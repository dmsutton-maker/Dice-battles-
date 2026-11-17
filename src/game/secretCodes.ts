/**
 * The secret codes in Settings, kept as HASHES.
 *
 * David, 1 Nov 2026: "Change all the secret codes to be set randomized 10
 * number and letter codes, with the codes for coins and trophies having
 * set amounts but there being multiple amounts so they'll have multiple
 * codes", and "For now just add ones for testing that set the counts to
 * a specific amount."
 *
 * Marc, 3 Nov 2026: "change every code to 14 characters, because its
 * much harder to crack". Every code was replaced, not lengthened: the
 * ten-character ones are dead. Fourteen characters from a 31-letter
 * alphabet (A-Z and 2-9 without 0/O and 1/I/L, which are easy to mix up
 * when read off a note) is about 2^69 guesses, against 2^52 for ten of
 * 36: some hundred thousand times longer to search.
 *
 * ── WHY HASHES ────────────────────────────────────────────────────────
 *
 * This repository is PUBLIC and the JavaScript bundle is readable by
 * anybody who unzips the app. The old codes were plain words in the
 * source (FAMILY, RESET, "500 COIN"), so anyone could type them. These
 * are fourteen random letters and digits, and only the SHA-256 of each is
 * written down here. The code box hashes what is typed and looks the
 * answer up; nothing in the app, or in git, can be read back into a code.
 *
 * A hash is not a lock a determined person cannot pick, and it is not
 * trying to be; fourteen characters makes the search far longer than
 * the ten it replaced (above). The aim is that a code cannot be read off the page,
 * which is all the old ones lacked. Nothing here protects money: the
 * codes only change what a family tester sees on their own phone.
 *
 * ── ADDING OR CHANGING A CODE ─────────────────────────────────────────
 *
 * Generate CODE_LENGTH random characters of CODE_ALPHABET OUTSIDE the repository,
 * keep them somewhere private, and add only `sha256(code)` to the table
 * below. Never paste the code itself into a file, a comment, a test or a
 * commit message: `tests/secretCodes.test.ts` scans `src/` and `tests/`
 * for any CODE_LENGTH-character run that hashes to a table entry, and fails if
 * it finds one.
 *
 * ── PURE JAVASCRIPT ON PURPOSE ────────────────────────────────────────
 *
 * Hermes has no `crypto.subtle`, and a native crypto module would need a
 * new build (AGENTS.md: nothing here may need one). So SHA-256 is written
 * out in plain JavaScript below, and the tests check it against the
 * published test vectors.
 */

/** How long every code is. Marc, 3 Nov 2026: fourteen, "much harder to crack". */
export const CODE_LENGTH = 14;

/** The letters codes are drawn from: no 0/O or 1/I/L, so a code read off a note is typed right. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

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
  { action: { kind: 'admin' }, sha256: 'fe11ff5602cdd2c147d4ec8858d498083250ce9aa613c3930ddd88b3f67ccb10' },
  { action: { kind: 'lock' }, sha256: '490334070a1b44606c6af34bfc35d72d3224fbb4aef54abd99bc4eab3ac564b8' },
  { action: { kind: 'reset' }, sha256: '9e49f1f2a2366e56751174398e657c954baea9095971c6e71758d1db4c41a01b' },

  { action: { kind: 'coins', amount: 0 }, sha256: '46fc6600f943a51cc410e8d07d5c48741d1b92f6def1d9d21267aa98473aadff' },
  { action: { kind: 'coins', amount: 500 }, sha256: '57e2fd897daad01cc9f562a0896b88f29541b43878d49f9b5ded407abef495ed' },
  { action: { kind: 'coins', amount: 1000 }, sha256: '888f7f6e7179e3e870639c5971891527ba8c1696afae2400bd862d5b860b7e3d' },
  { action: { kind: 'coins', amount: 5000 }, sha256: '30cd19ef1f9047646040f849700b5b2af1c5eab1494071ce3a9e05b712d2817c' },
  { action: { kind: 'coins', amount: 10000 }, sha256: '8fc041f6c75cdb8573a712274ae03b7961a2e40eb0abdd5863168aa1eacb1fe3' },
  { action: { kind: 'coins', amount: 50000 }, sha256: 'c53ed2b8cf7a1d244c1254e71d2e87b442f8f8dbbc9e98b8b6c910d7b9821233' },
  { action: { kind: 'coins', amount: 100000 }, sha256: '90d6491756625d6d906ae60761e783c54345fed553a3b2e683fb3ed64afd50c7' },

  { action: { kind: 'trophies', amount: 0 }, sha256: 'b2713e6be7eed841b1183e8d856e22505b49691b161e70b8c3c32c7193ec6c0d' },
  { action: { kind: 'trophies', amount: 100 }, sha256: 'd3a0e8e56771ab2edf9ac223107a62feaa78c4979b5e6ab6091daa9322633a56' },
  { action: { kind: 'trophies', amount: 250 }, sha256: 'fda6e415bd9788b3f3f45b3180f2db5ced7642961b6c70d7b31cce8cddb42eef' },
  { action: { kind: 'trophies', amount: 500 }, sha256: '228d49c0a2f6c22a67f648dc1434b065e4e0f1c355e3527176c91709610f8c9d' },
  { action: { kind: 'trophies', amount: 1000 }, sha256: '687a701c457256b46be7035159fd26538763de941a08018c98cb8092ce0db211' },
  { action: { kind: 'trophies', amount: 2000 }, sha256: '24f7041e5aeb8066b70bdc63434e3b217352804d35ae3ca2169a40c66eff5e10' },
  { action: { kind: 'trophies', amount: 5000 }, sha256: 'b942900cae68f2df47661350848fb9cb40f35eb26136729ed616e2b14bd22832' },
  { action: { kind: 'trophies', amount: 10000 }, sha256: '9f4c17c0cffa70957d49d67391acdc9a45dbac975ca69d4c06220d3890eb0dff' },
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
