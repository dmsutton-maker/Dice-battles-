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
  | 'brushed';

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
const PAINTERS: Record<Exclude<PatternId, 'plain'>, Painter> = {
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
   * Frost: thin needles crossing on a grid, the way ice grows on a window.
   *
   * Frost used to share the `stars` painter with Starry, so the two skins
   * were the same picture in two colours — indistinguishable in the
   * Inventory and on the table. This is deliberately a different SHAPE,
   * not a different tint.
   */
  frost: (x, y) => {
    const cell = 16;
    const cx = ((x % cell) - cell / 2) / (cell / 2);
    const cy = ((y % cell) - cell / 2) / (cell / 2);
    const r = Math.hypot(cx, cy);
    if (r > 1) return 0;

    // Three needles at 0deg, 60deg and 120deg through the centre.
    const ARMS = 3;
    const THICKNESS = 0.17;
    for (let i = 0; i < ARMS; i++) {
      const t = (Math.PI * i) / ARMS;
      // Perpendicular distance from the line through the centre.
      const across = Math.abs(-Math.sin(t) * cx + Math.cos(t) * cy);
      // Needles taper: wide at the middle, fine at the tips.
      if (across < THICKNESS * (1 - r * 0.65)) return 1;
    }
    // A small bright core where the needles meet.
    return r < 0.13 ? 1 : 0;
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
    // The ring coordinate wanders across the plank so the spacing varies.
    const drift = Math.sin(x / 21) * 5.5 + Math.sin(x / 7.3) * 1.4;
    const ring = Math.sin((y + drift) / 3.1);
    // Fine fibres running the length of the grain, under the rings. Half
    // what they were: at the old strength they chewed a ragged edge into
    // every ring, which is most of what made the wood look coarse.
    const fibre = Math.sin(y * 0.9 + Math.sin(x / 3.1) * 2.4) * 0.06;
    const v = ring + fibre;

    // One continuous ramp from pale early wood into the dark late-wood
    // line, instead of four stepped tones. Same rings, no staircase.
    const line = smoothstep(0.28, 0.98, v) * 0.88;
    // A shallow dip on the far side of each ring so the surface still has
    // some roll to it rather than going flat between the lines.
    const trough = smoothstep(-0.35, -1, v) * 0.1;
    return line - trough;
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
    // The band coordinate has to keep a clear DIRECTION or the veins close
    // into loops and the whole thing reads as a contour map — which is
    // exactly what the first attempt did. So the direction term dominates
    // and the warp only nudges it off straight.
    const warp = Math.sin(y / 9.5) * 2.4 + Math.sin(x / 15) * 1.7;
    // Tighter than it reads at full size on purpose: a die face is small,
    // and at 7.5 a face could come up carrying no vein at all.
    const vein = Math.abs(Math.sin((x * 0.9 + y * 0.4) / 5 + warp));

    // The vein and the halo it bleeds into the stone are ONE falloff now,
    // not a sharp line inside a second hard band. That pair of edges was
    // what made the veins look drawn on with a pen and a highlighter.
    const line = (1 - smoothstep(0.02, 0.3, vein)) * 0.8;
    // Broad cloudiness, continuous, so the stone between the veins drifts
    // gently instead of stepping between three flat tones.
    const cloud = Math.sin(x / 19 + Math.sin(y / 23) * 1.2) * 0.1;
    return line - cloud;
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
};

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
  const paint = PAINTERS[pattern];

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
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
