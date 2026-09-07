import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import { GAME_VERSION } from '../src/game/version';

/**
 * The parts of the submission gate that a machine can check.
 *
 * AGENTS.md mandates a full pass before ANY App Store submission and
 * names the store copy limits, the screenshot dimensions and the version
 * numbers among the things to check. All three were prose only — a
 * person remembering — on the one thing in this project that cannot be
 * rolled back in seconds. A submission rejected for a 31-character
 * subtitle costs a review cycle; a screenshot at the wrong size is
 * refused at upload.
 *
 * What is deliberately NOT here: `ios.buildNumber`, which EAS owns and
 * increments, and anything that needs a person to read App Store Connect.
 * Those live in David's own list.
 */

const root = join(__dirname, '..');
const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;

/** Character count as Apple counts it — the trailing newline is not copy. */
function copyLength(file: string): number {
  return readFileSync(join(root, 'store', file), 'utf8').replace(/\n+$/, '').length;
}

/** [major, minor, patch] from "1.2.3" or "v1.2.3". */
function semver(text: string): [number, number, number] {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(text.trim());
  assert(m !== null, `"${text}" is not a version number`);
  return [Number(m![1]), Number(m![2]), Number(m![3])];
}

function compare(a: string, b: string): number {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

suite('submission · the store copy fits Apple’s boxes', () => {
  /*
    App Store Connect truncates or refuses over-length copy at upload,
    and the fields are the first thing anyone reads. The limits are
    Apple's, not ours.
  */
  const LIMITS: [string, number][] = [
    ['subtitle.txt', 30],
    ['keywords.txt', 100],
    ['promo.txt', 170],
    ['description.txt', 4000],
  ];

  for (const [file, limit] of LIMITS) {
    test(`${file} is within ${limit} characters`, () => {
      const length = copyLength(file);
      note(`${file}: ${length}/${limit}`);
      assert(
        length <= limit,
        `store/${file} is ${length} characters — ${length - limit} over Apple's limit of ${limit}`,
      );
      assert(length > 0, `store/${file} is empty`);
    });
  }

  test('the keyword field spends its budget on words, not repeats', () => {
    // Apple already indexes the app NAME, so a keyword that repeats a
    // word from "Dice Battles: Color Rush" buys nothing and costs
    // characters that could be another search term.
    const name: string = app.name;
    const words = new Set(
      name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean),
    );
    const keywords = readFileSync(join(root, 'store/keywords.txt'), 'utf8')
      .trim()
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    const wasted = keywords.filter((k) => words.has(k));
    assertEqual(
      wasted.join(', '),
      '',
      `the keyword field repeats ${wasted.join(', ')} from the app name, which Apple already indexes`,
    );
    // Duplicates within the field itself are the same waste.
    assertEqual(
      new Set(keywords).size,
      keywords.length,
      `the keyword field repeats itself: ${keywords.join(', ')}`,
    );
  });
});

