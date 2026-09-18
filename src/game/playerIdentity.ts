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
 * THE ID IS THE DEVICE'S. THE NAME IS APPLE'S.
 *
 * A random local id, made on first run and kept for ever, is who the
 * server thinks you are. Game Center supplies the NAME and nothing else
 * — the alias a player chose, which Apple already moderates, which is
 * why this game can have friends without asking a child to invent a
 * username or collecting anything at all.
 *
 * Those two used to be the same thing, with Apple's id taking over the
 * moment it was available. See loadIdentity for what that did on
 * 10 Sep 2026 and why it cannot come back: the friend code is unique on
 * the server and belongs to the device, so an id that moves under it
 * strands the player with no profile and a friends screen that answers
 * "no such player".
 *
 * NOTHING HERE IS PERSONAL DATA. A local id is random, and a Game Center
 * alias is a nickname Apple moderates. Neither can be turned back into a
 * person by anyone holding it, including us.
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
  /**
   * True when Game Center answered and the name above is Apple's alias
   * rather than the anonymous default.
   *
   * It was called `portable` and meant "the id came from Apple", which
   * was read as "this profile follows you to a new phone". It never
   * did: the server authenticates with a device secret, so the same
   * Apple account on a second phone is refused whatever the id says.
   * The name is the honest thing it was actually telling you.
   */
  signedIn: boolean;
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
    THE PLAYER ID IS THE DEVICE'S, ALWAYS. Game Center supplies a NAME
    and nothing else.

    It used to be `apple?.playerId ?? localId`, on the reasoning that a
    player who signed in later "should become their real self". David
    found what that actually did, on 10 Sep 2026: a name showing as
    "New Player", and then "ask to be friends" answering "no such
    player".

    Here is the whole chain. The friend code belongs to the DEVICE and
    deliberately never changes, and on the server `friend_code` is
    UNIQUE. So the first launch where Game Center answers in time, the
    id flips from local to Apple's while the code stays — and pushing
    the profile tries to INSERT a second row carrying a friend code that
    the first row already holds. The insert fails on the unique index.
    The player now has no profile under the id they are using, so every
    friends call answers "no such player": no list, no requests, and no
    way to add anybody. The failure is silent because nothing read the
    result of the push.

    Nothing was gained for that. Keying on the Apple id was supposed to
    make a profile portable between phones, and it never could: the
    server authenticates with a DEVICE secret, so the same Apple account
    on a second phone is refused as "wrong secret" whatever the id says.
    A promise that never worked, in exchange for a breakage that always
    would.

    So the id is the local one, for ever, and it can never collide with
    itself. Signing in or out of Game Center changes the name on the
    profile and nothing else.
  */
  const localId = knownId ?? makeLocalId();
  const playerId = localId;
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

  cached = { playerId, name, friendCode, secret, signedIn: apple !== null, recovered };
  return cached;
}

/**
 * Ask Apple for the name again, and keep it if one has arrived.
 *
 * The other half of what David reported: every profile on the board was
 * called "New Player". Game Center's sign-in is not instant — on a cold
 * start it can be answering its system sheet while the game is already
 * drawing — so `loadIdentity` runs, finds nobody signed in, and caches
 * the anonymous name for the rest of the session. The name is then
 * PUBLISHED under that default, and stays wrong on everyone else's
 * friends list until something overwrites it.
 *
 * Cheap to call: `localPlayer` is a no-op once signed in, and this
 * returns the identity unchanged when nothing has changed, so a caller
 * can compare by reference to decide whether to publish again.
 *
 * Never throws, for the same reason nothing else here does.
 */
export async function refreshName(): Promise<Identity> {
  const me = cached ?? (await loadIdentity());
  const apple = await localPlayer();
  const name = apple?.name?.trim();
  if (!name || (name === me.name && me.signedIn)) return me;
  cached = { ...me, name, signedIn: true };
  return cached;
}

/**
 * Give up this device's friend code and take a fresh one.
 *
 * The one honest answer to the server saying "friend code taken" on a
 * FIRST publish. That means some other row already holds this code and
 * this phone cannot prove it owns it — which is a real, if rare, way to
 * arrive: a reinstall where the keychain returned the code but not the
 * secret, or a collision in the eight characters.
 *
 * Before this existed the game simply reported the failure and stopped,
 * leaving a player with no profile at all and nothing they could do
 * about it. A new code costs them the one they had written down; no
 * profile costs them the whole feature.
 *
 * The player id and the secret are deliberately untouched: the code is
 * the only thing that collided.
 */
export async function replaceFriendCode(): Promise<Identity> {
  const me = cached ?? (await loadIdentity());
  const friendCode = makeFriendCode();
  cached = { ...me, friendCode };
  try {
    await AsyncStorage.setItem(CODE_KEY, friendCode);
  } catch {
    // Made again next launch; the profile still works this session.
  }
  void vaultSet(CODE_KEY, friendCode);
  return cached;
}

/** Test seam: forget what was read. */
export function resetIdentityForTest(): void {
  cached = null;
}
