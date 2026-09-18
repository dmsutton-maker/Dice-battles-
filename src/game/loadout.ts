import AsyncStorage from '@react-native-async-storage/async-storage';
import { ARENAS, ArenaId } from '../arena/arenas';
import { THEMED_ARENA_META, ThemedArenaId } from '../arena/themeData';
import {
  DEFAULT_SKIN_ID,
  DiceSkin,
  DICE_SKINS,
  LADDER_SKINS,
  skinById,
  STORE_SKINS,
} from './diceSkins';
import { owns } from './currency';
import { hasUnlockAll, isUnlocked, TIERS, UnlockId } from './progress';

/**
 * What the player has EQUIPPED, as opposed to what they have earned
 * (src/game/progress.ts). Kept separate on purpose: trophies are the record
 * of what was won and must never be rewritten by a cosmetic choice.
 *
 * Every read is validated against the current unlocks, so a selection can
 * never leave the player in an item they no longer have — which is exactly
 * what happens when family tester mode is switched back off.
 */
export interface Loadout {
  arenaId: ArenaId;
  skinId: string;
}

/**
 * How each battlefield is OBTAINED — exactly one route each, the same
 * rule dice skins follow: a trophy tier on the ladder, or a coin price in
 * the Store. The themed arenas declare theirs in THEMED_ARENA_META so a
 * new theme cannot exist without deciding; the four originals stay on the
 * ladder they have always been on.
 */
export const ARENA_UNLOCKS: Partial<Record<ArenaId, UnlockId>> = {
  castle: 'castle',
  castleSunset: 'sunset-castle',
  jungle: 'jungle',
  space: 'space',
  ...Object.fromEntries(
    (Object.keys(THEMED_ARENA_META) as ThemedArenaId[])
      .filter((id) => THEMED_ARENA_META[id].tier !== undefined)
      .map((id) => [id, THEMED_ARENA_META[id].tier as UnlockId]),
  ),
};

/** Coin price for the battlefields sold in the Store. */
export const ARENA_PRICES: Partial<Record<ArenaId, number>> = Object.fromEntries(
  (Object.keys(THEMED_ARENA_META) as ThemedArenaId[])
    .filter((id) => THEMED_ARENA_META[id].price !== undefined)
    .map((id) => [id, THEMED_ARENA_META[id].price!]),
);

/**
 * The wallet key an arena purchase is stored under.
 *
 * Prefixed, because wallet.owned is one flat list shared with dice skins
 * and nothing stops a future skin and arena sharing a name — 'frost' was
 * a skin before it could ever be an arena, and a collision would sell two
 * things for one price.
 */
export function arenaKey(id: ArenaId): string {
  return `arena:${id}`;
}

/**
 * Display order in the Inventory: the trophy ladder first in climbing
 * order, then the Store shelf cheapest first — the same shape the dice
 * list has, so both halves of the cupboard read the same way.
 */
export const ARENA_ORDER: ArenaId[] = (() => {
  const all = Object.keys(ARENAS) as ArenaId[];
  const tierAt = (id: ArenaId) =>
    TIERS.find((t) => t.id === ARENA_UNLOCKS[id])?.at ?? 0;
  const ladder = all
    .filter((id) => ARENA_UNLOCKS[id] !== undefined)
    .sort((a, b) => tierAt(a) - tierAt(b));
  const store = all
    .filter((id) => ARENA_PRICES[id] !== undefined)
    .sort((a, b) => ARENA_PRICES[a]! - ARENA_PRICES[b]!);
  return [...ladder, ...store];
})();

/** The battlefields on the Store shelf, cheapest first. */
export const STORE_ARENAS: ArenaId[] = ARENA_ORDER.filter(
  (id) => ARENA_PRICES[id] !== undefined,
);

/** What a ladder skin costs in trophies. Store skins cost none. */
function trophyCost(skin: DiceSkin): number {
  return TIERS.find((t) => t.id === skin.unlock)?.at ?? 0;
}

