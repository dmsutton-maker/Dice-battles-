/**
 * Friend codes — how one player finds another.
 *
 * WHY A CODE AND NOT APPLE'S FRIENDS LIST.
 *
 * Game Center knows who your friends are, and GameKit can read that list
 * with `GKLocalPlayer.loadFriends()`. The package this game uses,
 * `expo-game-center@1.0.1`, does NOT wrap it — checked, not assumed: its
 * whole surface is isGameCenterAvailable, authenticateLocalPlayer,
 * getLocalPlayer, getPlayerImage, submitScore, reportAchievement and the
 * three present* view controllers. Exposing loadFriends means writing
 * Swift and shipping a new binary, so until that happens finding a friend
 * is done by sharing a code.
 *
 * WHAT A CODE IS MADE OF, and why it is not your player id.
 *
 * A code is eight characters of Crockford base32 in two groups of four —
 * "K7M2-9XPQ". Three properties matter, in this order:
 *
 *   1. A CHILD CAN READ IT ALOUD. Crockford drops I, L, O and U, so
 *      there is no 1/I, no 0/O, and no accidental rude word. A five-year
 *      old reading a code to a cousin over the phone is a real use.
 *   2. IT IS RANDOM, not derived from the Game Center player id. A code
 *      derived from an id would let anyone holding one code work out
 *      another, and would mean you could never change it. This can be
 *      reissued; your identity cannot.
 *   3. IT IS BIG ENOUGH. 32^8 is about a thousand billion, so guessing
 *      one at random is hopeless even though the alphabet is small.
 */

/** Crockford base32: no I, L, O or U. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const CODE_LENGTH = 8;

/**
 * The letters people actually type instead of the right ones.
 *
 * Crockford's own rule, and the reason the alphabet drops these: someone
 * reading "K7M2" off a screen will type O for 0 and I or L for 1 without
 * noticing. Accepting those quietly is kinder than an error that blames
 * the person for a shape the font chose.
 */
const CONFUSABLE: Record<string, string> = {
  O: '0',
  I: '1',
  L: '1',
  U: 'V',
};

/**
 * A fresh code. `random` is injectable so the tests are not a coin toss.
 */
export function makeFriendCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const pick = Math.floor(random() * ALPHABET.length);
    // A random() that returns exactly 1 (or anything out of range) must
    // not produce undefined here.
    code += ALPHABET[Math.min(ALPHABET.length - 1, Math.max(0, pick))];
  }
  return code;
}

/**
 * What someone typed, turned into a code — or null if it cannot be one.
 *
 * Deliberately forgiving about everything that is not the code itself:
 * case, spaces, dashes, and the four confusable letters. Deliberately
 * strict about length, because a code that is one character short is a
 * typo and looking it up would either fail confusingly or, worse, find
 * somebody else.
 */
export function normaliseFriendCode(input: string): string | null {
  if (typeof input !== 'string') return null;
  const stripped = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (stripped.length !== CODE_LENGTH) return null;
  let out = '';
  for (const ch of stripped) {
    const fixed = CONFUSABLE[ch] ?? ch;
    if (!ALPHABET.includes(fixed)) return null;
    out += fixed;
  }
  return out;
}

/** "K7M29XPQ" -> "K7M2-9XPQ", for showing on screen. */
export function formatFriendCode(code: string): string {
  const clean = code.replace(/-/g, '');
  if (clean.length !== CODE_LENGTH) return code;
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
}
