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

/** Value noise that wraps at `period`, so the tile has no seam. */
function noise(x: number, y: number, period: number): number {
  const wrap = (n: number) => ((n % period) + period) % period;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const h = (ix: number, iy: number) => hash(wrap(ix), wrap(iy));
  const top = h(x0, y0) + (h(x0 + 1, y0) - h(x0, y0)) * sx;
  const bot = h(x0, y0 + 1) + (h(x0 + 1, y0 + 1) - h(x0, y0 + 1)) * sx;
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

type SurfacePainter = (x: number, y: number, p: { a: Rgb; b: Rgb; accent: Rgb }) => Rgb;

/**
 * One painter per battlefield, keyed by what the place is built of.
 *
 * Keyed on the structure rather than on the arena id because the two are
 * already one to one (themeData.ts) and because it keeps the pairing
 * honest: a basalt-walled arena stands on cooled lava, a ship's hull
 * stands on deck planks.
 */
const PAINTERS: Record<ArenaStructure, SurfacePainter> = {
  // Packed snow, with wind-scoured drifts and a sparkle of ice.
  snowFence: (x, y, p) => {
    const drift = fbm(x + y * 0.3, y * 2.2, SIZE);
    let c = mix(p.a, p.b, smoothstep(0.35, 0.72, drift));
    c = mix(c, shade(p.b, 0.86), smoothstep(0.6, 0.9, noise(x / 3, y / 3, SIZE / 3)) * 0.35);
    if (hash(x, y) > 0.988) c = mix(c, p.accent, 0.8);
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
  logPile: (x, y, p) => {
    const cell = 11;
    const row = Math.floor(y / cell);
    const off = row % 2 === 0 ? 0 : cell / 2;
    const col = Math.floor((x + off) / cell);
    const h = hash(col, row);
    const lx = ((x + off) % cell) - cell / 2 + (h - 0.5) * 3;
    const ly = (y % cell) - cell / 2 + (hash(col + 7, row) - 0.5) * 3;
    const a = h * Math.PI;
    const ux = lx * Math.cos(a) + ly * Math.sin(a);
    const uy = -lx * Math.sin(a) + ly * Math.cos(a);
    let c = mix(p.a, shade(p.a, 0.9), fbm(x, y, SIZE));
    // Only about half the cells carry a leaf. Every cell carrying one
    // covered the floor edge to edge, and a floor of small dark marks
    // reads as grit, not as fallen leaves — it also fights the dice,
    // which are the thing on it that has to be read.
    if (hash(col + 11, row + 4) > 0.45 && Math.hypot(ux / 4.6, uy / 2.7) < 1) {
      c = mix(mix(p.b, p.accent, h), p.a, 0.25);
      if (Math.abs(uy) < 0.7) c = shade(c, 0.9);
    }
    return c;
  },

  // Riveted deck plating, the seams between panels picked out.
  station: (x, y, p) => {
    const edge = gridEdge(x, y, 32);
    let c = mix(p.a, p.b, hash(Math.floor(x / 32), Math.floor(y / 32)) * 0.5 + 0.25);
    c = mix(c, shade(p.a, 0.72), smoothstep(2.2, 0.5, edge));
    const rx = ((x % 32) + 32) % 32;
    const ry = ((y % 32) + 32) % 32;
    const rivet = Math.min(
      Math.hypot(rx - 4, ry - 4), Math.hypot(rx - 28, ry - 4),
      Math.hypot(rx - 4, ry - 28), Math.hypot(rx - 28, ry - 28),
    );
    return mix(c, p.accent, smoothstep(2.2, 0.9, rivet) * 0.8);
  },

  // Wet cave rock, minerals running through it in bands.
  stalagmite: (x, y, p) => {
    const warp = fbm(x, y, SIZE) * 14;
    const band = Math.sin((x * 0.35 + y * 0.85) * 0.16 + warp);
    let c = mix(p.a, p.b, (band + 1) / 2);
    // Mineral seams running through the rock, and the wet sheen on top
    // of them. Both lifted rather than tinted: the cavern's accent is
    // another purple, and purple on purple is a flat wash.
    c = mix(c, lift(p.b, 0.4), smoothstep(0.78, 1, band) * 0.6);
    c = mix(c, shade(p.a, 0.7), smoothstep(-0.78, -1, band) * 0.5);
    return mix(c, lift(c, 0.3), smoothstep(0.62, 0.9, noise(x / 5, y / 5, SIZE / 5)) * 0.35);
  },

  // Laid flagstone — the classic, kept for the one arena that is a castle.
  battlement: (x, y, p) => {
    const cell = 16;
    const tx = Math.floor(x / cell);
    const ty = Math.floor(y / cell);
    const edge = gridEdge(x, y, cell);
    const c = mix(p.a, p.b, hash(tx, ty));
    if (edge < 1) return shade(c, 0.72);
    return mix(c, shade(c, 0.94), noise(x / 2, y / 2, SIZE / 2));
  },

  // Regolith trodden into a hexagonal landing pad.
  airlock: (x, y, p) => {
    const u = x / 18;
    const v = (x * 0.5 + y * 0.866) / 18;
    const w = (x * 0.5 - y * 0.866) / 18;
    const e = (t: number) => Math.abs(t - Math.round(t));
    const near = Math.min(e(u), e(v), e(w));
    let c = mix(p.a, p.b, fbm(x, y, SIZE));
    c = mix(c, shade(p.a, 0.74), smoothstep(0.08, 0.02, near));
    if (hash(x, y) > 0.99) c = mix(c, p.accent, 0.6);
    return c;
  },

  // Wet sand with the tide's ripples and broken shell in it.
  driftwood: (x, y, p) => {
    const ripple = Math.sin(y * 0.34 + fbm(x, y, SIZE) * 7) * 0.5 + 0.5;
    let c = mix(p.a, p.b, ripple);
    c = mix(c, shade(p.a, 0.9), smoothstep(0.6, 0.95, fbm(x * 0.4, y * 0.4, SIZE)) * 0.5);
    if (hash(x * 2, y * 2) > 0.991) c = mix(c, p.accent, 0.85);
    return c;
  },

  // Iced squares, piped along their edges.
  gingerbread: (x, y, p) => {
    const cell = 21;
    const tx = Math.floor(x / cell);
    const ty = Math.floor(y / cell);
    const edge = gridEdge(x, y, cell);
    let c = (tx + ty) % 2 === 0 ? p.a : p.b;
    c = mix(c, p.accent, smoothstep(2.6, 0.6, edge));
    return mix(c, shade(c, 0.95), noise(x / 3, y / 3, SIZE / 3) * 0.5);
  },

  // Moss, with stepping stones worn through it.
  mossStone: (x, y, p) => {
    const blob = fbm(x * 0.55, y * 0.55, SIZE);
    let c = mix(p.a, p.b, smoothstep(0.34, 0.66, blob));
    /*
      Stepping stones, jittered and sized per cell. A fixed offset in a
      fixed cell gave a perfectly regular dot grid — polka dots, not a
      path. Cell 32 because it divides the 128 tile; 26 left a seam.
    */
    const cell = 32;
    const col = Math.floor(x / cell);
    const row = Math.floor(y / cell);
    const jx = (hash(col, row) - 0.5) * 13;
    const jy = (hash(col + 5, row + 9) - 0.5) * 13;
    const radius = hash(col + 8, row + 6) > 0.42 ? 5 + hash(col + 2, row + 3) * 4 : -99;
    const sx = (((x % cell) + cell) % cell) - cell / 2 - jx;
    const sy = (((y % cell) + cell) % cell) - cell / 2 - jy;
    const stone = Math.hypot(sx, sy) + fbm(x, y, SIZE) * 3;
    // Grey stone, not the theme's accent — the glade's accent is another
    // green, so the stepping stones vanished into the moss entirely.
    const rock: Rgb = [126, 132, 128];
    c = mix(c, mix(rock, p.accent, 0.25), smoothstep(radius + 2, radius, stone) * 0.95);
    // Moss creeping over each stone's edge.
    c = mix(
      c,
      shade(p.a, 0.72),
      smoothstep(radius, radius + 2, stone) * smoothstep(radius + 5, radius + 2, stone) * 0.6,
    );
    return mix(c, shade(c, 0.88), noise(x / 2, y / 2, SIZE / 2) * 0.45);
  },

  // Deck planks with the caulking black between them.
  shipHull: (x, y, p) => {
    const plank = 15;
    const row = Math.floor(y / plank);
    const inY = ((y % plank) + plank) % plank;
    let c = mix(p.a, p.b, hash(row, Math.floor(x / 42)) * 0.7 + 0.15);
    // Grain running the length of the plank.
    c = mix(c, shade(c, 0.9), noise(x / 6, y * 2, SIZE / 6) * 0.55);
    if (inY < 1.4 || inY > plank - 1.4) c = mix(c, p.accent, 0.45);
    // The butt joints where one plank ends and the next begins.
    if (Math.abs((((x + row * 17) % 42) + 42) % 42) < 1.2) c = mix(c, p.accent, 0.35);
    return c;
  },

  // Bare earth with straw trodden into it.
  picket: (x, y, p) => {
    let c = mix(p.a, p.b, fbm(x * 0.7, y * 0.7, SIZE));
    for (let k = 0; k < 2; k++) {
      const cell = 19 + k * 7;
      const cx = ((x + k * 7) % cell) - cell / 2;
      const cy = ((y + k * 11) % cell) - cell / 2;
      const a = hash(Math.floor(x / cell) + k, Math.floor(y / cell)) * Math.PI;
      const ux = cx * Math.cos(a) + cy * Math.sin(a);
      const uy = -cx * Math.sin(a) + cy * Math.cos(a);
      if (Math.abs(uy) < 0.7 && Math.abs(ux) < 5) c = mix(c, p.accent, 0.5);
    }
    return c;
  },

  // Rippled seabed, lighter where the water is shallower.
  coralRim: (x, y, p) => {
    const r = Math.sin(x * 0.28 + fbm(x, y, SIZE) * 8) * 0.5 + 0.5;
    let c = mix(p.a, p.b, r);
    /*
      Caustics: the net of light the water's surface throws on the bottom.
      They are LIGHT by definition, so they are lifted toward white — the
      first version tinted toward the theme's accent, which for the reef
      is a darker teal than the seabed, and painted the sunlight in
      shadow.
    */
    const caustic = Math.abs(
      Math.sin(x * 0.14 + fbm(x, y, SIZE) * 5) * Math.sin(y * 0.12 - fbm(y, x, SIZE) * 5),
    );
    c = mix(c, lift(p.b, 0.5), smoothstep(0.55, 0.95, caustic) * 0.8);
    c = mix(c, shade(p.a, 0.78), smoothstep(0.3, 0.05, caustic) * 0.35);
    return c;
  },

  // Rolled roofing felt, gravelled, with the seams showing.
  parapet: (x, y, p) => {
    const roll = 26;
    const inY = ((y % roll) + roll) % roll;
    let c = mix(p.a, p.b, fbm(x, y, SIZE) * 0.7 + 0.15);
    if (inY < 1.6) c = shade(c, 0.8);
    // Grit.
    const g = hash(x, y);
    if (g > 0.93) c = mix(c, lift(p.b, 0.3), 0.5);
    else if (g < 0.08) c = shade(c, 0.9);
    return c;
  },

  // A printed play mat: soft squares with a road drawn on it.
  blocks: (x, y, p) => {
    const cell = 22;
    const tx = Math.floor(x / cell);
    const ty = Math.floor(y / cell);
    const edge = gridEdge(x, y, cell);
    let c = (tx + ty) % 2 === 0 ? p.a : p.b;
    c = mix(c, shade(c, 0.9), smoothstep(2, 0.4, edge));
    // The felt of the mat itself.
    c = mix(c, shade(c, 0.93), noise(x / 2, y / 2, SIZE / 2) * 0.5);
    if (hash(x * 5, y * 5) > 0.995) c = mix(c, p.accent, 0.6);
    return c;
  },
};

function build(structure: ArenaStructure, paint: SurfacePaint): THREE.DataTexture {
  const painter = PAINTERS[structure];
  const p = { a: rgb(paint.a), b: rgb(paint.b), accent: rgb(paint.accent) };
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = painter(x, y, p);
      const i = (y * SIZE + x) * 4;
      data[i] = Math.max(0, Math.min(255, c[0]));
      data[i + 1] = Math.max(0, Math.min(255, c[1]));
      data[i + 2] = Math.max(0, Math.min(255, c[2]));
      data[i + 3] = 255;
    }
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

/** The tray floor: what the dice roll on. */
export function createTraySurface(
  structure: ArenaStructure,
  paint: SurfacePaint,
  repeat: [number, number],
): THREE.DataTexture {
  const t = build(structure, paint);
  t.repeat.set(repeat[0], repeat[1]);
  return t;
}

/** The ground outside the tray, out to the edge of the frame. */
export function createGroundSurface(
  structure: ArenaStructure,
  paint: SurfacePaint,
  repeat: number,
): THREE.DataTexture {
  const t = build(structure, paint);
  t.repeat.set(repeat, repeat);
  return t;
}

/** Test-only: the painters, so a suite can measure what they produce. */
export function surfacePixels(structure: ArenaStructure, paint: SurfacePaint): number[] {
  const painter = PAINTERS[structure];
  const p = { a: rgb(paint.a), b: rgb(paint.b), accent: rgb(paint.accent) };
  const out: number[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = painter(x, y, p);
      out.push(
        Math.max(0, Math.min(255, Math.round(c[0]))),
        Math.max(0, Math.min(255, Math.round(c[1]))),
        Math.max(0, Math.min(255, Math.round(c[2]))),
      );
    }
  }
  return out;
}

export const SURFACE_SIZE = SIZE;
