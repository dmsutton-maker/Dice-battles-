import * as THREE from 'three';

/**
 * Procedural patterns for dice shells. Built pixel by pixel because React
 * Native has no canvas API, the same way the arena floors are made.
 *
 * A pattern only ever paints the SHELL. The six coloured face stickers are
 * drawn on top of it and are the game signal, so a pattern can never change
 * how a roll reads — but it can still crowd a face, which is why the
 * pattern colours stay close to the shell colour rather than competing
 * with the palette.
 */
export type PatternId =
  | 'plain'
  | 'stripes'
  | 'spots'
  | 'stars'
  | 'grain'
  | 'bubbles'
  | 'frost'
  | 'wood'
  | 'marble'
  | 'granite'
  | 'sheen'
  | 'brushed'
  // The 26 Aug 2026 batch — David asked for ~40 new skins. Mask painters:
  | 'rosettes'
  | 'tigerStripes'
  | 'patches'
  | 'giraffe'
  | 'bands'
  | 'peacock'
  | 'fish'
  | 'shell'
  | 'diamonds'
  | 'paws'
  | 'basketball'
  | 'soccer'
  | 'tennis'
  | 'baseball'
  | 'laces'
  | 'dimples'
  | 'bowling'
  | 'waffle'
  | 'cookie'
  | 'candyStripes'
  | 'strawberry'
  | 'honeycomb'
  | 'chocolate'
  | 'citrus'
  | 'denim'
  | 'circuit'
  // Materials for the trophy ladder, added 26 Aug 2026 when David asked
  // for the skins to be "more accurate and textured if they need
  // texture". Ruby, Slate, Copper and Ocean are named after MATERIALS,
  // and a material with no texture is just a colour.
  | 'ruby'
  | 'slate'
  | 'copper'
  | 'ocean'
  // Full-colour painters (see COLOR_PAINTERS):
  | 'volleyball'
  | 'watermelon'
  | 'pizza'
  | 'donut'
  | 'rainbow'
  | 'galaxy'
  | 'camo'
  | 'tartan';

const SIZE = 64;

/**
 * How much of a face the coloured sticker covers, as a fraction of the
 * face's width.
 *
 * DieMesh draws the six colour stickers as circles of this radius at the
 * dead CENTRE of each face, and a face shows this texture exactly once,
 * so in tile terms the middle disc of radius `STICKER_FRACTION * SIZE`
 * is never seen. A pattern that puts its design there has drawn it for
 * nobody.
 *
 * David, 26 Aug 2026: "a lot of the dice are messed up because the
 * design is in the center, which doesn't make sense because the colors
 * are in the center." Eleven of the forty-three patterned skins were
 * doing exactly that — the Football's laces had ten times as much ink
 * under the sticker as outside it, so every face rendered as blank
 * leather, and the Soccer Ball's one pentagon was entirely hidden.
 *
 * The constant is exported so DieMesh reads it too: if the sticker ever
 * changes size, the tests that guard this move with it instead of
 * quietly measuring the wrong circle.
 */
export const STICKER_FRACTION = 0.33;
const STICKER_RADIUS = SIZE * STICKER_FRACTION;

type Painter = (x: number, y: number) => number;

/**
 * How dark a mask of -1 makes the shell. The dice are rendered UNLIT (see
 * DieMesh — two dice under real lights rendered as different whites on
 * device, so lighting was taken off them entirely), which means a shell
 * gets no highlight or shadow from the scene. Anything that should look
 * like a material rather than a flat colour has to have its light painted
 * into the texture.
 */
const SHADE_DEPTH = 0.55;

/**
 * Value noise that TILES at the texture's own size.
 *
 * Every painter here is sampled over a 64x64 square that wraps round a
 * die face, so anything built from `Math.sin(x / 21)` meets its own far
 * edge mid-stride and leaves a visible seam. Rendering the old wood and
 * marble tiled 2x2 showed exactly that: a hard vertical join straight
 * down the middle. This lattice is indexed modulo the tile, so the left
 * edge genuinely is the right edge.
 */
function hashCell(ix: number, iy: number): number {
  return Math.abs((Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453) % 1);
}

function wrappedNoise(x: number, y: number, period: number): number {
  const cells = SIZE / period;
  const gx = Math.floor(x / period);
  const gy = Math.floor(y / period);
  const fx = x / period - gx;
  const fy = y / period - gy;
  const at = (ix: number, iy: number) =>
    hashCell(((ix % cells) + cells) % cells, ((iy % cells) + cells) % cells);
  const ease = (t: number) => t * t * (3 - 2 * t);
  const sx = ease(fx);
  const sy = ease(fy);
  const top = at(gx, gy) + (at(gx + 1, gy) - at(gx, gy)) * sx;
  const bot = at(gx, gy + 1) + (at(gx + 1, gy + 1) - at(gx, gy + 1)) * sx;
  return top + (bot - top) * sy;
}

/**
 * Octaves of it, centred on zero.
 *
 * `periods` must all DIVIDE the tile, which is why this takes periods
 * rather than a frequency multiplier. Scaling the coordinate instead —
 * `wrappedNoise(x * 1.6, ...)` — silently breaks the wrap, because the
 * lattice only repeats when x advances by a whole tile. Displacing the
 * coordinate is fine and is how the veins get their turbulence: any
 * offset that is itself tile-periodic carries the periodicity with it.
 */
function fbm(x: number, y: number, periods: number[], weights: number[]): number {
  let sum = 0;
  let total = 0;
  for (let i = 0; i < periods.length; i++) {
    sum += (wrappedNoise(x, y, periods[i]) - 0.5) * 2 * weights[i];
    total += weights[i];
  }
  return sum / total;
}

/** A sine that completes whole turns across the tile, so it wraps. */
function tiling(v: number, turns: number): number {
  return Math.sin((v / SIZE) * turns * Math.PI * 2);
}

/**
 * A smooth 0..1 ramp between two edges.
 *
 * The materials used to pick their tone with a ladder of `if (v > 0.86)
 * return 0.95` thresholds, which puts a hard cliff wherever the value
 * crosses an edge — and at 64px those cliffs are the jagged, blocky
 * staircases that made wood read as corduroy and marble as cut paper.
 * Ramping between the same numbers is what "smoother" means here.
 */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Returns a mask from -1 to 1.
 *
 * Positive blends the shell toward the ink colour; 1 is full ink. Negative
 * darkens the shell toward its own shadow; -1 is the darkest. Two
 * directions from one ink is what lets gold have a bright band AND the
 * dark trough beside it, which is the whole of what makes metal read as
 * metal. Every pattern written before this returns 0..1 and is unaffected.
 */
/**
 * Which hexagon of a lattice a pixel is in, and where that hexagon's
 * centre is.
 *
 * The three-axial-stripe trick elsewhere in this file finds the distance
 * to the nearest hex EDGE, which is all a comb wall needs. It does not
 * identify a CELL: rounding each family separately gives three unrelated
 * integers, and hashing those to pick a colour per hexagon scatters
 * colour per pixel instead. The soccer ball came out as black splatter
 * that way. This is the standard cube-coordinate rounding.
 */
function hexCell(x: number, y: number, size: number): {
  q: number;
  r: number;
  cx: number;
  cy: number;
  d: number;
  /** 0 at the cell's centre, 1 exactly on its six-sided boundary. */
  t: number;
} {
  const fq = ((Math.sqrt(3) / 3) * x - y / 3) / size;
  const fr = ((2 / 3) * y) / size;
  const fs = -fq - fr;
  let q = Math.round(fq);
  let r = Math.round(fr);
  const sRound = Math.round(fs);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(sRound - fs);
  if (dq > dr && dq > ds) q = -r - sRound;
  else if (dr > ds) r = -q - sRound;
  const cx = size * Math.sqrt(3) * (q + r / 2);
  const cy = size * 1.5 * r;
  const d = Math.hypot(x - cx, y - cy);
  /*
    How far out the boundary is in THIS direction. Comparing the plain
    radius against a constant draws circles, not hexagons — which is
    what the soccer ball's panels came out as. A hexagon's boundary is
    its inradius divided by the cosine of the angle folded into one
    60-degree wedge.
  */
  const sector = Math.PI / 3;
  const a = Math.atan2(y - cy, x - cx);
  const folded = Math.abs((((a + sector / 2) % sector) + sector) % sector - sector / 2);
  const boundary = ((size * Math.sqrt(3)) / 2) / Math.cos(folded);
  return { q, r, cx, cy, d, t: d / boundary };
}

/** The eight patterns painted in full colour rather than through a mask. */
export type ColorPatternId =
  | 'volleyball' | 'watermelon' | 'pizza' | 'donut'
  | 'rainbow' | 'galaxy' | 'camo' | 'tartan'
  /*
    Moved here from the mask painters on 26 Aug 2026, and the reason is
    the same for all of them: a mask can only travel from the shell
    colour toward ONE ink, so it can darken or it can lighten, never
    both. Nothing with real relief can be drawn that way. A turtle's
    scutes are domed and need a lit side and a shaded one; a peacock's
    eye is navy, then blue, then gold; a chicken drumstick needs a bone
    PALER than the meat it sticks out of. Each of these was a flat
    two-tone smudge until it got its own paint.
  */
  | 'shell' | 'peacock' | 'waffle' | 'strawberry' | 'chocolate' | 'denim'
  | 'ruby' | 'slate' | 'copper' | 'ocean'
  /*
    The thirteen David named on 26 Aug 2026 — "make the golf ball, cow,
    bumblebee, turtle, soccer ball, denim, snake, basketball, football,
    honeycomb, tiger, bowling ball, and volleyball skins look better".
    Every one needed what the batch before it needed: a lit side AND a
    shaded one. A golf ball is white on white, so all of it is shading;
    a basketball's whole surface is pebble; a tiger is hairy; a honeycomb
    cell is a hole. None of that can be drawn by travelling from one
    colour toward one other.
  */
  | 'dimples' | 'soccer' | 'basketball' | 'laces' | 'bowling'
  | 'patches' | 'bands' | 'diamonds' | 'tigerStripes' | 'honeycomb'
  // Bubbles joined them on 27 Aug: a soap film is iridescent, and one
  // ink cannot be iridescent.
  | 'bubbles';
type MaskPatternId = Exclude<PatternId, 'plain' | ColorPatternId>;

