import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, suite, test } from './harness';
import {
  actionForHash,
  CODE_ALPHABET,
  CODE_LENGTH,
  CODE_TABLE,
  lookupCode,
  normaliseCode,
  sha256Hex,
} from '../src/game/secretCodes';

/**
 * David, 1 Nov 2026: "Change all the secret codes to be set randomized 10
 * number and letter codes, with the codes for coins and trophies having
 * set amounts but there being multiple amounts so they'll have multiple
 * codes", and "For now just add ones for testing that set the counts to
 * a specific amount." Marc, 3 Nov 2026: "change every code to 14
 * characters, because its much harder to crack" — every code was
 * replaced with a fourteen-character one, and the scan below looks for
 * runs of that length.
 *
 * The repository is public and the bundle is readable, so the codes are
 * kept ONLY as SHA-256 hashes (secretCodes.ts). That also means these
 * tests cannot type a real code: they check the hash function against
 * the published vectors, the shape of the table, that every old code is
 * dead, and — the one that matters most — that no code of CODE_LENGTH characters
 * has leaked into the source in plain text.
 */

suite('secret codes · SHA-256 matches the published test vectors', () => {
  test('the empty string', () => {
    assertEqual(
      sha256Hex(''),
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'sha256("")',
    );
  });

  test('"abc"', () => {
    assertEqual(
      sha256Hex('abc'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      'sha256("abc")',
    );
  });

  test('the 448-bit vector, which needs a second block for the padding', () => {
    assertEqual(
      sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
      'sha256 of the 56-byte message',
    );
  });

  test('the 896-bit vector and a long input', () => {
    assertEqual(
      sha256Hex(
        'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu',
      ),
      'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1',
      'sha256 of the 112-byte message',
    );
    assertEqual(
      sha256Hex('a'.repeat(1000)),
      '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3',
      'sha256 of a thousand a',
    );
  });

  test('text outside ASCII is hashed as UTF-8', () => {
    // Values from Node's own crypto, for two-byte and four-byte characters.
    assertEqual(
      sha256Hex('h\u00e9llo'),
      '3c48591d8d098a4538f5e013dfcf406e948eac4d3277b10bf614e295d6068179',
      'two-byte character',
    );
    assertEqual(
      sha256Hex('\u{1F600}'),
      'f0443a342c5ef54783a111b51ba56c938e474c32324d90c3a60c9c8e3a37e2d9',
      'four-byte character (a surrogate pair)',
    );
  });
});

suite('secret codes · the table', () => {
  const KINDS = { admin: 1, lock: 1, reset: 1, coins: 7, trophies: 8 } as const;

  test('eighteen entries, every hash distinct and well formed', () => {
    assertEqual(CODE_TABLE.length, 18, 'number of codes');
    const hashes = CODE_TABLE.map((e) => e.sha256);
    assertEqual(new Set(hashes).size, 18, 'distinct hashes');
    for (const hash of hashes) {
      assert(/^[0-9a-f]{64}$/.test(hash), `"${hash}" is not a lower-case sha256`);
    }
  });

  test('the kinds are the ones David asked for', () => {
    const counts: Record<string, number> = {};
    for (const e of CODE_TABLE) counts[e.action.kind] = (counts[e.action.kind] ?? 0) + 1;
    for (const [kind, n] of Object.entries(KINDS)) {
      assertEqual(counts[kind], n, `number of "${kind}" codes`);
    }
    assertEqual(Object.keys(counts).length, 5, 'no other kind of code');
  });

  test('coins set 0, 500, 1000, 5000, 10000, 50000, 100000', () => {
    const amounts = CODE_TABLE.flatMap((e) => (e.action.kind === 'coins' ? [e.action.amount] : []));
    assertEqual(amounts.join(','), '0,500,1000,5000,10000,50000,100000', 'coin amounts');
  });

  test('trophies set 0, 100, 250, 500, 1000, 2000, 5000, 10000', () => {
    const amounts = CODE_TABLE.flatMap((e) =>
      e.action.kind === 'trophies' ? [e.action.amount] : [],
    );
    assertEqual(amounts.join(','), '0,100,250,500,1000,2000,5000,10000', 'trophy amounts');
  });

  test('a hash finds its action, and an unknown hash finds nothing', () => {
    for (const e of CODE_TABLE) {
      assertEqual(actionForHash(e.sha256), e.action, `${e.action.kind} found by its hash`);
      assertEqual(actionForHash(e.sha256.toUpperCase()), e.action, 'hash case is ignored');
    }
    assertEqual(actionForHash(sha256Hex('not a code')), null, 'unknown hash');
    assertEqual(actionForHash(''), null, 'empty hash');
  });
});

suite('secret codes · the old codes are dead', () => {
  test('none of the old codes does anything', () => {
    // FAMILY, LOCK and RESET were plain words and "500 TROPHY" / "500 COIN"
    // carried a number. All of them were readable in the public source.
    const old = [
      'FAMILY', 'family', 'LOCK', 'lock', 'RESET', 'reset',
      '500 TROPHY', '500 trophy', 'TROPHY 500', '500 COIN', '1000 COIN', 'COIN 500',
      '0 COIN', '0 TROPHY', 'MONEY',
    ];
    for (const input of old) {
      assertEqual(lookupCode(input), null, `"${input}" still works`);
    }
  });

  test('empty and blank input is not a code', () => {
    for (const input of ['', ' ', '  -  ', '---']) {
      assertEqual(lookupCode(input), null, `"${input}" matched something`);
    }
  });

  test('a code is fourteen characters, so no short word can ever match', () => {
    // The table was generated from CODE_LENGTH characters of CODE_ALPHABET.
    // A hash of a shorter word is not in it, whatever the word.
    assertEqual(CODE_LENGTH, 14, 'Marc, 3 Nov 2026: fourteen characters');
    assert(/^[A-Z2-9]+$/.test(CODE_ALPHABET) && !/[01OIL]/.test(CODE_ALPHABET), 'no 0/O or 1/I/L');
    for (const word of ['FAMILY', 'LOCK', 'RESET', 'TROPHY', 'COIN', 'ADMIN', 'PASSWORD']) {
      assertEqual(lookupCode(word), null, `${word}`);
    }
  });
});

suite('secret codes · what was typed is made comparable', () => {
  test('trim, upper-case, drop spaces and dashes', () => {
    assertEqual(normaliseCode('  abc123XYZ9  '), 'ABC123XYZ9', 'trim and upper-case');
    assertEqual(normaliseCode('abcde fghij'), 'ABCDEFGHIJ', 'a space');
    assertEqual(normaliseCode('abcde-fghij'), 'ABCDEFGHIJ', 'a dash');
    assertEqual(normaliseCode(' ab-cd ef-gh ij '), 'ABCDEFGHIJ', 'several, and padded');
  });

  test('every spelling of a code hashes to the same thing', () => {
    // A stand-in code that is NOT one of the real ones: the lookup works on
    // normalised text, so the same normalisation must feed the hash.
    const spellings = ['qwertyuiop', 'QWERTYUIOP', ' qwerty uiop ', 'QWERT-YUIOP', 'qwert - yuiop'];
    const hashes = new Set(spellings.map((s) => sha256Hex(normaliseCode(s))));
    assertEqual(hashes.size, 1, 'spellings that should agree');
  });

  test('lookupCode hashes the NORMALISED text', () => {
    // Prove the path end to end without knowing a real code: swap the
    // table entry's hash for one we can make, and look it up three ways.
    const stand = 'Q1W2E3R4T5Y6U7';
    const entry = CODE_TABLE[0] as { sha256: string };
    const real = entry.sha256;
    try {
      entry.sha256 = sha256Hex(stand);
      for (const typed of ['q1w2e3r4t5y6u7', ' Q1W2E-3R4T5-Y6U7 ', 'q1w2e 3r4t5 y6u7']) {
        assertEqual(lookupCode(typed)?.kind, 'admin', `"${typed}"`);
      }
      assertEqual(lookupCode('Q1W2E3R4T5Y6U8'), null, 'one character off');
    } finally {
      entry.sha256 = real;
    }
    assertEqual(lookupCode(stand), null, 'the stand-in is gone again');
  });
});

/** Every CODE_LENGTH-character window of every alphanumeric run, upper-cased. */
function codeLengthRuns(text: string): Set<string> {
  const found = new Set<string>();
  const atLeast = new RegExp(`[A-Z0-9]{${CODE_LENGTH},}`, 'g');
  for (const run of text.toUpperCase().match(atLeast) ?? []) {
    for (let i = 0; i + CODE_LENGTH <= run.length; i++) found.add(run.slice(i, i + CODE_LENGTH));
  }
  return found;
}

/** Which of these hashes does some code-length run in the text hash to? */
function leaksIn(text: string, hashes: ReadonlySet<string>): string[] {
  return [...codeLengthRuns(text)].filter((run) => hashes.has(sha256Hex(run)));
}

function filesUnder(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) filesUnder(path, out);
    else if (/\.(ts|tsx|js|json|md)$/.test(name)) out.push(path);
  }
  return out;
}

