import { readFileSync } from 'node:fs';
import { assert, suite, test } from './harness';

/**
 * Why no ad was ever asked for (David, 5 Nov 2026: AdMob showed zero
 * requests in 30 days). ads.ts keeps the reason a start-up stopped, and
 * Settings shows it when the version line is held — for anybody, so a
 * phone NOT in tester mode can say where a real player's adverts stop.
 */
suite('ads · the reason they stopped is kept', () => {
  const ads = readFileSync('src/game/ads.ts', 'utf8');
  const screen = readFileSync('src/demo/DiceDemoScreen.tsx', 'utf8');

  test('a consent failure and a start-up failure both keep their reason', () => {
    assert(/problem = `consent error: \$\{describe\(error\)\}`/.test(ads), 'consent error not kept');
    assert(/problem = `consent status /.test(ads), 'a refused consent not kept');
    assert(/problem = `start-up error: \$\{describe\(error\)\}`/.test(ads), 'start-up error not kept');
  });

  test('a consent failure still means no ads, never ads-anyway', () => {
    assert(/canRequestAds = false;\s*\n\s*problem = `consent error/.test(ads), 'a failure no longer blocks ads');
  });

  test('a refused ad request keeps Google\'s answer, and requests are counted', () => {
    assert(/problem = `ad request error: \$\{describe\(error\)\}`/.test(ads), 'a refused request is not kept');
    assert(/ad\.load\(\);\s*\n\s*requested \+= 1;/.test(ads), 'requests are not counted');
    assert(/asked Google \{status\.requested\}/.test(screen), 'the count is not on the line');
  });

  test('holding the version line shows the status outside tester mode', () => {
    assert(/onLongPress=\{\(\) => setShowAdStatus\(\(on\) => !on\)\}/.test(screen), 'no way to show it');
    assert(/showAdStatus && !unlockAll && <AdStatusLine \/>/.test(screen), 'not drawn');
    assert(/Why: \$\{status\.problem\}/.test(screen), 'the reason is not on the line');
  });
});