const PAINTERS: Record<MaskPatternId, Painter> = {
  // Diagonal stripes.
  stripes: (x, y) => (Math.floor((x + y) / 8) % 2 === 0 ? 1 : 0),

  // Evenly spaced dots on a staggered grid.
  spots: (x, y) => {
    const cell = 16;
    const row = Math.floor(y / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;
    const cx = ((x + offset) % cell) - cell / 2;
    const cy = (y % cell) - cell / 2;
    return Math.hypot(cx, cy) < 4.2 ? 1 : 0;
  },

  /**
   * Five-pointed stars.
   *
   * This used to be `0.55 + 0.45 * |cos(5a/2)|`, which is a cosine lobe —
   * it draws five ROUNDED bumps, and rendered out as a blob. Rendering the
   * texture to an image is the only way that shows up. Here the angle is
   * folded into one of five sectors and the boundary runs straight from
   * the inner vertex out to the point, which is what a star actually is.
   */
  stars: (x, y) => {
    const cell = 21;
    const cx = ((x % cell) - cell / 2) / (cell / 2);
    const cy = ((y % cell) - cell / 2) / (cell / 2);
    const r = Math.hypot(cx, cy);
    if (r > 1) return 0;

    const points = 5;
    const sector = (Math.PI * 2) / points;
    // +PI/2 stands the star upright rather than resting on a point.
    const a = Math.atan2(cy, cx) + Math.PI / 2;
    const folded = ((a % sector) + sector) % sector;
    const half = sector / 2;
    // 0 in the valley between two points, `half` along a point.
    const t = Math.abs(folded - half) / half;

    const INNER = 0.42;
    const boundary = INNER + (1 - INNER) * t;
    return r <= boundary * 0.95 ? 1 : 0;
  },

  /**
   * Frost: classic six-armed snowflakes, the paper-cutout kind.
   *
   * Two goes at this were wrong in the same way. First it was three
   * needles crossed through a point — an asterisk. Then it grew branches
   * but read as a mess of stars, and rendering it at ten times size showed
   * exactly why: the ONE flake that happened to sit axis-aligned looked
   * fine, and every rotated one had been shredded into disconnected
   * stair-steps. A one-pixel arm cannot survive rotation on a 64-pixel
   * grid when each pixel is either ink or not.
   *
   * So the shape is SUPERSAMPLED: sampled on a 4x4 grid inside every pixel
   * and averaged, which gives partial coverage along every edge. That is
   * what lets a thin diagonal arm hold together, and it is why the flakes
   * can be delicate rather than chunky.
   *
   * The shape itself is the traditional one: six arms, three pairs of
   * dendrites angled forward off each, a bar across each tip, and a
   * hexagonal heart.
   */
  frost: (x, y) => {
    const cell = 32;
    const row = Math.floor(y / cell);
    const col = Math.floor(x / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;

    // Deterministic per-cell variation. No Math.random — the shelf and the
    // table have to show the same dice.
    const hash = Math.abs((Math.sin(row * 12.9898 + col * 78.233) * 43758.5453) % 1);
    const reach = (cell / 2) * (0.82 + hash * 0.16);
    const spin = hash * Math.PI;
    const sector = Math.PI / 3;

    /** Is this exact point inside the flake? Coordinates are in pixels. */
    const inside = (px: number, py: number): boolean => {
      const dx = ((px + offset) % cell) - cell / 2;
      const dy = (py % cell) - cell / 2;
      const r = Math.hypot(dx, dy);
      if (r > reach * 1.02) return false;

      // Everything below is in units of `reach`, so a big flake and a
      // small one are the same drawing at two sizes.
      const angle = Math.atan2(dy, dx) + spin;
      const folded = (((angle % sector) + sector) % sector) - sector / 2;
      const along = (r * Math.cos(folded)) / reach;
      const across = Math.abs(r * Math.sin(folded)) / reach;

      // The hexagonal heart.
      if (along < 0.14) return true;
      // The spine, running the full length of the arm.
      if (along <= 1 && across < 0.055) return true;
      // The bar across the tip, which is most of what says "snowflake"
      // rather than "spike".
      if (Math.abs(along - 0.9) < 0.05 && across < 0.13) return true;

      // Three pairs of dendrites, longest nearest the middle.
      const branch = (at: number, length: number, width: number) => {
        const bx = along - at;
        const by = across;
        const ux = 0.5;
        const uy = 0.866;
        const t = Math.max(0, Math.min(length, bx * ux + by * uy));
        return Math.hypot(bx - ux * t, by - uy * t) < width;
      };
      if (branch(0.28, 0.34, 0.05)) return true;
      if (branch(0.52, 0.25, 0.045)) return true;
      if (branch(0.72, 0.16, 0.04)) return true;
      return false;
    };

    // Supersample. Without this the thin arms break up wherever a flake is
    // not axis-aligned, which is what made the last version read as stars.
    const N = 4;
    let hits = 0;
    for (let sy = 0; sy < N; sy++) {
      for (let sx = 0; sx < N; sx++) {
        if (inside(x + (sx + 0.5) / N, y + (sy + 0.5) / N)) hits++;
      }
    }
    return hits / (N * N);
  },

  /**
   * Real bubbles rather than flat dots: a bright rim, a hollow middle so
   * the shell shows through like something you can see into, and a glint
   * off the top-left of each one. Sizes vary per cell — a grid of
   * identical circles reads as polka dots, which is what this was.
   *
   * The mask tops out at 1 (full ink) for the glint and sits lower for
   * the rim, so one ink colour still gives two brightnesses.
   */
  grain: (x, y) => {
    const wave = Math.sin(x / 5 + Math.sin(y / 11) * 1.6);
    return wave > 0.35 ? 0.75 : 0;
  },

  /**
   * Wood: growth rings, not stripes.
   *
   * The difference is that rings run along the length of the grain and
   * BEND — they are the annual rings of a tree cut at a slight angle, so
   * the spacing tightens and loosens across the face. Straight even bands
   * read as a painted pattern; wandering ones read as a plank.
   *
   * Late wood (the dark line laid down at the end of a season) is narrow
   * and hard-edged; early wood between the lines is wide and pale. Getting
   * that ratio the wrong way round is what makes fake wood look fake.
   */
  wood: (x, y) => {
    /*
      Real grain, not corduroy.

      The old version made rings from `sin((y + drift) / 3.1)`: one fixed
      frequency, so every band came out the same width, evenly spaced and
      flat across the face. Rendered and tiled it read as a striped
      jumper, and it did not wrap, so the die carried a seam.

      Wood does two things this has to do too. Ring SPACING varies a lot
      across a plank — tight where the tree grew slowly, wide where it
      grew fast — and each ring is soft on one side and hard on the
      other, because early wood is pale and open and late wood is dark
      and dense. The first comes from warping the ring coordinate with
      tiling noise; the second from a sawtooth rather than a sine.
    */
    // A knot, and the rings crowding around it. Displacing the ring
    // coordinate radially is what makes them bend into it, rather than a
    // dark smudge sitting on top of straight bands.
    const kx = x - SIZE * 0.66;
    const ky = y - SIZE * 0.34;
    const kd = Math.sqrt(kx * kx + ky * ky);
    const pull = Math.exp(-(kd * kd) / 420) * 9;

    // Ring coordinate: across the plank, warped so spacing opens and
    // closes, then pulled around the knot.
    //
    // TWO scales of warp, and the slow one carries most of the weight.
    // With only the fast one every ring wandered by the same amount and
    // the plank came out as even ripples, like water. A board has
    // REGIONS — a stretch of tight rings, then a stretch of wide ones —
    // and that is what the low-frequency term buys.
    const warp =
      fbm(x, y, [32], [1]) * 13 + fbm(x + 19, y + 7, [16, 8], [1, 0.5]) * 3.5;
    const rings = 7;
    const phase = ((((y + warp + pull) * rings) / SIZE) % 1 + 1) % 1;

    // Sawtooth: a slow pale rise into a sharp dark edge is the whole
    // character of a growth ring, and a sine is symmetric.
    const late = smoothstep(0.55, 0.9, phase) * (1 - smoothstep(0.9, 1, phase));

    // Fibres running WITH the grain — long and fine, so hairs rather
    // than speckle.
    const fibre = fbm(x, y, [16, 8], [0.5, 1]) * 0.07;

    // The knot's own dark heart, on top of the rings bending into it.
    const heart = Math.exp(-(kd * kd) / 55) * 0.5;

    return Math.min(1, late * 0.9 + fibre + heart);
  },

  /**
   * Marble: veins that wander, on cloudy stone.
   *
   * A vein is thin and sharp with a soft halo either side — that halo is
   * where the mineral bled into the stone, and leaving it off is what
   * makes marble look like someone drew on it with a pen. The wandering
   * comes from warping the coordinate before the wave, so the bands cannot
   * run parallel the way stripes do.
   */
  marble: (x, y) => {
    /*
      Veins that branch and vary, not contour lines and not blobs.

      Three attempts got here, and the two failures are worth naming.
      Banding a single sine gave every vein the same width and spacing —
      a topographic map. Thresholding the RIDGE of a noise field,
      `1 - |noise|`, gave one enormous island, because noise sits near
      zero most of the time so "close to the ridge" was most of the tile.

      A vein is where the field CROSSES zero, not where it is near it.
      Thresholding |field| against a small width draws a thin line along
      every zero contour, and because the field is displaced by its own
      turbulence those contours fork, wander and vary in thickness —
      which is what a fracture network in stone actually looks like.
    */
    // Turbulence. Tile-periodic itself, so displacing by it keeps the
    // wrap: see the note on fbm.
    const dx = fbm(x, y, [32, 16], [1, 0.5]) * 13;
    const dy = fbm(x + 31, y + 17, [32, 16], [1, 0.5]) * 13;
    const px = x + dx;
    const py = y + dy;

    /*
      DIRECTION, which the very first version of this painter had and
      which every rewrite since has done without — to its cost.

      Pure noise contours close on themselves. Four attempts produced
      islands, paisley and, most recently, a repeating bird shape,
      because a field with no bias has zero-crossings that loop. Marble
      is BEDDED: its veins run broadly one way across the stone, wandering
      hard but not curling back. So the field is a diagonal wave that
      tiles (integer turns, or the die grows a seam) with the turbulence
      bending it, rather than turbulence alone.
    */
    const bedding = Math.sin(((2 * px + py) / SIZE) * Math.PI * 2);
    const field = bedding * 0.62 + fbm(px, py, [32, 16], [1, 0.6]) * 0.8;

    /*
      VARYING width, which is most of what separates marble from a wiring
      diagram. A real vein swells and thins along its length, so the
      threshold is itself a slow noise rather than one number.
    */
    const width = 0.03 + wrappedNoise(x + 5, y + 41, 32) * 0.08;
    const vein = (1 - smoothstep(0, width, Math.abs(field))) * 0.82;
    // A soft bleed either side, so a vein sits IN the stone rather than
    // being painted on top of it.
    const halo = (1 - smoothstep(width, width + 0.22, Math.abs(field))) * 0.16;

    /*
      One hairline network, drawn from the SAME field at an offset so it
      runs parallel to the main veins the way a real seam's outriders do.
      A separate finer octave produced isolated dots instead: a period-4
      lattice on a 64px tile is 16 cells across, and its contours were
      shorter than the cells they lived in.
    */
    // Widened from 0.02: where the field's gradient is steep, a threshold
    // that tight fell between pixels and the hairline came out as a
    // dotted line rather than a faint one.
    const hair = (1 - smoothstep(0, 0.045, Math.abs(field - 0.52))) * 0.22;

    // Broad cloudiness in the stone itself, darkening rather than inking.
    const cloud = (wrappedNoise(x, y, 32) - 0.5) * 0.13;

    return Math.min(1, vein + halo + hair) - cloud;
  },

  /**
   * Granite: mottled stone under a scatter of mineral flecks.
   *
   * Two scales at once, which is what tells stone from noise: big soft
   * blotches of lighter and darker rock, and on top of them individual
   * bright quartz and dark mica specks. The specks come from a hash of the
   * pixel position, so the texture is identical every time it is built —
   * no Math.random, which would make the shelf and the table disagree.
   */
  granite: (x, y) => {
    // Flecks, but a fraction of what they were. Every fleck used to jump
    // the mask most of its full range, which at this size reads as
    // television static rather than as stone — David asked for smoother
    // and this is where nearly all of the coarseness was.
    const hash = Math.abs((Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1);
    const fleck = (hash - 0.5) * 0.34;

    // Two smooth scales of mottling under the flecks. Two rather than one
    // is what still tells stone from noise: broad patches of lighter and
    // darker rock, with a finer drift inside them.
    const coarse = Math.sin(x / 11 + Math.sin(y / 8) * 1.6) * 0.16;
    const fine = Math.sin(x / 5.5 + y / 6.5 + Math.sin(x / 17) * 1.3) * 0.08;
    return coarse + fine + fleck;
  },

  /**
   * Polished metal: a bright band with dark either side, brushed.
   *
   * This is the one pattern that exists purely because the dice are drawn
   * unlit. On a lit die, gold would catch a highlight as it turned; with
   * lighting off it is a flat yellow cube. So the highlight is painted in:
   * a band of light rolling diagonally across the face, with the surface
   * falling away to shadow on both sides of it, plus fine brush lines
   * along the direction of the sheen.
   */
  sheen: (x, y) => {
    // Diagonal position across the face, roughly 0..1.4.
    const d = (x * 0.62 + y * 0.78) / SIZE;
    // ONE highlight sweeping the face, not a repeating band. A cosine here
    // gave a striped ribbon — a Gaussian gives a single soft bar of light
    // with the metal falling away to shadow on both sides, which is what
    // one light source on a polished surface actually looks like.
    const bar = (centre: number, width: number, strength: number) =>
      Math.exp(-Math.pow((d - centre) / width, 2)) * strength;
    // The main highlight, plus a much weaker one where the far edge
    // catches the light again.
    const light = bar(0.4, 0.19, 1.5) + bar(1.02, 0.12, 0.5) - 0.5;
    // Brushing runs ALONG the highlight, so it uses the other diagonal.
    // Fine — at the first attempt's frequency it read as corduroy.
    const brush = Math.sin((x * 0.78 - y * 0.62) * 2.4) * 0.05;
    return light + brush;
  },

  /**
   * Polished silver: the same surface as gold, in the other metal.
   *
   * This used to be brushed — thousands of fine scratches running one way
   * — deliberately a different SHAPE from gold so the two could never be
   * one picture in two tints. David asked on 24 Aug 2026 for silver to be
   * the silver version of the gold skin, which is that rule overruled on
   * purpose, so it is a polished sweep of light now.
   *
   * They still cannot be confused, and not only because of the colour:
   * silver is a harder, cooler mirror than gold, so the bar of light is
   * tighter and brighter and the second reflection off the far edge is
   * stronger. Gold spreads its highlight; silver snaps it.
   */
  brushed: (x, y) => {
    const d = (x * 0.62 + y * 0.78) / SIZE;
    const bar = (centre: number, width: number, strength: number) =>
      Math.exp(-Math.pow((d - centre) / width, 2)) * strength;
    // Tighter (0.15 against gold's 0.19) and a touch brighter, with a
    // stronger far-edge catch — the difference between a mirror and a
    // warm metal, at the same shape.
    const light = bar(0.4, 0.15, 1.65) + bar(1.02, 0.13, 0.62) - 0.52;
    // The same faint polishing marks along the highlight that gold has.
    const brush = Math.sin((x * 0.78 - y * 0.62) * 2.4) * 0.045;
    return light + brush;
  },

  /*
   * ── The 26 Aug 2026 batch ─────────────────────────────────────────
   *
   * Twenty-six mask painters for the new skins. The style rules learned
   * on the first twelve apply throughout: cells are staggered and sized
   * by hashCell so nothing reads as graph paper, edges ramp through
   * smoothstep rather than stepping, and anything meant to look like a
   * MATERIAL gets negative shading as well as ink. No Math.random
   * anywhere — the shelf and the table must show the same die.
   */

  /** Leopard: broken rings on a staggered grid, a dot in some. */
  rosettes: (x, y) => {
    const cell = 16;
    const row = Math.floor(y / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;
    const col = Math.floor((x + offset) / cell);
    const h = hashCell(col, row);
    const cx = ((x + offset) % cell) - cell / 2 + (h - 0.5) * 3;
    const cy = (y % cell) - cell / 2 + (hashCell(col + 9, row) - 0.5) * 3;
    const r = Math.hypot(cx, cy);
    const ring = 4.6 + h * 1.4;
    // The ring, BROKEN in one or two places — an unbroken ring is a
    // polka dot with a hole, not a rosette.
    const a = Math.atan2(cy, cx);
    const gapAt = h * Math.PI * 2;
    const inGap =
      Math.abs(Math.atan2(Math.sin(a - gapAt), Math.cos(a - gapAt))) < 0.7;
    const onRing = Math.abs(r - ring) < 1.6 && !inGap;
    // A smaller solid freckle in the middle of about half of them.
    const freckle = h > 0.5 && r < 1.8;
    return onRing || freckle ? 0.95 : 0;
  },

  /** Tiger: vertical stripes that wave and TAPER to points. */
  giraffe: (x, y) => {
    const cell = 16;
    let d1 = 99;
    let d2 = 99;
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const px = (gx + ox + 0.5 + (hashCell(gx + ox, gy + oy) - 0.5) * 0.8) * cell;
        const py = (gy + oy + 0.5 + (hashCell(gx + ox + 7, gy + oy) - 0.5) * 0.8) * cell;
        const d = Math.hypot(x - px, y - py);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      }
    }
    return smoothstep(1.2, 2.6, d2 - d1) * 0.92;
  },

  /** Bee: three broad soft-edged bands across the die. */
  fish: (x, y) => {
    /*
      Actual fish, in rows swimming opposite ways.

      David, 26 Aug 2026: "make sure every dice design still makes sense
      according to the dice name. Like the fish should have fish on it."
      He picked the clearest case in the set: this was a scallop-row
      SCALE texture — what a fish is covered in rather than what a fish
      looks like — and at the size a die is actually seen it read as
      roof tiles.
    */
    const cell = 16;
    const row = Math.floor(y / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;
    const fx = ((x + offset) % cell) - cell / 2;
    const fy = (y % cell) - cell / 2;
    // Every other row swims the other way, so a face has some movement
    // in it rather than a column of identical stamps.
    const sx = row % 2 === 0 ? fx : -fx;
    const body = Math.hypot(sx / 5.6, fy / 3.2);
    const tail = sx < -3.4 && sx > -7.6 && Math.abs(fy) < (-sx - 3.4) * 1.35;
    if (body <= 1 || tail) {
      if (Math.hypot(sx - 3.2, fy + 0.9) < 1.1) return -0.85;
      if (Math.abs(sx - 0.4) < 0.6 && Math.abs(fy) < 2.3) return 0.4;
      // A paler belly, so it is a lit fish and not a silhouette.
      return fy > 1.3 ? 0.5 : 0.92;
    }
    // Water: a faint ripple, and the odd rising bubble.
    if (Math.hypot(sx + 6.4, fy - 4.8) < 1.2) return 0.3;
    return (wrappedNoise(x, y, 16) - 0.5) * 0.16;
  },

  paws: (x, y) => {
    const cell = 21;
    const row = Math.floor(y / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;
    const cx = ((x + offset) % cell) - cell / 2;
    const cy = (y % cell) - cell / 2;
    // Main pad: a wide ellipse low in the cell.
    if (Math.hypot(cx / 1.3, cy - 2.5) < 3.4) return 0.95;
    // Three toes arched above it.
    for (const [tx, ty] of [[-3.6, -2.2], [0, -3.8], [3.6, -2.2]] as const) {
      if (Math.hypot(cx - tx, cy - ty) < 1.7) return 0.95;
    }
    return 0;
  },

  /**
   * Basketball: the classic four seams — one vertical, one horizontal,
   * two side arcs — over a faint pebbled grain.
   */
  tennis: (x, y) => {
    const c = SIZE / 2;
    /*
      The two seams bulge in from the left and right EDGES. They used to
      cross the middle line about six pixels either side of the centre —
      that is, both of them ran under the colour sticker for most of
      their length, and a Tennis Ball die was a plain green square with
      two short white ticks top and bottom.
    */
    const left = Math.abs(Math.hypot(x + SIZE * 0.86, y - c) - SIZE);
    const right = Math.abs(Math.hypot(x - SIZE * 1.86, y - c) - SIZE);
    if (Math.min(left, right) < 1.8) return 0.95;
    // Felt: the faintest fuzz so the ground is not a flat wash.
    return (hashCell(x, y) - 0.5) * 0.08;
  },

  baseball: (x, y) => {
    /*
      Both stitch runs used to cross the middle third of the face, under
      the sticker. They sweep the left and right thirds now, which is
      also closer to where a baseball's seams actually sit when you look
      at one straight on.
    */
    for (const cx of [-SIZE * 0.53, SIZE * 1.53]) {
      const d = Math.hypot(x - cx, y - SIZE / 2);
      const off = Math.abs(d - SIZE * 0.69);
      if (off < 3.2) {
        // Position along the arc decides the dash rhythm.
        const a = Math.atan2(y - SIZE / 2, x - cx);
        if (Math.abs(Math.sin(a * 16)) > 0.55 && off > 0.8) return 0.9;
      }
    }
    return 0;
  },

  cookie: (x, y) => {
    const cell = 13;
    const row = Math.floor(y / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;
    const col = Math.floor((x + offset) / cell);
    const h = hashCell(col, row);
    const cx = ((x + offset) % cell) - cell / 2 + (h - 0.5) * 5;
    const cy = (y % cell) - cell / 2 + (hashCell(col + 3, row) - 0.5) * 5;
    if (Math.hypot(cx, cy) < 1.9 + h * 1.4) return 0.95;
    return (wrappedNoise(x, y, 8) - 0.5) * 0.14;
  },

  /** Candy cane: wide, soft-edged diagonal stripes. */
  candyStripes: (x, y) => {
    // Whole turns across the tile, like the metals' sweep — an odd count
    // reads as off-kilter in a good way.
    const wave = tiling(x + y, 3);
    return smoothstep(-0.15, 0.35, wave) * 0.96;
  },

  /** Strawberry: seeds — small pale teardrops, each in a tiny hollow. */
  citrus: (x, y) => {
    /*
      Cut slices in the corners of the face.

      This was a single wheel of ten segments with its hub dead centre —
      drawn, in other words, entirely inside the circle the colour
      sticker covers, so a Lemon die was a plain yellow square. Anchoring
      the fruit at the corners puts the whole slice, peel and all, in the
      part of a face you can actually see. Two big and two small, so it
      reads as a print rather than as four of the same stamp.
    */
    for (const [cx, cy, R] of [
      [0, 0, 23],
      [SIZE, SIZE, 23],
      [SIZE, 0, 15],
      [0, SIZE, 15],
    ] as const) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      if (r > R) continue;
      if (r > R - 2) return 0.9;      // peel
      if (r > R - 4) return -0.06;    // pith
      if (r < R * 0.11) return 0.85;  // the hub the segments meet at
      const a = Math.atan2(dy, dx);
      // Segment walls, spread evenly across the quarter that shows.
      if (Math.abs(Math.sin(a * 8)) > 0.93 && r > R * 0.18) return 0.85;
      // Flesh: the faintest sparkle of juice sacs.
      return (hashCell(x, y) - 0.5) * 0.12;
    }
    return (hashCell(x, y) - 0.5) * 0.06;
  },

  circuit: (x, y) => {
    const lane = Math.floor(y / 8);
    const inY = y - lane * 8;
    const h = hashCell(lane, 3);
    // Turns spread across the whole width. They used to bunch in the
    // middle third, which is the one part of a face nobody ever sees.
    const turnAt = 3 + h * 52;
    const padAt = turnAt + 5 + hashCell(lane, 7) * 8;
    // The run along the lane, then the stub after the turn.
    const online =
      Math.abs(inY - 4) < 1 &&
      (x < turnAt || (x > turnAt && x < padAt && Math.abs(inY - 4) < 1));
    if (Math.hypot(x - padAt, inY - 4) < 2.4) return 0.95;
    if (Math.hypot(x - turnAt, inY - 4) < 1.6) return 0.95;
    return online ? 0.7 : (wrappedNoise(x, y, 16) - 0.5) * 0.08;
  },

};

/** A colour painter returns the actual pixel, not a mask. */
type ColorPainter = (x: number, y: number) => [number, number, number];

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const mixRgb = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/**
 * The eight patterns that need MORE than base-plus-ink.
 *
 * The mask system deliberately keeps every pattern to two colours, which
 * is right for materials — but a watermelon is red, white, green and
 * black, and no mask can say so. These painters return finished pixels.
 * The skin's `body` still matters (it is what the face-separation check
 * reads, so each painter's dominant colour must match its skin's body),
 * and `ink` is unused — kept on the skin so the texture tests can treat
 * every patterned skin alike.
 */
const COLOR_PAINTERS: Record<ColorPatternId, ColorPainter> = {
  /** White leather in curved panels, every third panel blue or yellow. */
  watermelon: (x, y) => {
    const d = Math.hypot(x - SIZE * 1.1, y - SIZE * 1.1);
    // Outer rind: two greens striped along the arc.
    if (d > 62) {
      const stripe = Math.sin(Math.atan2(y - SIZE * 1.1, x - SIZE * 1.1) * 26);
      return stripe > 0 ? rgb('#3f8f4a') : rgb('#2e6e38');
    }
    if (d > 56) return rgb('#e8f0d8');
    // Flesh, with staggered black seeds pointing at the rind.
    const cell = 13;
    const row = Math.floor(y / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;
    const sx = ((x + offset) % cell) - cell / 2;
    const sy = (y % cell) - cell / 2;
    if (Math.hypot(sx / 0.75, sy / 1.4) < 1.7 && d < 50) return rgb('#2a2418');
    // The flesh pales slightly toward the pith, as the fruit does. Pinker
    // than a real melon on purpose: #e05a5a sat ΔLab 17.7 from the red
    // FACE sticker, and a shell that close swallows the face.
    return mixRgb(rgb('#f08585'), rgb('#f7b8b8'), smoothstep(48, 60, d));
  },

  /** Cheese, crust at one corner, pepperoni, herbs. */
  pizza: (x, y) => {
    const d = Math.hypot(x - SIZE * 1.05, y - SIZE * 1.05);
    if (d > 60) return rgb('#b3802e');
    // Four pepperoni, every one clear of BOTH the sticker and the crust.
    // Two of the original four sat under the sticker; the first attempt
    // at moving them put one out on the crust, where the crust — tested
    // first — simply painted over it.
    for (const [cx, cy, r] of [[46, 13, 7], [54, 38, 6.5], [20, 52, 7], [36, 58, 6]] as const) {
      const pd = Math.hypot(x - cx, y - cy);
      if (pd < r) {
        // A darker rim where the slice cupped in the oven.
        return pd > r - 1.8 ? rgb('#8e2f26') : rgb('#c24338');
      }
    }
    if (hashCell(x, y) > 0.965) return rgb('#4a7a2e');
    // The cheese itself, gently mottled where it browned.
    return mixRgb(rgb('#e8c078'), rgb('#d9a55c'), wrappedNoise(x, y, 16) * 0.7);
  },

  donut: (x, y) => {
    // The glaze covers the face except a scalloped lower-right margin.
    const dripEdge = 50 + tiling(x - y, 4) * 5;
    const onCake = x + y > dripEdge + 46;
    if (onCake) return mixRgb(rgb('#d9a55c'), rgb('#c2882e'), wrappedNoise(x, y, 8) * 0.5);
    // Sprinkles: short capsules in five colours, angled by their cell.
    const cell = 11;
    const row = Math.floor(y / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;
    const col = Math.floor((x + offset) / cell);
    const h = hashCell(col, row);
    const cx = ((x + offset) % cell) - cell / 2;
    const cy = (y % cell) - cell / 2;
    const a = h * Math.PI;
    const along = cx * Math.cos(a) + cy * Math.sin(a);
    const across = -cx * Math.sin(a) + cy * Math.cos(a);
    if (Math.abs(along) < 3 && Math.abs(across) < 1.1) {
      const jimmies = ['#e84a6e', '#3fa35c', '#3f7fd0', '#f0c020', '#ffffff'];
      return rgb(jimmies[Math.floor(h * jimmies.length)]);
    }
    return rgb('#e8a8b8');
  },

  /** Six soft bands on the diagonal, sky between. */
  rainbow: (x, y) => {
    const order = ['#e05a5a', '#e8963d', '#e8d23d', '#57b366', '#4a7fd0', '#9a6ee0'];
    const d = (x + y) / 2;
    const band = (d / 9) % order.length;
    const i = Math.floor(band);
    const frac = band - i;
    const here = rgb(order[i]);
    const next = rgb(order[(i + 1) % order.length]);
    // A soft blend at every boundary — hard-edged rainbows read as a
    // flag, soft ones as light.
    let px = frac > 0.8 ? mixRgb(here, next, (frac - 0.8) / 0.2) : here;
    // Brushed grain along the bands, so it is painted colour rather
    // than six flat swatches.
    px = mixRgb(px, rgb('#ffffff'), wrappedNoise(x * 2, y * 2, 16) * 0.18);
    return mixRgb(px, rgb('#3d3a4a'), (hashCell(x, y) - 0.5) * 0.1 + 0.05);
  },

  galaxy: (x, y) => {
    /*
      The core is low in one corner now, with the disc tilted across the
      face. It used to be a bright glow in the middle — which is where
      the sticker goes, so the one bright thing in the picture was the
      one thing covered up, and the face read as flat dark blue.
    */
    let px: [number, number, number] = rgb('#1d1440');
    const cloudA = smoothstep(0.15, 0.65, fbm(x + 26, y + 38, [32, 16], [1, 0.5]) + 0.3);
    const cloudB = smoothstep(0.2, 0.7, fbm(x + 5, y + 47, [32, 16], [1, 0.5]) + 0.25);
    px = mixRgb(px, rgb('#8a3d8f'), cloudA * 0.6);
    px = mixRgb(px, rgb('#2a6e9e'), cloudB * 0.5);
    const gx = SIZE * 0.17;
    const gy = SIZE * 0.83;
    // The disc, tilted, and the core burning at one end of it.
    const ux = (x - gx) * 0.94 + (y - gy) * 0.34;
    const uy = -(x - gx) * 0.34 + (y - gy) * 0.94;
    px = mixRgb(px, rgb('#6e3aa8'), Math.exp(-(Math.pow(ux / 30, 2) + Math.pow(uy / 10, 2))) * 0.55);
    px = mixRgb(px, rgb('#ffeccc'), Math.exp(-Math.pow(Math.hypot(x - gx, y - gy) / 8, 2)));
    // Stars: mostly pinpricks, a few brighter.
    const h = hashCell(x, y);
    if (h > 0.992) return rgb('#ffffff');
    if (h > 0.985) return mixRgb(px, rgb('#ffffff'), 0.6);
    return px;
  },

  camo: (x, y) => {
    const dark = wrappedNoise(x, y, 16) * 0.7 + wrappedNoise(x + 9, y + 21, 8) * 0.3;
    const pale = wrappedNoise(x + 31, y + 13, 16) * 0.7 + wrappedNoise(x + 3, y + 40, 8) * 0.3;
    // Four tones, further apart than the first version's — camouflage
    // is meant to break up a shape, not to be invisible, and at a die's
    // size the old four read as one muddy olive.
    let px = rgb('#6e7a52');
    if (dark > 0.62) px = rgb('#26331f');
    else if (pale > 0.66) px = rgb('#9aa374');
    else if (dark > 0.5) px = rgb('#46583a');
    /*
      Woven cotton over the top of the blobs. Four flat colours with
      hard edges read as a printed chart; real camouflage is printed ON
      cloth, and the cloth is what your eye finds first.
    */
    const weave = ((x % 2 === 0 ? 1 : 0) + (y % 2 === 0 ? 1 : 0)) / 2;
    px = mixRgb(px, rgb('#1d2418'), (weave - 0.5) * 0.16 + 0.03);
    return mixRgb(px, rgb('#e8e4d0'), (hashCell(x, y) - 0.5) * 0.1 + 0.03);
  },

  tartan: (x, y) => {
    const bandH = Math.abs(tiling(y, 2)) > 0.62;
    const bandV = Math.abs(tiling(x, 2)) > 0.62;
    const pinH = Math.abs(tiling(y + 8, 2)) > 0.985;
    const pinV = Math.abs(tiling(x + 8, 2)) > 0.985;
    // The woven look is entirely in the overlap rule: two bands crossing
    // go DARKER, a band alone goes its own colour.
    let px: [number, number, number] = rgb('#742533');
    if (bandH && bandV) px = rgb('#1d2438');
    else if (bandH || bandV) px = rgb('#2e4a3d');
    if (pinH || pinV) px = rgb('#e8c23d');
    // Twill: the fine diagonal texture cloth cannot help having.
    const twill = tiling(x * 2 - y * 2, 16) > 0.4 ? 0.06 : 0;
    return mixRgb(px, rgb('#000000'), twill);
  },

  /* ── moved here from the mask painters, 26 Aug 2026 ─────────────── */


  shell: (x, y) => {
    /*
      A turtle's carapace: big horn plates, each domed, ringed by a dark
      suture, carrying growth rings and the pale streaks that radiate
      from a scute's centre.

      Two earlier versions failed differently and for the same reason —
      neither knew which plate a pixel was in. One drew an even comb of
      same-sized cells (a honeycomb, not a shell); the next tried to
      hand-place vertebral and costal rows and produced a grid of small
      squares.
    */
    const size = 10.5;
    const cell = hexCell(x, y, size);
    // The hexagon's own boundary, not a circle: scutes tile a shell with
    // no gaps, and round plates leave gaps.
    const t = cell.t;
    const tone = hashCell(cell.q * 5 + 2, cell.r * 9 + 4);
    let px = mixRgb(rgb('#4a7d31'), rgb('#8fb85c'), tone);
    // Domed, lit from the upper left.
    const lit = -((x - cell.cx) + (y - cell.cy)) / size;
    px = mixRgb(px, rgb('#d2e5a3'), Math.max(0, lit) * 0.55);
    px = mixRgb(px, rgb('#274219'), Math.max(0, -lit) * 0.5);
    // Growth rings, concentric in the plate.
    px = mixRgb(px, rgb('#375c22'), smoothstep(0.3, 0.08, Math.abs(((t * 4 + tone) % 1) - 0.5)) * 0.3);
    // Streaks radiating from the plate's centre.
    const spoke = Math.abs(Math.sin(Math.atan2(y - cell.cy, x - cell.cx) * 6));
    px = mixRgb(px, rgb('#c2cf7a'), smoothstep(0.88, 1, spoke) * smoothstep(0.25, 0.7, t) * 0.45);
    // The horn lip, then the dark suture between plates.
    px = mixRgb(px, rgb('#cfc069'), smoothstep(0.72, 0.88, t) * 0.7);
    return mixRgb(px, rgb('#1f3311'), smoothstep(0.88, 1, t) * 0.95);
  },

  peacock: (x, y) => {
    /*
      The concentric navy-blue-gold ocelli a peacock's tail is made of,
      with the feather's barbs combing out of each one. Drawn through one
      ink it was a flat teal target: an eye whose entire point is that it
      changes colour ring by ring cannot be drawn in one colour.
    */
    const cell = 21;
    const row = Math.floor(y / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;
    const cx = ((x + offset) % cell) - cell / 2;
    const cy = (y % cell) - cell / 2;
    const r = Math.hypot(cx, cy);
    const a = Math.atan2(cy, cx);
    if (r < 2.7) return rgb('#101c33');
    if (r < 4.8) return mixRgb(rgb('#17548f'), rgb('#2470ad'), (r - 2.7) / 2.1);
    if (r < 6.4) return rgb('#0f3d52');
    if (r < 8.4) return mixRgb(rgb('#b8862e'), rgb('#d9a83d'), (r - 6.4) / 2);
    if (r < 9.2) return rgb('#8a6a1e');
    const px = mixRgb(rgb('#126b6b'), rgb('#1a8a80'), wrappedNoise(x, y, 16));
    return mixRgb(px, rgb('#0d4a52'), Math.abs(Math.sin(a * 9)) > 0.5 ? 0.4 : 0);
  },

  waffle: (x, y) => {
    /*
      Chicken and waffles, and you can now tell which is which.

      The chicken was two round lumps painted in the waffle's own brown,
      which read as two burnt patches. A drumstick needs a bone, and a
      bone has to be PALER than the meat it sticks out of — exactly what
      a single dark ink cannot do.
    */
    const cell = 16;
    const inX = ((x % cell) + cell) % cell;
    const inY = ((y % cell) + cell) % cell;
    const edge = Math.min(inX, cell - inX, inY, cell - inY);
    const px = edge < 2
      ? mixRgb(rgb('#f0c878'), rgb('#e8b45c'), 0.4)
      : mixRgb(rgb('#d9a04a'), rgb('#a8742a'), smoothstep(2, 8, edge));
    for (const [dx0, dy0, rot] of [[15, 18, 0.6], [46, 45, -0.7]] as const) {
      const dx = x - dx0;
      const dy = y - dy0;
      const ux = dx * Math.cos(rot) + dy * Math.sin(rot);
      const uy = -dx * Math.sin(rot) + dy * Math.cos(rot);
      // The bone and its knuckle, out of the narrow end.
      if (
        Math.hypot(ux - 10.6, uy - 0.4) < 2.8 ||
        (Math.abs(uy) < 1.8 && ux > 3.2 && ux < 10.8)
      ) {
        return mixRgb(rgb('#f2e6c9'), rgb('#cbbb99'), smoothstep(-1, 2.2, uy));
      }
      const lump = fbm(x + dy0, y + dx0, [16, 8], [1, 0.6]) * 1.7;
      const meat = Math.hypot((ux + 3.2) / 8, uy / 6.4) + lump * 0.1;
      if (meat < 1) {
        // Crust: craggy fried skin, darkest at the rim.
        return mixRgb(
          mixRgb(rgb('#c9762e'), rgb('#9e5418'), wrappedNoise(x * 2, y * 2, 16)),
          rgb('#6e360e'),
          smoothstep(0.55, 1, meat),
        );
      }
    }
    return px;
  },

  strawberry: (x, y) => {
    /*
      Real strawberry skin: every seed sunk in its own dimple with the
      pale lip a live achene sits in, over flesh that is not one flat
      red. The mask version could draw the seed or the hollow, never the
      seed lit inside the hollow.
    */
    const cell = 11;
    const row = Math.floor(y / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;
    const cx = ((x + offset) % cell) - cell / 2;
    const cy = (y % cell) - cell / 2;
    const d = Math.hypot(cx, cy);
    let px = mixRgb(rgb('#c93a52'), rgb('#e0687a'), wrappedNoise(x, y, 16) * 0.9);
    px = mixRgb(px, rgb('#9e2a40'), smoothstep(4.6, 1.9, d) * 0.55);
    px = mixRgb(px, rgb('#ef939c'), smoothstep(2.6, 4.4, d) * smoothstep(6, 4.4, d) * 0.5);
    const seed = Math.hypot(cx / 0.78, cy / 1.4);
    if (seed < 1.7) return mixRgb(rgb('#f7e6a0'), rgb('#b8932e'), smoothstep(0.2, 1.7, seed));
    return px;
  },

  chocolate: (x, y) => {
    /*
      A moulded bar: each square bevelled, lit along its top and left and
      shadowed along its bottom and right, with the deep channel between
      them. Two flat browns in a grid read as a chequerboard.
    */
    const cell = 16;
    const inX = ((x % cell) + cell) % cell;
    const inY = ((y % cell) + cell) % cell;
    const edge = Math.min(inX, cell - inX, inY, cell - inY);
    if (edge < 1.5) return rgb('#33200f');
    let px = mixRgb(rgb('#6e4226'), rgb('#7d4d2e'), wrappedNoise(x, y, 16) * 0.7);
    const bevel = smoothstep(4.5, 1.5, edge);
    if (Math.min(inX, inY) < 4.5) px = mixRgb(px, rgb('#ab7d4f'), bevel * 0.9);
    if (Math.min(cell - inX, cell - inY) < 4.5) px = mixRgb(px, rgb('#472616'), bevel * 0.9);
    return px;
  },


  denim: (x, y) => {
    /*
      Indigo twill: the diagonal rib of the weave, the pale weft crossing
      it, slubs, and two seams of orange topstitching. The copper rivet
      that used to sit at (47, 32) is gone — David: "get rid of that
      weird yellow dot on denim." On a shell this size it did not read as
      a rivet, it read as a stray dot.
    */
    const diag = tiling(x * 2 - y * 2, 16);
    let px = mixRgb(rgb('#22395c'), rgb('#5480ad'), smoothstep(0.12, 0.9, diag));
    px = mixRgb(px, rgb('#a3c2d9'), (x + y) % 3 === 0 ? 0.3 : 0);
    px = mixRgb(px, rgb('#16263f'), (x - y + 64) % 3 === 0 ? 0.22 : 0);
    if (hashCell(x, Math.floor(y / 4)) > 0.978) px = mixRgb(px, rgb('#cfe0ea'), 0.75);
    for (const sy of [11, 52]) {
      const near = Math.abs(y - sy);
      if (near < 4) px = mixRgb(px, rgb('#16263f'), smoothstep(4, 1.6, near) * 0.35);
      if (near < 1.5 && (x + Math.floor(y)) % 7 < 4) {
        px = mixRgb(rgb('#d99a35'), rgb('#a5701f'), (x % 2) * 0.5);
      }
    }
    return px;
  },
  ruby: (x, y) => {
    /*
      Gold's sheen, in red. David: "make the ruby dice color look like
      the gold but red." It was a cut gem of triangular facets, which is
      what a ruby IS but not what the ladder's metals look like — and
      Gold, Silver and Copper are one family the ruby ought to join.

      One soft bar of light sweeping the face, a hot core to it, and the
      stone going almost black where the light never reaches.
    */
    const d = (x * 0.62 + y * 0.78) / SIZE;
    const bar = (centre: number, width: number, strength: number) =>
      Math.exp(-Math.pow((d - centre) / width, 2)) * strength;
    const light = bar(0.38, 0.18, 1.0) + bar(1.02, 0.14, 0.42);
    let px = mixRgb(rgb('#4a0a1c'), rgb('#c22a48'), Math.min(1, light + 0.2));
    px = mixRgb(px, rgb('#ff9ab0'), Math.max(0, light - 0.76) * 1.9);
    px = mixRgb(px, rgb('#2b0511'), Math.max(0, 0.2 - light) * 1.2);
    // The same fine polishing marks the other three carry.
    const brush = Math.sin((x * 0.78 - y * 0.62) * 2.4) * 0.05 + (hashCell(x, y) - 0.5) * 0.05;
    return mixRgb(px, brush > 0 ? rgb('#ffffff') : rgb('#000000'), Math.abs(brush));
  },
  slate: (x, y) => {
    // Slate splits along its bedding: flat planes, a stepped edge where
    // one layer sits proud of the next, and the fine cleavage grain.
    const bed = fbm(x * 0.5, y * 2.2, [32, 16], [1, 0.5]);
    let px = mixRgb(rgb('#454d59'), rgb('#6e7784'), (bed + 0.6) * 0.8);
    const step = Math.abs(((((y + bed * 9) % 17) + 17) % 17) - 8.5);
    px = mixRgb(px, rgb('#2b323c'), smoothstep(2.2, 0.4, step) * 0.55);
    px = mixRgb(px, rgb('#8a939e'), smoothstep(3.6, 2.4, step) * 0.4);
    return mixRgb(px, rgb('#39404a'), (hashCell(x, y) - 0.5) * 0.24 + 0.12);
  },

  copper: (x, y) => {
    /*
      Polished copper, lit the way Gold and Silver are: one soft bar of
      light sweeping the face, a hot core to it, and the metal falling to
      shadow either side.

      It was a hammered surface of dimples before — accurate, and at the
      size a die is actually seen it read as nothing. David: "make it
      look like the gold and silver texture." He is right that the three
      metals should be one family; what separates them is the width of
      the sweep and what the shadow is made of. Gold's shadow is warm
      brown, Silver's is cold grey, and Copper's is the first breath of
      verdigris.
    */
    const d = (x * 0.62 + y * 0.78) / SIZE;
    const bar = (centre: number, width: number, strength: number) =>
      Math.exp(-Math.pow((d - centre) / width, 2)) * strength;
    const light = bar(0.38, 0.18, 1.0) + bar(1.02, 0.14, 0.42);
    let px = mixRgb(rgb('#66300f'), rgb('#c9793d'), Math.min(1, light + 0.2));
    px = mixRgb(px, rgb('#ffd9a8'), Math.max(0, light - 0.78) * 1.8);
    px = mixRgb(px, rgb('#3d7a6e'), Math.max(0, 0.2 - light) * 1.1);
    // The same fine polishing marks along the sweep the other two have.
    const brush = Math.sin((x * 0.78 - y * 0.62) * 2.4) * 0.05 + (hashCell(x, y) - 0.5) * 0.05;
    return mixRgb(px, brush > 0 ? rgb('#ffffff') : rgb('#000000'), Math.abs(brush));
  },


  ocean: (x, y) => {
    /*
      Rolling swells with the foam breaking in an unbroken LINE along
      each crest.

      Marc, 27 Aug 2026: "fix the ocean dice skin to look better." Three
      things were wrong and each one had to go.

      The wave phase was pushed around by 2.6 radians of noise — more
      than half a wavelength — so every swell bent back into itself and
      there were no wave fronts at all, only swirls.

      The foam was chosen from the SUM of the swell and the shorter chop
      crossing it. The chop is what stops a sea looking like corduroy,
      but adding it before deciding where the foam goes chews the crest
      line into pieces, and the pieces are the flying white blobs. Foam
      is picked from the swell alone now; the chop only ruffles the
      colour underneath it.

      And the water sat in one narrow band of teal, so even where a wave
      was there was nothing to see. Trough to crest now runs deep navy →
      ocean blue → bright shallow → pale glass, in steps wide enough to
      read at sixty-four pixels.
    */
    /*
      Two scales, because one is what kept going wrong.

      A single train of waves with foam on every crest gives evenly
      spaced parallel stripes, and at sixty-four pixels evenly spaced
      parallel stripes are a deck chair, not the sea — that was true of
      it as a thin neon line and just as true of it as a broad white
      band. What makes water read as water is that the foam is PATCHY
      and still lies along lines.

      So: a long roll carries the colour, shorter waves ride on top of it
      at a slight angle, and the foam needs BOTH — a small wave at its
      crest AND the long roll high underneath it. Foam then breaks out in
      runs along the tops of the rollers and leaves the troughs alone,
      which is what a sea from above actually does.
    */
    const wander = fbm(x, y, [32, 16], [0.8, 0.28]) * 0.45;
    // The long roll: two swells across the tile, down and to the right.
    const roll = Math.sin(((y + x * 0.42) / SIZE) * Math.PI * 4 + wander);
    // Shorter waves riding it, turned a little across the roll.
    const rip = Math.sin(((y * 0.85 - x * 0.34) / SIZE) * Math.PI * 10 + wander * 1.7 + roll * 0.75);
    const water = roll * 0.6 + rip * 0.4;

    /*
      The water itself, and there is far more of it than there is foam.
      Sea read from above is mostly mid-blue; trough to crest is a real
      range but it is not black to white.
    */
    let px = mixRgb(rgb('#14577a'), rgb('#2382a8'), smoothstep(-1, -0.1, water));
    px = mixRgb(px, rgb('#3aa6c6'), smoothstep(-0.15, 0.55, water));
    px = mixRgb(px, rgb('#76c4dc'), smoothstep(0.5, 0.95, water));
    // Green light coming back up out of the deepest troughs.
    px = mixRgb(px, rgb('#15695a'), smoothstep(-0.45, -0.95, water) * 0.42);
    // Ripple everywhere, so the surface is never a clean gradient.
    const ripple = wrappedNoise(x, y, 8) - 0.5;
    px = mixRgb(px, rgb(ripple > 0 ? '#8fd0e2' : '#0f4f6e'), Math.abs(ripple) * 0.45);

    // Where a short wave is breaking, and only up on the roll.
    const breaking = smoothstep(0.3, 0.9, rip) * smoothstep(-0.15, 0.75, roll);
    const froth = 0.5 + wrappedNoise(x, y, 8) * 0.8;
    px = mixRgb(px, rgb('#cfe7ef'), breaking * Math.min(1, froth) * 0.95);
    px = mixRgb(px, rgb('#f4fbfd'), breaking * smoothstep(0.72, 0.99, rip) * 0.8);
    return px;
  },

  dimples: (x, y) => {
    /*
      A golf ball: white on white, so all of it is shading. Pits packed
      on a real hex lattice, which is how a ball is actually dimpled.

      The first attempt measured "distance from a dimple" by adding up
      three axial stripe distances, which is not a distance to anything —
      it drew diagonal streaks rather than round pits.
    */
    const size = 4.1;
    const cell = hexCell(x, y, size);
    const ball = 1 - (x + y) / (SIZE * 2.8);
    let px = mixRgb(rgb('#d0d5cf'), rgb('#ffffff'), ball);
    const pit = smoothstep(size * 0.86, size * 0.2, cell.d);
    // A hollow lit from the upper left has its FAR wall bright.
    const lit = ((x - cell.cx) + (y - cell.cy)) / size;
    px = mixRgb(px, rgb('#ffffff'), Math.max(0, lit) * pit * 1.15);
    px = mixRgb(px, rgb('#8a908a'), Math.max(0, -lit) * pit * 1.25);
    return mixRgb(px, rgb('#b3b8b2'), pit * 0.2);
  },

  soccer: (x, y) => {
    /*
      A football is a truncated icosahedron: twelve BLACK PENTAGONS, no
      two of them touching, set in a field of white hexagons, with the
      stitched seams drawn between the lot.

      Marc, 27 Aug 2026: "that's not what a soccer ball looks like, make
      the soccer ball skin look like a freaking soccer ball." He is
      right. What was there picked one panel in three with a hash, so
      black cells landed next to each other and ran together into blobs;
      every panel was a hexagon; and the seam was a hairline. It read as
      bathroom tiling.

      Two changes do it. The black panels go on a proper 3-colouring of
      the hex lattice — (q + 2r) mod 3, the arrangement in which no two
      of them are EVER neighbours, which is exactly what a real ball does
      with its pentagons. And a black panel is drawn as a regular
      PENTAGON rather than as its hexagon, because five sides against six
      is the whole difference between a football and a honeycomb.
    */
    const size = 6.6;
    const cell = hexCell(x, y, size);
    const inradius = (size * Math.sqrt(3)) / 2;

    // White leather, with the grain barely showing.
    let px = mixRgb(rgb('#f7f5f0'), rgb('#dcd8cf'), wrappedNoise(x, y, 16) * 0.55);

    // The seam net, on every panel edge.
    px = mixRgb(px, rgb('#a9a49b'), smoothstep(0.78, 0.97, cell.t) * 0.9);

    const klass = (((cell.q + 2 * cell.r) % 3) + 3) % 3;
    if (klass === 0) {
      /*
        A regular pentagon's boundary at the angle we are looking along:
        its inradius over the cosine of the angle folded into one fifth
        of a turn — the same trick hexCell uses for six sides. Turned a
        little from panel to panel, the way a stitched ball never has two
        quite aligned.
      */
      const sector = (Math.PI * 2) / 5;
      const spin = ((((cell.q * 5 + cell.r * 3) % 5) + 5) % 5) * 0.22;
      const a = Math.atan2(y - cell.cy, x - cell.cx) + spin - Math.PI / 2;
      const folded = Math.abs(((((a + sector / 2) % sector) + sector) % sector) - sector / 2);
      const edge = (inradius * 0.9) / Math.cos(folded);
      px = mixRgb(px, rgb('#1b1826'), smoothstep(edge + 0.8, edge - 0.8, cell.d));
      // Stitching round it, a shade off the black so the edge reads.
      px = mixRgb(
        px,
        rgb('#6e6a79'),
        smoothstep(1.8, 0.3, Math.abs(cell.d - edge)) * 0.45,
      );
    }
    return px;
  },

  basketball: (x, y) => {
    /*
      A basketball: deep orange pebbled hide with the eight-panel seams
      wide and black over it. The seams used to be hairlines a pixel and
      a half wide, which at a die's size vanished into the pebble and
      left an orange cube.
    */
    const c = SIZE / 2;
    /*
      1.4375, out from 1.375. The seams got much wider when they were
      made bold enough to read, and at the old radius their inner lip
      reached 19.8 from the centre — inside the 21-pixel circle the
      colour sticker covers. Widening a line means moving it too.
    */
    const reach = SIZE * 1.4375;
    const seamAt = Math.min(
      Math.abs(Math.hypot(x - SIZE * 1.5, y - c) - reach),
      Math.abs(Math.hypot(x + SIZE * 0.5, y - c) - reach),
      Math.abs(Math.hypot(x - c, y - SIZE * 1.5) - reach),
      Math.abs(Math.hypot(x - c, y + SIZE * 0.5) - reach),
    );
    /*
      Pebble: a tight hex lattice of little domes over the whole hide.
      Built with hexCell rather than by rounding two axial stripes — the
      stripe version is not a distance to anything, and its beat against
      the tile put a third more contrast inside the sticker's circle than
      outside it.
    */
    const grain = hexCell(x, y, 2.1);
    const lit = ((x - grain.cx) + (y - grain.cy)) / 2.1;
    let px = mixRgb(rgb('#a34a14'), rgb('#cf6b24'), wrappedNoise(x, y, 32));
    px = mixRgb(px, rgb('#e8964f'), Math.max(0, lit) * 0.5);
    px = mixRgb(px, rgb('#66290a'), Math.max(0, -lit) * 0.45);
    // The seam: a black channel with the hide lipping over its edges.
    px = mixRgb(px, rgb('#1d1622'), smoothstep(2.8, 1.4, seamAt));
    px = mixRgb(px, rgb('#7a3a10'), smoothstep(4.2, 2.8, seamAt) * 0.5);
    return px;
  },
  laces: (x, y) => {
    // A football: pebbled hide, the lace panel on the left third and the
    // long seam sweeping the right, both clear of the colour sticker.
    const c = SIZE / 2;
    const cell = 4;
    const row = Math.floor(y / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;
    const gx = ((x + offset) % cell) - cell / 2;
    const gy = (y % cell) - cell / 2;
    const lit = (-gx - gy) / 2.6;
    let px = mixRgb(rgb('#6b3315'), rgb('#8a4722'), wrappedNoise(x, y, 32));
    px = mixRgb(px, rgb('#a3663a'), Math.max(0, lit) * 0.4);
    px = mixRgb(px, rgb('#45200e'), Math.max(0, -lit) * 0.35);
    // The pointed ends fall away, hinting the ball's curve.
    px = mixRgb(px, rgb('#38190b'), smoothstep(20, 32, Math.abs(y - c)) * 0.4);
    if (Math.abs(Math.hypot(x - SIZE * 1.4, y - c) - SIZE * 0.63) < 1.5) {
      px = mixRgb(rgb('#e8dfcc'), rgb('#bdb39b'), 0.4);
    }
    const lx = SIZE * 0.22;
    if (Math.abs(x - lx) < 1.6 && Math.abs(y - c) < 18) px = rgb('#f2ece0');
    for (let i = -2; i <= 2; i++) {
      if (Math.abs(y - (c + i * 7.5)) < 1.6 && Math.abs(x - lx) < 6.2) {
        px = mixRgb(rgb('#f7f2e8'), rgb('#c9c1af'), Math.abs(x - lx) / 6.2);
      }
    }
    return px;
  },

  volleyball: (x, y) => {
    // Panels in threes, each one domed, with a real seam channel between
    // them and the grain of synthetic leather over the lot.
    const t = (x * 0.78 + y * 0.62) / 15;
    const band = ((Math.floor(t) % 3) + 3) % 3;
    const frac = t - Math.floor(t);
    // Deeper than the old #f0c020: that sat ΔLab 18.6 from the yellow
    // face, the tightest painted colour in the set.
    let px = band === 1 ? rgb('#2a4a8a') : band === 2 ? rgb('#cf9c14') : rgb('#f0ede6');
    px = mixRgb(px, rgb('#ffffff'), (0.5 - Math.abs(frac - 0.5)) * 0.4);
    const edge = Math.abs(frac - 0.5);
    if (edge > 0.44) px = mixRgb(px, rgb('#66625a'), 0.8);
    else if (edge > 0.38) px = mixRgb(px, rgb('#ffffff'), 0.45);
    return mixRgb(px, rgb('#000000'), (hashCell(x, y) - 0.5) * 0.07 + 0.035);
  },

  bowling: (x, y) => {
    /*
      Polished resin: a swirl marbled through it, a hard gloss highlight,
      and three finger holes with depth. It was a flat dark cube with a
      corner glow — the least visible pattern in the whole set at a local
      contrast of seventeen.
    */
    let px = mixRgb(rgb('#221d30'), rgb('#463a66'), wrappedNoise(x, y, 32) * 0.9);
    const swirl = Math.sin((x * 0.9 + y * 0.4) * 0.12 + fbm(x, y, [32, 16], [1, 0.5]) * 6);
    px = mixRgb(px, rgb('#6b4da3'), smoothstep(0.25, 1, swirl) * 0.6);
    const g = Math.hypot(x - SIZE * 0.9, y - SIZE * 0.84);
    px = mixRgb(px, rgb('#bfb2e0'), smoothstep(22, 8, g) * 0.5);
    px = mixRgb(px, rgb('#ffffff'), smoothstep(8, 3, g) * 0.75);
    for (const [hx, hy] of [[8, 11], [18, 8], [13, 21]] as const) {
      const d = Math.hypot(x - hx, y - hy);
      if (d < 4.3) {
        px = mixRgb(px, rgb('#8f86a8'), smoothstep(3.3, 4.3, d) * 0.55);
        if (d < 3.4) px = mixRgb(rgb('#0a0813'), rgb('#2a2440'), smoothstep(0, 3.4, d) * 0.55);
      }
    }
    return px;
  },

  /* ── animals, remade in full colour ─────────────────────────────── */


  patches: (x, y) => {
    /*
      Cow markings, drawn as MARKINGS.

      David: "make the cow look more like a cow and less like an
      algorithm picking a pattern." It was one blob per cell of a
      staggered lattice, and however much each was jittered the grid
      showed through — the eye finds a repeat long before it finds a cow.

      These are six patches placed by hand at sizes and positions no
      lattice would produce, each one's edge chewed by noise. Hand-placed
      because a 64-pixel tile has room for about one island of
      low-frequency noise: pure noise gives one enormous blob, which is
      what sent this to a lattice in the first place.
    */
    let px = mixRgb(rgb('#efece4'), rgb('#ffffff'), wrappedNoise(x, y, 16));
    const patch = (cx: number, cy: number, rx: number, ry: number, spin: number) => {
      // Wrapped so a patch crossing the tile edge comes back the far side.
      const dx = ((((x - cx) % SIZE) + SIZE * 1.5) % SIZE) - SIZE / 2;
      const dy = ((((y - cy) % SIZE) + SIZE * 1.5) % SIZE) - SIZE / 2;
      const ux = dx * Math.cos(spin) + dy * Math.sin(spin);
      const uy = -dx * Math.sin(spin) + dy * Math.cos(spin);
      const chew = fbm(x * 1.6, y * 1.6, [32, 16], [1, 0.6]) * 0.5 - 0.15;
      return Math.hypot(ux / rx, uy / ry) + chew < 1;
    };
    const inside =
      patch(14, 12, 13, 9, 0.5) ||
      patch(46, 20, 9, 14, -0.9) ||
      patch(24, 44, 15, 10, 1.2) ||
      patch(56, 52, 8, 7, 0.2) ||
      patch(4, 34, 6, 11, -0.4) ||
      patch(38, 60, 11, 6, 0.8);
    if (inside) {
      px = mixRgb(rgb('#2b2723'), rgb('#4a443b'), wrappedNoise(x * 2, y * 2, 16));
    }
    // The short hair of the coat, over both.
    return mixRgb(px, rgb('#8a8378'), (wrappedNoise(x * 3, y, 16) - 0.5) * 0.16 + 0.08);
  },

  bands: (x, y) => {
    /*
      A bumblebee: fuzzy black and amber bands, and nothing else. The
      speckle of pale hairs scattered over them read as SPOTS — David
      asked for them gone, and he is right that a bee has no spots.
    */
    const fuzz = fbm(x * 2, y * 3, [32, 16], [1, 0.5]) * 2.4;
    const wave = tiling(y + fuzz, 3);
    let px = mixRgb(rgb('#221d13'), rgb('#dba428'), smoothstep(0.1, 0.4, wave));
    px = mixRgb(px, rgb('#ffd97a'), smoothstep(0.4, 0.6, wave) * smoothstep(0.92, 0.6, wave) * 0.55);
    px = mixRgb(px, rgb('#0b0905'), smoothstep(0.1, 0, wave) * 0.6);
    // The fuzz is DIRECTIONAL now — hair lying along the band rather
    // than dots sitting on it.
    return mixRgb(px, rgb('#f7e6b8'), (wrappedNoise(x * 5, y, 16) - 0.5) * 0.13);
  },

  diamonds: (x, y) => {
    /*
      A diamondback: big dark saddles down the spine, pale-edged, over
      fine scales. The scales used to BE the diamonds, which is a
      lattice — a diamondback's markings are several scales across.
    */
    const su = (x + y) / 4.4;
    const sv = (x - y) / 4.4;
    const fu = su - Math.floor(su) - 0.5;
    const fv = sv - Math.floor(sv) - 0.5;
    const keel = -(fu + fv) * 1.4;
    let px = mixRgb(rgb('#97ac60'), rgb('#c6d393'), hashCell(Math.floor(su), Math.floor(sv)) * 0.7);
    px = mixRgb(px, rgb('#e4ecc1'), Math.max(0, keel) * 0.4);
    px = mixRgb(px, rgb('#606f37'), Math.max(0, -keel) * 0.45);
    px = mixRgb(px, rgb('#4e5b2d'), smoothstep(0.4, 0.5, Math.max(Math.abs(fu), Math.abs(fv))) * 0.5);
    /*
      The saddles. Bigger than the scales by a long way, wandering with
      the noise so they are not a stamped grid, and edged in cream — the
      edging is most of what makes a snake read as a snake.
    */
    const wobble = fbm(x * 0.7, y * 0.7, [32, 16], [1, 0.5]) * 9 - 4.5;
    const bx = Math.abs(((x + wobble + SIZE * 1.5) % 32) - 16) / 16;
    const by = Math.abs(((y - wobble * 0.5 + SIZE * 1.5) % 21.33) - 10.67) / 10.67;
    const saddle = bx * 0.62 + by * 0.38;
    px = mixRgb(px, rgb('#f4f2d4'), smoothstep(0.62, 0.44, saddle) * 0.85);
    px = mixRgb(px, rgb('#2b3317'), smoothstep(0.44, 0.3, saddle));
    return px;
  },

  tigerStripes: (x, y) => {
    /*
      Black stripes over orange FUR. The fur is the half a mask could
      never draw — a tiger is not painted, it is hairy, and flat ink on
      flat orange reads as a warning sign.
    */
    const sway = tiling(y, 2) * 4 + fbm(x, y, [32], [1]) * 3;
    const wave = Math.abs(tiling(x + sway, 4));
    const width = 0.28 + 0.3 * tiling(y + 11, 3);
    const stripe = smoothstep(width + 0.12, width - 0.06, wave);
    let px = mixRgb(rgb('#a04c18'), rgb('#cf7a2b'), wrappedNoise(x, y, 32));
    px = mixRgb(px, rgb('#edc48a'), smoothstep(0.55, 0.95, wave) * 0.42);
    px = mixRgb(px, mixRgb(rgb('#191524'), rgb('#332c40'), wrappedNoise(x * 2, y * 2, 16)), stripe);
    return mixRgb(px, rgb('#f7e0c2'), (wrappedNoise(x * 4, y, 16) - 0.5) * 0.14 + 0.07);
  },

  honeycomb: (x, y) => {
    /*
      Comb with depth: each cell is a HOLE — dark at the bottom, honey
      standing in the fuller ones — under a wax wall that is lit on one
      side and shadowed on the other. Flat hexagons read as a grid.
    */
    const u = x / 9;
    const v = (x * 0.5 + y * 0.866) / 9;
    const w = (x * 0.5 - y * 0.866) / 9;
    const edge = (t: number) => Math.abs(t - Math.round(t));
    const nearest = Math.min(edge(u), edge(v), edge(w));
    const fill = wrappedNoise(x, y, 16);
    let px = mixRgb(rgb('#6b4711'), rgb('#8a6117'), fill);
    px = mixRgb(px, rgb('#d99f26'), smoothstep(0.3, 0.62, fill) * 0.85);
    // Deeper toward the middle of every cell.
    px = mixRgb(px, rgb('#4a300a'), smoothstep(0.3, 0.5, nearest) * 0.45);
    const wall = smoothstep(0.17, 0.08, nearest);
    const lit = 0.5 - (((x * 0.6 + y * 0.8) % 9) + 9) % 9 / 12;
    px = mixRgb(px, mixRgb(rgb('#c2933a'), rgb('#f2d488'), Math.max(0, lit + 0.35)), wall);
    return px;
  },

  bubbles: (x, y) => {
    /*
      Real soap bubbles: round, overlapping, thin-walled, with a bright
      specular dot near the top left of each and the faint rainbow a
      soap film throws. The mask version could only tint toward one ink,
      so every bubble was the same flat outline in the same one colour.
    */
    const cell = 15;
    let px = mixRgb(rgb('#bfe2f7'), rgb('#dff0fc'), fbm(x, y, [32, 16], [1, 0.5]));
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const row = Math.floor(y / cell) + dy;
        const col = Math.floor(x / cell) + dx;
        const h = hashCell(col, row);
        const offset = ((row % 2) + 2) % 2 === 0 ? 0 : cell / 2;
        const cx = col * cell + offset + (h - 0.5) * 4 + cell / 2;
        const cy = row * cell + (hashCell(col + 9, row) - 0.5) * 4 + cell / 2;
        const r = 4.6 + h * 2.6;
        const d = Math.hypot(x - cx, y - cy);
        if (d > r + 0.6) continue;
        // The film: brightest at the rim, all but clear in the middle.
        const rim = smoothstep(r - 2.2, r, d);
        // Iridescence — the colour a soap film shows at grazing angles.
        const tint = mixRgb(rgb('#c9a8f0'), rgb('#a8f0d8'), (Math.sin(d * 0.9 + h * 6) + 1) / 2);
        px = mixRgb(px, tint, rim * 0.55);
        px = mixRgb(px, rgb('#ffffff'), smoothstep(r - 1, r, d) * smoothstep(r + 0.6, r - 0.2, d) * 0.9);
        // Shadow under the far side, so it is a sphere not a ring.
        px = mixRgb(px, rgb('#7fa8c2'), rim * smoothstep(-0.2, 0.9, (x - cx + y - cy) / r) * 0.45);
        // The glint.
        if (Math.hypot(x - (cx - r * 0.38), y - (cy - r * 0.38)) < r * 0.2) {
          px = rgb('#ffffff');
        }
      }
    }
    return px;
  },
};

/** Every colour-painter id, for the one runtime branch that needs it. */
const COLOR_IDS = new Set(Object.keys(COLOR_PAINTERS));

/**
 * Does this pattern mix its own paint?
 *
 * A colour painter takes no ink: it returns finished pixels. Callers used
 * to work that out by checking whether a skin had an `ink` at all, which
 * meant every colour-painted skin had to carry a made-up ink nobody read
 * — and the suite then dutifully checked that made-up colour against the
 * face palette. Asking the question directly is both shorter and true.
 */
export function isColorPattern(pattern: PatternId): boolean {
  return COLOR_IDS.has(pattern);
}

/**
 * Build the shell texture for a pattern. `base` is the skin's own colour
 * and `ink` is the pattern colour drawn over it.
 */
/**
 * Raw RGB bytes for a pattern, one triple per pixel.
 *
 * Shared by the 3D shell texture and the 2D preview in the Store and the
 * Inventory, so what is on the shelf cannot drift away from what ends up
 * in your hand.
 */
export function patternPixels(
  pattern: Exclude<PatternId, 'plain'>,
  base: string,
  ink: string,
): number[] {
  const parse = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [br, bg, bb] = parse(base);
  const [ir, ig, ib] = parse(ink);

  // The eight full-colour patterns paint their own pixels outright.
  if (COLOR_IDS.has(pattern)) {
    const paintColor = COLOR_PAINTERS[pattern as ColorPatternId];
    const out: number[] = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        out.push(...paintColor(x, y));
      }
    }
    return out;
  }

  const paint = PAINTERS[pattern as MaskPatternId];

  const out: number[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const mask = Math.max(-1, Math.min(1, paint(x, y)));
      // Positive tints toward the ink, negative darkens the shell itself.
      const mix = (base: number, ink: number) =>
        mask >= 0 ? base + (ink - base) * mask : base * (1 + mask * SHADE_DEPTH);
      // Rounded to whole bytes. A Uint8Array used to truncate these for
      // free; the PNG encoder takes a plain array and a fractional byte
      // corrupts the stream.
      out.push(
        Math.round(mix(br, ir)),
        Math.round(mix(bg, ig)),
        Math.round(mix(bb, ib)),
      );
    }
  }
  return out;
}

/** The size every pattern is drawn at. */
export const PATTERN_SIZE = SIZE;

/**
 * Build the shell texture for a pattern. `base` is the skin's own colour
 * and `ink` is the pattern colour drawn over it.
 */
export function createPatternTexture(
  pattern: Exclude<PatternId, 'plain'>,
  base: string,
  ink: string,
): THREE.DataTexture {
  const rgb = patternPixels(pattern, base, ink);
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 3) {
    data[i] = rgb[p];
    data[i + 1] = rgb[p + 1];
    data[i + 2] = rgb[p + 2];
    data[i + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, SIZE, SIZE);
  texture.colorSpace = THREE.SRGBColorSpace;
  /*
   * CLAMP, not repeat.
   *
   * A cube's UVs run 0..1 on every face and `repeat` is never set, so
   * each face shows this image exactly once — the texture is not tiled
   * anywhere, and its left edge only ever meets its right edge at a
   * physical corner of the die, where a change is invisible.
   *
   * Repeat wrapping was therefore buying nothing and costing a little:
   * with linear filtering the outermost row of texels blends with the
   * row from the OPPOSITE edge, bleeding a sliver of the far side of the
   * pattern into the rim of every face. Clamping samples the edge itself.
   */
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
