import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { assert, assertEqual, note, suite, test } from './harness';
import { bottomInsetFor, hasHomeButton, IPHONE_INDICATOR } from '../src/game/safeAreaRules';
import { gridCardWidth, gridColumns, GRID_EDGE, GRID_GAP, MAX_COLUMNS } from '../src/demo/gridRules';
import { fitCamera } from '../src/demo/cameraFit';
import { FIGURE_RADIUS, JAIL_SLOTS, RETREAT_SLOTS } from '../src/game/stations';

const root = join(__dirname, '..');
const src = (p: string) => readFileSync(join(root, p), 'utf8');

/**
 * A phone that changes shape while the game is open.
 *
 * Apple announced the iPhone Duo on 9 Sep 2026: a book-style folding
 * iPhone with two screens, reported at 1422x2088 physical pixels folded
 * and 1920x2713 unfolded. At @3x that is 474x696pt and 640x904pt.
 *
 * Two assumptions in this codebase expired that morning, and both were
 * written down as if they were permanent:
 *
 *   1. "Every iPhone with a home indicator is at least 812pt tall...
 *      Nothing lives in the gap." The folded Duo is 696pt tall and has
 *      no home button. The rule would have returned an inset of ZERO.
 *   2. "Read once: the game is portrait-locked and the home indicator
 *      does not come and go." Unfolding changes the window without
 *      relaunching the app, so a value computed at import is stale.
 *
 * WHAT THESE CAN AND CANNOT PROVE. There is no folding phone in CI and
 * no renderer in this suite. The published dimensions are day-one press
 * figures and may be off. What is pinned is the reasoning: that the
 * inset rule answers correctly for a short screen with no home button,
 * that nothing derives layout from a frozen reading, and that the camera
 * frames the whole battlefield at both shapes. Whether it LOOKS right
 * has to be seen on the hardware.
 */

/** Reported, at @3x. Treated as approximate on purpose. */
const DUO_FOLDED = { w: 474, h: 696 };
const DUO_UNFOLDED = { w: 640, h: 904 };

suite('foldable · the home-indicator inset', () => {
  test('the folded screen is NOT mistaken for a home-button iPhone', () => {
    /*
      The whole bug in one line. 696pt is shorter than the 736pt iPhone
      8 Plus, so a height threshold says "home button, no inset" with
      complete confidence, and the navigation labels land in the strip
      the system takes the swipe from.
    */
    const inset = bottomInsetFor({
      os: 'ios',
      isPad: false,
      longSide: DUO_FOLDED.h,
      shortSide: DUO_FOLDED.w,
    });
    assertEqual(inset, IPHONE_INDICATOR, 'the folded Duo needs the indicator inset');
    assert(!hasHomeButton(DUO_FOLDED.h, DUO_FOLDED.w), 'the folded Duo has no home button');
    note(`folded ${DUO_FOLDED.w}x${DUO_FOLDED.h}pt -> ${inset}pt inset`);
  });

  test('the unfolded screen still gets it', () => {
    const inset = bottomInsetFor({
      os: 'ios',
      isPad: false,
      longSide: DUO_UNFOLDED.h,
      shortSide: DUO_UNFOLDED.w,
    });
    assertEqual(inset, IPHONE_INDICATOR, 'the unfolded Duo needs the indicator inset');
  });

  test('the four real home-button iPhones still get nothing', () => {
    // The fix must not hand 34pt of wasted screen to an iPhone SE.
    for (const [w, h] of [[320, 480], [320, 568], [375, 667], [414, 736]]) {
      assertEqual(
        bottomInsetFor({ os: 'ios', isPad: false, longSide: h, shortSide: w }),
        0,
        `${w}x${h} has a home button`,
      );
    }
  });

  test('an unknown screen errs towards leaving the inset in', () => {
    /*
      The direction of failure is the point. A needless 34pt costs a
      little room; a missing 34pt puts a button where the system takes
      the swipe. Every shape nobody has thought of should land on the
      first side, so hardware announced after this code was written is
      safe by default rather than by luck.
    */
    for (const [w, h] of [[400, 700], [500, 800], [666, 666], [412, 735]]) {
      assertEqual(
        bottomInsetFor({ os: 'ios', isPad: false, longSide: h, shortSide: w }),
        IPHONE_INDICATOR,
        `unknown ${w}x${h} should keep the inset`,
      );
    }
  });

  test('a folded screen the height of an SE is not an SE', () => {
    // 667pt tall but far too wide: matched on both sides, so it cannot
    // be confused with the phone that really does have a home button.
    assertEqual(
      bottomInsetFor({ os: 'ios', isPad: false, longSide: 667, shortSide: 474 }),
      IPHONE_INDICATOR,
      'height alone decided again',
    );
  });
});

