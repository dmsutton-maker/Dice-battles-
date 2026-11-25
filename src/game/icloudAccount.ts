import AsyncStorage from '@react-native-async-storage/async-storage';
import { vaultSet } from './deviceVault';
import { loadCloudStore, type ICloudStore } from './cloudSaveSdk';
import type { Identity } from './playerIdentity';

/**
 * Carrying the player's account to a NEW iPhone, through their iCloud.
 *
 * David, 5 Nov 2026: "I want players to be able to save their progress
 * no matter what". Marc's server backup (cloudSave.ts, v1.162.0) already
 * brings everything back after a delete and reinstall on the SAME phone,
 * because the keychain keeps the account (player id and secret) and the
 * server keeps the progress under it. What it cannot do is follow a
 * player to a new iPhone: the keychain stays on the old phone, so the new
 * one starts a new account, and the server's copy sits under the old one.
 *
 * David chose to combine the two: this file keeps a copy of the account
 * in the player's iCloud (Apple's key-value store, never our servers).
 * On a new phone that has not been played yet, the game asks "Is this
 * you?"; the chosen account is put on the phone and the game restarts,
 * and Marc's restore then finds an empty phone with an account and
 * brings the progress back from the server, exactly as after a reinstall.
 *
 * WHY IT ASKS RATHER THAN JUST DOING IT. Families often share one Apple
 * ID across several children's phones, and the key-value store is per
 * Apple ID. Every phone that has played keeps its own entry here, and a
 * new phone could belong to any of those children, so the player picks
 * theirs by name and trophies, or says they are new.
 *
 * WHAT IS IN AN ENTRY: the player id, the device secret that proves the
 * account to our server, the friend code, and the name and trophies the
 * question shows. Nothing else; the progress itself is on the server.
 *
 * The usual rule for anything native: nothing here throws, rejects or
 * blocks. Build 18 and earlier have no iCloud module, so nothing happens
 * there and the game behaves exactly as before.
 */

export const ACCOUNT_PREFIX = 'dbacct.v1.';

/** How many players' accounts are kept per Apple ID. */
export const MAX_ACCOUNTS = 8;

/** The same stores playerIdentity.ts reads, in the same order. */
const ID_KEY = 'dice-battles/player-id';
const CODE_KEY = 'dice-battles/friend-code';
const NAME_KEY = 'dice-battles/player-name';
const SECRET_KEY = 'dice-battles/player-secret';

/** Set once the player has answered "Is this you?" on this install. */
const ANSWERED_KEY = 'dice-battles:icloud-account-answered';

export interface CarriedAccount {
  v: 1;
  playerId: string;
  secret: string;
  friendCode: string;
  name: string;
  trophies: number;
  /** Milliseconds since 1970: when this phone last wrote it. */
  savedAt: number;
}

function text(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, max) : null;
}

/** A stored entry, checked, or null for anything that is not one. */
export function parseAccount(raw: string | null | undefined): CarriedAccount | null {
  if (typeof raw !== 'string') return null;
  let value: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    value = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  if (value.v !== 1) return null;
  const playerId = text(value.playerId, 100);
  const secret = text(value.secret, 200);
  const friendCode = text(value.friendCode, 40);
  if (!playerId || !secret || !friendCode) return null;
  const savedAt = typeof value.savedAt === 'number' && Number.isFinite(value.savedAt) ? value.savedAt : 0;
  const trophies =
    typeof value.trophies === 'number' && Number.isFinite(value.trophies) && value.trophies > 0
      ? Math.floor(value.trophies)
      : 0;
  return { v: 1, playerId, secret, friendCode, name: text(value.name, 40) ?? 'Player', trophies, savedAt };
}

/** Every account in the store, most recently played first. */
export function listAccounts(entries: Record<string, string | null | undefined>): CarriedAccount[] {
  const accounts: CarriedAccount[] = [];
  for (const [key, raw] of Object.entries(entries)) {
    if (!key.startsWith(ACCOUNT_PREFIX)) continue;
    const account = parseAccount(raw);
    if (account && key === ACCOUNT_PREFIX + account.playerId) accounts.push(account);
  }
  return accounts.sort((a, b) => b.savedAt - a.savedAt);
}

/** Accounts to delete so no more than MAX_ACCOUNTS remain: oldest first, never this phone's. */
export function accountsToPrune(accounts: CarriedAccount[], ownId: string | null): string[] {
  const others = accounts.filter((a) => a.playerId !== ownId).sort((a, b) => b.savedAt - a.savedAt);
  const room = ownId ? MAX_ACCOUNTS - 1 : MAX_ACCOUNTS;
  return others.slice(Math.max(0, room)).map((a) => a.playerId);
}

/**
 * Accounts to offer this phone, or none.
 *
 * Only on a phone that has not been played (`fresh`, Marc's
 * isFreshSnapshot) and did not get its account back from the keychain
 * (`recovered`: that is the same phone after a reinstall, which Marc's
 * restore already handles), and only until the player has answered.
 */
