import AsyncStorage from '@react-native-async-storage/async-storage';
import { localPlayer } from './gameCenter';
import { makeFriendCode } from './friendCodes';

/**
 * Who this player is — the ONE file that answers that.
 *
 * David chose "Game Center now, accounts later" on 3 Sep 2026. This is
 * the seam that makes "later" cheap: everything else in the game speaks
 * only of an opaque `playerId` and a `name`, so swapping the source for
 * a real signed-in account means rewriting this file and nothing else.
 *
 * TWO SOURCES, IN ORDER.
 *
 *   1. GAME CENTER, when it is there. Apple holds the identity, has the
 *      parent's consent, and moderates the alias — which is why this
 *      game can have friends at all without collecting anything or
 *      asking a child to invent a username.
 *   2. A LOCAL ID, when it is not. Android has no Game Center; nor does
 *      a simulator, a player signed out, or a binary older than the
 *      `getLocalPlayer` call. Those players still get a profile and a
 *      friend code, stored on the device. It is not portable to a new
 *      phone, and that is stated plainly on screen rather than hidden.
 *
 * NOTHING HERE IS PERSONAL DATA. A local id is random. A Game Center id
 * is Apple's opaque per-game identifier, not an Apple ID. Neither can be
 * turned back into a person by anyone holding it, including us.
 */

const ID_KEY = 'dice-battles/player-id';
const CODE_KEY = 'dice-battles/friend-code';
const NAME_KEY = 'dice-battles/player-name';
const SECRET_KEY = 'dice-battles/player-secret';

export interface Identity {
  playerId: string;
  name: string;
  friendCode: string;
  /** False when this identity lives only on this device. */
  portable: boolean;
  /**
   * A password the player never sees.
   *
   * Made once, kept on the device, sent with every write so the server
   * knows a request about this player really came from this phone. The
   * server keeps only its SHA-256, so a stolen database cannot be
   * replayed against it.
   *
   * NEVER shown on screen, never in a bug report, never logged. The
   * friend code is the thing to share; this is not.
   */
  secret: string;
}

let cached: Identity | null = null;

/** 128 bits of secret, as base36. Enough that guessing is hopeless. */
function makeSecret(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 26; i++) out += Math.floor(random() * 36).toString(36);
  return out;
}

/** A local id, distinguishable from a Game Center one at a glance. */
function makeLocalId(random: () => number = Math.random): string {
  let id = 'local-';
  for (let i = 0; i < 20; i++) {
    id += Math.floor(random() * 36).toString(36);
  }
  return id;
}

export function isLocalId(playerId: string): boolean {
  return playerId.startsWith('local-');
}

/**
 * The default name for a player Apple has not named.
 *
 * Deliberately not "Player 1" or a random word: the friend code is the
 * thing that identifies them, so the name only has to be harmless and
 * recognisable, and NOT a blank that a child would want to fill in with
 * free text this game has nowhere to moderate.
 */
export const ANONYMOUS_NAME = 'New Player';

/**
 * Read the identity, making one on first run.
 *
 * Never throws and never blocks on the network: a device with no storage
 * at all still gets a working identity for this session, because the
 * alternative is a friends screen that cannot draw.
 */
export async function loadIdentity(): Promise<Identity> {
  if (cached) return cached;

  let storedId: string | null = null;
  let storedCode: string | null = null;
  let storedName: string | null = null;
  let storedSecret: string | null = null;
  try {
    [storedId, storedCode, storedName, storedSecret] = await Promise.all([
      AsyncStorage.getItem(ID_KEY),
      AsyncStorage.getItem(CODE_KEY),
      AsyncStorage.getItem(NAME_KEY),
      AsyncStorage.getItem(SECRET_KEY),
    ]);
  } catch {
    // Unreadable storage. Fall through and make a fresh one for now.
  }

  const apple = await localPlayer();

  /*
    Game Center wins when it is available, even if a local id was made
    first: a player who opened the game on a plane and signed in later
    should become their real self rather than being stuck as a local
    stranger for ever. The local id is left in storage untouched, so
    signing out returns them to the profile they had.
  */
  /*
    The stored id is always the LOCAL one, made on first run and then
    left alone for ever. Game Center's id is never written: it comes
    from Apple every launch, and storing a copy would only create a
    second thing that could disagree with it.

    That is what makes signing out safe. A player who signs into Game
    Center becomes their Apple identity for as long as they are signed
    in, and drops back to the same local profile they had before —
    rather than to a new stranger — the moment they sign out.
  */
  const localId = storedId ?? makeLocalId();
  const playerId = apple?.playerId ?? localId;
  const name = apple?.name || storedName || ANONYMOUS_NAME;

  // The code belongs to the DEVICE and is kept across sign-in: a code
  // that changed when you signed into Game Center would break every
  // card a child had already written it on.
  const friendCode = storedCode ?? makeFriendCode();
  const secret = storedSecret ?? makeSecret();

  try {
    const writes: Promise<void>[] = [];
    if (storedId !== localId) writes.push(AsyncStorage.setItem(ID_KEY, localId));
    if (storedCode !== friendCode) writes.push(AsyncStorage.setItem(CODE_KEY, friendCode));
    if (storedName !== name) writes.push(AsyncStorage.setItem(NAME_KEY, name));
    if (storedSecret !== secret) writes.push(AsyncStorage.setItem(SECRET_KEY, secret));
    await Promise.all(writes);
  } catch {
    // Not written this time; made again next launch. Nothing breaks.
  }

  cached = { playerId, name, friendCode, secret, portable: apple !== null };
  return cached;
}

/** Test seam: forget what was read. */
export function resetIdentityForTest(): void {
  cached = null;
}
