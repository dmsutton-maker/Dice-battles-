import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  bottomInsetWith,
  HUD_SIDE,
  HUD_TOP,
  hudFrame,
  insetsFromLayout,
  IPHONE_INDICATOR,
} from '../src/game/safeAreaRules';
import { gridColumns } from '../src/demo/gridRules';

/**
 * Apple's "Designing for iPhone Duo" (HIG, 9 Sep 2026), which David sent
 * on 1 Nov 2026: "make sure the game design matches iphone duo design
 * when needed."
 *
 * What the guidance says that this game can act on today:
 *
 *   - "Use size classes, layout margins, and safe area insets to lay out
 *     controls and content. Avoid fixed widths and display-specific
 *     dependencies." The top of every screen assumed a status bar across
 *     the top (pills at y52, pages from y100). On the outer screen the
 *     status bar and camera run down the SIDE. Now measured.
 *   - "In a grid-style layout, prefer an even number of columns so
 *     content divides cleanly" across the fold. The unfolded screen gets
 *     four.
 *
 * What it cannot act on yet, and why: the fold itself. Apple reports it
 * through `ReservedRegion`, a new native API that React Native and Expo
 * SDK 54 do not expose. Until a build on a toolchain that has it, the game
 * cannot know the phone is half-open, so it keeps its layout and stays
 * playable, which is what Apple asks of a game: "Make your game playable
 * in every device pose ... fill the screen".
 *
 * As ever: no Duo and no simulator here. These pin the reasoning; how it
 * LOOKS needs the hardware or Xcode's Device Hub.
 */
const root = join(__dirname, '..');
const src = (p: string) => readFileSync(join(root, p), 'utf8');

suite('iPhone Duo · the top of the screen follows the safe area', () => {
  test('every iPhone with a status bar across the top is exactly as before', () => {
    // SE, notch, Dynamic Island, 16 Pro: the system's own top insets.
    for (const top of [20, 47, 50, 54, 59, 62]) {
      const f = hudFrame({ top, left: 0, right: 0, bottom: 34 });
      assertEqual(f.top, HUD_TOP, `top inset ${top}: the pills moved`);
      assertEqual(f.shift, 0, `top inset ${top}: the pages moved`);
      assertEqual(f.left, HUD_SIDE, `top inset ${top}: the pills moved sideways`);
    }
    // And before anything is measured, the old fixed figures.
    assertEqual(hudFrame(null).top, HUD_TOP, 'unmeasured');
    assertEqual(hudFrame(null).shift, 0, 'unmeasured shift');
  });

  test('no status bar across the top (the outer screen): the band is given back', () => {
    const f = hudFrame({ top: 0, left: 0, right: 0, bottom: 20 });
    note(`no top bar: pills at y${f.top}, everything below moves ${f.shift}pt`);
    assert(f.top < HUD_TOP && f.top >= 10, `pills at y${f.top}`);
    assertEqual(f.shift, f.top - HUD_TOP, 'the pages move with the pills');
  });

  test('a camera or status bar down one side pushes the pills off it', () => {
    // The outer screen, if the app ever draws under the side strip (a
    // build on Xcode 27 or later; Xcode 26 builds are kept out of it).
    const left = hudFrame({ top: 0, left: 44, right: 0, bottom: 20 });
    assert(left.left >= 44 + 8, `pills at x${left.left}, under a 44pt strip`);
    assertEqual(left.right, HUD_SIDE, 'the other side moved for nothing');
    const right = hudFrame({ top: 0, left: 0, right: 44, bottom: 20 });
    assert(right.right >= 44 + 8, `Settings row at ${right.right} from the right, under a 44pt strip`);
  });

  test('the bottom inset is the measured one on iOS, the table elsewhere', () => {
    const facts = { os: 'ios', isPad: false, longSide: 678, shortSide: 466 };
    assertEqual(bottomInsetWith(null, facts), IPHONE_INDICATOR, 'unmeasured falls back to the table');
    assertEqual(bottomInsetWith({ top: 0, left: 0, right: 0, bottom: 21 }, facts), 21, 'measured wins');
    assertEqual(
      bottomInsetWith({ top: 0, left: 0, right: 0, bottom: 21 }, { ...facts, os: 'android' }),
      12,
      'Android has no measurement',
    );
  });

  test('the measurement reads the padded view correctly', () => {
    const i = insetsFromLayout({ x: 44, y: 0, width: 422, height: 657 }, { width: 466, height: 678 });
    assertEqual(JSON.stringify(i), JSON.stringify({ top: 0, left: 44, right: 0, bottom: 21 }), 'insets from layout');
  });
});

suite('iPhone Duo · nothing in the top band is pinned to y52 any more', () => {
  test('the pills, the Settings row, the quit button, scoreboard, callout, pages, banner and preview bar follow the frame', () => {
    assert(/useHudFrame\(\)/.test(src('src/demo/StatsHud.tsx')), 'the pills');
    assert(/top: hud\.top, right: hud\.right/.test(src('src/demo/TopButtons.tsx')), 'the Settings row');
    const screen = src('src/demo/DiceDemoScreen.tsx');
    assert(/styles\.quitButton, \{ top: hud\.top, left: hud\.left \}/.test(screen), 'the quit button');
    assert(/styles\.scoreboard, \{ top: 54 \+ hud\.shift \}/.test(screen), 'the scoreboard');
    assert(/styles\.calloutWrap, \{ top: 150 \+ hud\.shift \}/.test(screen), 'the callout');
    assert(/paddingTop: 100 \+ hud\.shift/.test(screen), 'the battle picker');
    assert(/paddingTop: MENU_PAGE_TOP \+ useHudFrame\(\)\.shift/.test(src('src/demo/BottomNav.tsx')), 'the menu pages');
    assert(/paddingTop: 54 \+ hud\.shift/.test(src('src/demo/ChallengeBanner.tsx')), 'the challenge banner');
    assert(/marginTop: 46 \+ hud\.shift/.test(src('src/demo/ItemPreviewBar.tsx')), 'the preview bar');
    for (const page of ['InventoryScreen', 'StoreScreen', 'LeaderboardScreen', 'TournamentScreen']) {
      assert(/useMenuPageArea\(\)/.test(src(`src/demo/${page}.tsx`)), `${page} does not use the shared page area`);
    }
  });

  test('the probe is mounted at the root, and imports nothing outside React Native', () => {
    assert(/<SafeInsetsProbe \/>/.test(src('App.tsx')), 'the probe is not mounted');
    const probe = src('src/game/safeInsets.tsx');
    // Ships over the air: nothing native beyond what is in every binary.
    const imports = [...probe.matchAll(/(?:from|require\()\s*'([^']+)'/g)].map((m) => m[1]);
    for (const m of imports) {
      assert(
        m === 'react' || m.startsWith('react-native') || m.startsWith('./'),
        `safeInsets.tsx imports ${m}`,
      );
    }
  });
});

suite('iPhone Duo · the fold', () => {
  test('the unfolded screen gets an even number of grid columns', () => {
    // Apple: "prefer an even number of columns so content divides cleanly"
    // when the phone is half-open. 626pt wide gives four.
    const cols = gridColumns(626);
    note(`unfolded: ${cols} columns; folded: ${gridColumns(466)}`);
    assertEqual(cols % 2, 0, 'an odd number of columns straddles the fold');
  });
});
