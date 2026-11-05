/**
 * iCloud saves: the rules, with nothing native in them.
 *
 * David, 5 Nov 2026: "I want players to be able to save their progress
 * no matter what", chosen over Game Center saved games and over our own
 * servers, and wanted BEFORE launch. He had just bought a coin pouch in
 * TestFlight, spent it on dice, deleted the game, reinstalled it, and
 * found everything gone: coins and everything bought with them live only
 * on the phone, and Apple never restores consumables.
 *
 * WHAT A SAVE IS. A copy of the game's own stores (AsyncStorage values,
 * as the strings they already are), written to the player's iCloud
 * key-value store by `cloudSave.ts`. Restoring writes them back and
 * reloads the app, so every module reads its own data the ordinary way —
 * nothing here has to know how progress, the wallet or the season pass
 * are shaped beyond the three numbers shown on the "Welcome back" card.
 *
 * WHAT IS LEFT OUT, on purpose:
 *   - Anything bought with real money (entitlements, Gold Pass months,
 *     handled transactions). Apple's Restore Purchases is the truth for
 *     those, and a copy here could outlive a refund.
 *   - Caches that rebuild themselves (news, cups list, dice pictures).
 *
 * ONE SAVE PER PHONE ("slot"). Families often share one Apple ID across
 * several children's devices, and the key-value store is per Apple ID.
 * If every phone wrote one shared save, the last child to play would
 * overwrite everybody else. So each install writes its own slot, a new
 * install never writes over an old slot, and the player picks theirs —
 * shown by name, trophies and coins — when there is more than one.
 *
 * Pure functions only: tests/cloudSave.test.ts runs these in node.
 */

/** The stores a save copies. Order is the order they are written back. */
export const BACKED_UP_KEYS = [
  'dice-battles:progress', // trophies, wins, unlocks, cups, season pass, quests
  'dice-battles:wallet', // coins, and dice/battlefields bought with coins
  'dice-battles:loadout', // the chosen die and battlefield
  'dice-battles:tutorial-seen',
  'dice-battles:colorblind',
  'dice-battles:audio-settings',
  'dice-battles:installed-at', // keeps the starter-pack window from reopening
  'dice-battles/games-finished', // the ad rhythm
  'dice-battles/review-asked-at',
  'dice-battles:pending-match', // an online battle left mid-game still counts
  // The Friends profile, so friends follow the player to a new phone.
  'dice-battles/player-id',
  'dice-battles/player-secret',
  'dice-battles/player-name',
  'dice-battles/friend-code',
] as const;

/**
 * Dropped first if a save would be too big. None of these is progress the
 * player earned; losing one costs a setting, not a trophy.
 */
const OPTIONAL_KEYS: readonly string[] = [
  'dice-battles:pending-match',
  'dice-battles:audio-settings',
  'dice-battles:colorblind',
  'dice-battles/review-asked-at',
  'dice-battles/games-finished',
];

/** Every save's key in the store begins with this. */
export const SAVE_PREFIX = 'dbsave.v1.';

/**
 * How many phones' saves are kept per Apple ID. Apple allows 1 MB in all;
 * six of the largest allowed save still fit with room to spare.
 */
export const MAX_SLOTS = 6;

/** The largest single save written, in characters. */
export const MAX_SAVE_CHARS = 150_000;

/**
 * Below this many games played, an install still counts as new and is
 * offered an iCloud save. Three, not zero, so playing the first battle
 * before the save has arrived from iCloud does not lose the offer.
 */
export const FRESH_PLAYED_LIMIT = 3;

export interface CloudSave {
  v: 1;
  /** Which phone wrote it. */
  slot: string;
  /** Milliseconds since 1970. */
  savedAt: number;
  /** What the card shows, so a player can tell their save from a sibling's. */
  name: string;
  trophies: number;
  coins: number;
  played: number;
  gameVersion: string;
  /** The stores themselves, key to stored string. */
  data: Record<string, string>;
}

function parseObject(raw: string | null | undefined): Record<string, unknown> | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Games played, summed over the difficulties, from the stored progress. */
export function playedIn(progressRaw: string | null | undefined): number {
  const played = parseObject(progressRaw)?.played;
  if (played === null || typeof played !== 'object' || Array.isArray(played)) return 0;
  return Object.values(played as Record<string, unknown>).reduce<number>((sum, n) => sum + count(n), 0);
}

/** The three numbers on the card, read from a save's data. */
export function summarize(data: Record<string, string>): {
  trophies: number;
  coins: number;
  played: number;
} {
  const progress = parseObject(data['dice-battles:progress']);
  const wallet = parseObject(data['dice-battles:wallet']);
  return {
    trophies: count(progress?.trophies),
    coins: count(wallet?.coins),
    played: playedIn(data['dice-battles:progress']),
  };
}

/**
 * The save to write for this phone, or null when there is nothing worth
 * keeping yet — an install that has not finished a game makes no slot.
 */
