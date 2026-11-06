import * as THREE from 'three';
import type { ArenaStructure } from './themeData';

/**
 * The surface each battlefield is made of — the tray floor the dice roll
 * on, and the ground around it.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────
 *
 * David, 26 Aug 2026, looking at three of the new arenas on his phone:
 * "every new map, not just these, look either unfinished, off centered,
 * or only half done."
 *
 * He was right, and measuring the camera said why. The board is framed
 * almost straight down (see cameraFit.ts) and the visible world is a
 * narrow box: x from -3.9 to 3.9, z from -10.5 to 7.8. The tray itself
 * fills x ±2.8, z ±5.1 of that. So what a player actually SEES is the
 * tray, the jail behind it, the retreat in front, and about one world
 * unit of ground down each side.
 *
 * Everything the sixteen themed arenas had been dressing themselves with
 * — every prop at |x| 7 to 10, every hill at |x| 12, the mountains at
 * z -19, the clouds, the sun, the stars, the moon — was outside that box
 * and had never been on screen at all. And the one thing that WAS on
 * screen, the floor, was the same eight-by-eight stone grid in every
 * arena, because the renderer passed `floor.a` to the flagstone painter
 * and ignored `floor.b` entirely. A tray of grey grid in a wash of flat
 * colour is exactly what "unfinished" looks like.
 *
 * So the surface does the work now. It is the largest thing in frame by
 * a distance, there is one painter per battlefield, and no two share.
 */

const SIZE = 128;

/**
 * Painter units per world unit.
 *
 * The painters were written against a 128-unit square standing in for
 * 6.4 world units, and every feature size in them is tuned to that.
 * Changing this number resizes every feature on every floor at once.
 */
const UNITS_PER_WORLD = SIZE / 6.4;

/**
 * Texels per painter unit on the tray floor.
 *
 * The tray is the largest thing on screen at about 54 screen pixels to
 * the world unit. The painters are written at 20 units to the world
 * unit, so at a density of one each texel was covering nearly three
 * screen pixels and the floor looked soft — Marc, 28 Aug 2026: "the
 * floor is too blurry."
 *
 * Two is 40 texels to the world unit, so a texel is about 1.35 screen
 * pixels and the softness is mostly gone. It was one until now for a
 * reason that has since expired: at the time the heaviest floor took
 * 226ms to paint and anything above one pushed it past a quarter of a
 * second, which is a stall a player sees the first time an arena opens.
 * `noise` got 6.8x faster in v1.62.2, so the same floor is 37ms and four
 * times the pixels is 147ms — still comfortably inside the ceiling.
 *
 * Not three, which measures 339ms and blows it, and not two and a half,
 * which fits here at 227ms but leaves nothing for a slower phone and
 * holds 11.7MB of texture that is deliberately never freed. Two costs
 * 7.5MB across all sixteen.
 */
const TRAY_DENSITY = 2;

type Rgb = [number, number, number];

const rgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const mix = (a: Rgb, b: Rgb, t: number): Rgb => {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};

const shade = (c: Rgb, f: number): Rgb => [c[0] * f, c[1] * f, c[2] * f];

/**
 * A definitely-lighter version of a colour.
 *
 * Some effects only work in one direction — a caustic is light, a crack
 * is dark — and the accent a theme hands over is whatever suited its
 * scenery. Three surfaces came out as flat washes on the first pass
 * because their accent happened to sit within a few per cent of their
 * base: the glade's stepping stones were moss-green on moss, and the
 * reef's caustics were darker than the water they fell on.
 */
const lift = (c: Rgb, t: number): Rgb => mix(c, [255, 255, 255], t);

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1e-6)));
  return t * t * (3 - 2 * t);
}

/**
 * Deterministic hash. Math.random is deliberately NOT used here — the
 * flagstone painter this replaces did use it, so a floor was a different
 * floor on every launch and no test could ever pin one.
 */
function hash(ix: number, iy: number): number {
  const s = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Value noise that wraps at `period`, so the tile has no seam.
 *
 * Written flat, and it is worth saying why, because the obvious tidy
 * version is the slow one. This is the hottest function in the file by a
 * long way — a floor calls it millions of times — and as it stood it
 * allocated a `wrap` closure and an `h` closure on every single call,
 * then called `h` SIX times for four corners, so `h(x0, y0)` and
 * `h(x0, y0 + 1)` each hashed twice over. Twelve wraps and six hashes
 * for four distinct values.
 *
 * Now: four wraps, four hashes, no closures. Same four corners, same
 * arithmetic, same order of operations — every floor comes out
 * bit-identical, which a test checks by comparing all sixteen against
 * the pixels they had before.
 *
 * The tempting further step is to precompute the hashes into a table,
 * since `noise` only ever hashes lattice points. It does NOT work here:
 * `hash` is a fract-of-a-sine over its arguments, not a lookup, and the
 * painters pass FRACTIONAL periods (`SIZE / 3` is 42.667), so the
 * wrapped coordinates it hashes are a continuum rather than a grid. A
 * table quietly repaints five of the sixteen floors. It was tried.
 */
function noise(x: number, y: number, period: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const ax = ((x0 % period) + period) % period;
  const bx = (((x0 + 1) % period) + period) % period;
  const ay = ((y0 % period) + period) % period;
  const by = (((y0 + 1) % period) + period) % period;
  const p00 = hash(ax, ay);
  const p10 = hash(bx, ay);
  const p01 = hash(ax, by);
  const p11 = hash(bx, by);
  const top = p00 + (p10 - p00) * sx;
  const bot = p01 + (p11 - p01) * sx;
  return top + (bot - top) * sy;
}

const fbm = (x: number, y: number, p: number): number =>
  noise(x / 8, y / 8, p / 8) * 0.6 + noise(x / 4, y / 4, p / 4) * 0.4;

/** Distance to the nearest edge of a `cell`-sized grid square. */
const gridEdge = (x: number, y: number, cell: number): number => {
  const ix = ((x % cell) + cell) % cell;
  const iy = ((y % cell) + cell) % cell;
  return Math.min(ix, cell - ix, iy, cell - iy);
};

/*
  What a painter can say about a texel besides its colour.

  October 2026, the board redesign (docs/board-redesign.md): a floor has
  to read by its RELIEF as well as its pattern — sled tracks pressed into
  snow, ripples standing up out of sand, lava glowing in the seams of
  basalt. Colour alone cannot do the last of those at all under a night
  rig, and only does the first two from one angle.

  So a painter may also set a height (`h`, 0 to 1, becomes a bump map the
  real lights rake across) and a glow (`g` with its colour, becomes an
  emissive map that shines whatever the lighting). Both are filled in the
  SAME pass as the colour, because a second pass would double the cost of
  the most expensive thing an arena does when it opens.

  Module-level and mutated rather than returned, on purpose: the painter
  is called a hundred thousand times per floor, and an object per call is
  a hundred thousand objects for the collector.
*/
const SIDE = { h: 0.5, g: 0, gr: 0, gg: 0, gb: 0 };

/** A glow of strength `g` in colour `c`, for this texel. */
function glowAt(g: number, c: Rgb): void {
  if (g <= SIDE.g) return;
  SIDE.g = g;
  SIDE.gr = c[0];
  SIDE.gg = c[1];
  SIDE.gb = c[2];
}

/**
 * The key light, as the painters see it.
 *
 * The rig's key sits at (4, 12, 6): off to +x, and toward the player in
 * +z. Row 0 of a painted picture is the NEAR end of the tray (the plane is
 * laid with v running away from the camera), so in painter space the
 * light arrives from +x and from -y. Baked shading that disagreed with the
 * bump map's real lighting would make every bump read as a dent.
 */
const LX = 0.55;
const LY = -0.835;

/*
  A jittered Voronoi — the cut slabs of the cavern, the fractures in the
  frozen lake — with the nine sites around the current cell remembered
  between calls.

  A picture is painted a row at a time, so consecutive texels nearly
  always share a cell, and recomputing eighteen hashes for the same nine
  sites at every texel was most of the cost of those two floors: the
  cracked ice took 282ms to paint, over the 260ms ceiling a player would
  see as a stall. The answer is identical either way — same sites, same
  order, same ties — only the hashing is skipped. `tag` names the caller,
  so two painters can never be handed each other's sites.
*/
const VORO = {
  gx: Number.NaN,
  gy: Number.NaN,
  tag: -1,
  sx: new Float64Array(9),
  sy: new Float64Array(9),
  d1: 0,
  d2: 0,
  cx: 0,
  cy: 0,
  cq: 0,
  cr: 0,
};

function voronoi(
  x: number,
  y: number,
  cell: number,
  lo: number,
  span: number,
  tag: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): void {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  if (gx !== VORO.gx || gy !== VORO.gy || tag !== VORO.tag) {
    let k = 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++, k++) {
        const q = gx + ox;
        const r = gy + oy;
        VORO.sx[k] = (q + lo + hash(q + ax, r + ay) * span) * cell;
        VORO.sy[k] = (r + lo + hash(q + bx, r + by) * span) * cell;
      }
    }
    VORO.gx = gx;
    VORO.gy = gy;
    VORO.tag = tag;
  }
  let d1 = 1e9;
  let d2 = 1e9;
  let best = 0;
  for (let k = 0; k < 9; k++) {
    const dx = x - VORO.sx[k];
    const dy = y - VORO.sy[k];
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < d1) {
      d2 = d1;
      d1 = d;
      best = k;
    } else if (d < d2) {
      d2 = d;
    }
  }
  VORO.d1 = d1;
  VORO.d2 = d2;
  VORO.cx = VORO.sx[best];
  VORO.cy = VORO.sy[best];
  VORO.cq = gx + (best % 3) - 1;
  VORO.cr = gy + Math.floor(best / 3) - 1;
}

/** The three colours a surface painter is given. */
export interface SurfacePaint {
  /** The main tone. */
  a: string;
  /** The second tone — always used; the old floor threw this away. */
  b: string;
  /** A small amount of something else: moss, rust, embers, straw. */
  accent: string;
}

/**
 * `tray` says which surface is being painted: the board the dice roll on,
 * or the ground around it.
 *
 * Most painters ignore it — the same rock makes both. The Crystal Cavern
 * does not: its floor is now a bed of cut facets (Marc picked it off the
 * design canvas), and painting the ground the same way turned the entire
 * screen into crystal with no board to be seen in the middle of it.
 * Scenery has to stay quieter than the thing it surrounds.
 */
type SurfacePainter = (
  x: number,
  y: number,
  p: { a: Rgb; b: Rgb; accent: Rgb },
  tray: boolean,
) => Rgb;

/**
 * The tray picture in painter units, and the band of it under the walls.
 *
 * The floor plane runs under the walls (floorW is innerWidth plus two
 * wall thicknesses), so the PLAYABLE board is the picture less RIM all
 * round. A painter that wants its pattern to line up with the tray's
 * own edges — chocolate segments, deck planks, ploughed rows — lays it
 * over that inner rectangle. The same hard-coding the snow pond and the
 * reef already used.
 */
const TRAY_W = 112;
const TRAY_H = 204;
const RIM = 10;

/**
 * Which way the key light falls across a painted floor.
 *
 * The scene's key light sits at +x and toward the player (+z), and
 * painter y runs AWAY from the player, so in painter units the light
 * comes from +x and -y. A painted bevel or ridge lit on that side
 * agrees with the real shadows the dice cast, instead of fighting them.
 */
const LIGHT_X = 0.7071;
const LIGHT_Y = -0.7071;

