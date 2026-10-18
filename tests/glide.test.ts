import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, suite, test } from './harness';
import {
  easeInOutCubic,
  GLIDE_MAX_MS,
  GLIDE_MIN_MS,
  glideDuration,
  glideTarget,
} from '../src/demo/glide';

const root = join(__dirname, '..');

/** Source with its comments taken out, so a phrase in an explanation cannot pass for code. */
const code = (path: string) =>
  readFileSync(join(root, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

/*
  David, 18 Oct 2026: "When you click 'get the gold pass' on cups it
  should take you directly to the bottom of the page on the shop where it
  shows the gold pass. Make sure to make the scrolling flowing and not
  just like teleporting."
*/

suite('gold pass · the glide feels like travel, not a jump', () => {
  test('it starts and lands gently and never overshoots', () => {
    assertEqual(easeInOutCubic(0), 0, 'the glide does not start where it is');
    assertEqual(easeInOutCubic(1), 1, 'the glide does not end where it was going');
    let last = 0;
    for (let i = 1; i <= 100; i++) {
      const v = easeInOutCubic(i / 100);
      assert(v >= last, 'the glide goes backwards at some point');
      assert(v <= 1, 'the glide overshoots the card');
      last = v;
    }
    // Soft at both ends: the first and last tenth cover little ground.
    assert(easeInOutCubic(0.1) < 0.02, 'the glide lurches off the mark');
    assert(1 - easeInOutCubic(0.9) < 0.02, 'the glide slams into the card');
  });

  test('a long trip takes long enough to watch, never long enough to wait for', () => {
    assertEqual(glideDuration(0), GLIDE_MIN_MS, 'a short hop is not given its minimum');
    assert(glideDuration(3000) > glideDuration(800), 'a longer trip is not given longer');
    assertEqual(glideDuration(100000), GLIDE_MAX_MS, 'a huge trip is not capped');
    assert(GLIDE_MIN_MS >= 500, 'the glide is short enough to read as a jump');
    assert(GLIDE_MAX_MS <= 1200, 'the glide keeps the player waiting');
  });

  test('it lands on the card, and never past the bottom of the page', () => {
    // The Gold Pass near the bottom of a long page: the bottom is the stop.
    const atBottom = glideTarget({ cardY: 4600, cardHeight: 110, viewportHeight: 700, contentHeight: 4900 });
    assertEqual(atBottom, 4200, 'the glide does not stop at the bottom of the page');
    // Mid-page, it centres the card.
    const centred = glideTarget({ cardY: 2000, cardHeight: 100, viewportHeight: 700, contentHeight: 6000 });
    assertEqual(centred, 1700, 'the card is not centred');
    // A short page never scrolls above the top.
    const short = glideTarget({ cardY: 100, cardHeight: 100, viewportHeight: 700, contentHeight: 600 });
    assertEqual(short, 0, 'a short page scrolls past its top');
  });
});

suite('gold pass · the button and the Store are wired', () => {
  test('"Get the Gold Pass" asks the Store for the glide and opens it', () => {
    const screen = code('src/demo/DiceDemoScreen.tsx');
    const button = screen.slice(screen.indexOf('onGetGold={'), screen.indexOf('onGetGold={') + 300);
    assert(/setGoldFocus\(\(n\) => n \+ 1\)/.test(button), 'the button does not ask for the glide');
    assert(/setTab\('store'\)/.test(button), 'the button does not open the Store');
    assert(/focusGold=\{goldFocus\}/.test(screen), 'the Store is never told where to go');
  });

  test('the Store glides a frame at a time, stops for a finger, and only once per tap', () => {
    const store = code('src/demo/StoreScreen.tsx');
    assert(/requestAnimationFrame\(step\)/.test(store), 'the glide is not driven frame by frame');
    assert(/scrollTo\(\{ y, animated: false \}\)/.test(store), 'each frame is not a plain scroll step');
    assert(/easeInOutCubic\(t\)/.test(store), 'the glide is not eased');
    assert(/onScrollBeginDrag=\{stopGlide\}/.test(store), 'a finger on the page does not stop the glide');
    assert(/glidedFor\.current === focusGold/.test(store), 'coming back from a preview replays the glide');
    assert(/isReduceMotionEnabled/.test(store), 'Reduce Motion is ignored');
    assert(/cancelAnimationFrame/.test(store), 'the glide is never cancelled');
  });

  test('the Gold Pass reports where it is and lights up on arrival', () => {
    const shelf = code('src/demo/MoneyShelf.tsx');
    assert(/product\.kind === 'season'/.test(shelf), 'the Gold Pass card is not found');
    assert(/onGoldLayout\(e\.nativeEvent\.layout\.y, e\.nativeEvent\.layout\.height\)/.test(shelf), 'the card does not report its place');
    assert(/<GoldGlow token=\{goldGlow\} \/>/.test(shelf), 'the card never lights up');
    assert(/useNativeDriver: true/.test(shelf), 'the glow runs on the JS thread');
    assert(/pointerEvents="none"/.test(shelf), 'the glow can swallow a tap on the card');
  });
});