suite('foldable · nothing measures the screen only once', () => {
  test('no layout constant is derived at import time', () => {
    /*
      A StyleSheet is built when its module is first imported. Anything
      folded into one from the window size is frozen at that moment, and
      on a folding phone the window size is not a property of the device
      any more — it is a property of right now.
    */
    const area = src('src/game/safeArea.ts');
    assert(
      /export function useBottomInset\(\)/.test(area),
      'there is no hook for the inset, so nothing can react to a fold',
    );
    assert(
      /useWindowDimensions/.test(area),
      'the inset is not read from a reactive source',
    );
  });

  test('the launch-time value is named so it cannot be used by accident', () => {
    /*
      It still exists for the rare caller that cannot use a hook. The
      name is the guard rail: BOTTOM_INSET read like a fact, and
      BOTTOM_INSET_AT_LAUNCH reads like the caveat it is.
    */
    const area = src('src/game/safeArea.ts');
    assert(
      !/export const BOTTOM_INSET\b/.test(area),
      'the old always-correct-sounding name is back',
    );
    assert(
      /BOTTOM_INSET_AT_LAUNCH/.test(area),
      'the launch-time value has lost its warning name',
    );
  });

  test('no screen still imports a frozen inset', () => {
    const { execSync } = require('node:child_process') as typeof import('node:child_process');
    // safeArea.ts is where the launch-time value is DEFINED, and where
    // its warning comment lives; every other file naming it would be a
    // consumer, which is the thing being caught.
    const hits = execSync(
      "grep -rln 'BOTTOM_INSET_AT_LAUNCH\\|BOTTOM_NAV_HEIGHT' src || true",
      { encoding: 'utf8' },
    )
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f && f !== 'src/game/safeArea.ts');
    assertEqual(hits.join(', '), '', 'these still use a value frozen at launch');
  });
});

suite('foldable · the battlefield frames at both shapes', () => {
  /*
    The 3D side needs no change and this proves it rather than assuming
    it: CameraRig re-fits on every canvas resize, and fitCamera is given
    the aspect it is actually handed. These check the two new shapes
    against the same standard every other device is held to.
  */
  const SHAPES = [
    { name: 'Duo folded', aspect: DUO_FOLDED.w / DUO_FOLDED.h },
    { name: 'Duo unfolded (portrait)', aspect: DUO_UNFOLDED.w / DUO_UNFOLDED.h },
    // Reports disagree about whether the open screen is taller or wider
    // than it is square, so the flipped shape is checked too.
    { name: 'Duo unfolded (landscape)', aspect: DUO_UNFOLDED.h / DUO_UNFOLDED.w },
    { name: 'half of an unfolded screen (Split View)', aspect: (DUO_UNFOLDED.w / 2) / DUO_UNFOLDED.h },
  ];

  test('the whole battlefield fits every fold state', () => {
    for (const shape of SHAPES) {
      const camera = new THREE.PerspectiveCamera(50, shape.aspect, 0.1, 200);
      fitCamera(camera, shape.aspect);
      camera.updateMatrixWorld(true);
      const frustum = new THREE.Frustum().setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse,
        ),
      );
      const mustSee = [
        ...JAIL_SLOTS.map((s) => new THREE.Vector3(s.x, s.y + 0.9, s.z)),
        ...RETREAT_SLOTS.flatMap((s) => [
          new THREE.Vector3(s.x - FIGURE_RADIUS, s.y + 0.9, s.z),
          new THREE.Vector3(s.x + FIGURE_RADIUS, s.y + 0.9, s.z),
        ]),
      ];
      for (const point of mustSee) {
        assert(
          frustum.containsPoint(point),
          `${shape.name} (aspect ${shape.aspect.toFixed(3)}) cuts off ` +
            `${point.x.toFixed(1)},${point.z.toFixed(1)}`,
        );
      }
      note(`${shape.name}: aspect ${shape.aspect.toFixed(3)} frames everything`);
    }
  });

  test('the camera re-fits on resize rather than only on mount', () => {
    // Without this the board would keep the folded screen's framing.
    const rig = src('src/demo/CameraRig.tsx');
    assert(
      /\[camera, size\.width, size\.height\]/.test(rig),
      'the camera no longer re-fits when the canvas changes size',
    );
  });
});

