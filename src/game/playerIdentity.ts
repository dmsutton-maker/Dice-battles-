import AsyncStorage from '@react-native-async-storage/async-storage';
import { localPlayer } from './gameCenter';
import { makeFriendCode } from './friendCodes';
import { vaultGet, vaultSet } from './deviceVault';

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
 *
 * TWO PLACES TO KEEP IT, ADDED 7 SEP 2026. The friend code, the local id
 * and the secret are written to BOTH the ordinary store and the keychain
 * (see deviceVault.ts), and read back from the keychain first. iOS
 * deletes the app's own folder when the app is deleted but leaves the
 * keychain alone, so this is what makes a reinstall keep your profile
 * instead of stranding it: the phone still holds the secret that proves
 * the profile is yours, so the friends you had are still your friends.
 *
 * It is a recovery, not a guarantee — Apple does not promise keychain
 * survival, so `recovered` says which happened and the Friends screen
 * tells the player the truth either way.
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
   * True when this launch found a secret in the keychain that the app's
   * own storage had lost — i.e. the game was reinstalled and the old
   * profile came back rather than being replaced by a stranger.
   *
   * Only ever true once per install, on the launch that healed it. The
   * Friends screen uses it to say what happened instead of leaving a
   * player to wonder why their code changed (it did not).
   */
  recovered: boolean;
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

  /*
    THE REINSTALL PATH.

    The keychain outlives the app's own folder, so after a reinstall the
    three lines above come back empty while these three do not. Reading
    the vault SECOND and only filling gaps is deliberate: the ordinary
    store is the faster and more certain of the two, so it wins whenever
    it has an answer, and the keychain is consulted for what it lost.

    A player who has never reinstalled never notices any of this — the
    two agree, nothing is filled in, and `recovered` stays false.
  */
  const [vaultId, vaultCode, vaultSecret] = await Promise.all([
    storedId ? Promise.resolve(null) : vaultGet(ID_KEY),
    storedCode ? Promise.resolve(null) : vaultGet(CODE_KEY),
    storedSecret ? Promise.resolve(null) : vaultGet(SECRET_KEY),
  ]);

  /*
    The SECRET is what makes this a recovery rather than a coincidence.

    A friend code or a local id coming back alone would be cosmetic: the
    server would still refuse every write, because the secret is the only
    thing it checks. So this is the one that decides what to tell the
    player, and it is deliberately not "the vault had anything in it".
  */
  const recovered = storedSecret === null && vaultSecret !== null;

  /*
    The merged values go in NEW names, and the `stored*` ones keep
    meaning "what the ordinary store actually had".

    That distinction is the whole of it. The write-back further down
    only writes what has changed, by comparing against `stored*` — so
    merging into those variables made every recovered value compare
    equal to itself, skip its write, and never reach ordinary storage.
    The profile still worked, because the keychain was read again every
    launch, but the app said "welcome back" every single time and leant
    on the keychain for ever instead of healing itself once.
  */
  const knownId = storedId ?? vaultId;
  const knownCode = storedCode ?? vaultCode;
  const knownSecret = storedSecret ?? vaultSecret;

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
  const localId = knownId ?? makeLocalId();
  const playerId = apple?.playerId ?? localId;
  const name = apple?.name || storedName || ANONYMOUS_NAME;

  // The code belongs to the DEVICE and is kept across sign-in: a code
  // that changed when you signed into Game Center would break every
  // card a child had already written it on.
  const friendCode = knownCode ?? makeFriendCode();
  const secret = knownSecret ?? makeSecret();

  try {
    const writes: Promise<void>[] = [];
    if (storedId !== localId) writes.push(AsyncStorage.setItem(ID_KEY, localId));
    if (storedCode !== friendCode) writes.push(AsyncStorage.setItem(CODE_KEY, friendCode));
    /*
      The Apple alias is never written to the device's own name.

      It is read from `apple.name` every launch anyway (see above), so
      storing it changes nothing while signed in — and it is what made
      signing OUT of Game Center leave the local profile wearing the
      Apple alias for ever, with no way back to the name it had.
    */
    if (!apple && storedName !== name) writes.push(AsyncStorage.setItem(NAME_KEY, name));
    if (storedSecret !== secret) writes.push(AsyncStorage.setItem(SECRET_KEY, secret));
    await Promise.all(writes);
  } catch {
    // Not written this time; made again next launch. Nothing breaks.
  }

  /*
    And into the keychain, every launch, unconditionally.

    Not only on first run: an install that predates this code already
    has a secret in ordinary storage and nothing in the vault, and the
    whole point is that it is in the vault BEFORE the player deletes the
    game rather than after. Writing the same three values again is a few
    microseconds and it is what quietly upgrades every existing phone.

    Not awaited, and it cannot throw — see deviceVault.ts. The name is
    deliberately absent: it is Apple's alias while signed in and a
    default otherwise, so there is nothing there worth surviving, and
    the keychain is for the things that cannot be made again.
  */
  void vaultSet(ID_KEY, localId);
  void vaultSet(CODE_KEY, friendCode);
  void vaultSet(SECRET_KEY, secret);

  cached = { playerId, name, friendCode, secret, portable: apple !== null, recovered };
  return cached;
}

/** Test seam: forget what was read. */
export function resetIdentityForTest(): void {
  cached = null;
}
