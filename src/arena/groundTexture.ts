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
    let c: Rgb = [36, 38, 52];
    // Street lamps along both kerbs, every eight units.
    const along = ix < ST ? iy : ix;
    const across = ix < ST ? ix : iy;
    const lamp = Math.hypot(((along % 8) + 8) % 8 - 4, Math.min(across, ST - across) - 0.4);
    c = mix(c, [255, 196, 110], smoothstep(2.6, 0.2, lamp) * 0.55);
    if (lamp < 0.5) c = [255, 226, 160];
    // A car: two headlights or two tail lights.
    const lane = Math.floor(along / 6);
    const ch = hash(lane + bx * 7, by * 5 + (ix < ST ? 1 : 2));
    if (ch > 0.8 && Math.abs((along % 6) - 3) < 1.1 && Math.abs(across - 2.5) < 1) {
      c = ch > 0.9 ? [255, 120, 110] : [250, 246, 226];
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
  // A lit skylight, or a dark plant box, on some roofs.
  const fx = hash(bx * 9 + qx, by * 9 + qy);
  if (Math.abs(ux - half * (0.3 + fx * 0.4)) < 1.4 && Math.abs(uy - half * (0.6 - fx * 0.3)) < 1.0) {
    c = fx > 0.5 ? [255, 214, 140] : shade(c, 0.6);
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
const PAINTERS: Record<ArenaStructure, SurfacePainter> = {
  /*
    Snow that reads as SNOW, not plaster. The 31 Aug 2026 skin review
    scored this floor 5 and 4 for the same fault twice over: the two
    floor tones sat a whisker apart, so the wind-drift fbm painted
    nothing, and the only accent on offer was the fence's BROWN cap, so
    the "ice sparkle" came out as pepper flecks — dark on white, the
    opposite of a glint. Blue in the shadows is the single strongest
    cue that white stuff is snow, so the cold tones are the painter's
    own (the way the aurora snowfield owns its night blue and the
    cavern owns its gems) and the timber accent stays on the fence.
  */
  snowFence: (x, y, p, tray) => {
    const shadow: Rgb = [186, 201, 222]; // #bac9de — snow-shadow blue
    const glint: Rgb = [236, 251, 255]; // ice glint, a breath of cyan

    // The tray is the swept, packed board; outside lies deep drift.
    // Packed snow is brighter and flatter, so the arena reads as a
    // cleared surface inside a snowfield, not one sheet of white.
    const depth = tray ? 0.65 : 1;
    let c = lift(p.a, tray ? 0.35 : 0.15);

    // Wind-scoured lobes, elongated down the board. The directional
    // fbm was always here; the review's point was that its two tones
    // were too close for it to show. Wider band, a real second tone.
    const scour = fbm(x + y * 0.3, y * 2.2, SIZE);
    c = mix(c, p.b, smoothstep(0.3, 0.78, scour) * depth);

    // Broad soft drift shadows at two scales, tinted cold, so the
    // field undulates instead of sitting flat. The first pass of this
    // used #cdd8e6 at a third strength and it was invisible on the
    // render — a shadow nobody can see is the old flat floor again.
    const big = noise(x / 30 + 7, y / 30 + 3, SIZE / 30);
    const mid = noise(x / 12 + 61, y / 12 + 23, SIZE / 12);
    c = mix(c, shadow, smoothstep(0.35, 0.88, big) * depth * 0.85);
    c = mix(c, mix(p.b, shadow, 0.6), smoothstep(0.5, 0.92, mid) * depth * 0.55);

    if (tray) {
      // One frozen puddle, swept clear: pale ice with faint cracks, a
      // landmark the dice visibly skid across. Painted flat sheen, not
      // a pit — the REAL frozen pond (the sink obstacle) is dark water
      // under a bank, so the two never read as the same thing. The
      // bounding box keeps the extra noise off texels nowhere near it.
      const dx = x - 34;
      const dy = y - 146;
      if (Math.abs(dx) < 27 && Math.abs(dy) < 21) {
        const r = Math.hypot(dx / 17, dy / 12.5);
        const wob = (noise(x / 9 + 91, y / 9 + 47, SIZE / 9) - 0.5) * 0.55;
        const pond = smoothstep(1.05 + wob, 0.8 + wob, r);
        if (pond > 0.02) {
          let ice: Rgb = mix(
            [208, 231, 246],
            [176, 206, 232],
            noise(x / 7 + 11, y / 7 + 5, SIZE / 7),
          );
          const seam = Math.abs(
            Math.sin((x + fbm(x, y, SIZE) * 7) * 0.55) +
              Math.sin((y - fbm(x + 37, y + 19, SIZE) * 6) * 0.4),
          );
          ice = mix(ice, [140, 176, 208], smoothstep(0.16, 0.02, seam) * 0.55);
          c = mix(c, ice, pond);
        }
        // The lip of swept snow banked around the ice.
        c = mix(c, [252, 254, 255], smoothstep(1.22 + wob, 1.02 + wob, r) * (1 - pond) * 0.6);
      }
    }

    // Ice sparkle — a glint is LIGHT, always brighter than the field.
    // Fine grains everywhere...
    if (hash(x, y) > 0.988) c = mix(c, glint, 0.8);
    // ...and a rarer, fatter glint — a full painter unit square, so it
    // survives being looked at from arm's length.
    if (hash(Math.floor(x) + 13, Math.floor(y) + 57) > 0.9965) c = mix(c, [255, 255, 255], 0.9);
    return c;
  },

  // Wind ripples in fine sand, running one way across the dunes.
  adobe: (x, y, p) => {
    const ripple = Math.sin((x * 0.9 + y * 0.35) * 0.42 + fbm(x, y, SIZE) * 5);
    let c = mix(p.a, p.b, (ripple + 1) / 2);
    c = mix(c, shade(p.a, 0.92), smoothstep(0.55, 0.85, fbm(x * 0.5, y * 0.5, SIZE)) * 0.4);
    if (hash(x * 3, y * 3) > 0.994) c = mix(c, p.accent, 0.5);
    return c;
  },

  // Cooled lava: a crust broken into plates with heat still in the cracks.
  basalt: (x, y, p) => {
    // Two warps at different scales, or the cracks come out as a regular
    // diamond lattice rather than as broken rock.
    const warp = fbm(x, y, SIZE) * 11 + noise(x / 3, y / 3, SIZE / 3) * 6;
    const warp2 = fbm(x + 37, y + 19, SIZE) * 13;
    const seam = Math.abs(Math.sin((x + warp) * 0.15) + Math.sin((y - warp2) * 0.12));
    let c = mix(p.a, p.b, fbm(x * 0.6, y * 0.6, SIZE));
    c = mix(c, p.accent, smoothstep(0.22, 0.02, seam) * 0.9);
    return mix(c, shade(c, 0.7), smoothstep(0.5, 0.2, seam) * 0.3);
  },

  // Fallen leaves, each one a small oval lying its own way.
  // Fallen leaves: proper leaf shapes, in the reds and golds a wood
  // turns, each with a midrib. David asked for the Autumn Woods floor to
  // look better — it was small dark dashes, which reads as grit.
  //
  // The drift is thinned INSIDE the walls. Painted at ground density the
  // board became a carpet of red and gold, and a red or orange die
  // landing on it had to be hunted for — the one thing a floor must not
  // do. Outside the walls the density is untouched: that is where the
  // arena's name lives.
  logPile: (x, y, p, tray) => {
    const cell = 14;
    let c = mix(p.a, shade(p.a, 0.92), fbm(x, y, SIZE));
    // Two passes at different offsets, so leaves overlap the way a
    // drift of them does instead of sitting one to a cell.
    for (let pass = 0; pass < (tray ? 1 : 2); pass++) {
      const ox = pass * 7;
      const oy = pass * 5;
      const row = Math.floor((y + oy) / cell);
      const rowOff = row % 2 === 0 ? 0 : cell / 2;
      const col = Math.floor((x + ox + rowOff) / cell);
      const h = hash(col + pass * 31, row + pass * 17);
      if (h < (tray ? 0.72 : 0.42)) continue;
      const lx = (((x + ox + rowOff) % cell) + cell) % cell - cell / 2 + (h - 0.5) * 5;
      const ly = (((y + oy) % cell) + cell) % cell - cell / 2 + (hash(col + 7, row + pass) - 0.5) * 5;
      const a = h * Math.PI * 2;
      const ux = lx * Math.cos(a) + ly * Math.sin(a);
      const uy = -lx * Math.sin(a) + ly * Math.cos(a);
      // A leaf: an ellipse drawn to a point at both ends.
      const t = Math.abs(ux) / 5.2;
      if (t > 1) continue;
      const width = 2.6 * (1 - t * t);
      if (Math.abs(uy) > width) continue;
      const leaf = mix(
        mix(p.b, p.accent, hash(col + 3, row + 5)),
        [196, 92, 40],
        hash(col + 11, row + 2) * 0.8,
      );
      c = mix(leaf, shade(leaf, 0.82), Math.abs(uy) / Math.max(width, 0.6) * 0.5);
      // The midrib.
      if (Math.abs(uy) < 0.55) c = shade(c, 0.82);
    }
    return c;
  },

  // Snow under the lights, with the lights painted ON it. This was a
  // riveted metal panel grid, and at the gameplay camera the whole thing
  // collapsed into one teal wash — "generic metal corridor at dusk", in
  // an arena called Frozen Lights with not one light in frame. The
  // aurora itself lives in the sky at z -23, which the camera never
  // sees, so its reflection is swept across the ground instead: broad
  // diagonal ribbons of green, cyan and a touch of magenta over pale
  // snow cut into blocks. The rivets are gone — they were two-texel dots
  // nobody could find.
  station: (x, y, p, tray) => {
    const cold: Rgb = [213, 234, 240]; // #d5eaf0 — snow under a night sky
    const cell = 32;
    const edge = gridEdge(x, y, cell);
    const bx = Math.floor(x / cell);
    const by = Math.floor(y / cell);
    // Per-block tone. The old hash * 0.5 + 0.25 band was too narrow to
    // survive the night rig; this runs the cold-white mix from 0.3 to
    // 0.75 so neighbouring blocks stay distinct after the lights dim it.
    // The cold-white lift is a TRAY thing. Outside, pulling the snow up
    // to near-white swamped the darker meadow the theme now sets, and
    // the whole arena sat in one value band — board, wall and snow all
    // the same pale grey-blue, which is why it read foggy.
    const block = hash(bx, by);
    let c = mix(
      mix(p.a, p.b, 0.3 + hash(bx + 7, by + 3) * 0.7),
      cold,
      tray ? 0.2 + block * 0.6 : 0.04 + block * 0.22,
    );

    // Wind-drifted snow — the snowfield's own drift, mixed toward cold
    // white. Deepest on the ground outside the tray, so the board stays
    // the flattest, most playable snow in frame.
    const drift = fbm(x + y * 0.3, y * 2.2, SIZE);
    c = mix(c, lift(cold, 0.6), smoothstep(0.4, 0.8, drift) * (tray ? 0.4 : 0.3));

    // Joints between the snow blocks — soft blue shadows, not grout —
    // with drift piled a shade brighter along each lip.
    const joint = smoothstep(2.4, 0.5, edge);
    c = mix(c, shade(mix(p.b, cold, 0.3), 0.82), joint * 0.6);
    c = mix(c, lift(cold, 0.5), smoothstep(6, 2.8, edge) * (1 - joint) * drift * 0.5);

    // The lights, reflected on the snow: three broad ribbons running
    // diagonally, warped by noise so they waver like curtains. Integer
    // wave counts per 128-unit tile, so the ground copies still join.
    const warp = fbm(x + 53, y + 17, SIZE);
    const TAU = Math.PI * 2;
    const green = Math.sin(((2 * x + y) / SIZE) * TAU + warp * 2.2);
    const cyan = Math.sin(((x + 2 * y) / SIZE) * TAU + 2.1 + warp * 2.8);
    const magenta = Math.sin(((2 * x - y) / SIZE) * TAU + 4.4 + warp * 1.8);
    /*
      Each ribbon is a broad graded wash with a brighter core, so it
      reads as a curtain of light rather than a hard painted stripe —
      and each is now scaled by where it falls. The drift above already
      dimmed on the tray; these did not, so the curtains washed over the
      play floor as strongly as the snow, and the board came out a hazy
      grey-green smear at almost the same value as everything else. The
      green wash sat in the same family as the green die, too.

      Quiet under the dice, stronger on the snow around them, which is
      where this painter's own note says the picture lives.
    */
    const lights = tray ? 0.35 : 1.4;
    c = mix(c, [59, 226, 148], (smoothstep(0.0, 0.85, green) * 0.42 + smoothstep(0.7, 0.98, green) * 0.18) * lights);
    c = mix(c, [96, 208, 236], (smoothstep(0.05, 0.9, cyan) * 0.32 + smoothstep(0.72, 0.98, cyan) * 0.14) * lights);
    c = mix(c, [224, 134, 220], smoothstep(0.3, 0.95, magenta) * 0.24 * lights);

    // Ice sparkle.
    if (hash(x, y) > 0.993) c = lift(c, 0.85);
    return c;
  },

  // Wet cave rock, minerals running through it in bands.
  // Cave rock with crystal breaking through it. David: "make the crystal
  // cavern look less weird and more like crystals" — it was a scribble
  // of mineral veining that read as noise, so the rock is calm now and
  // the crystal is drawn as actual faceted shards catching the light.
  stalagmite: (x, y, p, tray) => {
    /*
      The Crystal Cavern's floor IS the crystal — the inside of a cracked
      geode, cut faces meeting edge to edge with nothing between them,
      about a quarter of them gemstone and the rest violet rock.

      Chosen by the family on 28 Aug 2026, twice. First "I like the
      FloorGeode", then — after seeing it in the game — "actually I don't
      like the floor", and finally, from a second set, "I want the cut
      slabs". Same idea both times; the SIZE was the whole argument, and
      it is settled below where the cell size is set.

      What this replaced was three goes at the other idea entirely:
      crystal objects scattered on rock. Long tapered blades radiating
      from a root read as a bird's footprint from above; faceted hexagonal
      shards read better but still left most of the floor a flat wash.
      Cutting the whole surface is what makes the floor itself the
      feature rather than a background for things lying on it.
    */
    /*
      The gems. Hardcoded rather than taken from SurfacePaint, which
      carries only three colours and none of them bright — the cavern's
      accent is its wall cap, a muted violet. These are the arena's own
      crystal colours from themeData.ts, so the floor is cut from the
      same stone as the props standing around it.
    */
    const GEMS: Rgb[] = [
      [201, 138, 255], [163, 122, 232], [220, 174, 255],
      [127, 212, 232], [240, 214, 138],
    ];

    if (!tray) {
      /*
        Outside the tray: damp violet rock with crystal showing THROUGH
        it here and there, which is what the cavern looked like before
        the floor became a geode and is what keeps the board readable as
        a board. The facets belong on the thing you are playing on.
      */
      let g = mix(p.a, p.b, smoothstep(0.2, 0.8, fbm(x * 0.6, y * 0.6, SIZE)));
      g = mix(g, shade(p.a, 0.62), smoothstep(0.5, 0.9, fbm(x * 0.35, y * 0.35, SIZE)) * 0.5);
      const vein = Math.abs(fbm(x * 0.5 + 17, y * 0.5, SIZE) - 0.5);
      g = mix(g, lift(p.accent, 0.35), smoothstep(0.07, 0.01, vein) * 0.4);
      const chunk = hash(Math.floor(x / 19), Math.floor(y / 19));
      if (chunk > 0.86) {
        const bx = (((x % 19) + 19) % 19) - 9.5;
        const by = (((y % 19) + 19) % 19) - 9.5;
        g = mix(g, lift(p.accent, 0.5), smoothstep(4.5, 1.5, Math.hypot(bx, by)) * 0.55);
      }
      return mix(g, shade(g, 0.9), noise(x / 3, y / 3, SIZE / 3) * 0.4);
    }

    /*
      Marc, 28 Aug 2026, after seeing the first version in the game:
      "actually I don't like the floor" — then, from a set rendered
      through this very painter rather than drawn by hand, "I want the
      cut slabs."

      Same idea as before, three times the size. The first pass cut the
      floor into cells about half a world unit across, and a hundred
      small facets on a board is gravel, not crystal. At thirty painter
      units — a unit and a half of world — the board is a handful of big
      cut planes, which is what the inside of a geode actually looks like
      and what reads as CUT at the size a player sees it.

      Worth recording how that mistake got through: the first set of
      options were hand-drawn SVG illustrations, and an illustration
      flatters itself. The cell size that looked like bold faceting in a
      drawing came out as rubble from the real painter. Every option in
      the second set was rendered by this function at shipping size, and
      the difference was obvious at a glance.

      The facets come from a jittered Voronoi: for each texel, the
      nearest of nine candidate sites owns it. Voronoi cells are convex
      polygons that tile without gaps, which is exactly what a cut
      surface is, so the edges fall out of the distances rather than
      being drawn — `d2 - d1`, the gap between nearest and
      second-nearest, is small only along a boundary.
    */
    const CELL = 30;
    const gx = Math.floor(x / CELL);
    const gy = Math.floor(y / CELL);
    let d1 = 1e9;
    let d2 = 1e9;
    let cx = 0;
    let cy = 0;
    let cq = 0;
    let cr = 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const q = gx + ox;
        const r = gy + oy;
        const jx = (q + 0.2 + hash(q, r) * 0.6) * CELL;
        const jy = (r + 0.2 + hash(q + 41, r + 17) * 0.6) * CELL;
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

    const gemmy = hash(cq * 7 + 3, cr * 11 + 5) > 0.72;
    const base = gemmy
      // Pushed further into the rock than it used to be. At 0.42 a lit
      // lilac facet reached about #c38cf7 — the purple die's own colour,
      // at ten times the size — and a purple die landing on one
      // disappeared. The gems still read as gems; they just belong to
      // the cavern now instead of competing with the dice.
      ? mix(GEMS[Math.floor(hash(cq + 5, cr + 9) * GEMS.length) % GEMS.length], p.b, 0.68)
      : mix(p.a, p.b, hash(cq + 2, cr + 6) * 0.7);

    /*
      Each slab is a flat plane at its own angle, so it takes the light
      differently from the one beside it — the whole reason a field of
      polygons reads as CUT crystal rather than as camouflage. A face
      this big also shows its own grain, which a small facet never did.
    */
    const tilt = ((x - cx) * 0.7 + (y - cy)) / CELL;
    // Gain capped at 0.25 (was 0.5) so no facet ends up brighter than
    // the wall behind it.
    let c = shade(base, 0.8 + Math.min(0.25, Math.max(0, -tilt) * 0.5));
    c = mix(c, shade(base, 0.86), noise(x / 4 + cq * 9, y / 4 + cr * 5, SIZE / 4) * 0.35);

    // The seam where two slabs meet, and the bright arris along it.
    const edge = d2 - d1;
    c = mix(c, shade(base, 0.42), smoothstep(2.6, 0.5, edge) * 0.55);
    return mix(c, lift(base, 0.6), smoothstep(1.2, 0.1, edge) * 0.7);
  },

  // The Sky Kingdom: weathered marble blocks inside the castle, and
  // nothing but sky and cloud outside it. Two pictures on purpose, like
  // the Crystal Cavern's — the 31 Aug 2026 review scored the old single
  // grid 4/10 and 3/10 for the same fault twice: every tile was the same
  // white square, so the tray read as bathroom tile and the ground as a
  // swimming pool seen from above. A kingdom that floats does not stand
  // on pool tile; it stands on clouds.
  battlement: (x, y, p, tray) => {
    if (!tray) {
      /*
        The open sky under the castle. One low-frequency field places
        the cumulus; thresholding it gives soft-edged blobs, brightest
        at their middles. Sampling the SAME field a few units up the
        picture finds where the cloud overhead is thicker than here —
        which is exactly a blob's lower edge — and that edge is shaded
        with the blue-grey the theme hands in as its accent, so every
        cloud has a lit top and a shadowed belly instead of being a
        flat white sticker.
      */
      const field =
        noise(x / 40, y / 40, SIZE / 40) * 0.7 +
        noise(x / 13 + 37, y / 13 + 11, SIZE / 13) * 0.3;
      const above =
        noise(x / 40, (y - 8) / 40, SIZE / 40) * 0.7 +
        noise(x / 13 + 37, (y - 8) / 13 + 11, SIZE / 13) * 0.3;
      // Open air between the clouds, deeper blue where they thin out.
      let c = mix(p.b, p.a, noise(x / 16 + 7, y / 16 + 3, SIZE / 16) * 0.8);
      const body = smoothstep(0.52, 0.66, field);
      const core = smoothstep(0.64, 0.82, field);
      c = mix(c, lift(p.a, 0.8), body * 0.92);
      c = mix(c, [255, 255, 255], core);
      return mix(c, p.accent, body * smoothstep(0.005, 0.09, above - field) * 0.7);
    }
    /*
      The castle floor: marble blocks, cut square and long since walked
      on. Each block takes its own tone from a genuinely wide band —
      the old mix(a, b, hash) was invisible because a and b were one
      value step apart — gets fbm-warped veins of the cap's blue-grey,
      and a one-unit bevel, lit on the top-left and shaded on the
      bottom-right, so the grid reads as raised stone rather than as
      grout lines drawn on a flat slab. An old block now and then has
      lost a corner.
    */
    const cell = 16;
    const tx = Math.floor(x / cell);
    const ty = Math.floor(y / cell);
    const edge = gridEdge(x, y, cell);
    const h = hash(tx, ty);
    let c = mix(p.a, p.b, 0.12 + h * 0.88);
    // Marble veins, wandering with the noise and phase-shifted per
    // block so they never line up across a joint. Blue-grey drawn from
    // the DARK floor tone, not the accent — the accent is the cap,
    // which is nearly white, and veins of white on white are no veins.
    const vein = Math.abs(Math.sin(x * 0.3 + y * 0.11 + fbm(x, y, SIZE) * 9 + h * 19));
    c = mix(c, shade(p.b, 0.8), smoothstep(0.2, 0.03, vein) * 0.55);
    if (edge < 1) return shade(c, 0.66);
    const lx = ((x % cell) + cell) % cell;
    const ly = ((y % cell) + cell) % cell;
    if (lx < 2.2 || ly < 2.2) c = lift(c, 0.3);
    else if (lx > cell - 2.2 || ly > cell - 2.2) c = shade(c, 0.88);
    // The chipped corner. Which corner is the block's own business.
    const chip = hash(tx + 13, ty + 7);
    if (chip > 0.92) {
      const cx = Math.floor((chip - 0.92) * 50) % 2 ? cell - lx : lx;
      const cy = Math.floor((chip - 0.92) * 25) % 2 ? cell - ly : ly;
      if (cx + cy < 4.4) c = shade(c, 0.7);
    }
    return mix(c, shade(c, 0.94), noise(x / 2, y / 2, SIZE / 2));
  },

  // Regolith trodden into a hexagonal landing pad.
  // Regolith: grey dust pocked with craters, and the tracks of whatever
  // has driven over it. David asked for the Moon Base floor to look
  // better — it was a hexagonal wireframe, which reads as graph paper.
  airlock: (x, y, p) => {
    let c = mix(p.a, p.b, fbm(x, y, SIZE));
    c = mix(c, shade(p.a, 0.86), smoothstep(0.45, 0.8, fbm(x * 0.5, y * 0.5, SIZE)) * 0.5);
    // Craters, three sizes, each a dark bowl inside a lit rim.
    for (let k = 0; k < 3; k++) {
      const cell = [37, 23, 13][k];
      const radius = [9, 5.5, 3][k];
      const row = Math.floor((y + k * 11) / cell);
      const col = Math.floor((x + k * 7) / cell);
      const h = hash(col + k * 29, row + k * 13);
      if (h < 0.35) continue;
      const cx = (((x + k * 7) % cell) + cell) % cell - cell / 2 + (h - 0.5) * 6;
      const cy = (((y + k * 11) % cell) + cell) % cell - cell / 2 + (hash(col, row + 5) - 0.5) * 6;
      const r = radius * (0.6 + h * 0.6);
      const d = Math.hypot(cx, cy) + fbm(x * 2, y * 2, SIZE) * 1.2;
      if (d > r * 1.2) continue;
      c = mix(c, shade(p.a, 0.66), smoothstep(r, r * 0.55, d) * 0.8);
      c = mix(c, lift(p.b, 0.4), smoothstep(r * 0.78, r, d) * smoothstep(r * 1.2, r, d) * 0.9);
    }
    // The dust itself, fine and even.
    return mix(c, hash(x, y) > 0.5 ? lift(p.b, 0.25) : shade(p.a, 0.9), 0.06);
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
    const iso = Math.abs(fbm(x * 0.6 + 70, y * 0.6 + 20, SIZE) - 0.5);
    c = mix(c, shade(p.b, 0.6), smoothstep(0.012, 0.003, iso) * 0.45);
    c = mix(c, lift(c, 0.1), smoothstep(0.6, 0.8, fbm(x * 0.3 + 5, y * 0.3 + 50, SIZE)) * 0.5);
    const g = hash(x * 2.3, y * 1.9);
    if (g > 0.86) c = mix(c, lift(p.a, 0.32), 0.32);
    else if (g < 0.1) c = shade(c, 0.86);
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
function build(
  structure: ArenaStructure,
  paint: SurfacePaint,
  wUnits: number,
  hUnits: number,
  density: number,
  tray: boolean,
): THREE.DataTexture {
  const painter = PAINTERS[structure];
  const p = { a: rgb(paint.a), b: rgb(paint.b), accent: rgb(paint.accent) };
  const w = Math.round(wUnits * density);
  const h = Math.round(hUnits * density);
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = painter(x / density, y / density, p, tray);
      const i = (y * w + x) * 4;
      data[i] = Math.max(0, Math.min(255, c[0]));
      data[i + 1] = Math.max(0, Math.min(255, c[1]));
      data[i + 2] = Math.max(0, Math.min(255, c[2]));
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, w, h);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** The tray floor: what the dice roll on. */
export function createTraySurface(
  structure: ArenaStructure,
  paint: SurfacePaint,
  world: [number, number],
): THREE.DataTexture {
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
  const t = build(
    structure,
    paint,
    world[0] * UNITS_PER_WORLD,
    world[1] * UNITS_PER_WORLD,
    TRAY_DENSITY,
    true,
  );
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
  return t;
}

/** The ground outside the tray, out to the edge of the frame. */
export function createGroundSurface(
  structure: ArenaStructure,
  paint: SurfacePaint,
  repeat: number,
): THREE.DataTexture {
  /*
    The ground still tiles, and that is right. It reaches 26 world units
    where the tray reaches ten, it is mostly behind scenery, and one
    picture that size would be either enormous to paint or blurred to
    nothing. Its painters wrap at SIZE, so its joins really are seamless
    — which is what the tray's could never be at repeat 1.594.
  */
  const t = build(structure, paint, SIZE, SIZE, 1, false);
  t.repeat.set(repeat, repeat);
  return t;
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

