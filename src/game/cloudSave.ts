import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAudioSettings,
  normalizeAudioSettings,
  setAudioVolume,
  type AudioLevelKey,
  type AudioSettings,
} from '../audio/settings';
import { isColorblindMode, setColorblindMode } from './colorblind';
import { getWallet, restoreWallet, type Wallet } from './currency';
import { DICE_SKINS } from './diceSkins';
import { pushProfile } from './friendsApi';
import {
  ARENA_ORDER,
  getLoadout,
  isArenaUnlocked,
  isSkinUnlocked,
  restoreLoadout,
  type Loadout,
} from './loadout';
import type { Identity } from './playerIdentity';
import { getProgress, restoreProgress, type Progress } from './progress';
import { onSaveChanged } from './saveChanges';
import { hasSeenTutorial, markTutorialSeen } from './tutorial';
import { GAME_VERSION } from './version';

/**
 * A backup of the player's progress on the server, so a reinstall keeps
 * everything.
 *
 * Marc, 5 Nov 2026: "When I delete the game and redownload it, it
 * completely resets my account, friends, friend code, trophies, coins,
 * and everything."
 *
 * The friends and the friend code were meant to survive already: the
 * device secret is kept in the keychain (deviceVault.ts), which iOS
 * leaves alone when the app is deleted, and the friends live on the
 * server under that identity. (They did not survive, for a reason
 * found the same day: see KEYCHAIN_KEY in deviceVault.ts.) EVERYTHING
 * ELSE — trophies, the record, the wallet, what is equipped, the quest,
 * the season's experience, the three settings — was in the app's own
 * storage, which goes with the app.
 *
 * So the game now keeps a SNAPSHOT of all of that on the server too,
 * under the device's own player id and proved by its secret, exactly as
 * the profile and the friends are (hq/src/app/api/players/save). It is
 * uploaded a little after anything in it changes and when the app goes
 * to the background; and on a launch that found the keychain had the
 * secret but ordinary storage had nothing — the reinstall — it is
 * fetched and put back before the home screen reads any of it.
 *
 * WHAT IS NOT IN IT. Purchases: what was bought is Apple's to restore,
 * and purchases.ts asks Apple. The identity: that is the keychain's.
 * Friends: on the server already. The cup list and the news: fetched
 * anyway.
 *
 * THE ONE RULE ABOUT WHICH COPY WINS (newerSnapshot). The server's copy
 * replaces a local state that is EMPTY — a fresh install — and nothing
 * else on its own. It is never quietly written over progress that has
 * been played since: the server's copy is by construction older than
 * whatever this phone has done, and a backup that could take a battle
 * away would be worse than none. Once restored, the local copy is the
 * truth again and the server simply follows it.
 *
 * NOTHING HERE MAY THROW, REJECT OR BLOCK. Offline means try later; a
 * server that will not answer in RESTORE_WAIT_MS means the loading
 * screen gives up and the restore is tried again next launch.
 */

/** The shape of a snapshot. Bump when a field changes meaning. */
export const SNAPSHOT_VERSION = 1;

/**
 * The most a snapshot may be, in bytes of JSON, and the same number the
 * server refuses above (hq/src/lib/playerSave.ts). A real one is a few
 * kilobytes; past this something is wrong, and it is not sent.
 */
export const SNAPSHOT_MAX_BYTES = 64 * 1024;

/** How long after the last change the upload goes. */
export const UPLOAD_DEBOUNCE_MS = 10_000;

/** How long the loading screen waits for the server's copy. */
export const RESTORE_WAIT_MS = 3_000;

/** The upload's own patience, well past the loading screen's. */
const UPLOAD_TIMEOUT_MS = 8_000;

const BASE = 'https://dice-battles-hq.vercel.app/api';

/**
 * Set on the launch that found the keychain's secret with nothing in
 * ordinary storage, and cleared once the server has been asked and
 * answered: a reinstall with no connection is tried again next launch.
 */
const RESTORE_PENDING_KEY = 'dice-battles:cloud-restore-pending';

export interface Snapshot {
  v: number;
  /** Epoch millis on the phone that collected it. */
  savedAt: number;
  progress: Progress;
  wallet: Wallet;
  loadout: Loadout;
  colorblind: boolean;
  audio: AudioSettings;
  tutorialSeen: boolean;
}

/** Everything the player would miss, as it stands right now. */
export function collectSnapshot(now: number = Date.now()): Snapshot {
  return {
    v: SNAPSHOT_VERSION,
    savedAt: now,
    progress: getProgress(),
    wallet: getWallet(),
    loadout: getLoadout(),
    colorblind: isColorblindMode(),
    audio: getAudioSettings(),
    tutorialSeen: hasSeenTutorial(),
  };
}

/** Whether something from the network or storage is a snapshot at all. */
export function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.v === 'number' &&
    typeof s.savedAt === 'number' &&
    !!s.progress &&
    typeof s.progress === 'object' &&
    !!s.wallet &&
    typeof s.wallet === 'object'
  );
}

