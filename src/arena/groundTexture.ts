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
 * The tray is the largest thing on screen, about 54 screen pixels to the
 * world unit against 20 texels — so each texel was covering nearly three
 * pixels and the floor was soft where it was not jagged. Half as many
 * again is what the faster hash pays for. Much more and a phone stalls
 * visibly the first time an arena opens, which is the very fault
 * textureCache.ts exists to avoid.
 */
const TRAY_DENSITY = 1;

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
  // Fallen leaves: proper leaf shapes, in the reds and golds a wood
  // turns, each with a midrib. David asked for the Autumn Woods floor to
  // look better — it was small dark dashes, which reads as grit.
  logPile: (x, y, p) => {
    const cell = 14;
    let c = mix(p.a, shade(p.a, 0.92), fbm(x, y, SIZE));
    // Two passes at different offsets, so leaves overlap the way a
    // drift of them does instead of sitting one to a cell.
    for (let pass = 0; pass < 2; pass++) {
      const ox = pass * 7;
      const oy = pass * 5;
      const row = Math.floor((y + oy) / cell);
      const rowOff = row % 2 === 0 ? 0 : cell / 2;
      const col = Math.floor((x + ox + rowOff) / cell);
      const h = hash(col + pass * 31, row + pass * 17);
      if (h < 0.42) continue;
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
  // Cave rock with crystal breaking through it. David: "make the crystal
  // cavern look less weird and more like crystals" — it was a scribble
  // of mineral veining that read as noise, so the rock is calm now and
  // the crystal is drawn as actual faceted shards catching the light.
  stalagmite: (x, y, p, tray) => {
    /*
      Marc, 28 Aug 2026, picking a direction off the design canvas: "I
      like the FloorGeode for the floor of the crystal cavern."

      So the floor IS the crystal now, rather than rock with crystal
      lying on it: the inside of a cracked geode, cut facets meeting edge
      to edge with nothing between them, about a third of them gemstone
      and the rest the cavern's own violet rock.

      The facets come from a jittered Voronoi — for each texel, the
      nearest of nine candidate sites owns it. Voronoi cells are convex
      polygons that tile without gaps, which is exactly what a cut
      surface is, and it means every edge falls out of the distances
      rather than being drawn. `d2 - d1`, the gap between the nearest and
      second-nearest site, is small only along a boundary, so the bright
      seam between facets is that number ramped — soft, and free.

      What this replaces was three goes at the OTHER idea: crystal
      objects scattered on rock. Long tapered blades radiating from a
      root read as a bird's footprint from above, and faceted hexagonal
      shards read better but still left most of the floor as flat wash.
      Cutting the whole surface into facets was the direction the family
      chose, and it is the one that makes the floor itself the feature.
    */
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

    const CELL = 11.5;
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
        const jx = (q + 0.15 + hash(q, r) * 0.7) * CELL;
        const jy = (r + 0.15 + hash(q + 41, r + 17) * 0.7) * CELL;
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

    const seed = hash(cq * 7 + 3, cr * 11 + 5);
    const gemmy = seed > 0.68;
    const base = gemmy
      ? mix(GEMS[Math.floor(hash(cq + 5, cr + 9) * GEMS.length) % GEMS.length], p.b, 0.34)
      : mix(p.a, p.b, hash(cq + 2, cr + 6));

    /*
      Each facet is a flat plane at its own angle, so it takes the light
      differently from the one beside it — which is the whole reason a
      field of polygons reads as CUT crystal rather than as camouflage.
      The tilt is measured from the facet's own centre, so one side of
      every cell is lit and the other falls away.
    */
    const tilt = ((x - cx) + (y - cy)) / CELL;
    let c = shade(base, 0.68 + Math.max(0, -tilt) * 0.72 + hash(cq + 13, cr + 3) * 0.18);

    // The seam where two facets meet, and the bright arris along it.
    const edge = d2 - d1;
    c = mix(c, shade(base, 0.4), smoothstep(1.5, 0.35, edge) * 0.6);
    c = mix(c, lift(base, gemmy ? 0.8 : 0.55), smoothstep(0.75, 0.08, edge) * 0.75);

    // A slow damp wash over the whole bed, so it is not evenly bright.
    return mix(c, shade(p.b, 0.72), smoothstep(0.45, 0.95, fbm(x * 0.35, y * 0.35, SIZE)) * 0.35);
  },

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
  // Moss with stepping stones worn through it, and the darker damp under
  // the shade. David asked for Glow Glade to look better; it was one
  // flat green with pale dots on it.
  mossStone: (x, y, p) => {
    /*
      Marc, 27 Aug 2026: "make the glow glade floor look better."

      It was a flat green with grey lumps on it and a scatter of white
      dots. Three things were wrong. The moss was one blob of noise, so
      it had colour but no TEXTURE — nothing at the scale of a leaf. The
      stones were near-circles with a soft rim, which at this size reads
      as mould rather than rock. And the glowing spores were single
      texels turned on by a hash: a lit pixel with nothing around it is
      not a glow, it is a dead pixel, and it is exactly what a floor
      "looking pixelated" means.

      Now: moss in three depths with a fine fibrous grain over it, stones
      that are lumpy rather than round and sit in their own shadow, and
      spores drawn as soft round lights with a halo.
    */
    const blob = fbm(x * 0.55, y * 0.55, SIZE);
    let c = mix(p.a, p.b, smoothstep(0.28, 0.72, blob));
    // Damp hollows, and the bright moss where light gets down.
    c = mix(c, shade(p.a, 0.6), smoothstep(0.35, 0.05, blob) * 0.7);
    c = mix(c, lift(p.b, 0.42), smoothstep(0.7, 0.95, blob) * 0.65);
    // A second, finer patchwork so the green is not one flat field.
    c = mix(c, lift(p.b, 0.22), smoothstep(0.55, 0.85, fbm(x * 1.6 + 31, y * 1.6, SIZE)) * 0.35);
    // The fibre of the moss itself, at the scale of a leaf.
    // Displaced by `blob`, which is already in hand, rather than by a
    // second fbm — that was eight more hash lookups on every texel of
    // the floor for a wobble nobody can see.
    const fibre = noise(x * 1.1, y * 1.1 + blob * 3, SIZE);
    c = mix(c, shade(c, 0.84), smoothstep(0.45, 0.85, fibre) * 0.5);
    c = mix(c, lift(c, 0.18), smoothstep(0.4, 0.08, fibre) * 0.4);

    const cell = 32;
    const col = Math.floor(x / cell);
    const row = Math.floor(y / cell);
    const jx = (hash(col, row) - 0.5) * 13;
    const jy = (hash(col + 5, row + 9) - 0.5) * 13;
    const radius = hash(col + 8, row + 6) > 0.42 ? 5 + hash(col + 2, row + 3) * 4 : -99;
    const sx = (((x % cell) + cell) % cell) - cell / 2 - jx;
    const sy = (((y % cell) + cell) % cell) - cell / 2 - jy;
    /*
      Lumpy, not round. The wobble is noise on the RADIUS rather than on
      the position, so a stone keeps one outline instead of being blurred
      into the moss the way adding noise to the distance did.
    */
    const wobble = (noise(sx * 0.55 + col * 7, sy * 0.55 + row * 7, SIZE) - 0.5) * 1.5;
    const stone = Math.hypot(sx, sy) - wobble;
    // Pale grey, barely tinted by the theme: the glade's accent is
    // another green, and a stone mixed a quarter into it came out DARKER
    // than the moss it was meant to sit proud of.
    const rock: Rgb = [170, 176, 167];
    // Its own shadow first, so the stone sits ON the moss.
    c = mix(c, shade(p.a, 0.66), smoothstep(radius + 3.5, radius + 0.5, stone) * 0.5);
    const body = mix(rock, p.accent, 0.12);
    c = mix(c, body, smoothstep(radius + 0.9, radius - 0.4, stone) * 0.96);
    // Lit from the upper left, with grain in the rock.
    const lit = -(sx + sy) / Math.max(1, radius);
    const on = smoothstep(radius + 0.4, radius - 1, stone);
    c = mix(c, lift(rock, 0.55), on * Math.max(0, lit) * 0.75);
    c = mix(c, shade(rock, 0.72), on * Math.max(0, -lit) * 0.5);
    c = mix(c, shade(c, 0.92), on * noise(x * 1.5, y * 1.5, SIZE) * 0.5);

    /*
      The glow. Two per lattice cell at most, drawn as a round light with
      a halo around it — a spore you can see is worth more than fifty
      single lit texels, which is what these were.
    */
    const gcell = 26;
    for (let k = 0; k < 2; k++) {
      const oz = k * 11;
      const gc = Math.floor((x + oz) / gcell);
      const gr = Math.floor((y + oz) / gcell);
      if (hash(gc + k * 31, gr + k * 17) < 0.72) continue;
      const gx = (((x + oz) % gcell) + gcell) % gcell - gcell / 2
        - (hash(gc + 2, gr + 4) - 0.5) * 11;
      const gy = (((y + oz) % gcell) + gcell) % gcell - gcell / 2
        - (hash(gc + 6, gr + 8) - 0.5) * 11;
      const d = Math.hypot(gx, gy);
      const glow: Rgb = [196, 246, 232];
      c = mix(c, glow, smoothstep(4.2, 0.9, d) * 0.32);
      c = mix(c, glow, smoothstep(1.5, 0.2, d) * 0.85);
    }
    return c;
  },

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
  // Ploughed earth in rows, straw trodden into it, and the green coming
  // through between the furrows. David: make the Sunny Farm "look better
  // and less simple" — it was flat dirt with two straws on it.
  picket: (x, y, p) => {
    // Furrows: long ridges running one way across the field.
    const wave = Math.sin((x * 0.32 + y * 0.06) + fbm(x, y, SIZE) * 3);
    let c = mix(p.a, p.b, fbm(x * 0.7, y * 0.7, SIZE));
    c = mix(c, shade(p.a, 0.78), smoothstep(-0.2, -1, wave) * 0.7);
    c = mix(c, lift(p.b, 0.3), smoothstep(0.3, 1, wave) * 0.5);
    // Clods turned up along the ridges.
    if (hash(x, y) > 0.955 && wave > 0) c = mix(c, shade(p.a, 0.7), 0.6);
    // Straw, lying along the furrows rather than scattered at random.
    for (let k = 0; k < 3; k++) {
      const cell = 15 + k * 6;
      const cx = (((x + k * 7) % cell) + cell) % cell - cell / 2;
      const cy = (((y + k * 11) % cell) + cell) % cell - cell / 2;
      const a = hash(Math.floor(x / cell) + k, Math.floor(y / cell)) * 0.9 - 0.45;
      const ux = cx * Math.cos(a) + cy * Math.sin(a);
      const uy = -cx * Math.sin(a) + cy * Math.cos(a);
      if (Math.abs(uy) < 0.6 && Math.abs(ux) < 5.5) c = mix(c, p.accent, 0.55);
    }
    return c;
  },

  // A living reef: sand between coral heads in half a dozen colours,
  // under the caustics. David asked for "more color and more coral" —
  // it was one teal mottle with a faint net of light on it.
  coralRim: (x, y, p) => {
    const r = Math.sin(x * 0.28 + fbm(x, y, SIZE) * 8) * 0.5 + 0.5;
    let c = mix(p.a, p.b, r);
    // Coral heads growing over the bottom, each its own colour.
    const REEF: Rgb[] = [
      [232, 122, 92], [232, 108, 158], [240, 186, 92],
      [150, 214, 168], [186, 132, 216], [244, 158, 120],
    ];
    for (let k = 0; k < 3; k++) {
      const cell = 21 - k * 4;
      const ox = k * 9;
      const row = Math.floor((y + ox) / cell);
      const col = Math.floor((x + ox * 2) / cell);
      const h = hash(col + k * 23, row + k * 11);
      if (h < 0.38) continue;
      const cx = (((x + ox * 2) % cell) + cell) % cell - cell / 2 + (h - 0.5) * 5;
      const cy = (((y + ox) % cell) + cell) % cell - cell / 2 + (hash(col + 3, row) - 0.5) * 5;
      const lump = fbm(x * 1.5 + k * 20, y * 1.5, SIZE) * 2.4;
      const rad = (cell * 0.3) * (0.6 + h * 0.7);
      const d = Math.hypot(cx, cy) + lump;
      if (d > rad) continue;
      const head = REEF[Math.floor(h * REEF.length * 0.999)];
      c = mix(c, head, 0.85);
      // Lit on the upper left, and the polyp texture over the top.
      c = mix(c, lift(head, 0.45), Math.max(0, -(cx + cy) / rad) * 0.5);
      c = mix(c, shade(head, 0.72), Math.max(0, (cx + cy) / rad) * 0.4);
      if (hash(x * 2, y * 2) > 0.6) c = mix(c, shade(head, 0.85), 0.25);
    }
    // Caustics over everything.
    const caustic = Math.abs(
      Math.sin(x * 0.14 + fbm(x, y, SIZE) * 5) * Math.sin(y * 0.12 - fbm(y, x, SIZE) * 5),
    );
    return mix(c, lift(p.b, 0.5), smoothstep(0.55, 0.95, caustic) * 0.55);
  },

  // A real rooftop: rolled felt with its seams, gravel ballast, tar
  // patches, and the chalk lines and hatches a roof carries. David asked
  // for Rooftop City to look better — it was grey felt and nothing else.
  parapet: (x, y, p) => {
    const roll = 26;
    const inY = ((y % roll) + roll) % roll;
    let c = mix(p.a, p.b, fbm(x, y, SIZE) * 0.7 + 0.15);
    if (inY < 1.6) c = shade(c, 0.8);
    // Patched repairs, darker than the felt around them.
    const patch = fbm(x * 0.5 + 40, y * 0.5, SIZE);
    c = mix(c, shade(p.a, 0.72), smoothstep(0.62, 0.78, patch) * 0.7);
    /*
      A painted hatch cover, a run of duct and a yellow safety line.

      Not in `p.accent`: the rooftop's accent is another grey within a few
      per cent of its felt, so the first version's hatches were invisible
      — the same trap the glade's stepping stones and the reef's caustics
      both fell into. A roof's fittings are painted BECAUSE they need to
      stand out from the roof.
    */
    /*
      One hatch, one duct run and one painted line per tile — not a grid
      of them. The first version repeated every 61 by 47 pixels, which on
      a 128 tile is five hatches, and five hatches in a lattice read as
      wallpaper rather than as the things on a roof.
    */
    if (y > 86 && y < 96) {
      // Galvanised duct, ribbed along its length.
      c = mix(c, [158, 166, 180], 0.7);
      if (((x % 5) + 5) % 5 < 1.4) c = shade(c, 0.82);
      if (y < 88 || y > 94) c = shade(c, 0.7);
    }
    if (x > 20 && x < 48 && y > 14 && y < 40) {
      const plate: Rgb = [196, 148, 62];
      c = mix(plate, lift(plate, 0.3), (x - 20) / 28);
      if (x < 23 || x > 45 || y < 17 || y > 37) c = shade(c, 0.72);
    }
    // The painted line that runs round the edge of every flat roof.
    if (x > 108 && x < 112) c = mix(c, [214, 176, 74], 0.5);
    // Grit.
    const g = hash(x, y);
    if (g > 0.93) c = mix(c, lift(p.b, 0.3), 0.5);
    else if (g < 0.08) c = shade(c, 0.9);
    return c;
  },

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

export const SURFACE_SIZE = SIZE;
