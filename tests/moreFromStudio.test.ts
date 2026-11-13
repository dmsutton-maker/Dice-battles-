import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, suite, test } from './harness';
import {
  GROWN_UP_MAX,
  GROWN_UP_MIN,
  STUDIO_ROW_NOTE,
  STUDIO_ROW_TITLE,
  VECTOR_FACES_APP_STORE_ID,
  VECTOR_FACES_URL,
  grownUpQuestion,
  isGrownUpAnswer,
} from '../src/game/moreFromStudio';

/**
 * "More from Paper Ship Studio" (David, 13 Nov 2026: "build the Vector
 * Faces link"). One quiet row in Settings, a grown-up check before the App
 * Store opens, and never an advert.
 */

const read = (...parts: string[]) => readFileSync(join(...parts), 'utf8');
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

suite('more from the studio · the link', () => {
  test('it opens Vector Faces on the App Store, over https', () => {
    assertEqual(VECTOR_FACES_APP_STORE_ID, '6832990414', 'not Vector Faces\' App Store id');
    assertEqual(VECTOR_FACES_URL, 'https://apps.apple.com/us/app/vector-faces/id6832990414', 'wrong link');
  });

  test('the words name the app and show no price', () => {
    assert(STUDIO_ROW_TITLE.includes('Paper Ship Studio'), 'the row does not say whose apps these are');
    assert(STUDIO_ROW_NOTE.includes('Vector Faces'), 'the row does not name the app');
    assert(!/[$£€]|\d+\.\d\d|free/i.test(STUDIO_ROW_TITLE + STUDIO_ROW_NOTE), 'a price crept into the words');
  });
});

suite('more from the studio · the grown-up check', () => {
  test('every sum is a times table from 6 × 6 to 9 × 9', () => {
    for (let i = 0; i < 2000; i += 1) {
      const q = grownUpQuestion();
      assert(q.a >= GROWN_UP_MIN && q.a <= GROWN_UP_MAX, `factor ${q.a} out of range`);
      assert(q.b >= GROWN_UP_MIN && q.b <= GROWN_UP_MAX, `factor ${q.b} out of range`);
      assertEqual(q.answer, q.a * q.b, 'the answer is not the product');
    }
    // The ends of the random range, and a broken random, stay in range too.
    assertEqual(grownUpQuestion(() => 0).answer, 36, 'lowest sum');
    assertEqual(grownUpQuestion(() => 0.9999999).answer, 81, 'highest sum');
    assertEqual(grownUpQuestion(() => Number.NaN).answer, 36, 'a NaN random');
  });

  test('only the right number passes', () => {
    const q = { a: 7, b: 8, answer: 56 };
    assert(isGrownUpAnswer(q, '56'), 'the right answer was refused');
    assert(isGrownUpAnswer(q, ' 56 '), 'spaces round the answer were refused');
    for (const wrong of ['', '55', '57', '5 6', '56.0', '-56', 'fifty-six', '056x']) {
      assert(!isGrownUpAnswer(q, wrong), `"${wrong}" was let through`);
    }
  });
});

suite('more from the studio · never an advert', () => {
  const component = read('src', 'demo', 'MoreFromStudio.tsx');
  const screen = read('src', 'demo', 'DiceDemoScreen.tsx');

  test('the App Store opens only after the grown-up answer is checked', () => {
    const body = code(component);
    assertEqual((body.match(/Linking\.openURL\(/g) ?? []).length, 1, 'more than one way out to the App Store');
    assert(
      /if \(isGrownUpAnswer\(question, typed\)\) \{[\s\S]*?Linking\.openURL\(VECTOR_FACES_URL\)/.test(body),
      'the link is not behind the grown-up check',
    );
  });

  test('it lives in Settings once, and nowhere else in the game', () => {
    assertEqual((screen.match(/<MoreFromStudio\b/g) ?? []).length, 1, 'the row appears more than once');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !/moreFromStudio\.ts$|MoreFromStudio\.tsx$|DiceDemoScreen\.tsx$/.test(name)) {
          const text = read(path);
          if (/Vector Faces|6832990414|MoreFromStudio/.test(text)) offenders.push(path);
        }
      }
    };
    walk('src');
    assertEqual(offenders.join(', '), '', 'Vector Faces is mentioned outside its Settings row (ads, news or a pop-up?)');
  });

  test('plain React Native only: no native module, so runtimeVersion stays put', () => {
    const imports = component.match(/^import .* from '([^']+)';$/gm) ?? [];
    for (const line of imports) {
      assert(
        /from '(react|react-native|\.\.\/[^']+)'/.test(line),
        `MoreFromStudio imports a package that may be native: ${line}`,
      );
    }
  });
});