export function accountsToOffer(
  accounts: CarriedAccount[],
  here: { playerId: string; recovered: boolean; fresh: boolean; answered: boolean },
): CarriedAccount[] {
  if (here.answered || here.recovered || !here.fresh) return [];
  return accounts.filter((a) => a.playerId !== here.playerId);
}

/** The entry this phone writes for its own account. */
export function accountEntry(me: Identity, trophies: number, now: number): CarriedAccount | null {
  const playerId = text(me.playerId, 100);
  const secret = text(me.secret, 200);
  const friendCode = text(me.friendCode, 40);
  if (!playerId || !secret || !friendCode) return null;
  return {
    v: 1,
    playerId,
    secret,
    friendCode,
    name: text(me.name, 40) ?? 'Player',
    trophies: Number.isFinite(trophies) && trophies > 0 ? Math.floor(trophies) : 0,
    savedAt: now,
  };
}

function readAccounts(store: ICloudStore): CarriedAccount[] {
  const entries: Record<string, string | null> = {};
  for (const key of store.keys()) {
    if (key.startsWith(ACCOUNT_PREFIX)) entries[key] = store.getString(key);
  }
  return listAccounts(entries);
}

/**
 * Keep this phone's account in iCloud. Only for a phone that has been
 * played (`fresh` false): a brand-new phone's empty account is not worth
 * offering anybody. True when it was written.
 */
export function rememberAccount(me: Identity | null, trophies: number, fresh: boolean, now: number = Date.now()): boolean {
  try {
    const store = loadCloudStore();
    if (!store || !me || fresh) return false;
    const entry = accountEntry(me, trophies, now);
    if (!entry) return false;
    if (!store.setString(ACCOUNT_PREFIX + entry.playerId, JSON.stringify(entry))) return false;
    for (const old of accountsToPrune(readAccounts(store), entry.playerId)) store.remove(ACCOUNT_PREFIX + old);
    return true;
  } catch {
    return false;
  }
}

/** The accounts "Is this you?" should show on this phone now, or none. */
export async function findAccountsToOffer(me: Identity | null, fresh: boolean): Promise<CarriedAccount[]> {
  try {
    const store = loadCloudStore();
    if (!store || !me) return [];
    const answered = (await AsyncStorage.getItem(ANSWERED_KEY)) !== null;
    if (answered) return [];
    store.synchronize();
    return accountsToOffer(readAccounts(store), {
      playerId: me.playerId,
      recovered: me.recovered === true,
      fresh,
      answered,
    });
  } catch {
    return [];
  }
}

/**
 * Looks at launch and again over the next minute, because iCloud can be
 * slow to reach a phone that has just installed the game. Stops once the
 * phone has been played (`isFresh` false). Calls `onOffer` at most once.
 */
export function watchForAccounts(
  me: Identity,
  isFresh: () => boolean,
  onOffer: (accounts: CarriedAccount[]) => void,
): () => void {
  const delays = [0, 2500, 8000, 20000, 45000];
  let stopped = false;
  const timers = delays.map((delay) =>
    setTimeout(() => {
      if (stopped || !isFresh()) return;
      void findAccountsToOffer(me, true).then((accounts) => {
        if (stopped || accounts.length === 0 || !isFresh()) return;
        stopped = true;
        timers.forEach(clearTimeout);
        onOffer(accounts);
      });
    }, delay),
  );
  return () => {
    stopped = true;
    timers.forEach(clearTimeout);
  };
}

/** "I'm a new player": not asked again on this install. */
export async function declineAccounts(): Promise<void> {
  try {
    await AsyncStorage.setItem(ANSWERED_KEY, '1');
  } catch {
    // Asked once more next launch, at worst.
  }
}

/**
 * "That's me": put the account on this phone and restart the game, so
 * the identity is read afresh and Marc's restore brings the progress back
 * from the server. 'reloading', or 'restart' when the game could not
 * restart itself, or 'failed' when nothing was written.
 */
export async function adoptAccount(account: CarriedAccount): Promise<'reloading' | 'restart' | 'failed'> {
  try {
    await AsyncStorage.setItem(ID_KEY, account.playerId);
    await AsyncStorage.setItem(CODE_KEY, account.friendCode);
    await AsyncStorage.setItem(SECRET_KEY, account.secret);
    await AsyncStorage.setItem(NAME_KEY, account.name);
    await AsyncStorage.setItem(ANSWERED_KEY, '1');
    // The keychain copy follows, so a later reinstall on THIS phone keeps it.
    await vaultSet(ID_KEY, account.playerId);
    await vaultSet(CODE_KEY, account.friendCode);
    await vaultSet(SECRET_KEY, account.secret);
  } catch {
    return 'failed';
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { reloadAppAsync } = require('expo');
    await reloadAppAsync('Signed in to an account from iCloud');
    return 'reloading';
  } catch {
    return 'restart';
  }
}
