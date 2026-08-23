import { patternPixels, PATTERN_SIZE, PatternId } from '../src/dice/patterns';
import { DICE_SKINS } from '../src/game/diceSkins';
import { assert, assertEqual, note, suite, test } from './harness';

/**
 * The material textures are pure maths with no picture attached, which is
 * the failure mode: a painter whose numbers are slightly wrong still
 * returns a valid texture, it just returns a flat square, or a stripe, or
 * — as marble did on the first attempt — a contour map. tsc cannot see any
 * of that and neither can a test that only checks the file parses.
 *
 * So these measure the pixels: how much of the face the pattern covers,
 * how many distinct tones it produces, and whether it varies in the
 * direction it is supposed to.
 */

const S = PATTERN_SIZE;

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

/** Luminance per pixel, in one row-major array. */
function tones(pattern: Exclude<PatternId, 'plain'>, body: string, ink: string): number[] {
  const px = patternPixels(pattern, body, ink);
  const out: number[] = [];
  for (let i = 0; i < px.length; i += 3) {
    out.push(0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]);
  }
  return out;
}

const MATERIALS = DICE_SKINS.filter(
  (s): s is typeof s & { ink: string } => s.pattern !== 'plain' && !!s.ink,
);

suite('textures · every patterned die actually has a picture on it', () => {
  test('no pattern comes out as a flat square', () => {
    for (const skin of MATERIALS) {
      const t = tones(skin.pattern as Exclude<PatternId, 'plain'>, skin.body, skin.ink);
      const spread = Math.max(...t) - Math.min(...t);
      note(`${skin.name}: ${spread.toFixed(0)} tones between darkest and lightest`);
      assert(
        spread > 18,
        `${skin.name} is very nearly a flat colour (spread ${spread.toFixed(1)})`,
      );
    }
  });

  /*
   * There was a test here twice, and both versions were wrong.
   *
   * The first counted how much of the face carried pattern, and failed
   * marble for being 97% pale stone with thin veins — which is what
   * marble is. The second measured how far the pattern moves the shell's
   * average tone, and failed Zebra for being half black — which is what a
   * zebra is.
   *
   * The thing worth guarding is real: the face-separation check reads
   * `body`, but what a player sees is body plus pattern, so a pattern
   * could in principle repaint a shell out from under that check. Neither
   * measurement captured it, and picking a threshold that happens to fit
   * the skins we have today would be a snapshot rather than a guard. Left
   * out on purpose rather than left in wrong.
   */

  test('wood grows rings across the grain, not along it', () => {
    // The rings run in one direction. If the variation were the same both
    // ways it would be noise, and if it were larger along the grain the
    // planks would be running the wrong way.
    const t = tones('wood', '#c49a68', '#7d5228');
    const spreadDown = variationAlong(t, 'column');
    const spreadAcross = variationAlong(t, 'row');
    note(`wood: ${spreadDown.toFixed(1)} down the face vs ${spreadAcross.toFixed(1)} across`);
    assert(
      spreadDown > spreadAcross * 1.5,
      'wood rings are not running in a consistent direction',
    );
  });

  test('polished gold has one sweep of light, not a stripe repeat', () => {
    // The first attempt was a cosine, which repeats — it read as a ribbon.
    // A single sweep means the brightest run of the diagonal is one band,
    // so counting how often the tone crosses its own midpoint separates
    // the two: a repeating stripe crosses many times.
    const t = tones('sheen', '#ffd76a', '#fff8dc');
    const diagonal: number[] = [];
    for (let i = 0; i < S; i++) diagonal.push(t[i * S + i]);
    const mid = (Math.max(...diagonal) + Math.min(...diagonal)) / 2;
    let crossings = 0;
    for (let i = 1; i < diagonal.length; i++) {
      if (diagonal[i - 1] <= mid && diagonal[i] > mid) crossings++;
      if (diagonal[i - 1] > mid && diagonal[i] <= mid) crossings++;
    }
    note(`gold: ${crossings} light/dark crossings down the highlight`);
    assert(crossings <= 4, `gold reads as ${crossings / 2} stripes, not one sweep of light`);
  });

  test('granite is speckled at the scale of single pixels', () => {
    // Its whole character is per-pixel flecks. A blurry version would pass
    // the flat-square test while looking like fog.
    const t = tones('granite', '#9aa0a6', '#eef1f4');
    let jumps = 0;
    for (let i = 1; i < t.length; i++) if (Math.abs(t[i] - t[i - 1]) > 25) jumps++;
    note(`granite: ${jumps} hard pixel-to-pixel jumps`);
    assert(jumps > 200, 'granite has lost its flecks');
  });

  test('every pattern the skins use is one a painter knows', () => {
    // A typo in a skin's pattern id would throw at texture-build time on
    // the device and nowhere earlier.
    for (const skin of MATERIALS) {
      const px = patternPixels(skin.pattern as Exclude<PatternId, 'plain'>, skin.body, skin.ink);
      assertEqual(px.length, S * S * 3, `${skin.name} did not paint a full texture`);
    }
  });
});

/** Mean absolute step between neighbours, down columns or across rows. */
function variationAlong(t: number[], axis: 'row' | 'column'): number {
  let total = 0;
  let n = 0;
  for (let y = 1; y < S; y++) {
    for (let x = 1; x < S; x++) {
      const here = t[y * S + x];
      const prev = axis === 'row' ? t[y * S + (x - 1)] : t[(y - 1) * S + x];
      total += Math.abs(here - prev);
      n++;
    }
  }
  return total / n;
}