/** UTF-8 bytes of a string, by hand: Hermes has no Buffer. */
export function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      // A surrogate pair is one four-byte character.
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/** How big the JSON that would be sent is. */
export function snapshotBytes(snapshot: Snapshot): number {
  return utf8Bytes(JSON.stringify(snapshot));
}

const total = (counts: Record<string, number> | undefined): number =>
  Object.values(counts ?? {}).reduce((n, v) => n + (Number.isFinite(v) ? v : 0), 0);

/**
 * A snapshot with nothing in it worth keeping: a fresh install.
 *
 * No trophies, no coins, nothing owned, no battle played or won, no
 * season experience. The tutorial is deliberately not counted: it opens
 * itself on a first launch, so "seen" says only that the game was
 * opened once, and a restore refused because the player closed the
 * how-to card would be refused in exactly the case it is for — a
 * reinstall whose first launch had no connection.
 */
export function isFreshSnapshot(s: Snapshot): boolean {
  const p = s.progress ?? ({} as Progress);
  const w = s.wallet ?? ({} as Wallet);
  return (
    !(p.trophies > 0) &&
    total(p.wins) === 0 &&
    total(p.played) === 0 &&
    !((p.season?.xp ?? 0) > 0) &&
    !(w.coins > 0) &&
    !(Array.isArray(w.owned) && w.owned.length > 0)
  );
}

export type SnapshotChoice =
  /** Keep what this phone has. */
  | 'local'
  /** Put the server's copy in: this phone has nothing to lose. */
  | 'remote'
  /** Both have progress. Only the player may decide; never silently. */
  | 'ask';

/**
 * Which copy wins. The server's only ever replaces an EMPTY local state
 * on its own; two copies with progress in both is the player's call,
 * and a server copy with nothing in it is not worth the write.
 */
export function newerSnapshot(local: Snapshot | null, remote: Snapshot | null): SnapshotChoice {
  if (!remote || !isSnapshot(remote) || isFreshSnapshot(remote)) return 'local';
  if (!local || isFreshSnapshot(local)) return 'remote';
  return 'ask';
}

/**
 * Write a snapshot back, through each module's own restore — never a
 * raw storage key, so every field is read exactly as a save of that
 * module would be. Returns whether the progress and wallet went in;
 * the settings are best-effort behind them.
 */
