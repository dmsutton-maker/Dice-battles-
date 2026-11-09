import { readFileSync } from 'node:fs';
import { assert, assertEqual, note, suite, test } from './harness';
import { THEME } from '../src/ui/theme';

/**
 * The app icon, in the three variants iOS asks for on the Customize
 * screen.
 *
 * Each one has a DIFFERENT transparency requirement, and getting one
 * wrong is invisible here and obvious on a phone. The rules are not
 * ours — they come from what Expo's prebuild does to each file
 * (`@expo/prebuild-config/build/plugins/icons/withIosIcons.js`):
 *
 *   light   strips transparency and flattens on WHITE
 *           -> must already be opaque, carrying its own cream ground,
 *              or the dice end up on white instead of paper
 *   dark    PRESERVES transparency
 *           -> must have a clear background, because iOS draws the dark
 *              backdrop itself; shipping our own doubles it up
 *   tinted  strips transparency and flattens on WHITE
 *           -> greyscale on a light ground
 */

const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;

/** Minimal PNG header reader: size, colour type, and whether alpha is used. */
function readPng(path: string) {
  const buf = readFileSync(path);
  assertEqual(buf.readUInt32BE(0), 0x89504e47, `${path} is not a PNG`);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  // Colour type 6 = RGBA, 4 = grey+alpha, 3 = palette (may carry tRNS).
  const colourType = buf[25];
  const hasAlphaChannel = colourType === 6 || colourType === 4;
  return { width, height, colourType, hasAlphaChannel };
}

suite('app icon · the three variants iOS asks for', () => {
  test('all three are declared, and the base icon is the light one', () => {
    const icon = app.ios?.icon;
    assert(
      icon && typeof icon === 'object',
      'ios.icon is a single path again — the Customize screen gets no dark or tinted version',
    );
    for (const variant of ['light', 'dark', 'tinted']) {
      assert(
        typeof icon[variant] === 'string' && icon[variant].length > 0,
        `the ${variant} icon is missing`,
      );
    }
    assertEqual(
      app.icon,
      icon.light,
      'the base icon and the iOS light icon disagree, so Android and iOS would ship different artwork',
    );
  });

  test('every variant is 1024 square, as Apple requires', () => {
    const icon = app.ios.icon;
    for (const variant of ['light', 'dark', 'tinted'] as const) {
      const { width, height } = readPng(icon[variant]);
      note(`${variant}: ${width}x${height}`);
      assertEqual(width, 1024, `the ${variant} icon is ${width}px wide`);
      assertEqual(height, 1024, `the ${variant} icon is ${height}px tall`);
    }
  });

  test('dark keeps its transparency and light does not', () => {
    /*
      The one that cannot be checked by looking at the files in a viewer,
      because a transparent background and a white one look identical on
      a white page.
    */
    const dark = readPng(app.ios.icon.dark);
    assert(
      dark.hasAlphaChannel,
      'the dark icon has no alpha channel — iOS will draw its dark backdrop UNDER an opaque square, so the icon gets a visible slab behind it',
    );
    const light = readPng(app.ios.icon.light);
    assert(
      !light.hasAlphaChannel,
      'the light icon carries alpha — Expo flattens it onto WHITE, so the dice would sit on white rather than on paper',
    );
  });

  test('the Android icon matches the paper ground', () => {
    // Android draws its own background behind the adaptive foreground.
    // Left on the old design's pale blue, the two platforms shipped
    // visibly different icons.
    assertEqual(
      String(app.android?.adaptiveIcon?.backgroundColor ?? '').toLowerCase(),
      THEME.ground.toLowerCase(),
      'the Android icon background is not the game’s paper colour',
    );
  });

  test('the layers Icon Composer needs are kept alongside', () => {
    /*
      Liquid Glass is not something a flat PNG can have: iOS gives every
      icon the system shape, but the depth is rendered from LAYERED
      artwork in a `.icon` bundle, and those are built in Icon Composer
      on a Mac. These are the layers that go into it — losing them means
      redrawing the icon to make the glass version.
    */
    for (const layer of ['1-background', '2-dice', '3-colour-bar']) {
      const { width } = readPng(`assets/icon/layers/${layer}.png`);
      assertEqual(width, 1024, `the ${layer} layer is the wrong size`);
    }
    const readme = readFileSync('assets/icon/README.md', 'utf8');
    assert(
      /Icon Composer/.test(readme),
      'the note explaining how to build the Liquid Glass icon is gone',
    );
  });
});