suite('submission · the screenshots are the sizes Apple accepts', () => {
  /** Minimal PNG header read — the same trick tests/appIcon.test.ts uses. */
  function pngSize(path: string): { width: number; height: number } {
    const buf = readFileSync(path);
    assertEqual(buf.readUInt32BE(0), 0x89504e47, `${path} is not a PNG`);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  /*
    Apple moves these goalposts, and the tool's own README says to check
    what App Store Connect asks for on the day. What this pins is that
    every shot in a folder is the SAME size and that size is one Apple
    currently accepts — a mixed folder is refused at upload and is the
    failure that actually happens, when one shot is rebuilt and the rest
    are not.
  */
  const SHAPES: Record<string, [number, number]> = {
    iphone: [1290, 2796],
    ipad: [2048, 2732],
  };

  for (const [folder, [width, height]] of Object.entries(SHAPES)) {
    test(`every ${folder} screenshot is ${width}x${height}`, () => {
      const dir = join(root, 'store/screenshots', folder);
      const shots = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
      assert(shots.length > 0, `store/screenshots/${folder} has no screenshots`);
      assert(
        shots.length >= 3,
        `only ${shots.length} ${folder} screenshots — Apple shows up to ten and three is thin`,
      );
      for (const shot of shots) {
        const size = pngSize(join(dir, shot));
        assert(
          size.width === width && size.height === height,
          `${folder}/${shot} is ${size.width}x${size.height}, not ${width}x${height}`,
        );
      }
      note(`${shots.length} ${folder} screenshots, all ${width}x${height}`);
    });
  }
});

suite('submission · the version numbers agree with each other', () => {
  test('app.json never claims a version ahead of the JavaScript', () => {
    /*
      Three numbers exist and they mean different things. GAME_VERSION is
      what a player sees in Settings and what a bug report is stamped
      with; it moves with every over-the-air update. app.json's version
      is the NATIVE marketing version, which only moves when a binary
      goes to Apple. The App Store Connect version record is a third,
      and no test here can see it — that one is in David's list.

      What must always hold, whichever way the ASC record is settled, is
      that the native version is not AHEAD of the JavaScript: a binary
      claiming 2.0.0 while the bundle inside it reports v1.66.0 makes
      every bug report unreadable.
    */
    const native: string = app.version;
    note(`app.json ${native}, GAME_VERSION ${GAME_VERSION}`);
    assert(
      compare(native, GAME_VERSION) <= 0,
      `app.json says ${native} but the JavaScript says ${GAME_VERSION} — ` +
        'the native marketing version has run ahead of the bundle',
    );
  });

  test('the version a player sees is the newest one written down', () => {
    // Already covered elsewhere for CHANGELOG's newest heading; this is
    // the other direction — every heading is a real version number, so a
    // typo in a heading cannot hide a release.
    const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
    const headings = [...changelog.matchAll(/^## (v[^\s]+)/gm)].map((m) => m[1]);
    assert(headings.length > 0, 'CHANGELOG.md has no version headings');
    for (const heading of headings.slice(0, 20)) semver(heading);
    assertEqual(headings[0], GAME_VERSION, 'the newest CHANGELOG entry is not this version');
  });
});

suite('submission · the ad configuration is per-platform', () => {
  test('the Android AdMob app id is not the iOS one pasted twice', () => {
    /*
      AdMob issues one App ID per PLATFORM app, so the same id in both
      slots means the Android build initialises against an iOS app: no
      fill at best, and an invalid-traffic flag on the account at worst.

      It is dead config TODAY — the launch is iOS-only and the ad SDK is
      not in the bundle, so initialize() is never called on either
      platform. The correct Android id does not exist yet either: David
      has to create an Android app in the AdMob console to get one.

      So this fails only from the moment it can actually do harm — when
      ads are switched on — and until then it says so in the run without
      turning the suite red. A test that is permanently red teaches
      people to ignore red.

      Do not "fix" this by deleting the key: the Google Mobile Ads
      Android SDK reads APPLICATION_ID from the manifest at startup and a
      missing value fails harder than a wrong one.
    */
    const plugins: unknown[] = app.plugins ?? [];
    const entry = plugins.find(
      (p): p is [string, Record<string, string>] =>
        Array.isArray(p) && p[0] === 'react-native-google-mobile-ads',
    );
    if (!entry) {
      note('the ad SDK plugin is not configured — nothing to compare');
      return;
    }
    const { iosAppId, androidAppId } = entry[1];
    assert(
      typeof iosAppId === 'string' && iosAppId.startsWith('ca-app-pub-'),
      'the iOS AdMob app id is missing or malformed',
    );
    assert(
      typeof androidAppId === 'string' && androidAppId.startsWith('ca-app-pub-'),
      'the Android AdMob app id is missing or malformed — the Android SDK ' +
        'crashes at startup without one',
    );
    assert(
      iosAppId !== androidAppId,
      'iosAppId and androidAppId are identical. AdMob issues one App ID per ' +
        'platform app, so Android would initialise against the iOS app — no ' +
        'fill at best, an invalid-traffic flag on the account at worst.',
    );

    /*
      Google's public Android test id is an ACCEPTABLE placeholder and a
      forbidden shipping value.

      There is no real Android AdMob app yet — one has to be created in
      the console, which only David can do — and the launch is iOS only.
      The wrong thing to do meanwhile was leave the real iOS id in the
      Android slot, which is what pointed Android at David's own iOS app.
      The wrong thing to do next is ship an Android release with the test
      id, which serves test adverts to real players and earns nothing.
    */
    const GOOGLE_TEST_ANDROID = 'ca-app-pub-3940256099942544~3347511713';
    if (androidAppId === GOOGLE_TEST_ANDROID) {
      const easJson = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
      const submitsAndroid = Object.values(easJson.submit ?? {}).some(
        (p) => typeof p === 'object' && p !== null && 'android' in p,
      );
      assert(
        !submitsAndroid,
        'the Android AdMob app id is still Google\'s public TEST id, and ' +
          'eas.json now has an Android submit profile. Create an Android app ' +
          'for com.dmsutton.dicebattles in the AdMob console and paste its ' +
          'real App ID into app.json before that release goes out.',
      );
      note('Android AdMob id is Google\'s test placeholder — iOS-only launch, replace before any Android release');
    }
  });
});
