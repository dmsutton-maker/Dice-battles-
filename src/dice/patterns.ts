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
  | 'scales'
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
/** The eight patterns painted in full colour rather than through a mask. */
export type ColorPatternId =
  | 'volleyball' | 'watermelon' | 'pizza' | 'donut'
  | 'rainbow' | 'galaxy' | 'camo' | 'tartan';
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
  bubbles: (x, y) => {
    const cell = 16;
    const row = Math.floor(y / cell);
    const col = Math.floor(x / cell);
    // Deterministic per-cell jitter — no Math.random, so the texture is
    // identical every time it is built.
    const hash = (Math.sin(row * 12.9898 + col * 78.233) * 43758.5453) % 1;
    const wobble = Math.abs(hash);
    const radius = 4.6 + wobble * 2.2;

    const offset = row % 2 === 0 ? 0 : cell / 2;
    const cx = ((x + offset) % cell) - cell / 2;
    const cy = (y % cell) - cell / 2;
    const d = Math.hypot(cx, cy);

    // The glint: a small dot up and to the left inside the bubble.
    const gd = Math.hypot(cx + radius * 0.34, cy + radius * 0.34);
    if (gd < radius * 0.2) return 1;

    // The rim.
    const thickness = 2.1;
    if (d < radius && d > radius - thickness) return 0.9;

    // Hollow inside — the faintest wash so it reads as glass, not a hole.
    if (d <= radius - thickness) return 0.12;

    return 0;
  },

  // Soft wavy bands. Kept for the skins that already use it.
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
  tigerStripes: (x, y) => {
    const sway = tiling(y, 2) * 4 + fbm(x, y, [32], [1]) * 3;
    const wave = Math.abs(tiling(x + sway, 4));
    // Stripe width breathes down its length, pinching to nothing —
    // parallel bands of constant width are a barcode, not a tiger.
    const width = 0.28 + 0.3 * tiling(y + 11, 3);
    return smoothstep(width + 0.12, width - 0.06, wave) * 0.95;
  },

  /**
   * Cow: several lumpy patches. NOT thresholded noise — a 64px tile has
   * room for about one island of low-frequency noise, and the first
   * version rendered as a single blob in one corner. Cells guarantee the
   * count; per-cell noise keeps every patch its own lumpy shape.
   */
  patches: (x, y) => {
    const cell = 24;
    const row = Math.floor(y / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;
    const col = Math.floor((x + offset) / cell);
    const h = hashCell(col, row);
    // A patch in roughly two cells out of three.
    if (h < 0.3) return 0;
    const cx = ((x + offset) % cell) - cell / 2 + (h - 0.5) * 6;
    const cy = (y % cell) - cell / 2 + (hashCell(col + 5, row) - 0.5) * 6;
    const lump = fbm(x + col * 7, y + row * 3, [16, 8], [1, 0.6]) * 4;
    const r = 6.5 + h * 3;
    return smoothstep(r + 1.5, r - 1.5, Math.hypot(cx, cy) + lump) * 0.95;
  },

  /**
   * Giraffe: polygonal plates with light seams between them. Nearest-two
   * Voronoi: the seam is where the two closest jittered points are nearly
   * equidistant, and everything else is plate.
   */
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
  bands: (x, y) => {
    const wave = tiling(y + fbm(x, y, [32], [1]) * 2, 3);
    return smoothstep(0.05, 0.45, wave) * 0.95;
  },

  /**
   * Peacock: staggered feather eyes — a ring with a bright heart, and
   * fine rays running outward between eyes.
   */
  peacock: (x, y) => {
    const cell = 21;
    const row = Math.floor(y / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;
    const cx = ((x + offset) % cell) - cell / 2;
    const cy = (y % cell) - cell / 2;
    const r = Math.hypot(cx, cy);
    if (r < 2.4) return 1;
    if (Math.abs(r - 5.2) < 1.3) return 0.85;
    // Rays: twelve per eye, fading with distance.
    const a = Math.atan2(cy, cx);
    const ray = Math.abs(Math.sin(a * 6)) > 0.92 && r < 9.5;
    return ray ? 0.35 : -0.06;
  },

  /** Fish scales: overlapping scallop rows. */
  scales: (x, y) => {
    const cell = 12;
    const row = Math.floor(y / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;
    const cx = ((x + offset) % cell) - cell / 2;
    // The arc of THIS row's scale, drawn where the scale below overlaps.
    const cy = (y % cell);
    const d = Math.hypot(cx, cy - cell);
    const onEdge = Math.abs(d - cell * 0.62) < 1.2 && cy > cell * 0.35;
    // A faint darkening toward each scale's root gives the rows depth.
    const shade = smoothstep(cell * 0.62, 0, d) * -0.12;
    return onEdge ? 0.9 : shade;
  },

  /** Turtle shell: big hexagonal plates with grooves between. */
  shell: (x, y) => {
    // Hex lattice via three axial stripe families 60° apart.
    const u = x / 16;
    const v = (x * 0.5 + y * 0.866) / 16;
    const w = (x * 0.5 - y * 0.866) / 16;
    const edge = (t: number) => Math.abs(t - Math.round(t));
    const nearest = Math.min(edge(u), edge(v), edge(w));
    const groove = smoothstep(0.1, 0.03, nearest);
    // Plates bow upward slightly: darker toward every groove.
    return groove * 0.9 - smoothstep(0.35, 0.1, nearest) * 0.1;
  },

  /** Snakeskin: a diamond lattice, each scale shaded to a keel. */
  diamonds: (x, y) => {
    const u = (x + y) / 11;
    const v = (x - y) / 11;
    const fu = Math.abs(u - Math.round(u));
    const fv = Math.abs(v - Math.round(v));
    const border = Math.min(fu, fv);
    const line = smoothstep(0.1, 0.02, border);
    // Each diamond darkens toward its lower edge, like lapped scales.
    const inner = (fu + fv) * 0.5;
    return line * 0.85 - smoothstep(0.5, 0.15, inner) * 0.14;
  },

  /** Paw prints: a main pad and three toes, marching diagonally. */
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
  basketball: (x, y) => {
    const c = SIZE / 2;
    /*
      The side arcs bulge OUTWARD, toward the edges — which means each
      one's circle is centred on the far side of the face. The first
      version centred them just off their own sides, and the two arcs
      swept through the middle and met at top and bottom: rendered, the
      ball wore an ellipse, not seams.
    */
    const seam =
      Math.abs(x - c) < 1.4 ||
      Math.abs(y - c) < 1.4 ||
      Math.abs(Math.hypot(x - SIZE * 1.5, y - c) - SIZE * 1.25) < 1.4 ||
      Math.abs(Math.hypot(x + SIZE * 0.5, y - c) - SIZE * 1.25) < 1.4;
    if (seam) return 0.95;
    // Pebble: fine hash speckle, kept subtle.
    return (hashCell(x, y) - 0.5) * 0.1;
  },

  /** Soccer ball: one pentagon at the centre, quarters in the corners. */
  soccer: (x, y) => {
    const pentagon = (cx: number, cy: number, r: number, spin: number) => {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > r) return false;
      const a = Math.atan2(dy, dx) + spin;
      const sector = (Math.PI * 2) / 5;
      const folded = Math.abs((((a % sector) + sector) % sector) - sector / 2);
      // Distance to the flat edge of a regular pentagon.
      return d * Math.cos(folded) <= r * Math.cos(sector / 2);
    };
    if (pentagon(SIZE / 2, SIZE / 2, 11, Math.PI / 2)) return 0.95;
    /*
      Corner pentagons stand upright like the centre one. Spinning them
      by PI/5 seemed more natural and put a flat edge across three of the
      four corners' visible quarters — the render showed one corner
      panel and three empty corners.
    */
    for (const [cx, cy] of [[0, 0], [SIZE, 0], [0, SIZE], [SIZE, SIZE]] as const) {
      if (pentagon(cx, cy, 12, Math.PI / 2)) return 0.95;
    }
    return 0;
  },

  /** Tennis ball: the two curved seams that wrap the felt. */
  tennis: (x, y) => {
    const c = SIZE / 2;
    const left = Math.abs(Math.hypot(x + SIZE * 0.32, y - c) - SIZE * 0.72);
    const right = Math.abs(Math.hypot(x - SIZE * 1.32, y - c) - SIZE * 0.72);
    if (Math.min(left, right) < 1.8) return 0.95;
    // Felt: the faintest fuzz so the ground is not a flat wash.
    return (hashCell(x, y) - 0.5) * 0.08;
  },

  /**
   * Baseball: two arcs of stitching. The stitches themselves are short
   * dashes crossing the seam line, not the line — a drawn-on line is
   * what makes toy baseballs look like toys.
   */
  baseball: (x, y) => {
    for (const cx of [-SIZE * 0.28, SIZE * 1.28]) {
      const d = Math.hypot(x - cx, y - SIZE / 2);
      const off = Math.abs(d - SIZE * 0.62);
      if (off < 3.2) {
        // Position along the arc decides the dash rhythm.
        const a = Math.atan2(y - SIZE / 2, x - cx);
        if (Math.abs(Math.sin(a * 14)) > 0.55 && off > 0.8) return 0.9;
      }
    }
    return 0;
  },

  /** Football: the lace panel — one long line, five cross-bars. */
  laces: (x, y) => {
    const c = SIZE / 2;
    if (Math.abs(x - c) < 1.5 && Math.abs(y - c) < 17) return 0.95;
    for (let i = -2; i <= 2; i++) {
      if (Math.abs(y - (c + i * 7)) < 1.4 && Math.abs(x - c) < 5.5) return 0.95;
    }
    // The two pointed ends shade away, hinting the ball's curve.
    return -smoothstep(20, 32, Math.abs(y - c)) * 0.18;
  },

  /** Golf ball: staggered dimples, each a shaded pit — no ink at all. */
  dimples: (x, y) => {
    const cell = 8;
    const row = Math.floor(y / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;
    const cx = ((x + offset) % cell) - cell / 2;
    const cy = (y % cell) - cell / 2;
    const d = Math.hypot(cx, cy);
    // Dark on the lower right of each pit, a touch of ink light on the
    // upper left: a dimple is a hollow, and a hollow has two sides.
    if (d < 2.6) {
      const lit = (-cx - cy) / 3.6;
      return lit > 0 ? lit * 0.35 : lit * 0.5;
    }
    return 0;
  },

  /** Bowling ball: three finger holes and one long sweep of polish. */
  bowling: (x, y) => {
    for (const [hx, hy] of [[24, 22], [34, 18], [31, 30]] as const) {
      if (Math.hypot(x - hx, y - hy) < 3.4) return -0.9;
    }
    const d = (x * 0.62 + y * 0.78) / SIZE;
    return Math.exp(-Math.pow((d - 0.55) / 0.22, 2)) * 0.5 - 0.1;
  },

  /**
   * Chicken and waffles — the waffle half. A deep grid, pockets shading
   * toward their centres, and two golden-brown fried pieces sitting on
   * top, drawn as darker crusted blobs. David named this one himself.
   */
  waffle: (x, y) => {
    // The chicken: two lumpy patches, crusted at the edge. Checked before
    // the grid so the pieces sit ON the waffle.
    for (const [cx, cy, r] of [[20, 21, 9.5], [43, 42, 11]] as const) {
      const lump = fbm(x * 1 + cy, y + cx, [16, 8], [1, 0.6]) * 2.5;
      const d = Math.hypot(x - cx, y - cy) + lump;
      if (d < r) {
        // Crust: darkest at the rim, easing toward the middle.
        return -0.28 - smoothstep(r - 4, r, d) * 0.3;
      }
    }
    const cell = 16;
    const inX = (x % cell + cell) % cell;
    const inY = (y % cell + cell) % cell;
    const edge = Math.min(inX, cell - inX, inY, cell - inY);
    // The grid ridge carries the ink; pockets darken toward the middle.
    if (edge < 2) return 0.75;
    return -smoothstep(2, 8, edge) * 0.3;
  },

  /** Cookie: chocolate chips of varying size, and a crumbly surface. */
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
  strawberry: (x, y) => {
    const cell = 11;
    const row = Math.floor(y / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;
    const cx = ((x + offset) % cell) - cell / 2;
    const cy = (y % cell) - cell / 2;
    // The seed: a narrow ellipse, standing upright.
    if (Math.hypot(cx / 0.7, cy / 1.3) < 1.6) return 0.95;
    // Its hollow: the flesh dips around every seed.
    return -smoothstep(4.5, 1.8, Math.hypot(cx, cy)) * 0.2;
  },

  /** Honeycomb: a tight hexagonal comb, cells varying like real honey. */
  honeycomb: (x, y) => {
    const u = x / 9;
    const v = (x * 0.5 + y * 0.866) / 9;
    const w = (x * 0.5 - y * 0.866) / 9;
    const edge = (t: number) => Math.abs(t - Math.round(t));
    const nearest = Math.min(edge(u), edge(v), edge(w));
    const wall = smoothstep(0.13, 0.05, nearest);
    // Cell fill varies: some cells capped and pale, some open and dark.
    const cellTone = (wrappedNoise(x, y, 16) - 0.5) * 0.3;
    return wall * 0.85 + cellTone * (1 - wall);
  },

  /**
   * Chocolate bar: square tablets. Grooves shade DOWN, and each tablet
   * catches ink light along its top-left bevel — a bar is moulded, and
   * the bevel is what says so.
   */
  chocolate: (x, y) => {
    const cell = 16;
    const inX = (x % cell + cell) % cell;
    const inY = (y % cell + cell) % cell;
    const edge = Math.min(inX, cell - inX, inY, cell - inY);
    if (edge < 1.5) return -0.5;
    if (edge < 3.5 && (inX < 4 || inY < 4)) return 0.55;
    if (edge < 3.5) return -0.2;
    return 0;
  },

  /** Lemon slice: rind ring, pith, and radial segments. */
  citrus: (x, y) => {
    const c = SIZE / 2;
    const dx = x - c;
    const dy = y - c;
    const r = Math.hypot(dx, dy);
    // Rind and pith at the very edge of the face.
    if (r > 29) return 0.9;
    if (r > 26.5) return -0.05;
    // Segment walls: ten radial lines plus a small hub.
    const a = Math.atan2(dy, dx);
    if (r < 2.5) return 0.85;
    if (Math.abs(Math.sin(a * 5)) > 0.965 && r > 5) return 0.85;
    // Flesh: the faintest sparkle of juice sacs.
    return (hashCell(x, y) - 0.5) * 0.12;
  },

  /** Denim: twill — the fine broken diagonals of woven cloth. */
  denim: (x, y) => {
    const diag = tiling(x * 2 - y * 2, 16);
    const weave = smoothstep(0.3, 0.8, diag) * 0.45;
    // Slubs: single pale threads where the yarn ran thick.
    const slub = hashCell(x, Math.floor(y / 4)) > 0.985 ? 0.5 : 0;
    return weave + slub + (wrappedNoise(x, y, 8) - 0.5) * 0.1;
  },

  /**
   * Circuit board: traces that run, turn once, and end on a pad. Each
   * horizontal lane carries one trace, its turn placed by hash — laid
   * out like routing, not scattered like noise.
   */
  circuit: (x, y) => {
    const lane = Math.floor(y / 8);
    const inY = y - lane * 8;
    const h = hashCell(lane, 3);
    const turnAt = 8 + h * 40;
    const padAt = turnAt + 8 + hashCell(lane, 7) * 12;
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
  volleyball: (x, y) => {
    const c = SIZE / 2;
    // Which band of the sweeping curve family this pixel falls in.
    const d = Math.hypot(x + SIZE * 0.4, y - c);
    const band = Math.floor(d / 13) % 3;
    const seam = Math.abs((d % 13) - 13 / 2) > 5.4;
    if (seam) return rgb('#c9c4b8');
    if (band === 1) return rgb('#2a4a8a');
    if (band === 2) return rgb('#f0c020');
    return rgb('#f0ede6');
  },

  /** Rind, pith, flesh and seeds, in rings from one corner. */
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
    return mixRgb(rgb('#f08585'), rgb('#f7b8b8'), smoothstep(40, 56, d));
  },

  /** Cheese, crust at one corner, pepperoni, herbs. */
  pizza: (x, y) => {
    const d = Math.hypot(x - SIZE * 1.05, y - SIZE * 1.05);
    if (d > 60) return rgb('#b3802e');
    for (const [cx, cy, r] of [[16, 18, 7], [40, 34, 7.5], [20, 46, 6.5], [48, 10, 6]] as const) {
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

  /** Pink glaze over cake, drips along the edge, sprinkles on top. */
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
    if (frac > 0.8) return mixRgb(here, next, (frac - 0.8) / 0.2);
    return here;
  },

  /** Nebula clouds and stars on deep indigo. */
  galaxy: (x, y) => {
    let px: [number, number, number] = rgb('#1d1440');
    const cloudA = smoothstep(0.15, 0.65, fbm(x, y, [32, 16], [1, 0.5]) + 0.3);
    const cloudB = smoothstep(0.2, 0.7, fbm(x + 21, y + 9, [32, 16], [1, 0.5]) + 0.25);
    px = mixRgb(px, rgb('#8a3d8f'), cloudA * 0.6);
    px = mixRgb(px, rgb('#2a6e9e'), cloudB * 0.5);
    // Stars: mostly pinpricks, a few brighter.
    const h = hashCell(x, y);
    if (h > 0.992) return rgb('#ffffff');
    if (h > 0.985) return mixRgb(px, rgb('#ffffff'), 0.6);
    return px;
  },

  /**
   * Classic camouflage. Two INDEPENDENT noise fields, one per overlay
   * tone, each at period 16 — a single period-32 field has room for one
   * island on a 64px tile, and the first render was exactly that: one
   * dark blob on flat green.
   */
  camo: (x, y) => {
    const dark = wrappedNoise(x, y, 16) * 0.7 + wrappedNoise(x + 9, y + 21, 8) * 0.3;
    const pale = wrappedNoise(x + 31, y + 13, 16) * 0.7 + wrappedNoise(x + 3, y + 40, 8) * 0.3;
    if (dark > 0.62) return rgb('#2e3d26');
    if (pale > 0.66) return rgb('#8f9668');
    if (dark > 0.5) return rgb('#4a5c3d');
    return rgb('#6e7a52');
  },

  /** Tartan: navy and green bands over red, yellow pinstripes. */
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
};

/** Every colour-painter id, for the one runtime branch that needs it. */
const COLOR_IDS = new Set(Object.keys(COLOR_PAINTERS));

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
