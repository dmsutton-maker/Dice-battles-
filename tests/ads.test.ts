import { readFileSync } from 'node:fs';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  GAMES_BEFORE_FIRST_AD,
  GAMES_PER_AD,
  gamesUntilAd,
  shouldShowAd,
} from '../src/game/adRules';

/**
 * The advertising rules, and the promises the App Store listing makes
 * about them.
 *
 * These are worth testing harder than most things here, because two of
 * them are not opinions about feel — they are statements this project has
 * made to Apple and to Google about a game children play. A regression in
 * `tagForChildDirectedTreatment` would quietly turn the App Privacy
 * answers into false ones, and nobody would see it on screen.
 */

suite('ads · when one is shown', () => {
  test('David asked for every third game, and that is what happens', () => {
    assertEqual(GAMES_PER_AD, 3, 'the interval David asked for');
    const shown = [];
    for (let played = 1; played <= 12; played++) {
      if (shouldShowAd(played)) shown.push(played);
    }
    note(`ads after games: ${shown.join(', ')}`);
    assertEqual(shown.join(','), '3,6,9,12', 'ads should land on every third game');
  });

  test('a brand-new player gets a clean run first', () => {
    // Somebody deciding whether they like this game should see the game.
    for (let played = 1; played < GAMES_BEFORE_FIRST_AD; played++) {
      assert(!shouldShowAd(played), `an ad appeared after game ${played}`);
    }
    assert(shouldShowAd(GAMES_BEFORE_FIRST_AD), 'the first ad never arrives');
  });

  test('a nonsense count never shows an ad', () => {
    // gamesFinished is read back from device storage, which can hold
    // anything at all after a bad write or a hand-edited backup.
    for (const bad of [NaN, Infinity, -Infinity, -3]) {
      assert(!shouldShowAd(bad), `${bad} produced an ad`);
    }
  });

  test('the loader is told one game before the ad is due', () => {
    // An interstitial takes a moment to fetch, and one that is not ready
    // when its turn comes is skipped rather than waited for — so it has
    // to start loading early or it is never ready at all.
    assertEqual(gamesUntilAd(2), 1, 'game 2 should be one away from the ad');
    assertEqual(gamesUntilAd(5), 1, 'game 5 should be one away');
    assertEqual(gamesUntilAd(3), 3, 'straight after an ad, three to go');
    for (const bad of [NaN, -1]) {
      assertEqual(gamesUntilAd(bad), GAMES_PER_AD, `${bad} should fall back safely`);
    }
  });
});

