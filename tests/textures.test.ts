import { readFileSync } from 'node:fs';
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

  test('granite is flecked, but no longer television static', () => {
    // Two bounds, because both failures are real and they are opposite.
    //
    // Too smooth and granite is fog: its whole character is per-pixel
    // flecks, and a blurred version would still pass the flat-square test.
    // Too harsh and it is static: this test used to demand 200 jumps of
    // more than 25 tone, and granite duly delivered 1258 of them, which is
    // what David was looking at when he asked for smoother stone. A guard
    // written to protect one quality had quietly mandated the fault.
    const t = tones('granite', '#9aa0a6', '#eef1f4');
    const jumpsOver = (delta: number) => {
      let n = 0;
      for (let i = 1; i < t.length; i++) if (Math.abs(t[i] - t[i - 1]) > delta) n++;
      return n;
    };
    const gentle = jumpsOver(8);
    const harsh = jumpsOver(25);
    note(`granite: ${gentle} gentle flecks, ${harsh} harsh ones`);
    assert(gentle > 800, `granite has lost its flecks — only ${gentle} left`);
    assert(harsh < 400, `granite is back to static — ${harsh} hard jumps`);
  });

  test('the materials are ramps, not staircases', () => {
    // What "smoother" actually meant. Wood, marble and granite each used
    // to pick a tone from a ladder of `if (v > 0.86) return 0.95`
    // thresholds, so the whole 64x64 face was painted in FIVE tones and
    // every threshold crossing was a hard cliff — the blocky staircase
    // edges that made wood read as corduroy and marble as cut paper.
    // Counting how many distinct tones a painter actually produces
    // separates a ramp from a ladder in one number.
    const MATERIALS_UNDER_TEST: [Exclude<PatternId, 'plain'>, string, string][] = [
      ['wood', '#c49a68', '#7d5228'],
      ['marble', '#f2efe8', '#7f8792'],
      ['granite', '#9aa0a6', '#eef1f4'],
    ];
    for (const [pattern, body, ink] of MATERIALS_UNDER_TEST) {
      const levels = new Set(tones(pattern, body, ink)).size;
      note(`${pattern}: ${levels} distinct tones`);
      // Before this change these were 5, 5 and 7. Stripes, which is meant
      // to be flat, is 2 — so this genuinely distinguishes the two kinds
      // of pattern rather than passing everything.
      assert(levels > 40, `${pattern} paints only ${levels} tones — it is stepping, not ramping`);
    }
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

suite('textures · frost is snow, not a sparkle', () => {
  /**
   * Frost used to be three needles crossed through a point — a six-pointed
   * asterisk. David asked for snowflakes, and the difference between the
   * two is BRANCHES: a snowflake has dendrites angled off each arm.
   */
  const S = PATTERN_SIZE;
  const t = tones('frost', '#e8f6ff', '#9fd3f0');
  // Halfway between the palest and darkest tone the painter actually
  // produces. A fixed number does not work here: frost's shell is a very
  // pale blue at tone 243 and its ink only reaches 199, so a threshold
  // picked by eye counted the whole texture as ink and both of these
  // tests passed on nothing.
  const midTone = (Math.max(...t) + Math.min(...t)) / 2;
  const lit = (x: number, y: number) => t[(y % S) * S + (x % S)] < midTone;

  test('the arms carry branches, not bare spikes', () => {
    // Walk a ring around a flake's centre and count how many separate runs
    // of ink it crosses. A bare six-armed asterisk crosses six times at
    // every radius. A branched flake crosses MORE than six part way out,
    // because the dendrites are out there beside the arms.
    const crossingsAt = (cx: number, cy: number, radius: number) => {
      let runs = 0;
      let prev = false;
      const steps = 180;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const on = lit(Math.round(cx + Math.cos(a) * radius), Math.round(cy + Math.sin(a) * radius));
        if (on && !prev) runs++;
        prev = on;
      }
      return runs;
    };
    // The flake centred in the first cell — cell is 32, so its middle is 16,16.
    const near = crossingsAt(16, 16, 5);
    const mid = crossingsAt(16, 16, 7);
    note(`frost: ${near} ink runs close in, ${mid} further out`);
    assert(
      Math.max(near, mid) > 6,
      'frost crosses six arms and nothing else — it is an asterisk, not a snowflake',
    );
  });

  test('flakes differ from one another', () => {
    // A grid of identical flakes at identical angles reads as wallpaper.
    // Two cells of the texture, compared pixel for pixel.
    const cell = 32;
    let same = 0;
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        if (lit(x, y) === lit(x + cell, y)) same++;
      }
    }
    const agreement = (same / (cell * cell)) * 100;
    note(`frost: two neighbouring flakes agree on ${agreement.toFixed(0)}% of pixels`);
    assert(agreement < 97, 'every flake is the same flake');
  });
});

/**
 * How the shell texture meets the edges of a face.
 *
 * A 2x2 tiled render of Timber and Marble on 25 Aug 2026 showed a hard
 * line down the join, and the first instinct was to call it a seam bug
 * and make every painter tile. It is not one: a cube's UVs run 0..1 per
 * face and `repeat` is never set on this texture, so each face shows the
 * image once and its edges only ever meet at a physical corner of the
 * die. Three other skins "failed" a tiling test written on that wrong
 * premise, and fixing them would have been work in service of nothing.
 *
 * What IS true is that repeat wrapping made linear filtering blend the
 * outermost texels with the opposite edge of the pattern. Clamping is
 * both correct for a 0..1 map and free.
 */
suite('textures · the shell clamps to the edge of each face', () => {
  test('the die texture is not set up to tile', () => {
    const source = readFileSync('src/dice/patterns.ts', 'utf8');
    const setup = source.slice(source.indexOf('export function createPatternTexture'));
    assert(
      /wrapS = THREE\.ClampToEdgeWrapping/.test(setup) &&
        /wrapT = THREE\.ClampToEdgeWrapping/.test(setup),
      'the die shell is back on repeat wrapping, which bleeds the far edge of the pattern into the rim of every face',
    );
    assert(
      !/repeat\.set/.test(setup),
      'the die texture is being tiled — every painter would then need to wrap, which none of them promises',
    );
  });
});
