import AsyncStorage from '@react-native-async-storage/async-storage';
import { vaultSet } from './deviceVault';
import { loadCloudStore, type ICloudStore } from './cloudSaveSdk';
import {
  BACKED_UP_KEYS,
  SAVE_PREFIX,
  buildSave,
  encodeSave,
  listSaves,
  newSlotId,
  playedIn,
  restoreWrites,
  savesToOffer,
  slotsToPrune,
  type CloudSave,
} from './cloudSaveCore';
import { GAME_VERSION } from './version';

/**
 * iCloud saves: backing up, offering, restoring. The rules are in
 * cloudSaveCore.ts; this file is the part that touches the phone.
 *
 * The usual rule for anything native: nothing here may throw, reject or
 * block. A phone with no iCloud, a build without the module (build 18 and
 * earlier), or Android simply has no iCloud saves, and the game plays on
 * exactly as before.
 */

/** This install's slot: which save in iCloud is this phone's own. */
const SLOT_KEY = 'dice-battles:cloud-slot';
/** Set once the player has answered "restore or start new" on this install. */
const ANSWERED_KEY = 'dice-battles:cloud-offer-answered';

const IDENTITY_KEYS = ['dice-battles/player-id', 'dice-battles/player-secret', 'dice-battles/friend-code'];

let lastSavedAt: number | null = null;
let lastResult: 'never' | 'saved' | 'nothing-yet' | 'failed' = 'never';
let displayName: string | null = null;
let offerOpen = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function readSaves(store: ICloudStore): CloudSave[] {
  const entries: Record<string, string | null> = {};
  for (const key of store.keys()) {
    if (key.startsWith(SAVE_PREFIX)) entries[key] = store.getString(key);
  }
  return listSaves(entries);
}

/** The name the card shows: the player's Game Center name when known. */
export function setCloudSaveName(name: string | null | undefined): void {
  displayName = typeof name === 'string' && name.trim() ? name.trim() : null;
}

/**
 * Keeps backups from running while "Welcome back" is on screen, so a new
 * install does not start a save of its own before the player has chosen.
 */
export function setRestoreOfferOpen(open: boolean): void {
  offerOpen = open;
}

/** Back up in a moment: called after every game, so a burst saves once. */
export function backupSoon(delayMs = 1500): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void backupNow();
  }, delayMs);
}

/** Write this phone's save to iCloud now. True when it was written. */
export async function backupNow(now: number = Date.now()): Promise<boolean> {
  try {
    const store = loadCloudStore();
    if (!store || offerOpen) return false;
    const stored: Record<string, string | null> = {};
    for (const key of BACKED_UP_KEYS) stored[key] = await AsyncStorage.getItem(key);
    let slot = await AsyncStorage.getItem(SLOT_KEY);
    const save = buildSave(slot ?? 'new', stored, now, GAME_VERSION, displayName ?? stored['dice-battles/player-name']);
    if (!save) {
      lastResult = 'nothing-yet';
      return false;
    }
    if (!slot) {
      slot = newSlotId();
      await AsyncStorage.setItem(SLOT_KEY, slot);
    }
    save.slot = slot;
    const text = encodeSave(save);
    if (!text || !store.setString(SAVE_PREFIX + slot, text)) {
      lastResult = 'failed';
      return false;
    }
    for (const old of slotsToPrune(readSaves(store), slot)) store.remove(SAVE_PREFIX + old);
    lastSavedAt = now;
    lastResult = 'saved';
    return true;
  } catch {
    lastResult = 'failed';
    return false;
  }
}

/**
 * Saves a new install should be offered, best first, or none. Empty once
 * the player has answered, once they have played a few games here, and
 * on any phone without iCloud saves.
 */
export async function findRestoreOffer(): Promise<CloudSave[]> {
  try {
    const store = loadCloudStore();
    if (!store) return [];
    if (await AsyncStorage.getItem(ANSWERED_KEY)) return [];
    store.synchronize();
    const played = playedIn(await AsyncStorage.getItem('dice-battles:progress'));
    const slot = await AsyncStorage.getItem(SLOT_KEY);
    return savesToOffer(readSaves(store), { played, slot, answered: false });
  } catch {
    return [];
  }
}

/**
 * Looks for a save to offer at launch and again over the next minute,
 * because iCloud can take a little while to deliver one to a phone that
 * has just installed the game. Calls `onOffer` once, at most. Returns a
 * function that stops looking.
 */
export function watchForRestoreOffer(onOffer: (saves: CloudSave[]) => void): () => void {
  const delays = [0, 2500, 8000, 20000, 45000];
  let stopped = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  for (const delay of delays) {
    timers.push(
      setTimeout(() => {
        if (stopped) return;
        void findRestoreOffer().then((saves) => {
          if (stopped || saves.length === 0) return;
          stopped = true;
          timers.forEach(clearTimeout);
          onOffer(saves);
        });
      }, delay),
    );
  }
  return () => {
    stopped = true;
    timers.forEach(clearTimeout);
  };
}

/** Every save in iCloud except this phone's own, newest first. */
export async function otherCloudSaves(): Promise<CloudSave[]> {
  try {
    const store = loadCloudStore();
    if (!store) return [];
    store.synchronize();
    const slot = await AsyncStorage.getItem(SLOT_KEY);
    return readSaves(store).filter((s) => s.slot !== slot);
  } catch {
    return [];
  }
}

/** "Start a new game": not asked again on this install. */
export async function declineRestore(): Promise<void> {
  offerOpen = false;
  try {
    await AsyncStorage.setItem(ANSWERED_KEY, '1');
  } catch {
    // Asked once more next launch, at worst.
  }
}

/**
 * Put a save on this phone and restart the game on it.
 *
 * 'reloading' when the game is restarting itself; 'restart' when it could
 * not, and the player has to close and reopen it; 'failed' when nothing
 * was written.
 */
export async function restoreFromCloud(save: CloudSave): Promise<'reloading' | 'restart' | 'failed'> {
  try {
    const { set, remove } = restoreWrites(save);
    for (const [key, value] of set) await AsyncStorage.setItem(key, value);
    for (const key of remove) await AsyncStorage.removeItem(key);
    // Carry on writing to the save that was restored, not a new one.
    await AsyncStorage.setItem(SLOT_KEY, save.slot);
    await AsyncStorage.setItem(ANSWERED_KEY, '1');
    // The keychain copy of the Friends profile, which a reinstall reads
    // first (deviceVault.ts), follows the restored one.
    for (const [key, value] of set) {
      if (IDENTITY_KEYS.includes(key)) await vaultSet(key, value);
    }
  } catch {
    return 'failed';
  }
  offerOpen = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { reloadAppAsync } = require('expo');
    await reloadAppAsync('Restored a save from iCloud');
    return 'reloading';
  } catch {
    return 'restart';
  }
}

/** For the Settings row. */
export function cloudSaveStatus(): {
  available: boolean;
  signedIn: boolean;
  lastSavedAt: number | null;
  lastResult: typeof lastResult;
} {
  const store = loadCloudStore();
  let signedIn = false;
  try {
    signedIn = store ? store.isSignedIn() : false;
  } catch {
    signedIn = false;
  }
  return { available: store !== null, signedIn, lastSavedAt, lastResult };
}

/** Tests only. */
export function resetCloudSaveForTest(): void {
  lastSavedAt = null;
  lastResult = 'never';
  displayName = null;
  offerOpen = false;
  if (timer) clearTimeout(timer);
  timer = null;
}