/**
 * Display order for the dice in the Inventory: everything earned with
 * trophies first, cheapest first, then everything bought with coins, also
 * cheapest first.
 *
 * Sorted rather than hand-ordered because the raw DICE_SKINS list is
 * declaration order, and the Store prices were written out of sequence —
 * 250, 300, 450, 400, 350 — so the Inventory listed a 450 die above a 350
 * one. The Store already sorted its own shelf; the Inventory was reading
 * straight from the unsorted list.
 *
 * Trophy dice come first because they are the ones you cannot buy: the
 * ladder is the spine of the screen, and the shop is what hangs off it.
 */
export const INVENTORY_SKIN_ORDER: DiceSkin[] = [
  ...LADDER_SKINS.slice().sort((a, b) => trophyCost(a) - trophyCost(b)),
  ...STORE_SKINS,
];

const STORAGE_KEY = 'dice-battles:loadout';
const DEFAULT_LOADOUT: Loadout = { arenaId: 'castle', skinId: DEFAULT_SKIN_ID };

let current: Loadout = { ...DEFAULT_LOADOUT };

export function getLoadout(): Loadout {
  return current;
}

export async function loadLoadout(): Promise<Loadout> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      current = {
        arenaId: parsed.arenaId in ARENAS ? parsed.arenaId : DEFAULT_LOADOUT.arenaId,
        skinId: DICE_SKINS.some((s) => s.id === parsed.skinId)
          ? parsed.skinId
          : DEFAULT_LOADOUT.skinId,
      };
    }
  } catch {
    // Defaults are fine if storage is unavailable.
  }
  return current;
}

function persist(): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
}

export function equipArena(arenaId: ArenaId): Loadout {
  current = { ...current, arenaId };
  persist();
  return current;
}

export function equipSkin(skinId: string): Loadout {
  current = { ...current, skinId };
  persist();
  return current;
}

/**
 * A battlefield is available if it is earned on the ladder or bought in
 * the Store. Family tester mode opens both routes, exactly as it does for
 * dice — nothing is bought, it is simply usable while the mode is on.
 */
export function isArenaUnlocked(arenaId: ArenaId, trophies: number): boolean {
  const tier = ARENA_UNLOCKS[arenaId];
  if (tier !== undefined) return isUnlocked(tier, trophies);
  return hasUnlockAll() || owns(arenaKey(arenaId));
}

/**
 * A skin is available if it is free, earned on the ladder, or bought in
 * the Store. The two routes never overlap: a skin has an unlock tier or a
 * coin price, not both.
 *
 * Family tester mode covers BOTH routes. It used to open the ladder and
 * the arenas but stop at the Store, so a playtester still had to grind
 * coins for half the dice — which is the opposite of what the mode is
 * for. Nothing is bought: they are simply usable while it is on, and
 * still cost coins the moment it goes off.
 */
export function isSkinUnlocked(skinId: string, trophies: number): boolean {
  const skin = skinById(skinId);
  if (skin.price !== undefined) return hasUnlockAll() || owns(skin.id);
  if (skin.unlock === null || skin.unlock === undefined) return true;
  return isUnlocked(skin.unlock, trophies);
}

/**
 * The battlefield actually used for a battle: the equipped one if it is
 * still unlocked, otherwise the best one the player owns.
 */
export function activeArena(trophies: number): ArenaId {
  if (isArenaUnlocked(current.arenaId, trophies)) return current.arenaId;
  const owned = ARENA_ORDER.filter((id) => isArenaUnlocked(id, trophies));
  return owned[owned.length - 1] ?? 'castle';
}

/**
 * The dice skin actually used, with the same fallback rule as the arena.
 *
 * The whole skin, not just its colour: the board used to take the body
 * colour from here (which falls back) and the pattern straight from the
 * stored id (which does not), so a locked patterned die rendered as ivory
 * wearing zebra stripes. One resolved skin cannot disagree with itself.
 */
export function activeSkin(trophies: number): DiceSkin {
  return isSkinUnlocked(current.skinId, trophies)
    ? skinById(current.skinId)
    : skinById(DEFAULT_SKIN_ID);
}

/** The dice shell colour actually used, with the same fallback rule. */
export function activeDieBody(trophies: number): string {
  return activeSkin(trophies).body;
}