suite('ads · the promises made to Apple and Google', () => {
  const source = readFileSync('src/game/ads.ts', 'utf8');

  test('every request is tagged as a child’s', () => {
    /*
      This game is for ages 5+, so COPPA applies whatever App Store
      category it sits in. These two flags are what make the App Store
      Connect privacy answers TRUE — "not used for tracking", and no App
      Tracking Transparency prompt. Losing them would not change anything
      on screen; it would just quietly make the filing false.
    */
    assert(
      /tagForChildDirectedTreatment:\s*true/.test(source),
      'child-directed treatment is off — the App Privacy filing says otherwise',
    );
    assert(
      /tagForUnderAgeOfConsent:\s*true/.test(source),
      'under-age-of-consent is off',
    );
    assert(
      /requestNonPersonalizedAdsOnly:\s*true/.test(source),
      'personalised ads are back on, which needs an ATT prompt and a new privacy filing',
    );
  });

  test('only G-rated creative may appear', () => {
    assert(
      /maxAdContentRating:\s*mod\.MaxAdContentRating\.G/.test(source),
      'the ad content rating cap is gone — a 5-year-old could be shown anything',
    );
  });

  test('no consent, no ads', () => {
    // The EU consent form is not advisory: requesting an ad before it is
    // answered is the violation, so a failure has to mean no ads at all
    // rather than ads anyway.
    assert(
      /canRequestAds\s*=\s*false/.test(source) && /if\s*\(!canRequestAds\)\s*return;/.test(source),
      'a consent failure no longer blocks ad requests',
    );
  });

  test('the SDK is required lazily, never imported', () => {
    /*
      The one that would take the game down for everybody. Ads are native
      code, but JavaScript ships over the air to binaries built before the
      SDK existed — and the runtime version is pinned to the Expo SDK,
      which adding a package does not change. A top-level import resolves
      at startup and crashes every one of those installs.
    */
    assert(
      !/^import .*react-native-google-mobile-ads/m.test(source),
      'the ad SDK is imported at module scope — this crashes every build without it compiled in',
    );
    assert(
      /require\('react-native-google-mobile-ads'\)/.test(source),
      'the lazy require is gone',
    );
  });

  test('nothing else in the game touches the SDK directly', () => {
    // One door, like gameCenter.ts: the swap to another ad network, or
    // ripping ads out again, stays a one-file job.
    const { execSync } = require('node:child_process') as typeof import('node:child_process');
    const hits = execSync(
      "grep -rl 'react-native-google-mobile-ads' src/ || true",
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter((f) => f.trim().length > 0);
    assertEqual(
      hits.join(','),
      'src/game/ads.ts',
      'something outside src/game/ads.ts imports the ad SDK',
    );
  });
});

suite('ads · an ad can never cost a player anything', () => {
  const source = readFileSync('src/game/ads.ts', 'utf8');
  const screen = readFileSync('src/demo/DiceDemoScreen.tsx', 'utf8');

  test('counting a game and showing an ad are separate calls', () => {
    /*
      A game ends on a fanfare, a trophy count and sometimes an unlock
      popup. An interstitial thrown up at that instant buries the reward
      the player just earned — so the count happens at the end of the
      game and the ad waits for the way OUT of the result screen.
    */
    assert(
      /export function noteGameFinished\(\): void/.test(source),
      'noteGameFinished should not show anything',
    );
    const finish = screen.slice(
      screen.indexOf('const finishRound'),
      screen.indexOf('const startCountdown'),
    );
    assert(
      finish.includes('noteGameFinished()'),
      'the game is no longer counted when it ends',
    );
    assert(
      !finish.includes('showAdIfDue()'),
      'an ad is being shown over the victory fanfare and the reward popup',
    );
  });

  test('both ways out of the result screen can show the ad', () => {
    for (const [name, marker] of [
      ['quitToMenu', 'const quitToMenu'],
      ['startCountdown', 'const startCountdown'],
    ] as const) {
      const start = screen.indexOf(marker);
      assert(start > 0, `${name} is gone`);
      const body = screen.slice(start, start + 900);
      assert(
        body.includes('showAdIfDue()'),
        `leaving via ${name} never shows a due ad`,
      );
    }
  });

  test('an ad that is not ready is skipped, never waited for', () => {
    // A child must not sit watching a spinner because the network is
    // slow. The next ad comes round in three games anyway.
    assert(
      /adDue = false;\s*\n\s*preload\(\);\s*\n\s*return false;/.test(source),
      'a due-but-unloaded ad no longer gives up immediately',
    );
  });

  test('the real ad unit is empty until David sends one, so tests ads are used', () => {
    /*
      An App ID (…~…) is not an ad unit id (…/…). Shipping with the wrong
      one would fail at request time with a misleading error, and asking
      for REAL ads from a machine that is not a registered test device is
      what gets an AdMob account suspended for invalid traffic.
    */
    const real = /INTERSTITIAL_AD_UNIT_ID = '([^']*)'/.exec(source);
    assert(real !== null, 'the ad unit constant is gone');
    const id = real![1];
    if (id.length > 0) {
      assert(
        id.startsWith('ca-app-pub-') && id.includes('/'),
        `"${id}" is not an ad unit id — an App ID uses ~, an ad unit uses /`,
      );
      note(`real ad unit configured: ${id}`);
    } else {
      note('no real ad unit yet — Google test interstitials are being used');
      assert(
        /mod\.TestIds\.INTERSTITIAL/.test(source),
        'no real unit AND no test unit: nothing would ever load',
      );
    }
  });
});
