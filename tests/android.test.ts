import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import { setPlatformForTest } from '../src/game/platform';
import { PLAY_STORE_URL, REVIEW_URL, reviewUrlFor } from '../src/game/review';

/**
 * The first Google Play release (David, 16 Nov 2026: "lets get the android
 * app going"). The game was only ever played on iPhone; these pin the few
 * places that must behave differently on Android.
 */

const read = (...parts: string[]) => readFileSync(join(...parts), 'utf8');

suite('android · the store', () => {
  test('"Rate Dice Battles" opens Google Play on Android and the App Store on iPhone', () => {
    assertEqual(PLAY_STORE_URL, 'https://play.google.com/store/apps/details?id=com.dmsutton.dicebattles', 'wrong Play link');
    assertEqual(reviewUrlFor('android'), PLAY_STORE_URL, 'Android sent to the App Store');
    assertEqual(reviewUrlFor('ios'), REVIEW_URL, 'iPhone no longer goes to its review page');
    const app = JSON.parse(read('app.json'));
    assert(PLAY_STORE_URL.endsWith(app.expo.android.package), 'the Play link is not this app\'s package');
  });

  test('the Gold Pass is consumed on Android so it can be bought again next season', () => {
    const source = read('src', 'game', 'purchases.ts');
    assert(
      /const consume = product\.kind === 'consumable' \|\| \(product\.kind === 'season' && isAndroid\(\)\);/.test(source),
      'Google would refuse the second season\'s Gold Pass as "already owned"',
    );
    assert(/finish\(\{ purchase, isConsumable: consume \}\)/.test(source), 'the consume decision is not used');
  });

  test('the Shop names Google, not Apple, on Android', () => {
    const shelf = read('src', 'demo', 'MoneyShelf.tsx');
    assert(/This \$\{isAndroid\(\) \? 'Google' : 'Apple'\} account/.test(shelf), 'Android players are told about an Apple account');
  });
});

suite('android · adverts', () => {
  test('Android has its own ad unit, and shows none until it exists', async () => {
    const ads = await import('../src/game/ads');
    setPlatformForTest('ios');
    assert(ads.hasRealAdUnit(), 'the iOS unit is not recognised');
    setPlatformForTest('android');
    const androidReady = ads.ANDROID_INTERSTITIAL_AD_UNIT_ID.length > 0;
    assertEqual(ads.hasRealAdUnit(), androidReady, 'the Android check reads the wrong unit');
    if (androidReady) {
      assert(
        ads.ANDROID_INTERSTITIAL_AD_UNIT_ID.startsWith('ca-app-pub-') && ads.ANDROID_INTERSTITIAL_AD_UNIT_ID.includes('/'),
        'the Android unit is not an ad unit id (… / …)',
      );
      assert((ads.ANDROID_INTERSTITIAL_AD_UNIT_ID as string) !== ads.INTERSTITIAL_AD_UNIT_ID, 'the iOS unit pasted into the Android slot');
    } else {
      note('no Android ad unit yet: Android shows no adverts');
    }
    setPlatformForTest(undefined);
    const source = read('src', 'game', 'ads.ts');
    assert(
      /if \(isAndroid\(\) && !hasRealAdUnit\(\) && !usingTestAds\(\)\) return;/.test(source),
      'Android without its own unit would show Google\'s test ads to real players',
    );
  });
});

suite('android · what is iPhone-only stays hidden', () => {
  test('update notices hide on Android until Firebase is set up', async () => {
    const { pushState } = await import('../src/game/push');
    setPlatformForTest('android');
    try {
      assertEqual(await pushState(), 'unavailable', 'the notices row would ask, then vanish');
    } finally {
      setPlatformForTest(undefined);
    }
  });

  test('the Vector Faces row (an Apple Watch app) is not shown on Android', () => {
    const row = read('src', 'demo', 'MoreFromStudio.tsx');
    assert(/if \(isAndroid\(\)\) return null;/.test(row), 'Android players are offered an Apple Watch app');
  });

  test('Game Center, iCloud and the keychain are asked for only on iPhone', () => {
    for (const [file, pattern] of [
      ['gameCenter.ts', /Platform\.OS !== 'ios'/],
      ['cloudSaveSdk.ts', /Platform\.OS !== 'ios'/],
      ['deviceVault.ts', /Platform\.OS !== 'ios'/],
    ] as const) {
      assert(pattern.test(read('src', 'game', file)), `${file} no longer stops at Android`);
    }
  });
});