/** Signed distance to a rounded rectangle, half-size hx by hy. */
function roundRect(px: number, py: number, hx: number, hy: number, r: number): number {
  const qx = Math.abs(px) - (hx - r);
  const qy = Math.abs(py) - (hy - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Candy Meadow's ground: pink frosting with sprinkles scattered on it. */
function frosting(x: number, y: number, p: { a: Rgb; b: Rgb; accent: Rgb }): Rgb {
  let c = mix(p.a, p.b, smoothstep(0.25, 0.8, fbm(x * 0.7, y * 0.7, SIZE)));
  // Soft piped swirls in the icing, lit on one side.
  const swirl = Math.sin(fbm(x * 1.3 + 20, y * 1.3, SIZE) * 14);
  c = swirl > 0 ? mix(c, lift(c, 0.2), swirl * 0.25) : mix(c, shade(c, 0.93), -swirl * 0.25);
  const SPRINKLE: Rgb[] = [
    [255, 250, 245], [140, 224, 192], [255, 226, 120],
    [190, 160, 240], [255, 150, 140], [130, 196, 240],
  ];
  // An 8-unit lattice divides the 128-unit tile, so the sprinkles wrap.
  const cell = 8;
  const col = Math.floor(x / cell);
  const row = Math.floor(y / cell);
  const h = hash(col * 3 + 1, row * 5 + 2);
  if (h > 0.6) {
    const lx = x - col * cell - cell / 2 - (hash(col + 4, row) - 0.5) * 3;
    const ly = y - row * cell - cell / 2 - (hash(col, row + 4) - 0.5) * 3;
    const a = hash(col + 7, row + 3) * Math.PI;
    const u = lx * Math.cos(a) + ly * Math.sin(a);
    const v = -lx * Math.sin(a) + ly * Math.cos(a);
    if (Math.abs(v) < 0.6 && Math.abs(u) < 1.8) {
      const s = SPRINKLE[Math.floor(hash(col + 1, row + 9) * 6) % 6];
      c = v * LIGHT_Y < 0 ? lift(s, 0.15) : shade(s, 0.88);
    }
  }
  return c;
}

/** Sunny Farm's ground: a mown meadow with daisies and buttercups. */
function meadow(x: number, y: number, p: { a: Rgb; b: Rgb; accent: Rgb }): Rgb {
  let c = mix(p.a, p.b, smoothstep(0.3, 0.75, fbm(x * 0.6, y * 0.6, SIZE)));
  // Mower stripes, 32 units wide so four fit the tile exactly.
  const stripe = Math.sin((x * Math.PI * 2) / 32);
  c = mix(c, lift(c, 0.08), smoothstep(-0.2, 0.4, stripe) * 0.6);
  // Blades: noise at 1.5x, wrapping at 1.5x the tile.
  const blade = noise(x * 1.5, y * 1.5, SIZE * 1.5);
  c = mix(c, shade(c, 0.86), smoothstep(0.55, 0.9, blade) * 0.45);
  const cell = 16;
  const col = Math.floor(x / cell);
  const row = Math.floor(y / cell);
  const h = hash(col + 21, row + 3);
  if (h > 0.62) {
    const lx = x - col * cell - cell / 2 - (hash(col + 2, row + 5) - 0.5) * 9;
    const ly = y - row * cell - cell / 2 - (hash(col + 5, row + 2) - 0.5) * 9;
    const d = Math.hypot(lx, ly);
    if (h > 0.85) {
      if (d < 0.6) c = [242, 196, 64];
      else if (d < 1.7 && Math.cos(Math.atan2(ly, lx) * 8) > -0.3) c = [250, 248, 240];
    } else if (d < 1.0) {
      c = lx - ly > 0.3 ? [252, 222, 96] : [232, 192, 56];
    }
  }
  return c;
}

/** Pirate Cove's quay: weathered boards running across, gaps between. */
function quay(x: number, y: number, p: { a: Rgb; b: Rgb; accent: Rgb }): Rgb {
  const W = 16;
  const row = Math.floor(y / W);
  const inY = y - row * W;
  const along = x + hash(row, 3) * 64;
  const seg = Math.floor(along / 64);
  const inX = along - seg * 64;
  const grey: Rgb = [150, 144, 134];
  // `seg & 1`: the tile is two board lengths long, so a board that runs
  // off one edge carries on at the other in the same tone.
  let c = mix(mix(p.a, p.b, hash(row + 5, (seg & 1) + 1)), grey, 0.5);
  const grain = noise(x / 8, y / 2, 16);
  c = mix(c, shade(c, 0.84), smoothstep(0.5, 0.85, grain) * 0.6);
  if (inY > W - 2) c = lift(c, 0.08);
  else if (inY < 2) c = shade(c, 0.9);
  if (inY < 1.1 || inX < 0.8) return mix(c, [38, 32, 28], 0.85);
  for (const nx of [3, 61]) {
    for (const ny of [4, 12]) {
      if (Math.hypot(inX - nx, inY - ny) < 0.8) c = [70, 64, 60];
    }
  }
  return c;
}

/**
 * Rooftop City's ground: the city at night, far below the roof.
 *
 * Blocks of 32 units — four to the tile, so it wraps — with streets
 * between them, street lamps and the odd car's lights in the streets,
 * and in each block a few roofs, a park now and then, and lit skylights.
 * All of it small, because it is a long way down; the scale is what
 * puts the roof up in the air.
 */
function cityBelow(x: number, y: number, p: { a: Rgb; b: Rgb; accent: Rgb }): Rgb {
  const BLK = 32;
  const ST = 5;
  const bx = Math.floor(x / BLK);
  const by = Math.floor(y / BLK);
  const ix = x - bx * BLK;
  const iy = y - by * BLK;
  if (ix < ST || iy < ST) {
    let c: Rgb = [30, 33, 50];
    // Street lamps along both kerbs, every eight units, and their pools.
    const along = ix < ST ? iy : ix;
    const across = ix < ST ? ix : iy;
    const lamp = Math.hypot(((along % 8) + 8) % 8 - 4, Math.min(across, ST - across) - 0.4);
    c = mix(c, [255, 190, 100], smoothstep(3.2, 0.2, lamp) * 0.62);
    if (lamp < 0.5) c = [255, 230, 170];
    /*
      Traffic, 19 Oct 2026: streaks rather than dots. Headlights run one
      way down the middle of the street and tail lights the other, each a
      short trail, which from this height is what moving traffic looks
      like and what says the city below is awake.
    */
    const lane = Math.floor(along / 6);
    const ch = hash(lane + bx * 7, by * 5 + (ix < ST ? 1 : 2));
    const inLane = ((along % 6) + 6) % 6;
    if (ch > 0.62 && inLane > 0.6 && inLane < 4.6 && Math.abs(across - (ch > 0.81 ? 1.7 : 3.3)) < 0.75) {
      const fade = ch > 0.81 ? smoothstep(0.6, 2.4, inLane) : smoothstep(4.6, 2.8, inLane);
      c = mix(c, ch > 0.81 ? [255, 118, 104] : [252, 246, 222], 0.35 + fade * 0.65);
    }
    return c;
  }
  // Inside the block: four lots, an alley between them.
  const lx = ix - ST;
  const ly = iy - ST;
  const span = BLK - ST;
  const qx = lx < span / 2 ? 0 : 1;
  const qy = ly < span / 2 ? 0 : 1;
  const ux = lx - qx * (span / 2);
  const uy = ly - qy * (span / 2);
  const lot = hash(bx * 4 + qx + 3, by * 4 + qy + 7);
  if (ux < 0.8 || uy < 0.8) return [30, 32, 44];
  const half = span / 2;
  if (lot < 0.16) {
    // A park: dark grass and round tree tops.
    let c: Rgb = [40, 66, 56];
    const tr = Math.hypot(((ux % 4) + 4) % 4 - 2, ((uy % 4) + 4) % 4 - 2);
    if (tr < 1.4 && hash(Math.floor(ux / 4) + bx, Math.floor(uy / 4) + by) > 0.4) c = [58, 92, 70];
    return c;
  }
  let c = shade(mix(p.a, p.b, lot), 0.42 + lot * 0.32);
  // The roof's own parapet, lit on the light side.
  const re = Math.min(ux - 0.8, half - ux, uy - 0.8, half - uy);
  if (re < 0.9) c = ux > half - 0.9 || uy < 1.7 ? lift(c, 0.2) : shade(c, 0.7);
  // A lit skylight, or a dark plant box, on some roofs — and on most, a
  // second: a stair-head hut with its light on, or a tank's dark disc.
  const fx = hash(bx * 9 + qx, by * 9 + qy);
  if (Math.abs(ux - half * (0.3 + fx * 0.4)) < 1.4 && Math.abs(uy - half * (0.6 - fx * 0.3)) < 1.0) {
    c = fx > 0.5 ? [255, 214, 140] : shade(c, 0.6);
  }
  const gx = hash(bx * 3 + qx + 11, by * 3 + qy + 5);
  if (gx > 0.3 && Math.hypot(ux - half * (0.72 - gx * 0.3), uy - half * (0.3 + gx * 0.35)) < 1.1) {
    c = gx > 0.65 ? [232, 196, 130] : shade(c, 0.5);
  }
  return c;
}

/** Toy Room's ground: honey floorboards running up the room. */
function floorboards(x: number, y: number, p: { a: Rgb; b: Rgb; accent: Rgb }): Rgb {
  const W = 16;
  const col = Math.floor(x / W);
  const inX = x - col * W;
  const along = y + hash(col, 11) * 64;
  const seg = Math.floor(along / 64);
  const inY = along - seg * 64;
  let c = mix(p.a, p.b, 0.15 + hash(col + 3, (seg & 1) + 5) * 0.7);
  // Grain along the board; both scales divide the tile so it wraps.
  const grain = noise(x / 2, y / 8, 16);
  c = mix(c, shade(c, 0.86), smoothstep(0.5, 0.88, grain) * 0.55);
  c = mix(c, lift(c, 0.1), smoothstep(0.35, 0.1, grain) * 0.4);
  if (inX > W - 1.8) c = lift(c, 0.06);
  if (inX < 0.8 || inY < 0.8) return shade(c, 0.6);
  return c;
}

/**
 * Glow Glade's ground outside the wall: dusk moss, stepping stones in
 * their own contact shadows, and spores glowing in two colours. Moved
 * out of the painter unchanged when the TRAY became dark moss (18 Oct
 * 2026); the surround was already right, so its pixels are untouched.
 */
function gladeGround(x: number, y: number, p: { a: Rgb; b: Rgb; accent: Rgb }): Rgb {
  const blob = fbm(x * 0.55, y * 0.55, SIZE);
  let c = mix(p.a, p.b, smoothstep(0.28, 0.72, blob));
  // Damp hollows, cooled toward the dusk sky rather than just darker.
  c = mix(c, [16, 46, 50], smoothstep(0.35, 0.05, blob) * 0.65);
  c = mix(c, lift(p.b, 0.35), smoothstep(0.7, 0.95, blob) * 0.55);
  // A second, finer patchwork so the green is not one flat field.
  c = mix(c, p.accent, smoothstep(0.55, 0.85, fbm(x * 1.6 + 31, y * 1.6, SIZE)) * 0.35);
  // The fibre of the moss itself, at the scale of a leaf.
  // Displaced by `blob`, which is already in hand, rather than by a
  // second fbm — that was eight more hash lookups on every texel of
  // the floor for a wobble nobody can see.
  const fibre = noise(x * 1.1, y * 1.1 + blob * 3, SIZE);
  c = mix(c, shade(c, 0.84), smoothstep(0.45, 0.85, fibre) * 0.5);
  c = mix(c, lift(c, 0.15), smoothstep(0.4, 0.08, fibre) * 0.35);

  const cell = 32;
  const col = Math.floor(x / cell);
  const row = Math.floor(y / cell);
  const jx = (hash(col, row) - 0.5) * 11;
  const jy = (hash(col + 5, row + 9) - 0.5) * 11;
  const radius = hash(col + 8, row + 6) > 0.52 ? 4 + hash(col + 2, row + 3) * 3 : -99;
  const sx = (((x % cell) + cell) % cell) - cell / 2 - jx;
  const sy = (((y % cell) + cell) % cell) - cell / 2 - jy;
  /*
    Lumpy, not round. The wobble is noise on the RADIUS rather than on
    the position, so a stone keeps one outline instead of being blurred
    into the moss the way adding noise to the distance did.
  */
  const wobble = (noise(sx * 0.55 + col * 7, sy * 0.55 + row * 7, SIZE) - 0.5) * 1.5;
  const stone = Math.hypot(sx, sy) - wobble;
  /*
    Mid grey, and deliberately no lighter: the key light doubles what
    it lands on at the near end of the ground, and the first grey
    tried here — [156, 158, 148] — came back off the renderer as a
    white cloud, which is the exact "pale blob" the stones were moved
    outside the wall to stop being.
  */
  const rock: Rgb = [112, 115, 104];
  /*
    The contact shadow first: a dark ellipse pushed down and right of
    the stone, so a crescent of it stays visible past the lit body and
    the stone sits ON the moss instead of floating over it. The first
    version's shadow was concentric and half this strength, and the
    render showed exactly none of it.
  */
  const shadowD = Math.hypot(sx - 1.6, (sy - 2.6) * 0.82) - wobble;
  c = mix(c, [12, 30, 28], smoothstep(radius + 4.2, radius - 0.8, shadowD) * 0.6);
  const body = mix(rock, p.accent, 0.22);
  c = mix(c, body, smoothstep(radius + 0.9, radius - 0.4, stone) * 0.96);
  // Lit from the upper left, with grey mottle in the rock.
  const lit = -(sx + sy) / Math.max(1, radius);
  const on = smoothstep(radius + 0.4, radius - 1, stone);
  c = mix(c, lift(rock, 0.35), on * Math.max(0, lit) * 0.6);
  c = mix(c, shade(rock, 0.68), on * Math.max(0, -lit) * 0.55);
  c = mix(c, shade(rock, 0.78), on * smoothstep(0.5, 0.85, noise(x * 1.7, y * 1.7, SIZE)) * 0.65);

  /*
    The glow. Spores in two colours — cyan and yellow-green, the same
    pair the toadstool props wear — and two sizes, each drawn as three
    alpha steps of halo around a hot centre, so every one reads as a
    LIGHT rather than as a lit pixel.
  */
  const SPORE: Rgb[] = [
    [126, 240, 224],
    [214, 244, 130],
  ];
  for (let k = 0; k < 2; k++) {
    // Both lattices divide SIZE, so the tile keeps its seamless wrap.
    const gcell = k === 0 ? 32 : 16;
    const oz = k * 7 + 5;
    const gc = Math.floor((x + oz) / gcell);
    const gr = Math.floor((y + oz) / gcell);
    const h = hash(gc + k * 31, gr + k * 17);
    if (h < (k === 0 ? 0.5 : 0.6)) continue;
    const gx = (((x + oz) % gcell) + gcell) % gcell - gcell / 2
      - (hash(gc + 2, gr + 4) - 0.5) * gcell * 0.36;
    const gy = (((y + oz) % gcell) + gcell) % gcell - gcell / 2
      - (hash(gc + 6, gr + 8) - 0.5) * gcell * 0.36;
    const d = Math.hypot(gx, gy);
    const glow = SPORE[Math.floor(h * 100) % 2];
    const core = k === 0 ? 1.7 : 1;
    c = mix(c, glow, smoothstep(core * 4.6, core * 1.7, d) * 0.16);
    c = mix(c, glow, smoothstep(core * 2.6, core * 0.9, d) * 0.4);
    c = mix(c, glow, smoothstep(core * 1.4, core * 0.4, d) * 0.8);
    c = mix(c, lift(glow, 0.55), smoothstep(core * 0.7, 0.1, d) * 0.95);
  }
  return c;
}

/**
 * Coral Reef's ground outside the wall: a living reef of coral heads on
 * rippled sand under a caustic web. This was the whole coral painter
 * until 18 Oct 2026, when the tray became open sea-floor sand and the
 * coral moved up onto the walls; it is kept exactly, with `tray` pinned
 * false, so the surround is the reef it always was.
 */
function reefGround(x: number, y: number, p: { a: Rgb; b: Rgb; accent: Rgb }): Rgb {
  const tray = false;
  const wob = fbm(x, y, SIZE);
  // Rippled sand, unmistakably PALER than the water tones — the first
  // pass painted "sand" as a second teal and the heads floated on it.
  const sand: Rgb = [216, 202, 168];
  const rip = Math.sin(y * 0.85 + x * 0.15 + wob * 5) * 0.5 + 0.5;
  // The board is SAND with water over it, not water with a hint of
  // sand. At 0.34 the tray still came out teal and six dice landed on
  // a surface the same value as themselves.
  let c = mix(mix(p.a, p.b, 0.5), sand, (tray ? 0.55 : 0.2) + rip * 0.3);
  c = mix(c, shade(p.b, 0.9), smoothstep(0.5, 0.06, rip) * 0.4);
  /*
    How likely a lattice cell is to skip its head. On the ground it is
    the old flat 0.38; on the tray it climbs toward ~0.93 away from the
    walls, so the middle of the board is open sand. 112 x 204 is the
    tray picture in painter units — floorW 5.6 by floorD 10.2 world at
    UNITS_PER_WORLD — the same hardcoding the snow pond uses.
  */
  // Both surfaces were re-tuned after the 6 Sep 2026 art pass called
  // this the worst arena of the sixteen — and it is the one that costs
  // 2400 coins. On the TRAY the base skip went 0.38 -> 0.66 and the
  // ramp starts almost at the wall, so heads are a thin fringe on the
  // rim and everything else is open sand: six dice used to land in
  // coral the same size and colour as themselves. On the GROUND the
  // skip went 0.38 -> 0.72, because at 0.38 through four lattices the
  // surround was a solid carpet of blobs that read as mould.
  const skip = tray
    ? 0.72 + smoothstep(4, 40, Math.min(x, 112 - x, y, 204 - y)) * 0.28
    : 0.8;
  // Coral heads, each its own colour. The 32-cell lattice (double the
  // rest, and the one size that wraps at 128 exactly) only grows in
  // the open ground outside the tray.
  const REEF: Rgb[] = [
    [232, 122, 92], [232, 108, 158], [240, 186, 92],
    [150, 214, 168], [186, 132, 216], [244, 158, 120],
  ];
  const lump = (wob - 0.5) * 3.2;
  // Two lattices outside instead of four, and only the two largest
  // head sizes inside the walls.
  for (let k = tray ? 2 : 0; k < (tray ? 4 : 2); k++) {
    const cell = k === 0 ? 32 : 25 - k * 4;
    const ox = k * 9;
    const row = Math.floor((y + ox) / cell);
    const col = Math.floor((x + ox * 2) / cell);
    const h = hash(col + k * 23, row + k * 11);
    if (h < skip) continue;
    const cx = (((x + ox * 2) % cell) + cell) % cell - cell / 2 + (h - 0.5) * 5;
    const cy = (((y + ox) % cell) + cell) % cell - cell / 2 + (hash(col + 3, row) - 0.5) * 5;
    const rad = (cell * 0.3) * (0.6 + h * 0.7);
    const d = Math.hypot(cx, cy) + lump;
    if (d > rad + 4.5) continue;
    if (d > rad) {
      // Contact shadow under the lower-right of the head, so it sits
      // ON the sand instead of hovering over it.
      const lr = (cx + cy) / (d || 1);
      if (lr > 0.1) c = mix(c, shade(c, 0.5), smoothstep(rad + 4.5, rad, d) * lr * 0.6);
      continue;
    }
    // The colour is its OWN hash — the first pass derived it from `h`,
    // the same number the skip threshold cuts, so every head that
    // survived a high threshold was the same salmon, and the first two
    // palette entries were never drawn at all.
    const head = REEF[Math.floor(hash(col + 19, row + k * 7) * REEF.length * 0.999)];
    // 0.55, not 0.9: coral seen THROUGH water, rather than stickers
    // laid on top of it. At full strength the surround read as static.
    c = mix(c, head, 0.55);
    // Interior structure, keyed on the head's own lattice hash: half
    // are brain corals with concentric ridges, half are knobbly
    // polyp mounds.
    if (hash(col * 7 + k, row * 5 + 1) > 0.5) {
      const ridge = Math.sin(d * 2.4 + h * 6);
      c = mix(c, shade(head, 0.68), smoothstep(0.1, 0.9, ridge) * 0.5);
      c = mix(c, lift(head, 0.3), smoothstep(-0.1, -0.9, ridge) * 0.4);
    } else {
      const pol = noise(x / 1.6 + k * 13, y / 1.6 + k * 7, SIZE / 1.6);
      c = mix(c, lift(head, 0.42), smoothstep(0.58, 0.85, pol) * 0.6);
      c = mix(c, shade(head, 0.7), smoothstep(0.42, 0.16, pol) * 0.5);
    }
    // Lit on the upper left, shaded to the lower right.
    c = mix(c, lift(head, 0.45), Math.max(0, -(cx + cy) / rad) * 0.4);
    c = mix(c, shade(head, 0.72), Math.max(0, (cx + cy) / rad) * 0.4);
  }
  /*
    The caustic web, applied over sand and coral alike. Thin connected
    filaments — the ridges where a noise field crosses its middle —
    pushed toward near-white, instead of the old broad 0.55-strength
    lift of the same teal, which was invisible under the heads (the
    trap named at `lift`). Strongest on the tray, where the open sand
    gives it somewhere to be seen.
  */
  const web =
    1 - Math.abs(noise(x / 9 + 31, y / 9 + 57, SIZE / 9) +
      (noise(x / 4.5 + 71, y / 4.5 + 13, SIZE / 4.5) - 0.5) * 0.35 - 0.5) * 2;
  // A few thin glints, not white spaghetti: the ramp narrowed and the
  // tray strength came down from 0.7 to 0.22. The web used to be laid
  // over the whole board at full strength, on top of the coral.
  return mix(c, lift(p.b, 0.85), smoothstep(0.9, 0.99, web) * (tray ? 0.22 : 0.5));
}

/**
 * One painter per battlefield, keyed by what the place is built of.
 *
 * Keyed on the structure rather than on the arena id because the two are
 * already one to one (themeData.ts) and because it keeps the pairing
 * honest: a basalt-walled arena stands on cooled lava, a ship's hull
 * stands on deck planks.
 */
/**
 * Dino Valley's floor: packed red earth with two trackways of
 * three-toed dinosaur footprints pressed into it, a big one walking up
 * the board and a little one crossing it. Each print is a heel pad and
 * three toes, sunk: the wall that faces the key light lit, the far one
 * in shade. Outside the tray, a jungle floor of leaves.
 */
function dinoPrint(lx: number, ly: number, size: number): number {
  // Toes point +y (away from the player). Returns depth 0..1.
  const heel = Math.hypot(lx / (size * 0.75), (ly + size * 0.15) / (size * 0.65));
  let d = heel < 1 ? 1 - heel : 0;
  for (const a of [-0.5, 0, 0.5]) {
    const u = lx * Math.cos(a) - ly * Math.sin(a);
    const v = lx * Math.sin(a) + ly * Math.cos(a);
    const toe = Math.hypot(u / (size * 0.28), (v - size * 1.15) / (size * 0.85));
    if (toe < 1) d = Math.max(d, 1 - toe);
  }
  return d;
}

function dinoEarth(x: number, y: number, p: { a: Rgb; b: Rgb; accent: Rgb }, tray: boolean): Rgb {
  if (!tray) {
    let c = mix(p.a, p.b, smoothstep(0.3, 0.75, fbm(x * 0.6, y * 0.6, SIZE)));
    const cell = 10;
    const col = Math.floor(x / cell);
    const row = Math.floor(y / cell);
    const h = hash(col + 13, row + 29);
    if (h > 0.45) {
      const lx = x - col * cell - cell / 2;
      const ly = y - row * cell - cell / 2;
      const a = h * Math.PI * 2;
      const u = lx * Math.cos(a) + ly * Math.sin(a);
      const v = -lx * Math.sin(a) + ly * Math.cos(a);
      if (Math.abs(v) < 1.6 - Math.abs(u) * 0.35 && Math.abs(u) < 4.2) {
        c = mix(c, h > 0.8 ? [62, 104, 40] : [96, 140, 58], 0.7);
      }
    }
    return c;
  }
  let c = mix(p.a, p.b, smoothstep(0.3, 0.8, fbm(x * 0.5, y * 0.5, SIZE)));
  const crumb = noise(x * 0.9, y * 0.9, SIZE);
  c = mix(c, shade(c, 0.9), smoothstep(0.6, 0.85, crumb) * 0.5);
  // Dried cracks.
  const crack = Math.abs(fbm(x * 0.8 + 31, y * 0.8 + 7, SIZE) - 0.5);
  c = mix(c, shade(c, 0.78), smoothstep(0.018, 0.004, crack) * 0.6);
  // The big trackway: steps up the middle, left, right, left.
  let depth = 0;
  let lit = 0;
  const STEP = 30;
  const k = Math.round((y - 22) / STEP);
  for (let j = k - 1; j <= k + 1; j++) {
    const py = 22 + j * STEP;
    if (py < RIM + 6 || py > TRAY_H - RIM - 6) continue;
    const px = TRAY_W / 2 + (j % 2 === 0 ? -9 : 9) + Math.sin(j * 1.7) * 2;
    const d = dinoPrint(x - px, y - py, 6.5);
    if (d > depth) {
      depth = d;
      lit = (x - px) * LIGHT_X + (y - py) * LIGHT_Y;
    }
  }
  // The little one, crossing on a diagonal near the far end.
  for (let j = 0; j < 6; j++) {
    const px = RIM + 14 + j * 14;
    const py = TRAY_H - RIM - 40 + j * 4 + (j % 2 === 0 ? -3 : 3);
    const lx = x - px;
    const ly = y - py;
    // Rotate so its toes point along +x.
    const d = dinoPrint(-ly, lx, 3);
    if (d > depth) {
      depth = d;
      lit = lx * LIGHT_X + ly * LIGHT_Y;
    }
  }
  if (depth > 0) {
    const sunk = shade(c, 0.72);
    c = mix(c, sunk, smoothstep(0, 0.35, depth));
    // The rim: lit on the side away from the light, which is the wall facing it.
    c = mix(c, lift(c, 0.18), smoothstep(0.25, 0, depth) * smoothstep(0, -3, lit) * 0.8);
  }
  return c;
}

/**
 * The Sun Temple's floor (season 2 of the pass, 21 Oct 2026):
 * flagstones of cut sandstone with a great sun carved into the middle
 * of the board — a disc, a ring round it and twelve rays — cut into the
 * stone so the key light rakes it. Outside the tray, dry ground: sand
 * and scorched grass, pebbles, and marigold petals blown off the altar.
 */
function templeStone(x: number, y: number, p: { a: Rgb; b: Rgb; accent: Rgb }, tray: boolean): Rgb {
  if (!tray) {
    const blob = fbm(x * 0.7, y * 0.7, SIZE);
    let c = mix(p.a, p.b, smoothstep(0.3, 0.75, blob));
    // Scorched grass in patches, blades at the scale of a finger.
    const grass = noise(x * 1.3, y * 1.3 + blob * 2, SIZE);
    c = mix(c, shade(mix(p.b, p.accent, 0.3), 0.95), smoothstep(0.5, 0.85, grass) * 0.4);
    c = mix(c, lift(p.a, 0.2), smoothstep(0.4, 0.1, grass) * 0.25);
    SIDE.h = 0.5 + (blob - 0.5) * 0.25;
    // Pebbles and petals on a jittered lattice, lit on the side toward
    // the light and in shade on the other.
    const cell = 12;
    const col = Math.floor(x / cell);
    const row = Math.floor(y / cell);
    const h = hash(col + 7, row + 3);
    if (h > 0.55) {
      const lx = x - col * cell - cell / 2 - (hash(col, row + 1) - 0.5) * 5;
      const ly = y - row * cell - cell / 2 - (hash(col + 4, row) - 0.5) * 5;
      const petal = h > 0.86;
      const r = petal ? 1.6 : 1.3 + h * 1.5;
      const d = Math.hypot(lx * (petal ? 1.4 : 1), ly);
      if (d < r) {
        const body: Rgb = petal ? (h > 0.93 ? [240, 178, 64] : [224, 122, 42]) : mix(p.accent, [255, 255, 255], 0.35);
        const on = smoothstep(r, r - 0.6, d);
        c = mix(c, body, on * 0.9);
        const lit = (lx * LIGHT_X + ly * LIGHT_Y) / r;
        c = mix(c, lift(body, 0.3), on * Math.max(0, -lit) * 0.5);
        c = mix(c, shade(body, 0.7), on * Math.max(0, lit) * 0.4);
        if (!petal) SIDE.h = 0.5 + smoothstep(r, r - 0.8, d) * 0.3;
      }
    }
    return c;
  }
  // Flagstones of cut sandstone, each its own tone, grooves between.
  const cell = 28;
  const col = Math.floor(x / cell);
  const row = Math.floor(y / cell);
  const tone = hash(col + 3, row + 11);
  let c = mix(p.a, p.b, 0.2 + tone * 0.55);
  c = mix(c, lift(p.a, 0.2), smoothstep(0.55, 0.85, fbm(x * 0.9 + col * 3, y * 0.9 + row * 5, SIZE)) * 0.4);
  const e = gridEdge(x, y, cell);
  const groove = smoothstep(1.7, 0.4, e);
  c = mix(c, shade(p.b, 0.7), groove * 0.7);
  let h = 0.55 - groove * 0.3;
  // The sun carved into the middle of the board.
  const dx = x - TRAY_W / 2;
  const dy = y - TRAY_H / 2;
  const r = Math.hypot(dx, dy);
  if (r < 40) {
    const ang = Math.atan2(dy, dx);
    // Where this point is within its twelfth of the circle: 0 at the
    // middle of a ray, 1 halfway to the next.
    const slice = Math.abs(((((ang * 12) / (Math.PI * 2)) % 1) + 1) % 1 - 0.5) * 2;
    // A ray narrows from the ring out to its tip.
    const width = 0.55 * (1 - smoothstep(18, 36, r));
    const ray = smoothstep(width + 0.08, width - 0.06, slice) * smoothstep(17.5, 19, r) * smoothstep(37, 35, r);
    const disc = smoothstep(13.5, 12.5, r);
    const ring = smoothstep(1.4, 0.4, Math.abs(r - 15.5));
    const carved = Math.max(ray, ring, smoothstep(12.5, 13.5, r) * smoothstep(14.5, 13.5, r));
    // Carved stone: deeper and darker in the cuts, the disc gilded.
    c = mix(c, mix(shade(c, 0.62), p.accent, 0.2), carved * 0.9);
    c = mix(c, mix(p.accent, [240, 178, 64], 0.5), disc * 0.75);
    h -= carved * 0.3;
    h += disc * 0.08;
    // The lit edge of every cut, so it reads as relief even unlit.
    const toward = (dx * LIGHT_X + dy * LIGHT_Y) / Math.max(1, r);
    c = mix(c, lift(c, 0.25), carved * Math.max(0, -toward) * 0.5);
  }
  SIDE.h = h;
  return c;
}

/** The Moon Garden's stepping stones, wandering up the board: x, y in painter units, and radius. */
const STEPPING_STONES: readonly (readonly [number, number, number])[] = [
  [44, 24, 8], [62, 46, 7], [48, 70, 8.5], [66, 94, 7], [52, 118, 8], [68, 142, 7.5], [50, 166, 8], [64, 186, 6.5],
];

/**
 * The Moon Garden's floor: raked gravel, the rake lines running up the
 * board and circling the stepping stones that wander across it, with
 * cherry petals fallen on the gravel. Outside the tray, moss at night
 * with moonflowers open in it — five pale petals round a gold heart —
 * glowing (the glow map), so the garden is lit by its own flowers under
 * the night rig.
 */
function moonGarden(x: number, y: number, p: { a: Rgb; b: Rgb; accent: Rgb }, tray: boolean): Rgb {
  if (!tray) {
    const blob = fbm(x * 0.6, y * 0.6, SIZE);
    let c = mix(p.a, p.b, smoothstep(0.3, 0.75, blob));
    c = mix(c, shade(p.b, 0.75), smoothstep(0.35, 0.05, blob) * 0.6);
    const fibre = noise(x * 1.2, y * 1.2 + blob * 2, SIZE);
    c = mix(c, shade(c, 0.85), smoothstep(0.5, 0.85, fibre) * 0.45);
    c = mix(c, lift(c, 0.12), smoothstep(0.4, 0.1, fibre) * 0.3);
    SIDE.h = 0.5 + (blob - 0.5) * 0.3;
    const cell = 16;
    const col = Math.floor(x / cell);
    const row = Math.floor(y / cell);
    const h = hash(col + 17, row + 5);
    // A flower in about a third of the cells, smaller and softer than
    // the first try, which read as snow from the game's camera.
    if (h > 0.76) {
      const cx = col * cell + cell / 2 + (hash(col + 2, row + 9) - 0.5) * 8;
      const cy = row * cell + cell / 2 + (hash(col + 6, row + 3) - 0.5) * 8;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const petal = 1.6 + 0.8 * Math.cos(a * 5 + h * 9);
      const flower = smoothstep(petal + 0.6, petal - 0.3, d);
      const bloom: Rgb = h > 0.86 ? [232, 226, 250] : [214, 208, 240];
      const halo = smoothstep(petal + 3.5, petal, d);
      c = mix(c, [120, 140, 210], halo * 0.25);
      c = mix(c, bloom, flower * 0.9);
      c = mix(c, [255, 230, 150], smoothstep(0.8, 0.15, d));
      glowAt(flower * 0.45 + halo * 0.15, bloom);
    }
    return c;
  }
  // Gravel: fine, pale, grey-blue.
  let c = mix(p.a, p.b, 0.4 + 0.25 * noise(x * 1.6, y * 1.6, SIZE));
  c = mix(c, hash(x, y) > 0.5 ? lift(p.a, 0.15) : shade(p.b, 0.92), 0.12);
  // The nearest stepping stone, and the rake lines: up the board, and
  // circling every stone.
  let best = 1e9;
  let bx = 0;
  let by = 0;
  let br = 0;
  for (const [sx, sy, sr] of STEPPING_STONES) {
    const d = Math.hypot(x - sx, y - sy) - sr;
    if (d < best) {
      best = d;
      bx = sx;
      by = sy;
      br = sr;
    }
  }
  const dStone = Math.hypot(x - bx, y - by);
  const around = smoothstep(br + 14, br + 4, dStone);
  const line = Math.sin(x * 1.6) * (1 - around) + Math.sin(dStone * 1.6) * around;
  const ridge = smoothstep(-0.2, 0.7, line);
  c = mix(c, lift(c, 0.14), ridge * 0.5);
  c = mix(c, shade(c, 0.86), (1 - ridge) * 0.4);
  let h = 0.5 + (ridge - 0.5) * 0.18;
  // The stone itself: a grey-blue slab, lumpy, lit on the side toward
  // the light, with its shadow on the gravel beyond it.
  const wobble = (noise((x - bx) * 0.5 + bx, (y - by) * 0.5 + by, SIZE) - 0.5) * 2.2;
  const edge = best + wobble;
  if (edge < 3) {
    const stone: Rgb = shade(mix(p.b, p.accent, 0.35), 0.8);
    const on = smoothstep(1.2, 0.2, edge);
    const lit = ((x - bx) * LIGHT_X + (y - by) * LIGHT_Y) / Math.max(1, br);
    c = mix(c, shade(c, 0.78), smoothstep(3, 0.4, edge) * (1 - on) * Math.max(0, lit) * 0.7);
    c = mix(c, stone, on * 0.95);
    c = mix(c, lift(stone, 0.3), on * Math.max(0, -lit) * 0.5);
    c = mix(c, shade(stone, 0.72), on * Math.max(0, lit) * 0.45);
    c = mix(c, shade(stone, 0.85), on * smoothstep(0.5, 0.85, noise(x * 1.5 + 9, y * 1.5, SIZE)) * 0.5);
    h = Math.max(h, 0.5 + on * 0.25);
  }
  // Petals fallen on the gravel: pale pink, each lying its own way.
  const cell = 14;
  const col = Math.floor(x / cell);
  const row = Math.floor(y / cell);
  const h2 = hash(col + 23, row + 31);
  if (h2 > 0.72) {
    const lx = x - col * cell - cell / 2 - (hash(col + 1, row) - 0.5) * 6;
    const ly = y - row * cell - cell / 2 - (hash(col, row + 2) - 0.5) * 6;
    const a = h2 * 9;
    const u = lx * Math.cos(a) + ly * Math.sin(a);
    const v = -lx * Math.sin(a) + ly * Math.cos(a);
    const d = Math.hypot(u / 2.2, v / 1.4);
    const on = smoothstep(1, 0.7, d);
    c = mix(c, h2 > 0.9 ? [246, 201, 216] : [240, 228, 240], on * 0.9);
    c = mix(c, [255, 255, 255], smoothstep(1, 0.6, Math.hypot((u - 0.5) / 2.2, (v - 0.3) / 1.4)) * on * 0.25);
  }
  SIDE.h = h;
  return c;
}

const PAINTERS: Record<ArenaStructure, SurfacePainter> = {
  fernRock: dinoEarth,
  // Season 2 of the pass (21 Oct 2026).
  sunstone: templeStone,
  lanternWall: moonGarden,
  /*
    Snowy Hollow: fresh snow with sled tracks in it.

    The drift lobes and the blue in the shadows are from the 31 Aug 2026
    skin review, which scored the old floor 5 and 4 for reading as
    plaster: blue shadow is the single strongest cue that white stuff is
    snow, so the cold tones are the painter's own and the fence's timber
    stays on the fence.

    What the October 2026 redesign adds is something PRESSED INTO it.
    Two sled runs curve down the board (one more crosses the ground
    outside), each a pair of runner grooves with a ploughed lip, the
    groove wall that faces the key light lit and the other in shade. A
    white floor nothing has touched was the plaster fault; a floor a sled
    has crossed is a snowfield. The grooves are a few texels wide and
    blue-grey, not dark — a die sits on them without being lost in them.

    The swept ice puddle painted at the far end is gone: the pit on this
    board IS a frozen pond, and two ponds read as one pond and a mistake.
  */
  snowFence: (x, y, p, tray) => {
    const shadow: Rgb = [186, 201, 222]; // #bac9de — snow-shadow blue
    const glint: Rgb = [236, 251, 255]; // ice glint, a breath of cyan

    // The tray is the swept, packed board; outside lies deep drift.
    const depth = tray ? 0.6 : 1;
    let c = lift(p.a, tray ? 0.3 : 0.15);

    // Wind-scoured lobes, elongated down the board.
    const scour = fbm(x + y * 0.3, y * 2.2, SIZE);
    c = mix(c, p.b, smoothstep(0.3, 0.78, scour) * depth);

    // Broad soft drift shadows at two scales, tinted cold.
    const big = noise(x / 30 + 7, y / 30 + 3, SIZE / 30);
    const mid = noise(x / 12 + 61, y / 12 + 23, SIZE / 12);
    c = mix(c, shadow, smoothstep(0.35, 0.88, big) * depth * 0.85);
    c = mix(c, mix(p.b, shadow, 0.6), smoothstep(0.5, 0.92, mid) * depth * 0.55);
    // The hollows are the shadowed parts, so they are the LOW parts.
    let h = 0.55 - (big - 0.5) * 0.35 + (scour - 0.5) * 0.15;

    // The sled runs. On the ground the curve makes whole waves per tile,
    // so the track joins itself at the repeat.
    const runs = tray ? 2 : 1;
    for (let k = 0; k < runs; k++) {
      let cx: number;
      let slope: number;
      if (!tray) {
        const a = (y * Math.PI * 2) / SIZE;
        cx = 40 + 14 * Math.sin(a);
        slope = ((14 * Math.PI * 2) / SIZE) * Math.cos(a);
      } else if (k === 0) {
        cx = 46 + 22 * Math.sin(y * 0.026 + 0.7);
        slope = 22 * 0.026 * Math.cos(y * 0.026 + 0.7);
      } else {
        cx = 70 + 18 * Math.sin(y * 0.019 + 3.4);
        slope = 18 * 0.019 * Math.cos(y * 0.019 + 3.4);
      }
      // Distance across the track, not across the picture: on a bend
      // the horizontal distance overstates it and the groove fattens.
      const across = 1 / Math.sqrt(1 + slope * slope);
      for (let side = -1; side <= 1; side += 2) {
        const dx = (x - cx - side * 4.5) * across;
        const d = Math.abs(dx);
        if (d > 3) continue;
        const groove = smoothstep(1.4, 0.25, d);
        const lip = smoothstep(2.9, 1.5, d) * (1 - groove);
        // The groove wall on the -x side faces the light; the other is
        // in its own shadow.
        c = mix(c, mix(p.b, shadow, 0.75), groove * (dx > 0 ? 0.7 : 0.3));
        c = mix(c, [252, 254, 255], lip * 0.55);
        h += lip * 0.12 - groove * 0.35;
      }
    }

    // Ice sparkle — a glint is LIGHT, always brighter than the field.
    if (hash(x, y) > 0.988) c = mix(c, glint, 0.8);
    // ...and a rarer, fatter glint that survives arm's length.
    if (hash(Math.floor(x) + 13, Math.floor(y) + 57) > 0.9965) c = mix(c, [255, 255, 255], 0.9);
    SIDE.h = h;
    return c;
  },

  /*
    Desert Dunes: rippled sand, and the ripples stand UP.

    The old ripple was a sine between the two sand tones — a stripe, the
    same light on both faces of every ridge, which at the game camera is
    corduroy rather than sand. Wind ripples are lopsided: a long gentle
    back and a short steep lee face. Here the steep face turns AWAY from
    the key light, so each ripple is a broad lit back with a thin shadow
    behind it — gentle enough for dice to sit on, unmistakably combed by
    wind. Six waves across and eight down per 128-unit tile, so the ground
    outside still joins at its repeat.

    Outside the walls the dunes themselves are drawn: a broad swell lit on
    the face that turns to the sun and shaded on the one that turns away,
    found by asking whether the sand rises or falls a step toward the
    light. That is what makes the ground a dune field and not a beach.
  */
  adobe: (x, y, p, tray) => {
    const swellAt = (sx: number, sy: number) =>
      noise(sx / 32, sy / 32, SIZE / 32) * 0.65 + noise(sx / 16 + 5, sy / 16 + 9, SIZE / 16) * 0.35;
    const swell = swellAt(x, y);
    let c = mix(p.a, p.b, smoothstep(0.25, 0.8, swell) * (tray ? 0.55 : 0.85));

    if (!tray) {
      // Falls toward the light: faces it.
      const facing = (swell - swellAt(x + LX * 3, y + LY * 3)) * 14;
      c = facing > 0
        ? mix(c, lift(c, 0.2), Math.min(1, facing))
        : mix(c, shade(p.b, 0.8), Math.min(0.85, -facing));
    }

    const phase = ((x * 6 - y * 8) / SIZE + fbm(x, y, SIZE) * 0.55) * (tray ? 1.3 : 1);
    const f = phase - Math.floor(phase);
    const k = tray ? 0.6 : 1;
    // 0 to 0.8 is the back, falling toward the light; the rest is the lee.
    const lee = smoothstep(0.78, 0.83, f) * (1 - smoothstep(0.97, 1, f));
    c = mix(c, lift(c, 0.1), (1 - lee) * 0.55 * k);
    c = mix(c, shade(c, 0.8), lee * 0.8 * k);
    const ridge = f < 0.8 ? 1 - f / 0.8 : (f - 0.8) / 0.2;

    // A pebble now and then, and a darker grain of mica.
    if (hash(x * 3, y * 3) > 0.994) c = mix(c, p.accent, 0.5);
    if (hash(x * 2 + 17, y * 2 + 5) > 0.996) c = shade(c, 0.82);
    SIDE.h = 0.45 + (swell - 0.5) * 0.5 + ridge * 0.16;
    return c;
  },

  /*
    Volcano Rim: black basalt with lava glowing in its seams.

    Basalt cools into COLUMNS, and a floor of column tops seen from above
    is a field of rough hexagons — the most recognisable rock pattern
    there is, and the one thing the old floor (warped plates in a plum
    wash) was not. So the board is hexagonal plates on an offset lattice,
    jittered just enough not to be a tile, each with a bevel that the key
    light catches on one side. Some of the seams between them run hot:
    those carry lava in the colour picture AND in the glow map, so they
    shine under the night rig the way an open crack actually would, and
    the renderer breathes their brightness.

    Kept thin and kept to a minority of seams. A floor of orange lines is
    a floor an orange die disappears into.
  */
  basalt: (x, y, p, tray) => {
    const LAVA: Rgb = [255, 112, 38];
    const CORE: Rgb = [255, 204, 96];
    const crust: Rgb = [30, 20, 22];
    if (!tray) {
      // Outside: rough rock with lava rivers, the old cooled-crust seams
      // widened into channels and set glowing.
      const warp = fbm(x, y, SIZE) * 11 + noise(x / 4, y / 4, SIZE / 4) * 5;
      const warp2 = fbm(x + 37, y + 19, SIZE) * 13;
      const seam = Math.abs(
        Math.sin((x + warp) * ((Math.PI * 2 * 3) / SIZE)) +
          Math.sin((y - warp2) * ((Math.PI * 2 * 2) / SIZE)),
      );
      // Darker than the theme's meadow and hill, and less red: those two
      // also paint the shelf picture, which wants them warm.
      let g = shade(mix(mix(p.a, p.b, fbm(x * 0.6, y * 0.6, SIZE)), [70, 64, 66], 0.35), 0.82);
      g = mix(g, shade(g, 0.72), smoothstep(0.55, 0.2, seam) * 0.45);
      if (hash(x * 1.7, y * 1.7) > 0.97) g = shade(g, 0.78);
      // Only some stretches of crack are still open, and those thinly:
      // the first pass lit every one of them a texel wide and the ground
      // became a map of orange rivers louder than the board.
      const open = smoothstep(0.45, 0.62, noise(x / 32 + 9, y / 32 + 4, SIZE / 32));
      const river = smoothstep(0.09, 0.02, seam) * open;
      g = mix(g, [96, 34, 22], smoothstep(0.22, 0.06, seam) * 0.5);
      g = mix(g, mix(LAVA, CORE, smoothstep(0.04, 0.01, seam)), river);
      glowAt(river * 0.8, mix(LAVA, CORE, smoothstep(0.05, 0.01, seam)));
      SIDE.h = 0.6 - river * 0.4 - smoothstep(0.5, 0.2, seam) * 0.15;
      return g;
    }

    const C = 22;
    const RH = C * 0.866;
    const gr = Math.floor(y / RH);
    let d1 = 1e9;
    let d2 = 1e9;
    let cx = 0;
    let cy = 0;
    let cq = 0;
    let cr = 0;
    for (let oy = -1; oy <= 1; oy++) {
      const r = gr + oy;
      const off = r & 1 ? C / 2 : 0;
      const gq = Math.floor((x - off) / C);
      for (let ox = -1; ox <= 1; ox++) {
        const q = gq + ox;
        const jx = (q + 0.5 + (hash(q, r) - 0.5) * 0.32) * C + off;
        const jy = (r + 0.5 + (hash(q + 41, r + 17) - 0.5) * 0.32) * RH;
        const dx = x - jx;
        const dy = y - jy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          cx = jx;
          cy = jy;
          cq = q;
          cr = r;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
    const edge = d2 - d1;
    let c = mix(p.a, p.b, hash(cq + 2, cr + 6));
    // Vesicles — the gas bubbles frozen into the rock — and its grain.
    c = mix(c, shade(c, 0.86), noise(x / 2 + cq * 7, y / 2 + cr * 3, SIZE / 2) * 0.5);
    if (hash(Math.floor(x * 1.4), Math.floor(y * 1.4)) > 0.982) c = shade(c, 0.72);
    // The bevel: each column top is rounded off at its rim, and the rim
    // that faces the light catches it.
    const bevel = 1 - smoothstep(0, 3.4, edge);
    const toward = ((x - cx) * LX + (y - cy) * LY) / Math.max(1, d1);
    c = toward > 0 ? mix(c, lift(c, 0.32), bevel * toward) : shade(c, 1 + bevel * toward * 0.38);
    // The seam itself, and whether it is still hot.
    const seam = smoothstep(1.5, 0.35, edge);
    c = mix(c, crust, seam * 0.8);
    const hot = smoothstep(0.56, 0.7, noise(x / 30 + 13, y / 30 + 5, SIZE / 30));
    const lava = smoothstep(1.1, 0.2, edge) * hot;
    const lavaColour = mix(LAVA, CORE, smoothstep(0.6, 0.1, edge));
    c = mix(c, lavaColour, lava * 0.92);
    glowAt(lava, lavaColour);
    SIDE.h = 0.75 - bevel * 0.3 - seam * 0.35;
    return c;
  },

  /*
    Autumn Woods: a carpet of fallen leaves, reds and ambers.

    The first floor drew small dark dashes (grit); the next drew leaves
    and then thinned them on the board, because a red die on a red carpet
    had to be hunted for. Both lessons hold. What the October 2026
    redesign adds is RELIEF: every leaf casts a soft shadow down and away
    from the key light, and is folded along its midrib with one half lit
    and one in shade, so the floor reads as leaves LYING on earth rather
    than printed onto it. Outside the walls there are maples among the
    ovals, because a maple is the leaf everybody draws.

    On the board the leaves are plain ovals, muted almost half way toward
    the earth and covering well under half of it — a red die is still the
    reddest thing in sight. Outside the walls it is a full carpet.
  */
  logPile: (x, y, p, tray) => {
    const LEAF: Rgb[] = [
      [192, 78, 40], [214, 138, 46], [168, 56, 40], [226, 170, 70], [150, 92, 46],
    ];
    let c = mix(p.a, shade(p.a, 0.84), fbm(x, y, SIZE));
    let h = 0.4;
    const cell = 13;
    const passes = tray ? 2 : 3;

    // One leaf's coverage, 0 to 1, at leaf-local (u, v).
    const cover = (u: number, v: number, maple: boolean, size: number): number => {
      if (maple) {
        const rr = Math.sqrt(u * u + v * v) / size;
        if (rr > 5) return 0;
        // Pointed lobes, not round ones: a round-lobed outline is a
        // flower, and the first render was a meadow of daisies.
        const f = (Math.atan2(v, u) / (Math.PI * 2)) * 5 + 0.5;
        const tri = 1 - Math.abs((f - Math.floor(f)) * 2 - 1);
        const lobe = 4.6 * (0.42 + 0.58 * tri * tri);
        return smoothstep(0.6, -0.4, rr - lobe);
      }
      const t = Math.abs(u) / (5.4 * size);
      if (t > 1) return 0;
      return smoothstep(0.6, -0.4, Math.abs(v) - 2.6 * size * (1 - t * t));
    };

    for (let pass = 0; pass < passes; pass++) {
      const ox = pass * 7 + 3;
      const oy = pass * 5 + 1;
      const row = Math.floor((y + oy) / cell);
      const rowOff = row & 1 ? cell / 2 : 0;
      const col = Math.floor((x + ox + rowOff) / cell);
      const hh = hash(col + pass * 31, row + pass * 17);
      if (hh < (tray ? 0.55 : 0.18)) continue;
      const lx = ((((x + ox + rowOff) % cell) + cell) % cell) - cell / 2 + (hh - 0.5) * 4;
      const ly = ((((y + oy) % cell) + cell) % cell) - cell / 2 + (hash(col + 7, row + pass) - 0.5) * 4;
      const a = hh * 17.3;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const size = 0.8 + hash(col + 5, row + 3) * 0.4;
      // Maples only outside: on the board every leaf is a plain oval, the
      // quietest shape there is under a die.
      const maple = !tray && hash(col + 23, row + 29) > 0.62;
      // The shadow is the same leaf, cast away from the light.
      const qx = lx + LX * 1.9;
      const qy = ly + LY * 1.9;
      const shadowCover = cover(qx * ca + qy * sa, -qx * sa + qy * ca, maple, size);
      c = mix(c, shade(c, 0.6), shadowCover * 0.5);
      const u = lx * ca + ly * sa;
      const v = -lx * sa + ly * ca;
      const m = cover(u, v, maple, size);
      if (m <= 0) continue;
      let leaf = LEAF[Math.floor(hash(col + 11, row + 2) * LEAF.length) % LEAF.length];
      if (tray) leaf = mix(leaf, p.b, 0.45);
      // Folded along the midrib: the half that tilts toward the light
      // is lit, the other is in shade.
      const half = (v > 0 ? 1 : -1) * (sa * LX - ca * LY);
      leaf = half > 0 ? mix(leaf, lift(leaf, 0.2), half * 0.7) : shade(leaf, 1 + half * 0.22);
      if (maple ? Math.sqrt(u * u + v * v) < 0.9 : Math.abs(v) < 0.45) leaf = shade(leaf, 0.82);
      c = mix(c, leaf, m);
      h = Math.max(h, 0.45 + m * (0.3 + pass * 0.1));
    }
    SIDE.h = h;
    return c;
  },

  /*
    Frozen Lights: cracked lake ice with the aurora in it.

    The board is no longer snow cut into blocks — that was a polar
    STATION's floor, and Frozen Lights is not a station any more. It is a
    frozen lake: pale ice with clear patches where you can see down into
    it, a web of white fracture lines (not a full grid of them — some
    plates have fused, so a noise field decides which seams show), air
    bubbles, and the green and magenta of the lights overhead lying faint
    across the surface. The brightest of the green also goes into the
    glow map, so the reflection keeps shining under the night rig.

    Outside the walls is still the snowfield with the lights swept across
    it, unchanged in intent: quiet under the dice, stronger around them.
  */
  iceBlocks: (x, y, p, tray) => {
    const cold: Rgb = [213, 234, 240]; // #d5eaf0 — snow under a night sky
    const TAU = Math.PI * 2;
    const warp = fbm(x + 53, y + 17, SIZE);
    const green = Math.sin(((2 * x + y) / SIZE) * TAU + warp * 2.2);
    const magenta = Math.sin(((2 * x - y) / SIZE) * TAU + 4.4 + warp * 1.8);

    if (!tray) {
      const cyan = Math.sin(((x + 2 * y) / SIZE) * TAU + 2.1 + warp * 2.8);
      const cell = 32;
      const edge = gridEdge(x, y, cell);
      const bx = Math.floor(x / cell);
      const by = Math.floor(y / cell);
      const block = hash(bx, by);
      let c = mix(mix(p.a, p.b, 0.3 + hash(bx + 7, by + 3) * 0.7), cold, 0.04 + block * 0.22);
      const drift = fbm(x + y * 0.3, y * 2.2, SIZE);
      c = mix(c, lift(cold, 0.6), smoothstep(0.4, 0.8, drift) * 0.3);
      const joint = smoothstep(2.4, 0.5, edge);
      c = mix(c, shade(mix(p.b, cold, 0.3), 0.82), joint * 0.6);
      c = mix(c, lift(cold, 0.5), smoothstep(6, 2.8, edge) * (1 - joint) * drift * 0.5);
      c = mix(c, [59, 226, 148], (smoothstep(0.0, 0.85, green) * 0.42 + smoothstep(0.7, 0.98, green) * 0.18) * 1.4);
      c = mix(c, [96, 208, 236], (smoothstep(0.05, 0.9, cyan) * 0.32 + smoothstep(0.72, 0.98, cyan) * 0.14) * 1.4);
      c = mix(c, [224, 134, 220], smoothstep(0.3, 0.95, magenta) * 0.24 * 1.4);
      glowAt(smoothstep(0.6, 0.98, green) * 0.55, [70, 236, 160]);
      if (hash(x, y) > 0.993) c = lift(c, 0.85);
      SIDE.h = 0.6 - joint * 0.3 + drift * 0.2;
      return c;
    }

    const deep: Rgb = [64, 122, 164];
    let c = mix(p.a, p.b, smoothstep(0.3, 0.75, noise(x / 16, y / 16, SIZE / 16)));
    // Clear patches, where the eye goes down into the ice.
    const clear = noise(x / 32 + 40, y / 32 + 9, SIZE / 32);
    c = mix(c, deep, smoothstep(0.5, 0.82, clear) * 0.5);
    // Frost feathering across the surface.
    c = mix(c, lift(c, 0.35), smoothstep(0.6, 0.85, noise(x / 3 + 13, y / 9, SIZE / 3)) * 0.25);

    // The fracture web: a jittered Voronoi, of which only some seams show.
    voronoi(x, y, 34, 0.15, 0.7, 1, 3, 9, 51, 27);
    // Wobbled by the curtain warp already in hand, so a fracture is not
    // a ruled line.
    const edge = VORO.d2 - VORO.d1 + (warp - 0.5) * 0.9;
    const live = smoothstep(0.22, 0.42, noise(x / 22 + 3, y / 22 + 7, SIZE / 22));
    const crack = smoothstep(0.95, 0.15, edge) * live;
    const bruise = smoothstep(2.6, 0.9, edge) * (1 - crack) * live;
    c = mix(c, shade(mix(c, deep, 0.5), 0.88), bruise * 0.55);
    c = mix(c, lift(c, 0.9), crack * 0.9);

    // The lights, lying faint on the ice.
    c = mix(c, [86, 226, 168], smoothstep(0.25, 0.95, green) * 0.1);
    c = mix(c, [214, 140, 226], smoothstep(0.5, 0.97, magenta) * 0.12);
    glowAt(smoothstep(0.8, 0.99, green) * 0.22, [70, 236, 160]);

    // Air bubbles caught in the freeze.
    if (hash(x * 2.3, y * 2.3) > 0.9965) c = lift(c, 0.6);
    SIDE.h = 0.62 - crack * 0.38 - bruise * 0.1;
    return c;
  },

  /*
    Crystal Cavern: dark rock with glowing crystal veins.

    Marc's cut slabs stay — "I want the cut slabs", 28 Aug 2026, picked
    from floors rendered through this very painter — at the same thirty
    painter units. What changed in October 2026 is where the crystal is.
    It used to be a quarter of the slab FACES, sunk into the rock so a
    purple die would not vanish on one. Now the faces are dark cave rock
    and the crystal is in the SEAMS between them: violet and ice-blue
    veins that glow (they go into the glow map too, so they shine in the
    dark the way the spec's "glowing crystal veins" means), with a bright
    arris along each. A die sits on rock; the light runs round it.

    Outside the walls the rock is quieter and the veins rarer — scenery
    stays quieter than the board.
  */
  stalagmite: (x, y, p, tray) => {
    const VEIN: Rgb[] = [
      [201, 138, 255], [127, 212, 232], [220, 174, 255],
    ];
    if (!tray) {
      let g = mix(p.a, p.b, smoothstep(0.2, 0.8, fbm(x * 0.6, y * 0.6, SIZE)));
      g = mix(g, shade(p.a, 0.62), smoothstep(0.5, 0.9, fbm(x * 0.35, y * 0.35, SIZE)) * 0.5);
      const vein = Math.abs(fbm(x * 0.5 + 17, y * 0.5, SIZE) - 0.5);
      const veinColour = VEIN[Math.floor(noise(x / 32, y / 32, SIZE / 32) * 2.999)];
      const lit = smoothstep(0.03, 0.006, vein);
      g = mix(g, veinColour, lit * 0.3);
      glowAt(lit * 0.25, veinColour);
      const chunk = hash(Math.floor(x / 16), Math.floor(y / 16));
      if (chunk > 0.86) {
        const bx = (((x % 16) + 16) % 16) - 8;
        const by = (((y % 16) + 16) % 16) - 8;
        const geode = smoothstep(4, 1.2, Math.hypot(bx, by));
        g = mix(g, lift(veinColour, 0.3), geode * 0.5);
        glowAt(geode * 0.4, veinColour);
      }
      SIDE.h = 0.55 - lit * 0.3 + noise(x / 3, y / 3, SIZE / 3) * 0.2;
      return mix(g, shade(g, 0.9), noise(x / 3, y / 3, SIZE / 3) * 0.4);
    }

    // Marc's cut slabs: a jittered Voronoi at thirty painter units.
    const CELL = 30;
    voronoi(x, y, CELL, 0.2, 0.6, 2, 0, 0, 41, 17);
    const { d1, d2, cx, cy, cq, cr } = VORO;
    const base = mix(p.a, p.b, hash(cq + 2, cr + 6) * 0.8);
    // Each slab a plane at its own angle to the key light.
    const tilt = ((x - cx) * LX + (y - cy) * LY) / CELL;
    let c = shade(base, 0.9 + Math.max(-0.12, Math.min(0.14, tilt * 0.35)));
    c = mix(c, shade(base, 0.8), noise(x / 4 + cq * 9, y / 4 + cr * 5, SIZE / 4) * 0.4);
    // Mineral speckle, a few grains of it catching the light.
    if (hash(x * 1.9, y * 1.9) > 0.9975) c = lift(c, 0.4);

    const edge = d2 - d1;
    const veinColour = VEIN[Math.floor(noise(x / 40 + 3, y / 40 + 11, SIZE / 40) * 2.999)];
    // Every seam carries crystal; how brightly it burns wanders.
    const burn = 0.2 + 0.8 * smoothstep(0.35, 0.75, noise(x / 18 + 5, y / 18 + 2, SIZE / 18));
    const vein = smoothstep(1.5, 0.3, edge);
    c = mix(c, shade(base, 0.45), smoothstep(3.2, 1.6, edge) * 0.5);
    c = mix(c, mix(veinColour, [255, 255, 255], smoothstep(0.5, 0.05, edge) * 0.4), vein * (0.35 + burn * 0.45));
    glowAt(vein * burn * 0.7, veinColour);
    SIDE.h = 0.7 - smoothstep(3.2, 0.4, edge) * 0.5;
    return c;
  },

  /*
    Sky Kingdom: a cloud floor with gilded paving stones.

    It used to be the castle floor of the one castle in the set — marble
    tiles under merlons. Sky Kingdom is not a castle any more (it stands
    behind a gold balustrade on clouds), so the floor is the courtyard of
    a palace in the air: big pale paving slabs laid in courses, every
    joint picked out in GOLD with a lit and a shaded side so the gilding
    reads as inlay rather than as a drawn line, and cloud welling up over
    the edges from the walls — white puffs with blue-grey undersides, the
    shaded side being whichever side faces away from the sun. The middle
    stays clear paving, because that is where the dice land.

    Outside: open sky and cumulus as before, and through the gaps in the
    cloud the patchwork fields a long way below, hazed blue with height.
    That haze is what puts the board in the air.
  */
  cloudBalustrade: (x, y, p, tray) => {
    const GOLD: Rgb = [206, 156, 60];
    const BELLY: Rgb = [172, 192, 220];
    if (!tray) {
      const fieldAt = (sx: number, sy: number) =>
        noise(sx / 32, sy / 32, SIZE / 32) * 0.7 + noise(sx / 16 + 37, sy / 16 + 11, SIZE / 16) * 0.3;
      const field = fieldAt(x, y);
      let c = mix(p.b, p.a, noise(x / 16 + 7, y / 16 + 3, SIZE / 16) * 0.8);
      // The ground far below, where the cloud is thinnest: field squares
      // with hedges between them, hazed most of the way to sky blue.
      const open = smoothstep(0.44, 0.3, field);
      if (open > 0) {
        const FIELDS: Rgb[] = [[118, 168, 92], [168, 182, 96], [98, 146, 84], [196, 176, 110]];
        const plot = FIELDS[Math.floor(hash(Math.floor(x / 16), Math.floor(y / 16)) * 3.999)];
        let land = gridEdge(x, y, 16) < 0.9 ? shade(plot, 0.7) : plot;
        land = mix(land, p.b, 0.55);
        c = mix(c, land, open * 0.85);
      }
      const body = smoothstep(0.52, 0.66, field);
      const core = smoothstep(0.64, 0.82, field);
      c = mix(c, lift(p.a, 0.8), body * 0.92);
      c = mix(c, [255, 255, 255], core);
      // The side away from the sun: the cloud thickens toward the light.
      const away = smoothstep(0.005, 0.08, fieldAt(x + LX * 6, y + LY * 6) - field);
      c = mix(c, p.accent, body * away * 0.6);
      SIDE.h = 0.3 + body * 0.5 + core * 0.2;
      return c;
    }

    const cell = 26;
    const row = Math.floor(y / cell);
    const off = row & 1 ? cell / 2 : 0;
    const col = Math.floor((x + off) / cell);
    const lx = (((x + off) % cell) + cell) % cell;
    const ly = ((y % cell) + cell) % cell;
    const edge = Math.min(lx, cell - lx, ly, cell - ly);
    const hh = hash(col, row);
    let c = mix(p.a, p.b, 0.08 + hh * 0.62);
    const vein = Math.abs(Math.sin(x * 0.3 + y * 0.11 + noise(x / 8, y / 8, SIZE / 8) * 9 + hh * 19));
    c = mix(c, shade(p.b, 0.85), smoothstep(0.18, 0.03, vein) * 0.4);
    // The slab's bevel: the edges that face +x and -y face the light.
    if (edge < 2.4 && edge >= 1.1) {
      const lit = lx > cell - 2.4 || ly < 2.4;
      c = lit ? lift(c, 0.25) : shade(c, 0.9);
    }
    // The gilded joint, lit along one side of it.
    const joint = smoothstep(1.5, 0.7, edge);
    const gilt = lx > cell / 2 || ly < cell / 2 ? lift(GOLD, 0.3) : shade(GOLD, 0.82);
    c = mix(c, gilt, joint);

    // Cloud welling up over the paving from the walls.
    const fromWall = Math.min(x - 10, 102 - x, y - 10, 194 - y);
    // The cloud thins out toward the middle, which is clear paving by
    // design — so past that point the field is not asked at all, which
    // was a third of this floor's cost.
    const reach = smoothstep(24, 12, fromWall);
    const cloudAt = (sx: number, sy: number) =>
      fbm(sx * 0.8 + 11, sy * 0.8 + 3, SIZE) * reach + smoothstep(13, -2, fromWall) * 0.5;
    const cl = reach > 0 ? cloudAt(x, y) : 0;
    const body = smoothstep(0.7, 0.84, cl);
    if (body > 0) {
      const core = smoothstep(0.78, 0.98, cl);
      c = mix(c, lift(p.a, 0.75), body * 0.92);
      c = mix(c, [255, 255, 255], core * 0.9);
      const away = smoothstep(0.0, 0.1, cloudAt(x + LX * 5, y + LY * 5) - cl);
      c = mix(c, BELLY, body * away * 0.55);
    }
    SIDE.h = Math.max(0.6 - joint * 0.35, 0.45 + body * 0.55);
    return c;
  },

  /*
    Moon Base: grey regolith, bootprints and small craters.

    The craters used to be concentric — a dark bowl in a lit ring — which
    is how a crater looks lit from directly overhead and from no other
    angle. Lit from the side, as the key light is, the inner wall nearest
    the light is in shade and the far one catches it, and the rim does the
    opposite. That asymmetry is the whole difference between a crater and
    a grey ring, so every crater is shaded against the light now.

    And a trail of bootprints crosses the board, tread lines and all, from
    the near end to the far: somebody walked out here. Outside the walls
    the craters are bigger and a rover has driven past, its two treads
    printing chevrons in the dust.
  */
  airlock: (x, y, p, tray) => {
    let c = mix(p.a, p.b, fbm(x, y, SIZE));
    // Darker maria, where old lava flooded the dust.
    c = mix(c, shade(p.b, 0.86), smoothstep(0.5, 0.8, fbm(x * 0.4 + 9, y * 0.4, SIZE)) * 0.5);
    let h = 0.55;
    for (let k = 0; k < 3; k++) {
      const cell = tray ? [37, 23, 13][k] : [64, 32, 16][k];
      const radius = tray ? [9, 5.5, 3][k] : [13, 7, 3.5][k];
      const row = Math.floor((y + k * 11) / cell);
      const col = Math.floor((x + k * 7) / cell);
      const hh = hash(col + k * 29, row + k * 13);
      if (hh < 0.4) continue;
      const cx = ((((x + k * 7) % cell) + cell) % cell) - cell / 2 + (hh - 0.5) * cell * 0.3;
      const cy = ((((y + k * 11) % cell) + cell) % cell) - cell / 2 + (hash(col, row + 5) - 0.5) * cell * 0.3;
      const r = radius * (0.6 + hh * 0.6);
      const d = Math.hypot(cx, cy) + (noise(x / 2, y / 2, SIZE / 2) - 0.5) * 1.2;
      if (d > r * 1.35) continue;
      const toward = (cx * LX + cy * LY) / Math.max(0.5, d);
      if (d < r) {
        const wall = smoothstep(r * 0.25, r, d);
        c = mix(c, shade(c, 0.86), smoothstep(r, r * 0.4, d) * 0.4);
        c = toward > 0
          ? mix(c, shade(p.b, 0.62), wall * toward * 0.75)
          : mix(c, lift(p.a, 0.35), wall * -toward * 0.55);
        h = Math.min(h, 0.55 - (1 - d / r) * 0.4);
      } else {
        const rim = smoothstep(r * 1.35, r, d);
        c = toward > 0 ? mix(c, lift(p.a, 0.3), rim * toward * 0.6) : mix(c, shade(c, 0.82), rim * -toward * 0.5);
        h = Math.max(h, 0.55 + rim * 0.2);
      }
    }

    if (tray) {
      // The bootprints: a meandering walk, a print every eleven units,
      // left and right of the line in turn.
      const step = Math.floor(y / 11);
      const yc = step * 11 + 5.5;
      const px = 56 + 26 * Math.sin(yc * 0.024 + 0.5) + (step & 1 ? 3 : -3);
      const dx = x - px;
      const dy = y - yc;
      if (Math.abs(dx) < 2.6 && Math.abs(dy) < 3.6) {
        const q = (dx / 1.7) ** 4 + (dy / 2.8) ** 4;
        const print = smoothstep(1.2, 0.8, q);
        if (print > 0) {
          const tread = Math.sin(dy * 3.4) > 0.2 ? 0.86 : 1;
          c = mix(c, shade(c, 0.74 * tread), print * 0.7);
          // The wall of the print on the light's side is in its shade.
          const side = (dx * LX + dy * LY) / 3;
          c = side < 0 ? mix(c, lift(c, 0.25), print * (1 - print) * 3 * -side) : c;
          h = Math.min(h, 0.55 - print * 0.25);
        }
      }
    } else {
      // A rover's tracks: two tread bands, chevrons pressed into them.
      const a = (y * Math.PI * 2) / SIZE;
      const tx = 88 + 8 * Math.sin(a);
      for (let side = -1; side <= 1; side += 2) {
        const dx = x - tx - side * 5;
        if (Math.abs(dx) > 2) continue;
        const band = smoothstep(2, 1.4, Math.abs(dx));
        const chevron = Math.sin((y + Math.abs(dx) * 1.2) * 1.3) > 0.25;
        c = mix(c, shade(c, chevron ? 0.72 : 0.86), band * 0.7);
        h = Math.min(h, 0.55 - band * 0.2);
      }
    }
    // The dust itself, fine and even.
    c = mix(c, hash(x, y) > 0.5 ? lift(p.b, 0.25) : shade(p.a, 0.9), 0.06);
    SIDE.h = h;
    return c;
  },

  /*
    ── THE EIGHT STORE BOARDS ──────────────────────────────────────────

    Redrawn on 18 Oct 2026 (docs/board-redesign.md): "make each board
    look totally different ... and board matches its name." Every one of
    these used to be a two-tone pattern — beige ripples, pink tiles, a
    green lawn — and most of what told them apart was the tint. Each now
    paints the actual material the board is named after, with RELIEF:
    the key light comes from +x and the near end of the board (painter
    +x and -y, see LIGHT_X), so a ridge, a bevel or a cushion is lit on
    that side and shaded on the other, and the floor reads as a surface
    rather than as a print.

    Two rules they all keep, because the dice have to stay findable:
    the detail under the middle of the board is LOW CONTRAST (the
    louder pieces — shells, spores, the road print — keep near the
    edges or stay small), and nothing on a tray is die-sized and
    die-coloured.
  */

  // Treasure Beach: sand with shells and a trail of footprints.
  driftwood: (x, y, p, tray) => {
    /*
      Wind ripples whose period divides the 128-unit ground tile on both
      axes (the x term is a whole number of waves too), so the ground
      copies join without a seam. Quieter on the board than off it.
    */
    const TAU = Math.PI * 2;
    const phase = ((y + x * 0.25) / 128) * TAU * 20 + fbm(x, y, SIZE) * 4;
    const crest = Math.cos(phase);
    const amp = tray ? 0.8 : 1;
    let c = mix(p.a, p.b, 0.25 + 0.4 * smoothstep(0.25, 0.85, fbm(x * 0.45 + 11, y * 0.45 + 5, SIZE)));
    c = crest > 0
      ? mix(c, lift(c, 0.2), crest * 0.4 * amp)
      : mix(c, shade(c, 0.86), -crest * 0.45 * amp);
    const grain = hash(x * 1.7, y * 1.3);
    if (grain > 0.72) c = lift(c, 0.05);
    else if (grain < 0.22) c = shade(c, 0.95);

    if (tray) {
      /*
        Somebody walked up the beach before the battle. Bare-foot prints
        wandering from the retreat end to the jail, pressed in: dark
        inside, with a lit lip on the side away from the light. Kept
        faint — it is a story on the sand, not a road under the dice.
      */
      const path = (yy: number) => 46 + 22 * Math.sin(yy / 47) + 8 * Math.sin(yy / 19);
      if (y > 12 && y < 192 && Math.abs(x - path(y)) < 9) {
        const k = Math.round((y - 6) / 14);
        const cy = 6 + k * 14;
        const side = k % 2 === 0 ? -1 : 1;
        const cx = path(cy) + side * 3.4;
        const dx = (x - cx) * side;
        const dy = y - cy;
        const sole = (dx / (dy < -1 ? 1.6 : 2.0)) ** 2 + ((dy + 0.4) / 3.6) ** 2;
        let toe = 9;
        for (let t = 0; t < 4; t++) {
          toe = Math.min(toe, Math.hypot(dx - (-1.3 + t * 0.85), dy - (4.6 - Math.abs(t - 1) * 0.35)) / 0.62);
        }
        const inPrint = Math.min(sole, toe * toe);
        if (inPrint < 1.25) {
          const press = smoothstep(1.2, 0.75, inPrint);
          c = mix(c, shade(p.b, 0.9), press * 0.55);
          // The lip: lit on the side facing away from the light.
          const lip = smoothstep(1.25, 1.0, inPrint) * smoothstep(0.7, 1.0, inPrint);
          if ((x - cx) - (y - cy) < 0) c = mix(c, lift(c, 0.25), lip * 0.5);
        }
      }
    }

    // Shells, one lattice cell in a few. Mostly scallops, some
    // periwinkles, a pebble now and then — each with a contact shadow
    // falling away from the light, so they lie ON the sand.
    const cell = 16;
    const col = Math.floor(x / cell);
    const row = Math.floor(y / cell);
    const h = hash(col + 3, row + 7);
    if (h > (tray ? 0.8 : 0.7)) {
      const lx = x - col * cell - cell / 2 - (hash(col + 9, row) - 0.5) * 8;
      const ly = y - row * cell - cell / 2 - (hash(col, row + 9) - 0.5) * 8;
      const kind = hash(col + 11, row + 5);
      const a = hash(col + 2, row + 13) * TAU;
      const u = lx * Math.cos(a) + ly * Math.sin(a);
      const v = -lx * Math.sin(a) + ly * Math.cos(a);
      const SHELL: Rgb[] = [[244, 212, 192], [248, 238, 222], [226, 204, 220], [238, 190, 164]];
      const tint = SHELL[Math.floor(hash(col + 5, row + 3) * 4) % 4];
      const R = 2.4 + hash(col + 7, row + 1) * 1.2;
      const shadowD = Math.hypot(lx + 0.7, ly - 0.8);
      if (kind < 0.55) {
        // A scallop: a fan of ribs with two little ears at the hinge.
        const r = Math.hypot(u, v + R * 0.35);
        const inFan = v > -R * 0.35 && r < R;
        const ear = v < -R * 0.2 && v > -R * 0.55 && Math.abs(u) < R * 0.45;
        if (inFan || ear) {
          const rib = Math.sin(Math.atan2(u, v + R * 0.35) * 11);
          c = mix(tint, shade(tint, 0.8), smoothstep(0.2, 1, rib) * 0.5);
          c = mix(c, lift(c, 0.25), Math.max(0, lx - ly) / (R * 2));
        } else if (shadowD < R * 0.95) {
          c = shade(c, 0.9);
        }
      } else if (kind < 0.85) {
        // A periwinkle: a small spiral, amber-brown.
        const r = Math.hypot(lx, ly);
        if (r < 1.7) {
          const coil = Math.sin(Math.atan2(ly, lx) + r * 3.4);
          c = mix([196, 150, 112], [150, 108, 78], smoothstep(-0.2, 0.8, coil) * 0.7);
          if (lx - ly > 0.7) c = lift(c, 0.3);
        } else if (shadowD < 1.8) {
          c = shade(c, 0.9);
        }
      } else {
        const r = Math.hypot(u / 1.3, v);
        if (r < 1.3) c = mix([176, 166, 150], [204, 196, 182], Math.max(0, (lx - ly) / 2.6 + 0.4));
        else if (shadowD < 1.5) c = shade(c, 0.9);
      }
    }
    return c;
  },

  // Candy Meadow: a bar of chocolate, segments moulded and bevelled,
  // inside a meadow of pink frosting and sprinkles.
  gingerbread: (x, y, p, tray) => {
    if (!tray) return frosting(x, y, p);
    /*
      Square segments laid over the PLAYABLE board (the picture runs on
      under the walls, a wall's thickness all round), four across and
      eight down, so the bar's own edges line up with the tray's. Each
      segment is raised: a moulded channel, then a bevel lit on the two
      sides facing the light and shaded on the other two, then a flat
      top with a soft sheen across it. That bevel is the whole trick —
      flat squares in two browns read as tiles, which is what this board
      was ("pink bathroom tiles"); bevelled ones read as chocolate.
    */
    const cs = (TRAY_W - RIM * 2) / 4;
    const gx = x - RIM;
    const gy = y - RIM;
    const col = Math.floor(gx / cs);
    const row = Math.floor(gy / cs);
    const u = gx - col * cs;
    const v = gy - row * cs;
    const toL = u;
    const toR = cs - u;
    const toB = v;
    const toT = cs - v;
    const d = Math.min(toL, toR, toB, toT);
    let base = mix(p.a, p.b, 0.08 + hash(col + 5, row + 9) * 0.2);
    const groove = 1.2;
    const bevel = 4.4;
    if (d < groove) return shade(p.b, 0.6 + (d / groove) * 0.14);
    if (d < bevel) {
      // Light from +x and the near end: the right and bottom bevels face it.
      const lit = d === toR ? 0.85 : d === toB ? 0.7 : d === toL ? -0.8 : -0.65;
      const fade = 1 - ((d - groove) / (bevel - groove)) * 0.25;
      return lit > 0 ? lift(base, 0.17 * lit * fade) : shade(base, 1 + 0.22 * lit * fade);
    }
    // The flat top: a sheen running corner to corner, and the faint step
    // of the mould's inner border.
    const diag = u / cs - v / cs;
    base = mix(base, lift(base, 0.13), smoothstep(0.32, 0.02, Math.abs(diag + 0.15)) * 0.7);
    if (d > bevel + 2.4 && d < bevel + 3.3) base = shade(base, 0.94);
    else if (d >= bevel + 3.3 && d < bevel + 4.0) base = lift(base, 0.04);
    return mix(base, shade(base, 0.95), noise(x / 2.5, y / 2.5, SIZE / 2.5) * 0.45);
  },

  /*
    Glow Glade: DARK moss in cushions, with spores glowing in it.

    The lawn this replaces was light green on purpose — the 31 Aug 2026
    review found the green die hard to find on the old mid-green — and
    the brief now asks for dark moss. Dark is the safer side of that
    argument: the die is a saturated #33cc6b and the moss is a deep
    blue-green two value steps under it, so the die stands OFF the floor
    by lightness as well as by hue, and the ivory bodies of every die
    read brightest of all on it.
  */
  mossStone: (x, y, p, tray) => {
    if (!tray) return gladeGround(x, y, p);
    /*
      Cushions of moss as a HEIGHT field — two scales of noise — shaded
      by its own slope against the light. The first pass cut the floor
      into Voronoi cells with dark joints and it read as crazy paving;
      moss has no joints, it humps and dips, so the hollows are simply
      the low ground going dark.
    */
    const hgt = (u: number, v: number) =>
      noise(u / 7, v / 7, SIZE) * 0.65 + noise(u / 2.6 + 17, v / 2.6 + 9, SIZE) * 0.35;
    const h0 = hgt(x, y);
    const slope = -((hgt(x + 0.8, y) - h0) * LIGHT_X + (hgt(x, y + 0.8) - h0) * LIGHT_Y) / 0.8;
    let c = mix(p.b, p.a, smoothstep(0.25, 0.75, h0));
    c = slope > 0
      ? mix(c, lift(c, 0.2), Math.min(1, slope * 5))
      : mix(c, shade(c, 0.84), Math.min(1, -slope * 5));
    c = mix(c, shade(p.b, 0.7), smoothstep(0.32, 0.18, h0) * 0.5);
    // The fibre of the moss, at leaf scale.
    const f = noise(x * 1.4, y * 1.4, SIZE);
    c = mix(c, shade(c, 0.85), smoothstep(0.5, 0.9, f) * 0.45);
    c = mix(c, lift(c, 0.12), smoothstep(0.4, 0.1, f) * 0.3);
    /*
      The spores: small, sparse, each a hot point in a soft halo. Few
      enough that a die never lands on a field of them — the glade's
      big lights are on the walls and in the air (storeBoards.tsx), and
      the floor only has to say it glows too.
    */
    const SPORE: Rgb[] = [[126, 240, 224], [214, 244, 130]];
    const sc = 18;
    const sx = Math.floor((x + 5) / sc);
    const sy = Math.floor((y + 3) / sc);
    const sh = hash(sx + 17, sy + 29);
    if (sh > 0.72) {
      const lx = x + 5 - sx * sc - sc / 2 - (hash(sx + 2, sy + 4) - 0.5) * 9;
      const ly = y + 3 - sy * sc - sc / 2 - (hash(sx + 6, sy + 8) - 0.5) * 9;
      const dd = Math.hypot(lx, ly);
      const glow = SPORE[sh > 0.86 ? 1 : 0];
      c = mix(c, glow, smoothstep(3.2, 0.9, dd) * 0.22);
      c = mix(c, lift(glow, 0.5), smoothstep(1.0, 0.25, dd) * 0.9);
    }
    return c;
  },

  /*
    Pirate Cove: a ship's DECK, and a quay outside it.

    Seven planks across the playable width, running the length of the
    board, each butted end to end at its own stagger. What makes it a
    deck rather than a floor is the work in it: tarred seams between the
    planks, iron nail heads in pairs at every butt and at mid-plank,
    grain and the odd knot, and a bevel on each plank — lit along the
    edge that faces the light. The ground outside is the quay the ship
    is tied up to (the sea itself is drawn in storeBoards.tsx).
  */
  shipHull: (x, y, p, tray) => {
    if (!tray) return quay(x, y, p);
    const W = (TRAY_W - RIM * 2) / 7;
    const gx = x - RIM;
    const plank = Math.floor(gx / W);
    const inX = gx - plank * W;
    const LEN = 68;
    const along = y + hash(plank + 3, 7) * LEN;
    const seg = Math.floor(along / LEN);
    const inY = along - seg * LEN;
    let c = mix(p.a, p.b, 0.1 + hash(plank * 7 + 1, seg * 3 + 2) * 0.55);
    const streak = noise(x * 1.5 + plank * 13, y / 9, SIZE);
    c = mix(c, shade(c, 0.86), smoothstep(0.45, 0.85, streak) * 0.6);
    c = mix(c, lift(c, 0.08), smoothstep(0.4, 0.1, streak) * 0.5);
    // A knot in some planks.
    if (hash(plank * 5 + 2, seg * 11 + 4) > 0.55) {
      const kx = W * (0.3 + 0.4 * hash(plank + 8, seg + 1));
      const ky = LEN * (0.2 + 0.6 * hash(plank + 1, seg + 8));
      const kd = Math.hypot(inX - kx, (inY - ky) / 2.2);
      if (kd < 3) c = mix(c, shade(p.b, 0.7), smoothstep(3, 0.5, kd) * (0.35 + 0.25 * Math.sin(kd * 5)));
    }
    // The bevel: lit along the plank's +x edge, shaded along its -x edge.
    if (inX > W - 2.2) c = lift(c, 0.09 * (1 - (W - inX) / 2.2));
    else if (inX < 2) c = shade(c, 0.9 + inX * 0.05);
    const TAR: Rgb = [44, 31, 22];
    if (inX < 0.75 || inX > W - 0.45) return mix(c, TAR, 0.85);
    if (inY < 0.8) return mix(c, TAR, 0.75);
    // Nail heads: iron, with a glint on the side the light comes from.
    for (const ny of [2.4, LEN - 2.0]) {
      for (const nx of [W * 0.27, W * 0.73]) {
        const dx = inX - nx;
        const dy = inY - ny;
        const nd = dx * dx + dy * dy;
        if (nd < 1.0) {
          c = mix([62, 56, 52], [150, 146, 140], smoothstep(-0.2, 0.9, dx - dy) * 0.8);
        } else if (nd < 1.6 && dx - dy < 0) {
          c = shade(c, 0.85);
        }
      }
    }
    return c;
  },

  // Sunny Farm: ploughed rows of brown earth, straw in the furrows and
  // the first shoots on the ridges; a mown meadow outside the fence.
  picket: (x, y, p, tray) => {
    if (!tray) return meadow(x, y, p);
    /*
      Eight rows across the playable width, running the length of the
      board, each a soft ridge. The relief is the point: the face of a
      ridge turned to the light is lit and the other side is in shade,
      which is what makes rows read as PLOUGHED rather than as stripes —
      and keeps them gentle enough that a die on a ridge and a die in a
      furrow look the same.
    */
    const ROWW = (TRAY_W - RIM * 2) / 8;
    const wob = (fbm(x * 0.5, y * 0.5, SIZE) - 0.5) * 3;
    const s = (x - RIM + wob) / ROWW;
    const t = s - Math.floor(s);
    const ridge = Math.sin(Math.PI * t);
    const slope = Math.cos(Math.PI * t);
    let c = mix(p.b, p.a, 0.2 + ridge * 0.65);
    c = slope < 0 ? mix(c, lift(c, 0.14), -slope * 0.55) : mix(c, shade(c, 0.86), slope * 0.55);
    const crumb = noise(x * 0.9, y * 0.9, SIZE);
    c = mix(c, shade(c, 0.88), smoothstep(0.55, 0.85, crumb) * 0.5);
    c = mix(c, lift(c, 0.08), smoothstep(0.4, 0.12, crumb) * 0.4);
    const rowIdx = Math.floor(s);
    if (ridge < 0.5) {
      // Straw lying along the furrow.
      const fx = (t < 0.5 ? t : t - 1) * ROWW;
      const sc = 6;
      const k = Math.floor(y / sc);
      const sh = hash(rowIdx * 7 + 3, k * 3 + 1);
      if (sh > 0.62) {
        const off = (sh - 0.8) * 6;
        const slant = (hash(rowIdx + 1, k + 7) - 0.5) * 0.5;
        const dy = y - (k + 0.5) * sc;
        if (Math.abs(fx - off - dy * slant) < 0.45 && Math.abs(dy) < 2.6) {
          c = mix(c, [226, 196, 118], 0.75);
        }
      }
    } else {
      // A shoot on the ridge now and then: two little leaves.
      const sc = 13;
      const k = Math.floor((y + rowIdx * 5) / sc);
      if (hash(rowIdx * 3 + 9, k * 7 + 2) > 0.7) {
        const lx = (t - 0.5) * ROWW;
        const ly = y + rowIdx * 5 - (k + 0.5) * sc;
        const leaf =
          Math.min(Math.hypot((lx - 0.9) / 1.1, (ly - 0.4) / 0.55), Math.hypot((lx + 0.9) / 1.1, (ly - 0.4) / 0.55));
        if (leaf < 1) c = mix([112, 158, 70], [150, 196, 96], Math.max(0, lx - ly) * 0.4 + 0.3);
      }
    }
    return c;
  },

  /*
    Coral Reef: the sea floor, pale sand ridged by the current, with a
    faint web of light on it. The coral lives on the walls now
    (storeBoards.tsx) instead of in a ring on the floor, and the moving
    caustics are drawn over the top; this painter only has to be a
    believable bed of sand. The ground outside is the reef as it was.
  */
  coralRim: (x, y, p, tray) => {
    if (!tray) return reefGround(x, y, p);
    // Current ripples: a sharp lit crest and a long shaded lee, which is
    // the shape sand under moving water actually takes.
    const phase = y * 0.5 + x * 0.1 + fbm(x, y, SIZE) * 2.6;
    const wave = Math.sin(phase);
    const crest = Math.cos(phase);
    let c = mix(p.a, p.b, 0.12 + 0.3 * smoothstep(0.3, 0.8, fbm(x * 0.4 + 31, y * 0.4 + 7, SIZE)));
    c = crest > 0
      ? mix(c, lift(c, 0.26), smoothstep(0.2, 1, crest) * smoothstep(-0.2, 0.6, wave) * 0.7)
      : mix(c, shade(c, 0.84), -crest * 0.5);
    const web =
      1 - Math.abs(noise(x / 9 + 31, y / 9 + 57, SIZE / 9) +
        (noise(x / 4.5 + 71, y / 4.5 + 13, SIZE / 4.5) - 0.5) * 0.35 - 0.5) * 2;
    c = mix(c, lift(c, 0.55), smoothstep(0.88, 0.99, web) * 0.2);
    // Silt and pebbles gathered against the foot of the reef wall.
    const edge = Math.min(x - RIM, TRAY_W - RIM - x, y - RIM, TRAY_H - RIM - y);
    if (edge < 14) {
      c = mix(c, shade(p.b, 0.85), (1 - Math.max(0, edge) / 14) * 0.35);
      const pc = 6;
      const px = Math.floor(x / pc);
      const py = Math.floor(y / pc);
      if (hash(px + 13, py + 31) > 0.72) {
        const dd = Math.hypot(x - (px + 0.5) * pc, y - (py + 0.5) * pc);
        if (dd < 1.3) c = mix([150, 140, 160], [196, 186, 204], Math.max(0, x - y - (px - py) * pc) * 0.3 + 0.3);
      }
    }
    // A sand dollar, here and there.
    const dc = 26;
    const dx0 = Math.floor(x / dc);
    const dy0 = Math.floor(y / dc);
    if (hash(dx0 + 5, dy0 + 19) > 0.8) {
      const lx = x - (dx0 + 0.5) * dc;
      const ly = y - (dy0 + 0.5) * dc;
      const r = Math.hypot(lx, ly);
      if (r < 2.4) {
        const petal = Math.cos(Math.atan2(ly, lx) * 5);
        c = mix([236, 226, 204], [200, 188, 164], smoothstep(0.6, 1, petal) * smoothstep(0.6, 1.6, r) * 0.7);
      }
    }
    return c;
  },

  /*
    Rooftop City: a flat roof of tarred felt in rolls, with gravel
    ballast, crack sealant and two drains — and, outside the parapet,
    NOT more roof: the city at night, a long way down. The roof used to
    stand on the same grey felt as itself; from a height the street grid
    is what says you are on top of a building.
  */
  parapet: (x, y, p, tray) => {
    if (!tray) return cityBelow(x, y, p);
    const roll = 30;
    const inY = (((y - RIM) % roll) + roll) % roll;
    let c = mix(p.a, p.b, 0.2 + fbm(x * 0.5, y * 0.5, SIZE) * 0.55);
    // A lap seam: the shadowed step, then the lit edge of the sheet over it.
    if (inY < 0.8) c = shade(c, 0.8);
    else if (inY < 2.2) c = lift(c, 0.07);
    /*
      19 Oct 2026: the sealant used to wander over the whole roof and
      read as scribble. Now it is a few short runs where the felt has
      split, and the roof has what a roof has at night — two puddles
      holding the sky, and a painted safety line a step in from the
      parapet, the one warm colour on the tar.
    */
    const iso = Math.abs(fbm(x * 0.6 + 70, y * 0.6 + 20, SIZE) - 0.5);
    const split = smoothstep(0.58, 0.7, fbm(x * 0.18 + 31, y * 0.18 + 9, SIZE));
    c = mix(c, shade(p.b, 0.55), smoothstep(0.009, 0.003, iso) * 0.5 * split);
    c = mix(c, lift(c, 0.1), smoothstep(0.6, 0.8, fbm(x * 0.3 + 5, y * 0.3 + 50, SIZE)) * 0.5);
    const g = hash(x * 2.3, y * 1.9);
    if (g > 0.86) c = mix(c, lift(p.a, 0.32), 0.32);
    else if (g < 0.1) c = shade(c, 0.86);
    const edge = Math.min(x - RIM, TRAY_W - RIM - x, y - RIM, TRAY_H - RIM - y);
    if (edge > 3.2 && edge < 4.6) {
      const worn = smoothstep(0.35, 0.7, fbm(x * 0.9 + 3, y * 0.9 + 77, SIZE));
      c = mix(c, [214, 174, 66], 0.62 * worn);
    }
    for (const [px, py, rx, ry] of [[84, 168, 10, 6], [40, 108, 7.5, 4.6]] as const) {
      const d = Math.hypot((x - px) / rx, (y - py) / ry);
      if (d < 1.15) {
        const sky = mix([88, 104, 150], [128, 146, 192], smoothstep(1, 0, d) * (0.5 + noise(x * 0.9, y * 0.9, SIZE) * 0.5));
        c = mix(c, sky, smoothstep(1.15, 0.9, d) * 0.72);
      }
    }
    for (const [dx0, dy0] of [[30, 152], [82, 50]] as const) {
      const dx = x - dx0;
      const dy = y - dy0;
      const d = Math.hypot(dx, dy);
      if (d > 9) continue;
      if (d < 3.6) {
        c = [44, 46, 56];
        if (Math.abs(dx) < 0.45 || Math.abs(dy) < 0.45 || Math.abs(d - 2.2) < 0.35) c = [126, 130, 142];
      } else if (d < 4.8) {
        c = mix([128, 132, 144], [178, 182, 194], smoothstep(-3, 3, dx - dy));
      } else {
        // The ring of grime where water stands round a drain.
        c = mix(c, shade(c, 0.86), smoothstep(9, 5, d) * 0.6);
      }
    }
    return c;
  },

  // Toy Room: a soft playmat with a road printed round it, on a floor of
  // honey floorboards.
  blocks: (x, y, p, tray) => {
    if (!tray) return floorboards(x, y, p);
    let c = mix(p.a, p.b, smoothstep(0.3, 0.8, fbm(x * 0.35, y * 0.35, SIZE)) * 0.35);
    // The pile of the carpet: two fine scales, low contrast.
    const pile = noise(x * 1.6, y * 1.6, SIZE) * 0.6 + hash(x * 3.1, y * 2.7) * 0.4;
    c = mix(shade(c, 0.93), lift(c, 0.06), pile);
    const edge = Math.min(x - RIM, TRAY_W - RIM - x, y - RIM, TRAY_H - RIM - y);
    if (edge < 5) {
      // The bound edge of the mat, with a running stitch along it.
      c = mix(c, shade(p.b, 0.78), 0.75);
      if (edge > 2 && edge < 2.9 && (x + y) % 4 < 2) c = lift(c, 0.4);
      return c;
    }
    /*
      A printed road loop, round the outside of the mat so the middle —
      where the dice land — is plain pile. Printed, so it is a tint on the
      carpet rather than a slab of grey, with dashes down the middle and
      a zebra crossing on one side.
    */
    const cx = TRAY_W / 2;
    const cy = TRAY_H / 2;
    const sd = roundRect(x - cx, y - cy, 33, 78, 18);
    if (Math.abs(sd) < 5.4) {
      const ink = 0.62;
      let road = mix(c, [118, 124, 134], ink);
      if (Math.abs(sd) > 4.6) road = mix(road, [238, 236, 226], 0.55);
      const vertical = Math.abs(x - cx) * 78 > Math.abs(y - cy) * 33;
      const along = vertical ? y : x;
      if (Math.abs(sd) < 0.6 && (((along % 9) + 9) % 9) < 4.5) road = mix(road, [244, 238, 210], 0.7);
      if (x < cx && Math.abs(y - cy) < 7 && Math.abs(sd) < 4.4 && (((y % 3) + 3) % 3) < 1.5) {
        road = mix(road, [240, 238, 230], 0.65);
      }
      return road;
    }
    // Printed trees in the four corners inside the loop.
    for (const [tx, ty] of [[cx - 17, cy - 58], [cx + 17, cy - 58], [cx - 17, cy + 58], [cx + 17, cy + 58]] as const) {
      const d = Math.hypot(x - tx, y - ty);
      if (d < 5.2) {
        c = mix(c, d < 1.2 ? [150, 108, 72] : [96, 160, 104], 0.5);
        if (d > 3.8) c = shade(c, 0.9);
      }
    }
    return c;
  },
};

/**
 * Paint a surface.
 *
 * `wUnits` x `hUnits` is the picture in the painters' OWN coordinates,
 * where 20 units is one world unit — the density they were written at
 * and the one every feature size in them is tuned to (a 26-unit crystal
 * lattice, a 16-unit flagstone). `density` then decides how many real
 * texels each of those units gets, so the picture can be drawn finer
 * without a single painter changing what it draws.
 */
/**
 * Which surfaces also paint a height and a glow, and so carry a bump map
 * and an emissive map beside their colour (see SIDE). Only these; every
 * other painter is drawn exactly as it was, at exactly its old cost.
 */
const EXTRAS: Partial<Record<ArenaStructure, { bump: boolean; glow: boolean }>> = {
  snowFence: { bump: true, glow: false },
  adobe: { bump: true, glow: false },
  basalt: { bump: true, glow: true },
  logPile: { bump: true, glow: false },
  iceBlocks: { bump: true, glow: true },
  stalagmite: { bump: true, glow: true },
  cloudBalustrade: { bump: true, glow: false },
  airlock: { bump: true, glow: false },
  // Season 2 (21 Oct 2026): the carved sun is relief; the moonflowers glow.
  sunstone: { bump: true, glow: false },
  lanternWall: { bump: true, glow: true },
};

/** A picture as a texture, filtered the way every surface here is. */
function surfaceTexture(data: Uint8Array, w: number, h: number, srgb: boolean): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, w, h);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const byte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * A picture being painted a few rows at a time.
 *
 * David, 21 Oct 2026: "I want the arenas to load much faster when you
 * click on them to view them." A floor is 224 x 408 texels and takes 35
 * to 360ms to paint on a desktop — a second on a phone — and painting it
 * in one go is what the tap used to wait for. Painted in rows between
 * frames (textureCache.ts, paintInBackground), the same picture costs
 * the same in all but blocks nothing; the board shows a quick low-detail
 * floor meanwhile and swaps the finished one in. `step` paints up to
 * `rows` more rows and says whether the picture is done; the bytes are
 * exactly what `build` produces in one go.
 */
export interface SurfaceJob {
  readonly texture: THREE.DataTexture;
  /** How many rows there are to paint. */
  readonly rows: number;
  step(rows: number): boolean;
}

function startBuild(
  structure: ArenaStructure,
  paint: SurfacePaint,
  wUnits: number,
  hUnits: number,
  density: number,
  tray: boolean,
): SurfaceJob {
  const painter = PAINTERS[structure];
  const p = { a: rgb(paint.a), b: rgb(paint.b), accent: rgb(paint.accent) };
  const w = Math.round(wUnits * density);
  const h = Math.round(hUnits * density);
  const data = new Uint8Array(w * h * 4);
  /*
    The height and glow are kept at one texel per painter unit — half the
    colour's resolution on the tray. A bump that soft still rakes, and a
    glow is SUPPOSED to be soft; at full size the pair would add three
    quarters of a megabyte to every glowing floor for nothing visible.
  */
  const extra = EXTRAS[structure];
  const step = Math.max(1, Math.round(density));
  const ew = Math.ceil(w / step);
  const eh = Math.ceil(h / step);
  const bump = extra?.bump ? new Uint8Array(ew * eh * 4) : null;
  const glow = extra?.glow ? new Uint8Array(ew * eh * 4) : null;
  const texture = surfaceTexture(data, w, h, true);
  /*
    Carried on the colour texture rather than returned beside it, so the
    one cache entry (textureCache.ts) holds all three and they cannot be
    painted from different colours or evicted separately.
  */
  texture.userData.bump = bump ? surfaceTexture(bump, ew, eh, false) : null;
  texture.userData.glow = glow ? surfaceTexture(glow, ew, eh, true) : null;
  let y = 0;
  const paintRow = () => {
    for (let x = 0; x < w; x++) {
      SIDE.h = 0.5;
      SIDE.g = 0;
      const c = painter(x / density, y / density, p, tray);
      const i = (y * w + x) * 4;
      data[i] = byte(c[0]);
      data[i + 1] = byte(c[1]);
      data[i + 2] = byte(c[2]);
      data[i + 3] = 255;
      if ((bump || glow) && x % step === 0 && y % step === 0) {
        const j = ((y / step) * ew + x / step) * 4;
        if (bump) {
          const v = byte(SIDE.h * 255);
          bump[j] = v;
          bump[j + 1] = v;
          bump[j + 2] = v;
          bump[j + 3] = 255;
        }
        if (glow) {
          glow[j] = byte(SIDE.gr * SIDE.g);
          glow[j + 1] = byte(SIDE.gg * SIDE.g);
          glow[j + 2] = byte(SIDE.gb * SIDE.g);
          glow[j + 3] = 255;
        }
      }
    }
  };
  return {
    texture,
    rows: h,
    step(rows: number): boolean {
      const end = Math.min(h, y + rows);
      for (; y < end; y++) paintRow();
      if (y < h) return false;
      // Painted after the texture was made: tell the GPU to read it again.
      texture.needsUpdate = true;
      for (const m of [texture.userData.bump, texture.userData.glow]) if (m) m.needsUpdate = true;
      return true;
    },
  };
}

/**
 * The stand-in's resolution, as a fraction of the real one: a quarter
 * the texels each way, a sixteenth of the work, soft but the right
 * colours. On screen for well under a second.
 */
export const QUICK_DENSITY = 0.25;

/** The relief and glow painted alongside a surface, where it has them. */
export function surfaceExtras(t: THREE.Texture): {
  bump: THREE.DataTexture | null;
  glow: THREE.DataTexture | null;
} {
  return { bump: t.userData.bump ?? null, glow: t.userData.glow ?? null };
}

/** Both of a surface's maps, laid down the way its colour is. */
function matchExtras(t: THREE.DataTexture): void {
  for (const m of [t.userData.bump, t.userData.glow] as (THREE.DataTexture | null)[]) {
    if (!m) continue;
    m.wrapS = t.wrapS;
    m.wrapT = t.wrapT;
    m.repeat.copy(t.repeat);
    m.anisotropy = t.anisotropy;
  }
}

/** The tray floor: what the dice roll on. */
export function createTraySurface(
  structure: ArenaStructure,
  paint: SurfacePaint,
  world: [number, number],
  density = TRAY_DENSITY,
): THREE.DataTexture {
  const job = startTraySurface(structure, paint, world, density);
  job.step(job.rows);
  return job.texture;
}

/** The tray floor, to be painted in rows — see SurfaceJob. */
export function startTraySurface(
  structure: ArenaStructure,
  paint: SurfacePaint,
  world: [number, number],
  density = TRAY_DENSITY,
): SurfaceJob {
  /*
    ONE PICTURE, the shape of the tray.

    Marc, 27 Aug 2026: "make the floor of every arena one continuous
    picture and design because you can see the line in the middle where
    it's cut."

    There was a line, and this is where it came from. The floor was a
    square 128x128 picture laid down with `repeat` set to the tray's size
    over 6.4 world units — [0.875, 1.594]. Across the tray that is less
    than one copy, so nothing shows; DOWN it the picture runs out at 1.0
    and starts again from the top, and the join is a hard horizontal cut
    about six-tenths of the way along the floor. Every arena had it, in
    the same place, right where the dice land.

    A square picture cannot cover a 5.6 x 10.2 tray without either
    repeating or being stretched out of shape. So it is not square any
    more: the painter is asked for a picture of the tray's own
    proportions and it is laid down once, at repeat [1, 1]. No join, and
    nothing stretched, because the texels stay square in world space.
  */
  const job = startBuild(
    structure,
    paint,
    world[0] * UNITS_PER_WORLD,
    world[1] * UNITS_PER_WORLD,
    density,
    true,
  );
  const t = job.texture;
  // It covers the floor exactly once, so there is nothing to wrap, and
  // clamping stops the filter reaching round to the opposite edge.
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1, 1);
  /*
    The camera looks down the tray at a 17-degree tilt (cameraFit.ts), so
    the far half of the floor is squashed hard in one direction and not
    the other. That is exactly the case ordinary mipmapping handles
    badly: it picks one level for both axes, so the far end blurs along
    its length to avoid aliasing across it. Anisotropic filtering samples
    the two axes separately and is the fix. Eight is a request, not a
    promise — three.js clamps it to whatever the device can do.
  */
  t.anisotropy = 8;
  matchExtras(t);
  return job;
}

/** The ground outside the tray, out to the edge of the frame. */
export function createGroundSurface(
  structure: ArenaStructure,
  paint: SurfacePaint,
  repeat: number,
  density = 1,
): THREE.DataTexture {
  const job = startGroundSurface(structure, paint, repeat, density);
  job.step(job.rows);
  return job.texture;
}

/** The ground, to be painted in rows — see SurfaceJob. */
export function startGroundSurface(
  structure: ArenaStructure,
  paint: SurfacePaint,
  repeat: number,
  density = 1,
): SurfaceJob {
  /*
    The ground still tiles, and that is right. It reaches 26 world units
    where the tray reaches ten, it is mostly behind scenery, and one
    picture that size would be either enormous to paint or blurred to
    nothing. Its painters wrap at SIZE, so its joins really are seamless
    — which is what the tray's could never be at repeat 1.594.
  */
  const job = startBuild(structure, paint, SIZE, SIZE, density, false);
  const t = job.texture;
  t.repeat.set(repeat, repeat);
  matchExtras(t);
  return job;
}

/** Test-only: the painters, so a suite can measure what they produce. */
export function surfacePixels(
  structure: ArenaStructure,
  paint: SurfacePaint,
  tray = true,
): number[] {
  const painter = PAINTERS[structure];
  const p = { a: rgb(paint.a), b: rgb(paint.b), accent: rgb(paint.accent) };
  const out: number[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = painter(x, y, p, tray);
      out.push(
        Math.max(0, Math.min(255, Math.round(c[0]))),
        Math.max(0, Math.min(255, Math.round(c[1]))),
        Math.max(0, Math.min(255, Math.round(c[2]))),
      );
    }
  }
  return out;
}

