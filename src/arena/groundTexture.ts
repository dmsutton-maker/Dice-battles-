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
 * One painter per battlefield, keyed by what the place is built of.
 *
 * Keyed on the structure rather than on the arena id because the two are
 * already one to one (themeData.ts) and because it keeps the pairing
 * honest: a basalt-walled arena stands on cooled lava, a ship's hull
 * stands on deck planks.
 */
const PAINTERS: Record<ArenaStructure, SurfacePainter> = {
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

  // The glade: a mown clearing inside the wall, dusk moss with stepping
  // stones and glowing spores outside it. Two pictures on purpose.
  mossStone: (x, y, p, tray) => {
    /*
      Marc, 27 Aug 2026: "make the glow glade floor look better." Then
      the 31 Aug 2026 review scored the result 3/10 twice over, for the
      same two faults. Everything — board, wall, ground — sat in one
      narrow band of forest green, so the arena boundary vanished; and
      the stepping stones INSIDE the tray were pale grey blobs the size
      and value of a die face, which is a fight the floor must never
      pick with the dice.

      So the two surfaces split, like the Crystal Cavern's did. The TRAY
      is the clearing: a mown lawn in light spring green, banded the way
      a lawn is, with nothing on it that could be mistaken for a die.
      The GROUND outside is the glade at dusk: moss pulled down toward
      the teal of the sky, stepping stones that sit in their own contact
      shadow — moved out here, where no die can stand beside them — and
      the glow the arena is named for: spores in two colours and two
      sizes, each a soft halo of light, which only reads as light
      because the moss under it went dark.
    */
    if (tray) {
      // Mow bands at two widths, running the length of the tray. The
      // wide ones are near-square with a soft edge — a sine alone
      // spends most of its time between the two tones and the banding
      // vanished into the grain the first time round.
      const wide = Math.sin((x + 6) * (Math.PI / 28));
      let c = mix(p.b, p.a, smoothstep(-0.45, 0.45, wide));
      // Graded, not banded. A hard half-wave at 0.7 darkened every 16
      // painter units into stripes you could not unsee, and the green
      // die sat on them. smoothstep rolls the edge off and the depth
      // comes down to a hint of a mow line.
      const fine = Math.sin(x * (Math.PI / 8));
      c = mix(c, shade(c, 0.9), smoothstep(-0.3, 0.6, fine) * 0.25);
      // Patches where the grass grows thicker, so the lawn is not paper.
      const blob = fbm(x * 0.5, y * 0.5, SIZE);
      c = mix(c, lift(p.b, 0.16), smoothstep(0.62, 0.9, blob) * 0.3);
      c = mix(c, shade(p.a, 0.93), smoothstep(0.38, 0.1, blob) * 0.3);
      // The blades themselves, at leaf scale.
      const grain = noise(x * 1.8, y * 1.8 + blob * 2, SIZE);
      c = mix(c, shade(c, 0.88), smoothstep(0.55, 0.9, grain) * 0.45);
      return mix(c, lift(c, 0.1), smoothstep(0.35, 0.05, grain) * 0.4);
    }

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
  },

  /*
    Pirate Cove: a deck on the board, a shore around it.

    Two faults, both found on 6 Sep 2026. The planks ran ACROSS the
    short axis in short staggered courses with strong seams, so the
    deck read as a chocolate brick wall rather than as boards. And the
    painter ignored its `tray` flag, so the surrounding ground got the
    same deck treatment — a ship beached on nothing, which is a wooden
    crate on a warehouse floor, and there was no cove anywhere in
    Pirate Cove.

    So the boards now run the LONG axis in 64-unit lengths (64 and 16
    both divide the 128-unit ground tile, so nothing seams at the
    repeat), and outside the walls is rippled sand with shell flecks.
    The hull IS the board; the shore is what it is beached on.
  */
  shipHull: (x, y, p, tray) => {
    if (!tray) {
      // Wet sand, the adobe ripple turned across the other diagonal so
      // the shore does not read as the same dune field as the desert.
      const ripple = Math.sin((y * 0.9 + x * 0.35) * 0.42 + fbm(x, y, SIZE) * 5);
      let c = mix(p.a, p.b, (ripple + 1) / 2);
      c = mix(c, shade(p.a, 0.92), smoothstep(0.55, 0.85, fbm(x * 0.5, y * 0.5, SIZE)) * 0.4);
      // Shells and pebbles, in the deck's own gold so the two surfaces
      // still belong to one arena.
      if (hash(x * 3, y * 3) > 0.9955) c = mix(c, p.accent, 0.55);
      if (hash(x * 3 + 41, y * 3 + 17) > 0.9975) c = mix(c, [244, 238, 224], 0.7);
      return c;
    }
    const plank = 16;
    const row = Math.floor(x / plank);
    const inX = ((x % plank) + plank) % plank;
    let c = mix(p.a, p.b, hash(row, Math.floor(y / 64)) * 0.7 + 0.15);
    // Grain running the length of the plank — now the y axis.
    c = mix(c, shade(c, 0.9), noise(y / 6, x * 2, SIZE / 6) * 0.55);
    if (inX < 1.4 || inX > plank - 1.4) c = mix(c, p.accent, 0.45);
    // The butt joints where one plank ends and the next begins.
    if (Math.abs((((y + row * 17) % 64) + 64) % 64) < 1.2) c = mix(c, p.accent, 0.35);
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

  /*
    A living reef: coral heads on a bed of rippled sand, under a caustic
    web. The 31 Aug 2026 skin review scored the first pass 5 and 4, all
    for the same set of faults: the heads were soft-edged uniform discs
    ("confetti, not coral") floating on flat teal with no sand and no
    contact shadow, the caustics were invisible under them, and — worst
    for THIS game — the tray was tiled wall to wall with pastel blobs at
    roughly die-face size, the single hardest background for reading
    settled pastel dice.

    So the painter uses its `tray` flag now. On the tray the head
    probability fades with distance from the walls, so coral survives as
    a ring hugging the rim and the middle opens into pale rippled sand
    where the caustics finally read — the dice land on sand, not on
    camouflage. Outside, the reef stays wall to wall but gains a lattice
    of double-size heads so it reads as coral heads, not gravel.
  */
  coralRim: (x, y, p, tray) => {
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
  },

  // A real rooftop: rolled felt with its seams, gravel ballast, tar
  // patches, and the chalk lines and hatches a roof carries. David asked
  // for Rooftop City to look better — it was grey felt and nothing else.
  parapet: (x, y, p, tray) => {
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
    /*
      The fittings belong on the ROOF, not on the world around it.

      This painter used to ignore its `tray` flag, so the duct, the
      hatch and the safety line were drawn on the outside ground too —
      which tiles every 128 units, printing long pale bands and a yellow
      line across the whole surround. Rooftop City read as a street with
      a zebra crossing and a centre line. Outside now gets felt seams,
      patches and grit only, and the arena reads as a roof.
    */
    if (tray) {
      if (y > 168 && y < 178 && x > 16 && x < 78) {
        // Galvanised duct, ribbed along its length. Moved from mid-board
        // (y 86-96) to the near end, and no longer spanning the full
        // width — a full-width ribbed grey band under a near-top-down
        // camera reads as a crossing however it is coloured. Ribs at
        // every 3 units rather than 5, so they read as ribs, not dashes.
        c = mix(c, [158, 166, 180], 0.7);
        if (((x % 3) + 3) % 3 < 1.1) c = shade(c, 0.82);
        if (y < 170 || y > 176) c = shade(c, 0.7);
        // Capped ends, so the run stops rather than being cut off.
        if (x < 19 || x > 75) c = shade(c, 0.62);
      }
      if (x > 20 && x < 48 && y > 14 && y < 40) {
        const plate: Rgb = [196, 148, 62];
        c = mix(plate, lift(plate, 0.3), (x - 20) / 28);
        if (x < 23 || x > 45 || y < 17 || y > 37) c = shade(c, 0.72);
      }
      // The painted line that runs round the edge of every flat roof.
      if (x > 108 && x < 112) c = mix(c, [214, 176, 74], 0.5);
    }
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
  for (let y = 0; y < h; y++) {
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
  }
  const texture = surfaceTexture(data, w, h, true);
  /*
    Carried on the colour texture rather than returned beside it, so the
    one cache entry (textureCache.ts) holds all three and they cannot be
    painted from different colours or evicted separately.
  */
  texture.userData.bump = bump ? surfaceTexture(bump, ew, eh, false) : null;
  texture.userData.glow = glow ? surfaceTexture(glow, ew, eh, true) : null;
  return texture;
}

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
  matchExtras(t);
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
  matchExtras(t);
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