export function applySnapshot(snapshot: Snapshot): boolean {
  if (!isSnapshot(snapshot)) return false;
  try {
    const progress = restoreProgress(snapshot.progress);
    const wallet = restoreWallet(snapshot.wallet);
    restoreLoadout(snapshot.loadout);
    setColorblindMode(snapshot.colorblind === true);
    const audio = normalizeAudioSettings(snapshot.audio);
    for (const key of Object.keys(audio) as AudioLevelKey[]) setAudioVolume(key, audio[key]);
    if (snapshot.tutorialSeen === true) markTutorialSeen();
    return progress && wallet;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* The server.                                                         */

type Call<T> = { ok: true; data: T } | { ok: false; status?: number };

/** One call, with a deadline. Never throws. */
async function call<T>(body: Record<string, unknown>, timeoutMs: number): Promise<Call<T>> {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const response = await fetch(`${BASE}/players/save`, {
      method: 'POST',
      signal: controller?.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as T;
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, data };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

/** What the profile needs if the server has never met this phone. */
function profileStats() {
  const progress = getProgress();
  const loadout = getLoadout();
  return {
    trophies: progress.trophies,
    wins: progress.wins,
    modeWins: progress.modeWins,
    diceOwned: DICE_SKINS.filter((s) => isSkinUnlocked(s.id, progress.trophies)).length,
    arenasOwned: ARENA_ORDER.filter((id) => isArenaUnlocked(id, progress.trophies)).length,
    favouriteDie: loadout.skinId,
    favouriteArena: loadout.arenaId,
  };
}

/**
 * Send the snapshot up. A server that does not know this phone yet
 * (401: the profile is only made when Friends is opened or an online
 * battle is looked for) is sent the profile once and asked again, the
 * way matchmaking does.
 */
export async function uploadSnapshot(me: Identity, snapshot: Snapshot = collectSnapshot()): Promise<boolean> {
  if (snapshotBytes(snapshot) > SNAPSHOT_MAX_BYTES) return false;
  const body = {
    playerId: me.playerId,
    secret: me.secret,
    action: 'save',
    snapshot,
    gameVersion: GAME_VERSION,
  };
  let result = await call<{ ok: boolean }>(body, UPLOAD_TIMEOUT_MS);
  if (!result.ok && result.status === 401) {
    await pushProfile(me, profileStats());
    result = await call<{ ok: boolean }>(body, UPLOAD_TIMEOUT_MS);
  }
  return result.ok;
}

export type Fetched =
  | { ok: true; snapshot: Snapshot | null }
  /** No answer in time, or no connection: nothing is known. */
  | { ok: false };

/** The server's copy, null when it has none, or no answer at all. */
export async function fetchSnapshot(me: Identity, timeoutMs: number = RESTORE_WAIT_MS): Promise<Fetched> {
  const result = await call<{ snapshot: unknown }>(
    { playerId: me.playerId, secret: me.secret, action: 'load' },
    timeoutMs,
  );
  // An unknown phone has no save; that is an answer, not a failure.
  if (!result.ok) return result.status === 401 ? { ok: true, snapshot: null } : { ok: false };
  const snapshot = result.data?.snapshot;
  return { ok: true, snapshot: isSnapshot(snapshot) ? snapshot : null };
}

/* ------------------------------------------------------------------ */
/* Uploading, a little after anything changes.                         */

let me: Identity | null = null;
let dirty = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<boolean> | null = null;
let stopListening: (() => void) | null = null;

function upload(): Promise<boolean> {
  if (inFlight) return inFlight;
  if (!me || !dirty) return Promise.resolve(false);
  dirty = false;
  const who = me;
  inFlight = uploadSnapshot(who)
    .then((sent) => {
      // Not sent: keep it to try again after the next change or the
      // next background. Sent, but changed meanwhile: go again.
      if (!sent) dirty = true;
      else if (dirty) schedule();
      return sent;
    })
    .catch(() => {
      dirty = true;
      return false;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void upload();
  }, UPLOAD_DEBOUNCE_MS);
}

/**
 * Follow every change to the backed-up modules for this player, and
 * upload UPLOAD_DEBOUNCE_MS after the last one. Returns the stop.
 */
export function watchCloudSave(identity: Identity): () => void {
  stopListening?.();
  me = identity;
  stopListening = onSaveChanged(() => {
    dirty = true;
    schedule();
  });
  if (dirty) schedule();
  return () => {
    stopListening?.();
    stopListening = null;
  };
}

/** Whether a change is waiting to go up. */
export function uploadPending(): boolean {
  return dirty;
}

/**
 * Send what is waiting NOW — the app is going to the background, and a
 * phone in a pocket may be closed before the timer fires. Resolves to
 * whether anything was sent; never rejects.
 */
export function flushCloudSave(): Promise<boolean> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  return upload();
}

/* ------------------------------------------------------------------ */
/* Restoring, on launch.                                               */

export type RestoreOutcome =
  /** The server's copy is in. Tell the player. */
  | 'restored'
  /** Nothing to do: no reinstall, or the server had nothing. */
  | 'nothing'
  /** No answer in time. Tried again next launch. */
  | 'later'
  /** Both copies had progress; this phone's stands. */
  | 'kept';

async function readPending(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(RESTORE_PENDING_KEY)) === 'true';
  } catch {
    return false;
  }
}

async function writePending(on: boolean): Promise<void> {
  try {
    if (on) await AsyncStorage.setItem(RESTORE_PENDING_KEY, 'true');
    else await AsyncStorage.removeItem(RESTORE_PENDING_KEY);
  } catch {
    // Tried again next launch either way.
  }
}

/**
 * The reinstall: fetch the server's copy and put it in before the home
 * screen reads anything, when this launch recovered the identity from
 * the keychain, when an earlier launch did and could not reach the
 * server, or when this phone is simply empty and the server might not
 * be. Waits at most `waitMs` in all — the identity included, because
 * loadIdentity waits for Game Center, and on a first launch that can be
 * Apple's sign-in sheet with nobody in a hurry to answer it.
 */
export async function restoreOnLaunch(
  identity: Identity | Promise<Identity>,
  waitMs: number = RESTORE_WAIT_MS,
): Promise<RestoreOutcome> {
  const deadline = Date.now() + waitMs;
  let clock: ReturnType<typeof setTimeout> | null = null;
  try {
    const me = await Promise.race([
      identity,
      new Promise<null>((resolve) => {
        clock = setTimeout(() => resolve(null), waitMs);
      }),
    ]);
    if (!me) return 'later';

    const local = collectSnapshot();
    const fresh = isFreshSnapshot(local);
    const pending = await readPending();
    if (!me.recovered && !pending && !fresh) return 'nothing';
    if (me.recovered && !pending) await writePending(true);

    const fetched = await fetchSnapshot(me, Math.max(1, deadline - Date.now()));
    if (!fetched.ok) return 'later';

    const choice = newerSnapshot(local, fetched.snapshot);
    await writePending(false);
    if (choice !== 'remote' || !fetched.snapshot) return choice === 'ask' ? 'kept' : 'nothing';
    const applied = applySnapshot(fetched.snapshot);
    // The restore's own writes are not a change worth sending back.
    dirty = false;
    return applied ? 'restored' : 'nothing';
  } catch {
    return 'later';
  } finally {
    if (clock) clearTimeout(clock);
  }
}

/** Test seam: forget the player, the timer and anything waiting. */
export function resetCloudSaveForTests(): void {
  stopListening?.();
  stopListening = null;
  me = null;
  dirty = false;
  if (timer) clearTimeout(timer);
  timer = null;
  inFlight = null;
}
