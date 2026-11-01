/**
 * The secret codes in Settings, kept as HASHES.
 *
 * David, 1 Nov 2026: "Change all the secret codes to be set randomized 10
 * number and letter codes, with the codes for coins and trophies having
 * set amounts but there being multiple amounts so they'll have multiple
 * codes", and "For now just add ones for testing that set the counts to
 * a specific amount."
 *
 * ── WHY HASHES ────────────────────────────────────────────────────────
 *
 * This repository is PUBLIC and the JavaScript bundle is readable by
 * anybody who unzips the app. The old codes were plain words in the
 * source (FAMILY, RESET, "500 COIN"), so anyone could type them. These
 * are ten random letters and digits, and only the SHA-256 of each is
 * written down here. The code box hashes what is typed and looks the
 * answer up; nothing in the app, or in git, can be read back into a code.
 *
 * A hash is not a lock a determined person cannot pick (ten characters
 * of 36 is a big search, but not an impossible one for a GPU), and it is
 * not trying to be. The aim is that a code cannot be read off the page,
 * which is all the old ones lacked. Nothing here protects money: the
 * codes only change what a family tester sees on their own phone.
 *
 * ── ADDING OR CHANGING A CODE ─────────────────────────────────────────
 *
 * Generate ten random characters of A-Z and 0-9 OUTSIDE the repository,
 * keep them somewhere private, and add only `sha256(code)` to the table
 * below. Never paste the code itself into a file, a comment, a test or a
 * commit message: `tests/secretCodes.test.ts` scans `src/` and `tests/`
 * for any ten-character run that hashes to a table entry, and fails if
 * it finds one.
 *
 * ── PURE JAVASCRIPT ON PURPOSE ────────────────────────────────────────
 *
 * Hermes has no `crypto.subtle`, and a native crypto module would need a
 * new build (AGENTS.md: nothing here may need one). So SHA-256 is written
 * out in plain JavaScript below, and the tests check it against the
 * published test vectors.
 */

// ── SHA-256 ──────────────────────────────────────────────────────────

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/** Text as UTF-8 bytes, by hand: Hermes cannot be assumed to have TextEncoder. */
function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    // A surrogate pair is one character outside the basic plane.
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        i += 1;
      }
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

/** The SHA-256 of a string (as UTF-8), in lower-case hex. */
export function sha256Hex(text: string): string {
  const bytes = utf8Bytes(text);
  const bitLength = bytes.length * 8;

  // Padding: a 1 bit, zeros up to 56 mod 64, then the length as 64 bits.
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  for (const word of [high, low]) {
    bytes.push((word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff);
  }

  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const w = new Array<number>(64);

  for (let block = 0; block < bytes.length; block += 64) {
    for (let t = 0; t < 16; t++) {
      const i = block + t * 4;
      w[t] = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) | 0;
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + choose + K[t] + w[t]) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0;
    h[5] = (h[5] + f) | 0;
    h[6] = (h[6] + g) | 0;
    h[7] = (h[7] + hh) | 0;
  }

  return h.map((word) => (word >>> 0).toString(16).padStart(8, '0')).join('');
}

// ── The codes ────────────────────────────────────────────────────────

/** What a code does when it is typed into Settings. */
export type CodeAction =
  /** Tester (admin) mode on: unlocks everything, and every real-money purchase is free. */
  | { kind: 'admin' }
  /** Tester mode off again, to test real progression. */
  | { kind: 'lock' }
  /**
   * Empties the Store cupboard so the shelf can be walked through from
   * scratch. Coins are left alone: the point is to buy the things
   * again, not to be handed them.
   */
  | { kind: 'reset' }
  /**
   * SET the coin balance to exactly this. Sets rather than adds, so the
   * Store can be looked at from any budget, including a smaller one than
   * you had.
   */
  | { kind: 'coins'; amount: number }
  /**
   * SET the trophy count to exactly this, with the same unlock and
   * relock handling as ever: going up announces the rungs crossed,
   * going down relocks them.
   */
  | { kind: 'trophies'; amount: number };

interface CodeEntry {
  action: CodeAction;
  /** SHA-256 of the code after `normaliseCode`, lower-case hex. */
  sha256: string;
}

