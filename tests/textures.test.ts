import { readFileSync } from 'node:fs';
import {
  isPerFace,
  DIE_FACE_SLOTS,
  dieFacePixels,
  patternPixels,
  PATTERN_SIZE,
  PatternId,
  shellSampler,
  SMOOTH_EDGES,
} from '../src/dice/patterns';
import { dieShadeTexture, shadeAt, stickerTexture, BEVEL_UV } from '../src/dice/dieShading';
import { DIE_FACE_COLORS } from '../src/game/colors';
import { COLOR_SYMBOLS } from '../src/game/colorblind';
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
    object. Each side now takes its own part of one continuous design:
    the four sides are four squares of one strip that goes once round the
    die, and the top and bottom carry it on over their edges. That every
    edge really joins is tests/continuity.test.ts; these are the rest.
  */
  const face = (skin: (typeof DICE_SKINS)[number], f: number) =>
    dieFacePixels(skin.pattern as Exclude<PatternId, 'plain'>, skin.body, skin.ink ?? skin.body, f);
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

      18 Oct 2026: the noise now repeats once round the die rather than
      once per square, so of those nine only the strictly regular prints
      — candy stripes, tartan — still repeat side to side, and David's
      "same design copied and pasted to every side" is gone from the rest.
      The floor below was raised to match.
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
      const sides = DIE_FACE_SLOTS.map((_, f) => face(skin, f).join(','));
      // Every design painted as a strip must differ side to side: that
      // is the whole point of the strip (20 Oct 2026).
      if (!isPerFace(skin.pattern)) {
        assert(new Set(sides).size > 1, `${skin.id} is painted as a strip but has the same picture on every side`);
      }
      if (new Set(sides).size > 1) {
        unique++;
      } else {
        // Identical, so it must be identical BECAUSE it tiles: the
        // square one along and one up have to match as well, which a
        // one-off coincidence would not.
        const front = cell(0, 0);
        assert(
          cell(1, 0) === front && cell(0, 1) === front,
          `${skin.id} paints one picture on every side without tiling, so the ` +
            'die really is wallpaper',
        );
        tiling++;
      }
    }
    // Was a fixed count (more than forty), which went stale as one-picture-
    // per-side designs were added; the per-skin check above is the real one.
    assert(unique > 30, `only ${unique} skins have different sides — the strip is being ignored`);
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
    let worst = 0;
    let worstId = '';
    for (const skin of DICE_SKINS.filter((s) => s.pattern !== 'plain')) {
      if (isPerFace(skin.pattern)) continue;
      // The front (+Z) and the side to its right (+X), as the die wears them.
      const front = face(skin, 4);
      const right = face(skin, 0);
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
    // `plain` carries no shape at all, on purpose: the starting Ivory is
    // told apart by colour alone. Flagging it is true and useless.
    const SHAPELESS = ['plain'];
    const lum = (px: number[], i: number) =>
      0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];

    /*
      THREE MEASURES, because the first version had only one and MISSED
      SIX SKINS.

      v1.90.0 measured each face's brightest point against its darkest,
      which answers "does this face have light and dark in it". Fish
      passed perfectly with four of its six sides showing nothing but
      rippling water: the ripples are light and dark, and the goldfish —
      the entire point of the skin — were on the other two. Denim and
      basketball hid the same way behind a busy weave.

      So a face is also measured for how much of it is NOT its most
      common colour (the subject, as opposed to the background), and for
      how many distinct colours are on it. A blank side fails at least
      one of the three.
    */
    const faceStats = (px: number[]) => {
      let hi = 0;
      let lo = 255;
      const counts = new Map<number, number>();
      for (let i = 0; i < px.length; i += 3) {
        const l = lum(px, i);
        if (l > hi) hi = l;
        if (l < lo) lo = l;
        const q = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
        counts.set(q, (counts.get(q) ?? 0) + 1);
      }
      return {
        range: hi - lo,
        colours: counts.size,
        design: 1 - Math.max(...counts.values()) / (px.length / 3),
      };
    };

    let tightest = 1;
    let tightestId = '';
    let tightestWhy = '';
    let checked = 0;
    for (const skin of DICE_SKINS) {
      if (SHAPELESS.includes(skin.pattern)) continue;
      checked++;
      const stats = DIE_FACE_SLOTS.map((_, f) => faceStats(face(skin, f)));
      /*
        MEASURED AGAINST THE SHELF PICTURE, not against the other faces.

        This is the third version of this check and the first one that
        works. Comparing the six faces with EACH OTHER cannot see a skin
        whose subject is missing from all of them equally — which is
        exactly what fish was: its four goldfish sit at y=8..56 on the
        painter's own canvas, and not one square of the cube net covers
        that patch, so every side was plain rippling water and all six
        agreed about it perfectly. Verified by deleting fish from the
        per-face set and watching the previous version stay green.

        The picture at the origin is the one the painter was written to
        draw and the one the Store shows on the card. Every side of the
        die has to carry as much as it does.

        A ratio against that, never a fixed number: ruby is a dark stone
        and volleyball nearly white, and any threshold suiting one would
        libel the other.
      */
      const shelf = faceStats(
        patternPixels(
          skin.pattern as Exclude<PatternId, 'plain'>,
          skin.body,
          skin.ink ?? skin.body,
        ),
      );
      /*
        `colours` has ONE exemption, with its reason.

        Counting distinct quantised colours is what caught denim, whose
        orange stitching is too small a fraction of the face to move
        either of the other two measures — 43% against its shelf picture
        while `design` sat at 88%. It is worth keeping for that.

        Galaxy is the one design it cannot judge: large soft nebula
        gradients plus a random star field, where one face happens to
        catch a bright cluster and counts three times the colours of a
        neighbour that is visually just as full. Rendered and looked at
        before granting this — every side of the galaxy die has nebulae
        and stars on it.
      */
      const SOFT_GRADIENTS: Record<string, string> = {
        galaxy: 'soft nebulae and a random star field — the colour COUNT swings, the design does not',
      };
      for (const [why, pick] of [
        ['light and dark', (f: ReturnType<typeof faceStats>) => f.range],
        ['design', (f: ReturnType<typeof faceStats>) => f.design],
        ['colours', (f: ReturnType<typeof faceStats>) => f.colours],
      ] as const) {
        if (why === 'colours' && SOFT_GRADIENTS[skin.id]) continue;
        // The colour COUNT is judged against the shelf picture alone: the
        // top and bottom are painted from two sides blended along their
        // diagonals (patterns.ts, dieFaceSampler), and on a two-tone
        // design those blends count as a dozen extra colours that the
        // four sides, rightly, do not have (the leopard, 20 Oct 2026).
        const reference = why === 'colours' ? pick(shelf) : Math.max(pick(shelf), ...stats.map(pick));
        const ratio = reference === 0 ? 1 : Math.min(...stats.map(pick)) / reference;
        if (ratio < tightest) {
          tightest = ratio;
          tightestId = skin.id;
          tightestWhy = why;
        }
        assert(
          ratio > 0.6,
          `${skin.id}: one side has ${(ratio * 100).toFixed(0)}% of the ${why} its ` +
            'shelf picture has — that is a blank side',
        );
      }
    }
    assert(checked > 40, `only ${checked} skins were checked — the filter is too wide`);
    note(
      `${checked} skins, every side carrying the design; the least even is ` +
        `${tightestId} at ${(tightest * 100).toFixed(0)}% of its ${tightestWhy}`,
    );
  });

  test('the strip is written in three.js face order', () => {
    /*
      An array of materials on a BoxGeometry is matched to its groups in
      the order +X, -X, +Y, -Y, +Z, -Z. Get this wrong and the pattern
      still looks continuous on the flat sheet while being scrambled on
      the actual die — the kind of bug a screenshot of the sheet would
      not show.

      This used to pin the paper cube net, which looked right on paper
      and joined only three of the die's twelve edges. Its intent is the
      same: the order is pinned here, and tests/continuity.test.ts checks
      it against the geometry itself.
    */
    assertEqual(DIE_FACE_SLOTS.length, 6, 'a cube has six sides');
    assertEqual(DIE_FACE_SLOTS[4], 0, '+Z, the front, must be the first square — the shelf picture');
    assertEqual(DIE_FACE_SLOTS[0], 1, '+X carries on from the front');
    assertEqual(DIE_FACE_SLOTS[5], 2, '-Z carries on from +X');
    assertEqual(DIE_FACE_SLOTS[1], 3, '-X carries on from -Z, and back round to the front');
    assertEqual(DIE_FACE_SLOTS[2], null, '+Y is painted from the sides it borders');
    assertEqual(DIE_FACE_SLOTS[3], null, '-Y is painted from the sides it borders');
  });

  test('the shelf picture is the front of the die', () => {
    // What you buy is what you roll: the card is the +Z side, exactly.
    for (const skin of DICE_SKINS.filter((s) => s.pattern !== 'plain')) {
      const pattern = skin.pattern as Exclude<PatternId, 'plain'>;
      if (isPerFace(pattern)) continue;
      const card = patternPixels(pattern, skin.body, skin.ink ?? skin.body).join(',');
      assert(card === face(skin, 4).join(','), `${skin.id}'s card is not the front of its die`);
    }
  });

  test('the shelf pictures still paint one square, not six', () => {
    // The Store and the Inventory show a single face. Painting a whole
    // die for each of 53 cards would undo the speed work in the same
    // release that shipped it.
    const preview = readFileSync('src/dice/preview.ts', 'utf8');
    assert(
      !/DIE_FACE_SLOTS|dieFacePixels|createDieFaceTextures/.test(preview),
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

/**
 * The light painted into an unlit die (src/dice/dieShading.ts), and the
 * edge smoothing in patternPixels — 18 Oct 2026.
 */
suite('textures · baked shading and inset stickers', () => {
  const hexRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

  test('the middle of every sticker is the exact palette colour', () => {
    /*
      The colour IS the game. The rim may be shaded; the middle may not
      move by a single step, with or without the colourblind shape.
    */
    for (const c of DIE_FACE_COLORS) {
      const want = hexRgb(c.hex);
      const tex = stickerTexture(c.hex, null);
      const data = tex.image.data as Uint8Array;
      const N = tex.image.width;
      let checked = 0;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const r = Math.hypot(((x + 0.5) / N) * 2 - 1, ((y + 0.5) / N) * 2 - 1);
          if (r > 0.66) continue;
          const i = (y * N + x) * 4;
          assert(
            data[i] === want[0] && data[i + 1] === want[1] && data[i + 2] === want[2],
            `${c.label}'s sticker is not ${c.hex} at its middle`,
          );
          checked++;
        }
      }
      assert(checked > N * N * 0.3, 'the middle of the sticker was not measured');
    }
  });

  test('the rim is darker than the face, and the same colour family', () => {
    for (const c of DIE_FACE_COLORS) {
      const want = hexRgb(c.hex);
      const tex = stickerTexture(c.hex, null);
      const data = tex.image.data as Uint8Array;
      const N = tex.image.width;
      // Straight out from the centre to the edge, along +x.
      const i = (Math.floor(N / 2) * N + (N - 2)) * 4;
      const rim = [data[i], data[i + 1], data[i + 2]];
      const sum = (v: number[]) => v[0] + v[1] + v[2];
      assert(sum(rim) < sum(want) * 0.8, `${c.label}'s sticker has no darker rim`);
      // The brightest channel of the face is still the brightest of the rim.
      const top = want.indexOf(Math.max(...want));
      assert(
        rim[top] === Math.max(...rim),
        `${c.label}'s rim has changed hue rather than darkened`,
      );
    }
  });

  test('colourblind shapes survive on the inset sticker', () => {
    // The same bounds as the flat symbol stickers in colorblind.test.ts.
    for (const c of DIE_FACE_COLORS) {
      const want = hexRgb(c.hex);
      const tex = stickerTexture(c.hex, COLOR_SYMBOLS[c.id]);
      const data = tex.image.data as Uint8Array;
      const N = tex.image.width;
      let inked = 0;
      let inside = 0;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const r = Math.hypot(((x + 0.5) / N) * 2 - 1, ((y + 0.5) / N) * 2 - 1);
          if (r > 0.66) continue;
          inside++;
          const i = (y * N + x) * 4;
          const differs =
            Math.abs(data[i] - want[0]) +
            Math.abs(data[i + 1] - want[1]) +
            Math.abs(data[i + 2] - want[2]);
          if (differs > 30) inked++;
        }
      }
      const share = inked / inside;
      assert(share > 0.08 && share < 0.75, `${c.label}'s shape covers ${(share * 100).toFixed(1)}%`);
    }
  });

  test('the sticker and shade textures are built once and shared', () => {
    assert(stickerTexture('#cc2533', null) === stickerTexture('#cc2533', null), 'sticker rebuilt');
    assert(dieShadeTexture() === dieShadeTexture(), 'shade map rebuilt');
    const mesh = readFileSync('src/dice/DieMesh.tsx', 'utf8');
    assert(/lightMap: dieShadeTexture\(\)/.test(mesh), 'DieMesh no longer shades the body');
    assert(
      !/new THREE\.MeshStandardMaterial|new THREE\.MeshLambertMaterial|new THREE\.MeshPhongMaterial/.test(mesh),
      'DieMesh has gone back to a lit material — see the beige-die note there',
    );
  });

  test('the shade darkens toward the edges and meets itself at every crest', () => {
    const centre = shadeAt(0.5, 0.5);
    const flatEdge = shadeAt(BEVEL_UV + 0.001, 0.5);
    const crest = shadeAt(0.0005, 0.5);
    const corner = shadeAt(0.0005, 0.0005);
    assert(centre > 0.97 && centre <= 1.001, `the middle of a face is shaded (${centre})`);
    assert(crest < centre * 0.85, `the edge of a face is barely darker (${crest} vs ${centre})`);
    assert(corner < crest, 'a corner is no darker than an edge');
    assert(flatEdge > crest, 'the bevel does not fall away');
    // Two faces meet at a crest, each with its own copy of this map in its
    // own orientation; the four edges must agree or the seam shows.
    for (const t of [0.1, 0.3, 0.5]) {
      const v = [shadeAt(0, t), shadeAt(1, t), shadeAt(t, 0), shadeAt(t, 1)];
      assert(Math.max(...v) - Math.min(...v) < 1e-9, 'the four edges of a face disagree');
    }
    // Stored without clipping, so the glint is not flattened.
    const data = dieShadeTexture().image.data as Uint8Array;
    let max = 0;
    for (let i = 0; i < data.length; i += 4) max = Math.max(max, data[i]);
    assert(max < 255, 'the shade map clips at its brightest');
  });

  test('edge smoothing only ever touches texels on an edge', () => {
    /*
      Everywhere else a smoothed painter must give exactly what a single
      sample gives — the smoothing is for staircases, not a blur.
    */
    for (const skin of DICE_SKINS) {
      if (!SMOOTH_EDGES.has(skin.pattern)) continue;
      const pattern = skin.pattern as Exclude<PatternId, 'plain'>;
      const ink = skin.ink ?? skin.body;
      const px = patternPixels(pattern, skin.body, ink, 1, 1);
      const sample = shellSampler(pattern, skin.body, ink);
      let changed = 0;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const c = sample(x + S, y + S).map(Math.round);
          const i = (y * S + x) * 3;
          if (c[0] !== px[i] || c[1] !== px[i + 1] || c[2] !== px[i + 2]) changed++;
        }
      }
      assert(changed > 0, `${skin.id} is on SMOOTH_EDGES but has no edge to smooth`);
      assert(changed < S * S * 0.5, `${skin.id}: smoothing changed ${changed} of ${S * S} texels`);
    }
  });

  test('every smoothed painter is a smooth function of position', () => {
    /*
      Asked a hair away from a whole texel, a smooth painter gives almost
      the same colour almost everywhere. One that hashes each whole texel
      (a sparkle, a speck, a weave) gives a different one most of the time
      — and averaging those would wash its texture out, not smooth an
      edge. See SMOOTH_EDGES.
    */
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const pattern of SMOOTH_EDGES) {
      const skin = DICE_SKINS.find((s) => s.pattern === pattern);
      if (!skin) continue;
      const sample = shellSampler(pattern as Exclude<PatternId, 'plain'>, skin.body, skin.ink ?? skin.body);
      let jumps = 0;
      const N = 1500;
      for (let k = 0; k < N; k++) {
        const x = Math.floor(rnd() * 256);
        const y = Math.floor(rnd() * 192);
        const a = sample(x, y);
        const b = sample(x + 0.013, y + 0.007);
        if (Math.max(...a.map((v, i) => Math.abs(v - b[i]))) > 10) jumps++;
      }
      assert(jumps / N < 0.03, `${pattern} jumps at ${((jumps / N) * 100).toFixed(1)}% of nudges`);
    }
  });
});