suite('secret codes · no code has leaked into the source', () => {
  const root = join(__dirname, '..');
  const hashes: ReadonlySet<string> = new Set(CODE_TABLE.map((e) => e.sha256));

  test('the leak check itself catches a planted code', () => {
    const planted = 'K7Q2M9X4ZBW3R8';
    const table = new Set([sha256Hex(planted)]);
    assertEqual(leaksIn(`const code = '${planted}'; // oops`, table).length, 1, 'plain');
    assertEqual(leaksIn(`const code = '${planted.toLowerCase()}';`, table).length, 1, 'lower case');
    assertEqual(leaksIn(`x_${planted}_y`, table).length, 1, 'inside a longer word');
    assertEqual(leaksIn('const code = "nothing to see here 0123456789";', table).length, 0, 'clean');
  });

  test('no code-length run in src/ hashes to a table entry', () => {
    const files = filesUnder(join(root, 'src'));
    assert(files.length > 50, 'the scan found the source files');
    const leaks: string[] = [];
    for (const file of files) {
      for (const run of leaksIn(readFileSync(file, 'utf8'), hashes)) {
        leaks.push(`${file}: a secret code in plain text`);
        void run; // never print the code itself, even in a failure message
      }
    }
    assertEqual(leaks.join('\n'), '', 'a code was written into the source');
  });

  test('nor in tests/, which is public too', () => {
    const leaks: string[] = [];
    for (const file of filesUnder(__dirname)) {
      if (leaksIn(readFileSync(file, 'utf8'), hashes).length > 0) {
        leaks.push(`${file}: a secret code in plain text`);
      }
    }
    assertEqual(leaks.join('\n'), '', 'a code was written into a test');
  });
});