export function buildSave(
  slot: string,
  stored: Record<string, string | null | undefined>,
  now: number,
  gameVersion: string,
  name: string | null | undefined,
): CloudSave | null {
  const data: Record<string, string> = {};
  for (const key of BACKED_UP_KEYS) {
    const value = stored[key];
    if (typeof value === 'string') data[key] = value;
  }
  const summary = summarize(data);
  if (summary.played === 0) return null;
  const cleanName = typeof name === 'string' ? name.trim().slice(0, 40) : '';
  return {
    v: 1,
    slot,
    savedAt: now,
    name: cleanName || 'Player',
    ...summary,
    gameVersion,
    data,
  };
}

/**
 * The save as the string to store, dropping optional stores if it is too
 * big, or null if it is still too big without them.
 */
export function encodeSave(save: CloudSave): string | null {
  let text = JSON.stringify(save);
  if (text.length <= MAX_SAVE_CHARS) return text;
  const data = { ...save.data };
  for (const key of OPTIONAL_KEYS) {
    delete data[key];
    text = JSON.stringify({ ...save, data });
    if (text.length <= MAX_SAVE_CHARS) return text;
  }
  return null;
}

/** A stored save, checked, or null for anything that is not one. */
export function parseSave(raw: string | null | undefined): CloudSave | null {
  const value = parseObject(raw);
  if (!value || value.v !== 1) return null;
  if (typeof value.slot !== 'string' || value.slot.length === 0) return null;
  if (typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt)) return null;
  const rawData = value.data;
  if (rawData === null || typeof rawData !== 'object' || Array.isArray(rawData)) return null;
  const data: Record<string, string> = {};
  const known: readonly string[] = BACKED_UP_KEYS;
  for (const [key, v] of Object.entries(rawData as Record<string, unknown>)) {
    if (known.includes(key) && typeof v === 'string') data[key] = v;
  }
  // Progress is the one store a save cannot do without.
  if (!data['dice-battles:progress']) return null;
  const summary = summarize(data);
  return {
    v: 1,
    slot: value.slot,
    savedAt: value.savedAt,
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 40) : 'Player',
    ...summary,
    gameVersion: typeof value.gameVersion === 'string' ? value.gameVersion : '',
    data,
  };
}

/** Every save in the store, newest first. */
export function listSaves(entries: Record<string, string | null | undefined>): CloudSave[] {
  const saves: CloudSave[] = [];
  for (const [key, raw] of Object.entries(entries)) {
    if (!key.startsWith(SAVE_PREFIX)) continue;
    const save = parseSave(raw);
    if (save && key === SAVE_PREFIX + save.slot) saves.push(save);
  }
  return saves.sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * Slots to delete so no more than MAX_SLOTS remain: the oldest first,
 * never this phone's own.
 */
export function slotsToPrune(saves: CloudSave[], ownSlot: string | null): string[] {
  const others = saves.filter((s) => s.slot !== ownSlot).sort((a, b) => b.savedAt - a.savedAt);
  const room = ownSlot ? MAX_SLOTS - 1 : MAX_SLOTS;
  return others.slice(Math.max(0, room)).map((s) => s.slot);
}

/**
 * The saves to offer a new install, best first — or none.
 *
 * Only while this install is still new (fewer than FRESH_PLAYED_LIMIT
 * games) and the player has not already answered, and only saves that
 * hold more than this phone does. Never this phone's own slot.
 */
export function savesToOffer(
  saves: CloudSave[],
  local: { played: number; slot: string | null; answered: boolean },
): CloudSave[] {
  if (local.answered || local.played >= FRESH_PLAYED_LIMIT) return [];
  return saves.filter((s) => s.slot !== local.slot && s.played > local.played);
}

/** What restoring a save writes to the phone, and what it clears. */
export function restoreWrites(save: CloudSave): { set: [string, string][]; remove: string[] } {
  const set: [string, string][] = [];
  const remove: string[] = [];
  for (const key of BACKED_UP_KEYS) {
    const value = save.data[key];
    if (typeof value === 'string') set.push([key, value]);
    // Never clear the Friends profile: a save without one keeps this
    // phone's, rather than leaving the player with none.
    else if (!key.startsWith('dice-battles/player-') && key !== 'dice-battles/friend-code') {
      remove.push(key);
    }
  }
  return { set, remove };
}

/** A new slot name: short, random, and safe as part of a key. */
export function newSlotId(random: () => number = Math.random): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < 12; i++) id += alphabet[Math.floor(random() * alphabet.length) % alphabet.length];
  return id;
}

/** "today", "yesterday", or "4 Nov", for the card. */
export function savedWhen(savedAt: number, now: number): string {
  const day = (t: number) => {
    const d = new Date(t);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  if (day(savedAt) === day(now)) return 'today';
  if (day(savedAt) === day(now - 86_400_000)) return 'yesterday';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(savedAt);
  return `${d.getDate()} ${months[d.getMonth()]}`;
}
