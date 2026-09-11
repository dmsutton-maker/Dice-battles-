import { readFileSync } from 'node:fs';
import {
  isPerFace,
  CUBE_NET_CELLS,
  patternPixels,
  PATTERN_SIZE,
  PatternId,
} from '../src/dice/patterns';
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

/*
  Every patterned skin, with the ink the die would actually build it
  with. This used to filter on `!!s.ink` — which quietly excluded the
  four skins painted by full-colour painters, since those mix their own
  paint and carry no ink. Those four were the exact four that shipped
  rendering as flat cubes, and this is the test that would have caught
  it and did not, because they had been filtered out of it.
*/
const MATERIALS = DICE_SKINS.filter((s) => s.pattern !== 'plain').map((s) => ({
  ...s,
  ink: s.ink ?? s.body,
}));

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

suite('textures · a die is one object, not six copies of a picture', () => {
  /*
    David, 10 Sep 2026: "make all the dice have unique sides that make
    the entire dice a continuous pattern rather than the same image on
    every side."

    One 64x64 texture used to be handed to the whole box, so a zebra die
    was the same stripes six times and read as wallpaper rather than an
    object. Each side now takes its own square of one continuous design,
    laid out as the paper cube every child cuts out.
  */
  test('a die is continuous, whether or not its sides differ', () => {
    /*
      MEASURED, and the measuring corrected the premise.

      The obvious test is "all six sides must be different pictures", and
      it is wrong. Nine skins — zebra, marble, bee, fish, tiger,
      candycane, chocolate, waffles, tartan — repeat exactly every 64
      pixels, so the square to the right of FRONT is the same image as
      FRONT. For those, identical sides are not the bug: they are what a
      perfectly continuous die looks like, because the stripes carry
      straight over the edge. Forcing them to differ would BREAK the
      continuity David asked for.

      So the rule is continuity, and uniqueness is one way of getting
      there rather than the goal. A skin passes if its sides differ, or
      if it tiles so exactly that they need not.
    */
    let unique = 0;
    let tiling = 0;
    for (const skin of DICE_SKINS.filter((s) => s.pattern !== 'plain')) {
      const cell = (cx: number, cy: number) =>
        patternPixels(
          skin.pattern as Exclude<PatternId, 'plain'>,
          skin.body,
          skin.ink ?? skin.body,
          cx,
          cy,
        ).join(',');
      const front = cell(1, 1);
      const distinct = new Set(CUBE_NET_CELLS.map(([cx, cy]) => cell(cx, cy)));
      if (distinct.size > 1) {
        unique++;
      } else {
        // Identical, so it must be identical BECAUSE it tiles: the
        // square two to the right has to match as well, which a
        // one-off coincidence would not.
        assert(
          cell(3, 1) === front && cell(1, 2) === front,
          `${skin.id} paints one picture on every side without tiling, so the ` +
            'die really is wallpaper',
        );
        tiling++;
      }
    }
    assert(unique > 0, 'no skin has different sides at all — the net is being ignored');
    note(`${unique} skins have six different sides; ${tiling} tile exactly and do not need to`);
  });

  test('the joins land on the edges of the die, and none is grossly wrong', () => {
    /*
      What "continuous" can and cannot mean on a cube.

      A cube cannot be unwrapped flat without cutting some edges, so
      perfect continuity everywhere is not available. What IS true is
      that every join lands on a physical edge of the die, where the
      surface turns ninety degrees — the least visible place a seam can
      be, and the same reason this texture has always been clamped
      rather than wrapped.

      So this is a floor, not a polish check: the jump across a join is
      compared with how much neighbouring columns differ WITHIN a face.
      A noisy skin like galaxy jumps hugely between any two columns, and
      measuring it against a fixed number called it broken when it is
      not. Measured this way almost every skin sits at 1.0-1.4x. Tartan
      and volleyball are the outliers at about 6.7x and 6.2x, and both
      are skins whose sides are identical anyway, so their joins are
      exactly what they were before any of this.
    */
    /*
      THE KIND OF SKIN THIS RULE DOES NOT APPLY TO, read from the code
      rather than listed here.

      A design painted per FACE is one object repeated on each side — a
      pizza, a baseball's seams, a polished highlight. Its joins are not
      seams in a wallpaper: they are the edges of the die, where the
      surface turns ninety degrees and a pizza genuinely stops.

      This used to be a hand-written list of two metals. It is now
      `isPerFace` from patterns.ts, so the exemption cannot drift from
      the thing it describes — which matters, because ten more designs
      joined that set on 11 Sep 2026 when David reported "a lot of skins
      don't have any of the designs on some of their sides".
    */

    const S = PATTERN_SIZE;
    const cell = (skin: (typeof DICE_SKINS)[number], cx: number, cy: number) =>
      patternPixels(
        skin.pattern as Exclude<PatternId, 'plain'>,
        skin.body,
        skin.ink ?? skin.body,
        cx,
        cy,
      );
    let worst = 0;
    let worstId = '';
    for (const skin of DICE_SKINS.filter((s) => s.pattern !== 'plain')) {
      if (isPerFace(skin.pattern)) continue;
      const front = cell(skin, 1, 1);
      const right = cell(skin, 2, 1);
      let inside = 0;
      let n = 0;
      for (let x = 1; x < S; x++) {
        for (let y = 0; y < S; y++) {
          inside += Math.abs(front[(y * S + x) * 3] - front[(y * S + x - 1) * 3]);
          n++;
        }
      }
      inside /= n;
      let seam = 0;
      for (let y = 0; y < S; y++) {
        seam += Math.abs(front[(y * S + S - 1) * 3] - right[y * S * 3]);
      }
      seam /= S;
      const ratio = seam / (inside + 1);
      if (ratio > worst) {
        worst = ratio;
        worstId = skin.id;
      }
    }
    assert(
      worst < 9,
      `${worstId} jumps ${worst.toFixed(1)}x its own texture at the join — that is ` +
        'a hard line down the middle of an edge, not a corner turn',
    );
    note(`worst join: ${worstId} at ${worst.toFixed(1)}x its own within-face variation`);

    note(
      `${DICE_SKINS.filter((k) => isPerFace(k.pattern)).length} per-face skins are ` +
        'exempt from the join rule',
    );
  });

  /**
   * NO SIDE OF ANY DIE IS BLANK.
   *
   * David, 11 Sep 2026: "a lot of skins don't have any of the designs on
   * some of their sides and it's just a blank one or two colors."
   *
   * He diagnosed it himself, and correctly: since v1.76.0 each side takes
   * its own square of one continuous design laid out as a paper cube net,
   * so a painter that places its motif at particular SHEET coordinates —
   * one pizza, one baseball's seams, one bowling ball's finger holes —
   * puts it on the two or three squares it covers and leaves the others
   * empty. Ten skins were doing exactly that.
   *
   * THIS RUNS ON EVERY SKIN, not only the ones exempt from the join rule
   * above, and that is the whole point. The first version checked only
   * the exempt ones, and taking a skin OUT of the per-face set then
   * removed it from this check in the same move — so the fault could be
   * reintroduced and nothing would say a word. Found by doing exactly
   * that on purpose.
   */
  test('every side of every die carries the design', () => {
    /*
      `plain` and `satin` carry no shape at all, on purpose: the starting
      Ivory and the three ladder prizes are told apart by colour alone.
      Flagging them is true and useless.
    */
    const SHAPELESS = ['plain', 'satin'];
    const lum = (px: number[], i: number) =>
      0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    const faceRange = (px: number[]) => {
      let hi = 0;
      let lo = 255;
      for (let i = 0; i < px.length; i += 3) {
        const l = lum(px, i);
        if (l > hi) hi = l;
        if (l < lo) lo = l;
      }
      return hi - lo;
    };

    let tightest = 1;
    let tightestId = '';
    let checked = 0;
    for (const skin of DICE_SKINS) {
      if (SHAPELESS.includes(skin.pattern)) continue;
      checked++;
      const ranges = CUBE_NET_CELLS.map(([cx, cy]) =>
        faceRange(
          patternPixels(
            skin.pattern as Exclude<PatternId, 'plain'>,
            skin.body,
            skin.ink ?? skin.body,
            cx,
            cy,
          ),
        ),
      );
      const quietest = Math.min(...ranges);
      const busiest = Math.max(...ranges);
      /*
        Measured against the BUSIEST side of the same die, never against
        a fixed number: ruby is a dark stone and volleyball is nearly
        white, and any threshold that suited one would libel the other.
        A blank side is one much quieter than its own siblings.
      */
      const ratio = busiest === 0 ? 1 : quietest / busiest;
      if (ratio < tightest) {
        tightest = ratio;
        tightestId = skin.id;
      }
      assert(
        ratio > 0.5,
        `${skin.id}: one side carries ${(ratio * 100).toFixed(0)}% of the design the ` +
          'busiest side has — that is a blank side',
      );
    }
    assert(checked > 40, `only ${checked} skins were checked — the filter is too wide`);
    note(
      `${checked} skins, every side carrying the design; the least even is ` +
        `${tightestId} at ${(tightest * 100).toFixed(0)}%`,
    );
  });

  test('the net is written in three.js face order', () => {
    /*
      An array of materials on a BoxGeometry is matched to its groups in
      the order +X, -X, +Y, -Y, +Z, -Z. Get this wrong and the pattern
      still looks continuous on the flat sheet while being scrambled on
      the actual die — the kind of bug a screenshot of the net would not
      show.
    */
    assertEqual(CUBE_NET_CELLS.length, 6, 'a cube has six sides');
    assertEqual(CUBE_NET_CELLS[4].join(','), '1,1', '+Z must be the middle of the net');
    assertEqual(CUBE_NET_CELLS[0].join(','), '2,1', '+X sits to the right of it');
    assertEqual(CUBE_NET_CELLS[1].join(','), '0,1', '-X sits to the left of it');
    assertEqual(CUBE_NET_CELLS[2].join(','), '1,0', '+Y sits above it');
    assertEqual(CUBE_NET_CELLS[3].join(','), '1,2', '-Y sits below it');
  });

  test('the shelf pictures still paint one square, not six', () => {
    // The Store and the Inventory show a single face. Painting a whole
    // die for each of 53 cards would undo the speed work in the same
    // release that shipped it.
    const preview = readFileSync('src/dice/preview.ts', 'utf8');
    assert(
      !/CUBE_NET_CELLS|createDieFaceTextures/.test(preview),
      'the shelf pictures now paint all six sides of every die',
    );
  });

  test('the six sides are cached for the life of the app', () => {
    // Six times the painting, and DieMesh's useMemo only lasts as long
    // as one component — the dice remount whenever the scene rebuilds.
    const src = readFileSync('src/dice/patterns.ts', 'utf8');
    assert(
      /cachedTexture\(`die:\$\{pattern\}/.test(src),
      'the die faces are not in the app-wide cache, so they repaint on every roll',
    );
  });
});