suite('foldable · the on-screen ruler', () => {
  /*
    The ruler exists to answer the one question the tests above admit
    they cannot: whether the folded shape LOOKS right. It reads the
    window size back out on screen so that dragging a resizable
    simulator to 474x696pt is a thing you can see rather than guess.

    It is also the one piece of debug UI mounted in the real app, so
    what matters here is that a player can never see it.
  */

  test('the ruler is mounted behind __DEV__, so no player ever sees it', () => {
    // __DEV__ is false in every release bundle AND every OTA update, so
    // this guard is what keeps a debug overlay out of the App Store.
    const app = src('App.tsx');
    assert(/\{__DEV__ && <ScreenRuler \/>\}/.test(app), 'ScreenRuler is not guarded by __DEV__');
    note('App.tsx renders ScreenRuler only when __DEV__');
  });

  test('the ruler names the Duo at exactly the sizes the rest of this file uses', () => {
    // If these ever drift apart, the ruler would say "not a shape we
    // know" on the very screen everything else here is written for.
    const ruler = src('src/debug/ScreenRuler.tsx');
    assert(
      ruler.includes(`[${DUO_FOLDED.w}, ${DUO_FOLDED.h}, 'iPhone Duo (folded)']`),
      'the ruler does not recognise the folded Duo',
    );
    assert(
      ruler.includes(`[${DUO_UNFOLDED.w}, ${DUO_UNFOLDED.h}, 'iPhone Duo (unfolded)']`),
      'the ruler does not recognise the unfolded Duo',
    );
  });

  test('the ruler reads the live window, not a value frozen at import', () => {
    // The same mistake safeArea.ts had to unlearn. A ruler that reports
    // the launch size while you drag the window is worse than none.
    const ruler = src('src/debug/ScreenRuler.tsx');
    assert(/useWindowDimensions\(\)/.test(ruler), 'the ruler does not use useWindowDimensions');
    assert(
      !/Dimensions\.get/.test(ruler),
      'the ruler reads Dimensions.get, which freezes at module scope',
    );
  });
});

suite('foldable · the card grids use the extra width', () => {
  /*
    Found by looking rather than by reasoning, which is the whole point
    of tools/duo-preview: at 640pt across, `width: '31%'` gave a 190pt
    card with a 58pt thumbnail marooned in it. Three columns is a fact
    about a 390pt phone, not a fact about the game.
  */

  test('every real iPhone still gets exactly three columns', () => {
    // The safety property. This change is meant to be invisible on the
    // hardware the family actually holds.
    for (const width of [320, 375, 390, 393, 402, 414, 428, 430, 440]) {
      assertEqual(gridColumns(width), 3, `${width}pt should stay at three columns`);
    }
    note('320-440pt: three columns, unchanged');
  });

  test('the folded Duo stays at three and the unfolded one gains a fourth', () => {
    assertEqual(gridColumns(DUO_FOLDED.w), 3, 'the folded Duo is still phone-shaped');
    assertEqual(gridColumns(DUO_UNFOLDED.w), 4, 'the unfolded Duo should use the room');
    note(
      `folded ${gridColumns(DUO_FOLDED.w)} columns at ${gridCardWidth(DUO_FOLDED.w)}pt, ` +
        `unfolded ${gridColumns(DUO_UNFOLDED.w)} at ${gridCardWidth(DUO_UNFOLDED.w)}pt`,
    );
  });

  test('a row of cards and their gaps always fits the screen', () => {
    /*
      The bug a percentage invites: 33% x 3 plus two 10pt gaps overflows,
      which is why the old value was a hand-tuned 31%. Points do the
      arithmetic instead, so check the arithmetic.
    */
    for (let width = 320; width <= 1366; width += 1) {
      const columns = gridColumns(width);
      const row = gridCardWidth(width) * columns + GRID_GAP * (columns - 1);
      assert(
        row <= width - GRID_EDGE * 2,
        `${width}pt: a row of ${columns} is ${row}pt inside ${width - GRID_EDGE * 2}pt`,
      );
    }
  });

  test('cards never get silly at either end', () => {
    // An iPad is 1024pt wide and would otherwise ask for six or seven
    // columns of postage stamps; a narrow split view would ask for one.
    for (let width = 300; width <= 1366; width += 1) {
      const columns = gridColumns(width);
      assert(columns >= 3 && columns <= MAX_COLUMNS, `${width}pt asked for ${columns} columns`);
      assert(gridCardWidth(width) > 58, `${width}pt: card narrower than its 58pt thumbnail`);
    }
    note(`iPad 1024pt: ${gridColumns(1024)} columns at ${gridCardWidth(1024)}pt`);
  });

  test('the screens ask for the width live, so a fold re-flows the grid', () => {
    for (const file of ['src/demo/InventoryScreen.tsx', 'src/demo/StoreScreen.tsx']) {
      const text = src(file);
      assert(/useGridCardWidth\(\)/.test(text), `${file} does not use useGridCardWidth`);
      assert(
        !/width: '31%'/.test(text),
        `${file} still has the fixed 31% card, which cannot re-flow`,
      );
    }
  });
});