/**
 * Eighteen codes, none of them written down here. Several amounts each
 * for coins and trophies, as David asked, so a tester can stand at the
 * rung or the budget they want to look at.
 */
export const CODE_TABLE: readonly CodeEntry[] = [
  { action: { kind: 'admin' }, sha256: 'cf2e8a72d8a2929b3e54089067134d9d758d2befe06120c4153ef0c9a35a6762' },
  { action: { kind: 'lock' }, sha256: '2f828c9f2167c2d2dd43b3a4ce588ab40202750e7e57f1f0caf56fcb123b425f' },
  { action: { kind: 'reset' }, sha256: 'd8d753f3b4b4573f3480603752d21755679bc39b5f773288156b3b0c7accb8b0' },

  { action: { kind: 'coins', amount: 0 }, sha256: 'b53db0ec372086d90d3255f60f466e9c3cb57e63cad4c8db6f441f89b3106673' },
  { action: { kind: 'coins', amount: 500 }, sha256: '5010453f6bfcd5ccfc055cc663a6111c33bf1cba3a7a82c165219203d242c501' },
  { action: { kind: 'coins', amount: 1000 }, sha256: '81cc7dfd197c907811dfb21ce28ec0b604e1faf164eda8a532adaddb76d241d7' },
  { action: { kind: 'coins', amount: 5000 }, sha256: 'e729df66ee7835f1d1c5cffedfaf4262a661c38cd7e9d13e68cbd211fd748b38' },
  { action: { kind: 'coins', amount: 10000 }, sha256: '9844cb1a6feed6d70454bfa2001f5713233414f039c43f42143f1bfc64b0e003' },
  { action: { kind: 'coins', amount: 50000 }, sha256: 'af9bca7c9ee49ff03b73fbd7456b94194d6fe6300e5d79e6c21612eeacf96cf8' },
  { action: { kind: 'coins', amount: 100000 }, sha256: '99ff87d64b64f4820c0c9ccf706209e9d485f40c87bfa57763daa97ee7db0bbf' },

  { action: { kind: 'trophies', amount: 0 }, sha256: 'a9a8b04b6233597c4517b3b16f48c38200726e0b99f1c90c3c58e16c83e81e35' },
  { action: { kind: 'trophies', amount: 100 }, sha256: '1451f80808565a08916b6a602a2edb5f29a2c172ead38728198f83d77b1a501e' },
  { action: { kind: 'trophies', amount: 250 }, sha256: '4a4538d3211be0ca20aa3130d1116613fb1116c6f06689f144e02475327ce6aa' },
  { action: { kind: 'trophies', amount: 500 }, sha256: '8d2c8499a64e12863ab9be595b35d03e63c30f19b4abb5d995170fa2adb328ae' },
  { action: { kind: 'trophies', amount: 1000 }, sha256: '2f3f54bc6364ee838078dea70e5af2c663286bdbb15e99c31e1e413f66631460' },
  { action: { kind: 'trophies', amount: 2000 }, sha256: '214b4e4b903824353a22ae615928e265b58bcbabbb27537ae4962323a40aecbd' },
  { action: { kind: 'trophies', amount: 5000 }, sha256: 'db26865cff7151b942cf9e3f940cbd56261205d4134055858a0bd6a3eb199464' },
  { action: { kind: 'trophies', amount: 10000 }, sha256: '18bc666d4a97427f00bb8e5c64c67fe39dabac88642e68499953df946e81ab88' },
];

/**
 * What was typed, made comparable: trimmed, upper-cased, with spaces and
 * dashes dropped. A child (or a grown-up copying from a note) may type
 * "abcde-fghij" or "ABCDE FGHIJ", and the code box should not care.
 */
export function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, '');
}

/** The action for a hash, or null when no code has that hash. */
export function actionForHash(hash: string): CodeAction | null {
  const wanted = hash.toLowerCase();
  const entry = CODE_TABLE.find((e) => e.sha256 === wanted);
  return entry ? entry.action : null;
}

/** What a typed code does, or null when it is not a code at all. */
export function lookupCode(raw: string): CodeAction | null {
  const code = normaliseCode(raw);
  if (!code) return null;
  return actionForHash(sha256Hex(code));
}
