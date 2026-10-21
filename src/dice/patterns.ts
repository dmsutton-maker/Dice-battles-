import * as THREE from 'three';
import { cachedTexture } from '../arena/textureCache';
import { BUBBLE, FishPlace, goldfishAt, Rgb, waterAt } from './goldfish';
export type { Rgb } from './goldfish';

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
  // The Supporter die: a gold compass rose on teal (19 Oct 2026).
  | 'supporterCompass'
  | 'neon'
  | 'grain'
  | 'bubbles'
  | 'frost'
  | 'wood'
  | 'marble'
  | 'granite'
  | 'sheen'
  | 'satin'
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
  | 'slate'
  | 'ocean'
  // Ivory, 31 Aug 2026 — the default die shipped as a flat pure-white
  // square, the one skin whose material name delivered nothing at all.
  | 'ivory'
  // Full-colour painters (see COLOR_PAINTERS):
  | 'volleyball'
  | 'watermelon'
  | 'pizza'
  | 'donut'
  | 'rainbow'
  | 'galaxy'
  | 'camo'
  | 'tartan'
  // Blossom, 31 Aug 2026 — it shipped as a plain pink cube, the one
  // skin in the set whose name promised a picture it did not have.
  | 'blossom'
  // Lavender, 31 Aug 2026 — the other flat cube whose name promised a
  // plant. Sprigs of the plant itself: green stems, purple bud spikes.
  | 'lavender'
  | 'embers'
  | 'ice';

const SIZE = 64;

/**
 * Once round the four sides of a die, in sheet pixels.
 *
 * David, 18 Oct 2026: "make all the dice have a continuous flowing design
 * instead of the same design copied and pasted to every side." The four
 * sides are painted as four consecutive squares of one strip (see
 * DIE_FACE_SLOTS), so the strip has to come back to where it started when
 * it reaches the far side: every painter that is not drawn per face must
 * repeat across RING — and only across RING, not across one square, or
 * the four sides are the same picture again. That is why the noise below
 * wraps here rather than at SIZE, and why the cell sizes of the dotted and
 * hexagonal designs are chosen to fit a whole number of times round it.
 */
const RING = SIZE * 4;

/** A remainder that is never negative — the strip runs below y = 0 too. */
const mod = (v: number, m: number) => ((v % m) + m) % m;

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

/**
 * A painter is asked for a SHEET position (x, y): a point of the strip
 * that runs round the four sides, or of its continuation over the top and
 * bottom edges. Every sheet position is a point on the die (sheetToCube),
 * and since 21 Oct 2026 nothing is painted per face: light, motifs and
 * materials alike are functions of where on the die they are.
 */
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
 *
 * It wraps at RING, not SIZE, since 18 Oct 2026. Wrapping at one square
 * made every square of the sheet the same picture, so a marble die had one
 * slab of marble printed on each of its sides; wrapping once round the
 * die gives four different sides that still close up round the back.
 */
function hashCell(ix: number, iy: number): number {
  return Math.abs((Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453) % 1);
}

export function wrappedNoise(x: number, y: number, period: number): number {
  const cells = RING / period;
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
 * `periods` must all DIVIDE the ring (RING), which is why this takes
 * periods rather than a frequency multiplier. Scaling the coordinate
 * instead — `wrappedNoise(x * 1.6, ...)` — silently breaks the wrap,
 * because the lattice only repeats when x advances by a whole ring; a
 * WHOLE-number multiplier is the one safe kind, since it just goes round
 * more than once. Displacing the
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

/*
  ── The die as a solid ──────────────────────────────────────────────

  The sheet is laid out so the four sides are four squares of one strip
  (y 0..64), and the top and bottom are painted as the strip carrying on
  over each top and bottom edge — see dieFaceSampler. So every sheet
  point is also a point ON THE CUBE, and a design that belongs to a real
  round object — the seam of a baseball, the panels of a football — can
  be drawn on the cube itself and come out continuous over every edge
  and every corner, with no seam left anywhere.
*/

/** Each side's outward normal and the way its x runs, in strip order. */
const SIDE_FRAMES: readonly (readonly [readonly number[], readonly number[]])[] = [
  [[0, 0, 1], [1, 0, 0]], // +Z, the front
  [[1, 0, 0], [0, 0, -1]], // +X
  [[0, 0, -1], [-1, 0, 0]], // -Z
  [[-1, 0, 0], [0, 0, 1]], // -X
];

/**
 * The point on the cube a sheet position stands for, in texels from the
 * die's centre (a face is 64 across, so the cube runs -32..32).
 *
 * Inside the strip it is a point on that side. Above it, it is the top
 * reached by carrying straight on over that side's top edge, and below
 * it the bottom — the same unfolding dieFaceSampler paints the top and
 * bottom from, so a sheet painter and a solid one agree everywhere.
 */
export function sheetToCube(x: number, y: number): [number, number, number] {
  const sx = mod(x, RING);
  const k = Math.min(3, Math.floor(sx / SIZE));
  const [n, t] = SIDE_FRAMES[k];
  const along = sx - k * SIZE + 0.5 - SIZE / 2;
  const c = y + 0.5;
  const up = Math.max(0, Math.min(SIZE, c)) - SIZE / 2;
  // How far past the top or bottom edge, across the cap; capped at a
  // whole face so anything further stays on the cube.
  const over = Math.min(SIZE, c > SIZE ? c - SIZE : c < 0 ? -c : 0);
  const out = SIZE / 2 - over;
  return [n[0] * out + t[0] * along, up, n[2] * out + t[2] * along];
}

/**
 * How far a cube point is from a plane through the die's centre, measured
 * ACROSS THE FACE the point is on, in texels.
 *
 * `g` is the plane's value at the point and `grad` its gradient. The face
 * is the one whose axis the point is furthest along; dropping that axis
 * from the gradient leaves its slope along the face, and value over slope
 * is the distance to where it crosses zero. Exact for a plane, and very
 * nearly so for the gently curved seams below.
 */
function acrossFace(P: readonly number[], g: number, grad: readonly number[]): number {
  const ax = Math.abs(P[0]);
  const ay = Math.abs(P[1]);
  const az = Math.abs(P[2]);
  const gx = ax >= ay && ax >= az ? 0 : grad[0];
  const gy = ay > ax && ay >= az ? 0 : grad[1];
  const gz = az > ax && az > ay ? 0 : grad[2];
  return g / Math.max(1e-6, Math.hypot(gx, gy, gz));
}

const norm3 = (v: readonly number[]) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot3 = (a: readonly number[], b: readonly number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/*
  The seam of a tennis ball or a baseball, wrapped round the die.

  A real seam is one closed curve that splits the ball into two identical
  halves. The cube's version winds round the body diagonal (1,1,1),
  rising and falling three times — a smoothed copy of the zig-zag of six
  edges that cuts a cube into two identical three-sided halves. It is
  phased to swing AWAY from each face's centre, so it never runs under a
  colour sticker: it crosses every side once, through the corner region
  the sticker leaves showing.
*/
const SEAM_AXIS = norm3([1, 1, 1]);
const SEAM_E1 = norm3([1, -1, 0]);
const SEAM_E2 = norm3([1, 1, -2]);
/**
 * How far the seam swings either side of the flat hexagon, as tan(lat).
 * At 0 it would cross each side 22.6px from the middle, under the
 * sticker's rim; at 0.2 it hugged the bevels and the sides looked blank.
 * 0.09 puts it about 27px out along the diagonal, on the flat of the face.
 */
const SEAM_SWING = 0.09;

/**
 * A seam's frame: the body diagonal it winds round and two axes across
 * it. The cube has four body diagonals, so four such curves exist, each
 * crossing every side through a different corner; the basketball and
 * the Neon die wind two of them round the die at once.
 */
type SeamFrame = { axis: readonly number[]; e1: readonly number[]; e2: readonly number[] };
const SEAM_FRAME: SeamFrame = { axis: SEAM_AXIS, e1: SEAM_E1, e2: SEAM_E2 };
/**
 * The same curve round the (1, -1, 1) diagonal. `e1` is chosen so the
 * swing still pushes the curve AWAY from every face's centre (the sign of
 * sin 3phi at the centres is what decides it; see seamAt).
 */
const SEAM_FRAME_B: SeamFrame = (() => {
  const axis = norm3([1, -1, 1]);
  const e1 = norm3([-1, -1, 0]);
  const e2 = norm3([
    axis[1] * e1[2] - axis[2] * e1[1],
    axis[2] * e1[0] - axis[0] * e1[2],
    axis[0] * e1[1] - axis[1] * e1[0],
  ]);
  return { axis, e1, e2 };
})();

/**
 * Signed distance from the seam in texels across the face, and where
 * along it the point is (an angle round the die's diagonal, -PI..PI).
 * The raw seam value `g` comes back too, for designs that want bands of
 * it rather than one line (the volleyball's panels).
 */
function seamAt(
  P: readonly number[],
  swing = SEAM_SWING,
  frame: SeamFrame = SEAM_FRAME,
): { off: number; along: number; g: number } {
  const a = dot3(P, frame.e1);
  const b = dot3(P, frame.e2);
  const h = dot3(P, frame.axis);
  const r2 = Math.max(1e-6, a * a + b * b);
  // f = r sin(3 phi), written in a and b so the gradient comes easily.
  const num = 3 * a * a * b - b * b * b;
  const f = num / r2;
  const fa = (6 * a * b * r2 - num * 2 * a) / (r2 * r2);
  const fb = ((3 * a * a - 3 * b * b) * r2 - num * 2 * b) / (r2 * r2);
  const g = h + swing * f;
  const grad = [0, 1, 2].map((i) => frame.axis[i] + swing * (fa * frame.e1[i] + fb * frame.e2[i]));
  return { off: acrossFace(P, g, grad), along: Math.atan2(b, a), g };
}

/*
  A football's panels, on the die.

  A football is a truncated icosahedron: twelve pentagons where an
  icosahedron's corners were, twenty hexagons where its faces were. Each
  panel is a flat face of that solid, and a point belongs to whichever
  face the ray from the centre reaches first — the largest n·p / r, with
  r the distance of that face from the centre. Two neighbouring panels
  meet along a plane through the centre, so the seam between them is
  exactly a straight line on each side of the die, and nothing breaks
  at the edges or corners because it is all one ball.
*/
const PHI = (1 + Math.sqrt(5)) / 2;
const SOCCER_PANELS: readonly (readonly [number, number, number, boolean])[] = (() => {
  const panels: [number, number, number, boolean][] = [];
  // Pentagons: the icosahedron's twelve corners. Hexagons: the
  // dodecahedron's twenty, which sit over the icosahedron's faces.
  // Hexagons are 1/2.2673 of the way out, pentagons 1/2.3274 — the two
  // face distances of a truncated icosahedron with unit edges.
  const add = (v: number[], pent: boolean) => {
    const n = norm3(v);
    const w = pent ? 2.2673 / 2.3274 : 1;
    panels.push([n[0] * w, n[1] * w, n[2] * w, pent]);
  };
  const cyc = (a: number, b: number, c: number) => [
    [a, b, c],
    [b, c, a],
    [c, a, b],
  ];
  for (const s1 of [-1, 1]) {
    for (const s2 of [-1, 1]) {
      for (const v of cyc(0, s1, s2 * PHI)) add(v, true);
      for (const v of cyc(0, s1 / PHI, s2 * PHI)) add(v, false);
    }
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) add([sx, sy, sz], false);
  return panels;
})();

/**
 * Which football panel a cube point is on, and how far it is from that
 * panel's seam, in texels across the face.
 */
function soccerPanelAt(P: readonly number[]): { pent: boolean; seam: number; centre: number } {
  let best = -Infinity;
  let second = -Infinity;
  let bi = 0;
  let si = 0;
  for (let i = 0; i < SOCCER_PANELS.length; i++) {
    const v = SOCCER_PANELS[i];
    const s = v[0] * P[0] + v[1] * P[1] + v[2] * P[2];
    if (s > best) {
      second = best;
      si = bi;
      best = s;
      bi = i;
    } else if (s > second) {
      second = s;
      si = i;
    }
  }
  const a = SOCCER_PANELS[bi];
  const b = SOCCER_PANELS[si];
  const m = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const len = Math.hypot(P[0], P[1], P[2]);
  return {
    pent: a[3],
    seam: acrossFace(P, best - second, m),
    // How squarely the point faces its panel's middle: 1 at the middle.
    centre: best / (len * Math.hypot(a[0], a[1], a[2])),
  };
}

/*
  ── Painting on the cube itself ─────────────────────────────────────

  David, 21 Oct 2026: "Make sure EVERY DICE has a continuous pattern that
  flows on every side of it." Until now a third of the skins were one
  picture stamped on each side — a pizza per side, a compass per side —
  because their motif was drawn at particular positions on a square.
  These helpers let a painter put a motif on the DIE instead: a sticker
  stuck on one face can be folded over an edge onto the next, so a
  pepperoni, a lemon slice or a goldfish can lie across an edge and
  come out whole, and a design built from them is one design round the
  whole die with no side blank and nothing copied.
*/

/** Each face's outward normal and its texture's u and v axes, in three.js face order. */
export const FACE_FRAMES: readonly { n: readonly number[]; u: readonly number[]; v: readonly number[] }[] = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] }, // +X
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] }, // -X
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] }, // +Y
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] }, // -Y
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, // +Z
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] }, // -Z
];

/** Which face a cube point is on: the axis it is furthest along. */
export function cubeFace(P: readonly number[]): number {
  const ax = Math.abs(P[0]);
  const ay = Math.abs(P[1]);
  const az = Math.abs(P[2]);
  if (ax >= ay && ax >= az) return P[0] >= 0 ? 0 : 1;
  if (ay >= az) return P[1] >= 0 ? 2 : 3;
  return P[2] >= 0 ? 4 : 5;
}

/**
 * Where a cube point lands on face `f`, laid flat: its (u, v) in that
 * face's own texels from the face's centre. A point on the face itself
 * is simply projected; a point on a neighbouring face is FOLDED over
 * the edge the two share, the way the strip folds over the top and
 * bottom edges — so a flat drawing centred on `f` carries on over its
 * edges without a break. A point on the opposite face is out of reach
 * and returns null.
 */
export function unfoldOnto(P: readonly number[], f: number): [number, number] | null {
  const F = FACE_FRAMES[f];
  const g = cubeFace(P);
  const h = dot3(P, F.n);
  let u = dot3(P, F.u);
  let v = dot3(P, F.v);
  if (g !== f) {
    const G = FACE_FRAMES[g];
    const gu = dot3(G.n, F.u);
    const gv = dot3(G.n, F.v);
    if (gu === 0 && gv === 0) return null; // the opposite face
    const past = SIZE / 2 - h;
    u += gu * past;
    v += gv * past;
  }
  return [u, v];
}

/** A hash of a 3D lattice point, 0..1. */
function hash3(ix: number, iy: number, iz: number): number {
  return Math.abs((Math.sin(ix * 127.1 + iy * 311.7 + iz * 74.7) * 43758.5453) % 1);
}

/**
 * Value noise in THREE dimensions, sampled at a point on the cube.
 *
 * The strip's noise (wrappedNoise) is continuous round the four sides
 * and over the top and bottom edges, but the top and bottom are each
 * painted from four sides' continuations that meet along the cap's
 * diagonals, and there two different stretches of the strip meet. Noise
 * of the point's place IN SPACE has no such join: the same point is
 * the same point however the sheet reached it, so a swirl or a mottle
 * built from this is seamless over every edge and every diagonal.
 */
export function cubeNoise(P: readonly number[], period: number): number {
  const gx = Math.floor(P[0] / period);
  const gy = Math.floor(P[1] / period);
  const gz = Math.floor(P[2] / period);
  const ease = (t: number) => t * t * (3 - 2 * t);
  const sx = ease(P[0] / period - gx);
  const sy = ease(P[1] / period - gy);
  const sz = ease(P[2] / period - gz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const x00 = lerp(hash3(gx, gy, gz), hash3(gx + 1, gy, gz), sx);
  const x10 = lerp(hash3(gx, gy + 1, gz), hash3(gx + 1, gy + 1, gz), sx);
  const x01 = lerp(hash3(gx, gy, gz + 1), hash3(gx + 1, gy, gz + 1), sx);
  const x11 = lerp(hash3(gx, gy + 1, gz + 1), hash3(gx + 1, gy + 1, gz + 1), sx);
  return lerp(lerp(x00, x10, sy), lerp(x01, x11, sy), sz);
}

/** Octaves of cubeNoise, centred on zero, like fbm. */
function cubeFbm(P: readonly number[], periods: number[], weights: number[]): number {
  let sum = 0;
  let total = 0;
  for (let i = 0; i < periods.length; i++) {
    sum += (cubeNoise(P, periods[i]) - 0.5) * 2 * weights[i];
    total += weights[i];
  }
  return sum / total;
}

/** A per-texel speck that is the same speck from every side: hashed by the point's place in space. */
function cubeSpeck(P: readonly number[]): number {
  return hash3(Math.round(P[0] * 2), Math.round(P[1] * 2), Math.round(P[2] * 2));
}

/**
 * A flat drawing stuck on one face of the die, which may hang over an
 * edge onto a neighbour. `u, v` is its centre in that face's texels from
 * the face's centre, `rot` turns it, `reach` is how far from its centre
 * it can paint, and `h` is a hash of its own for size and colour.
 */
export interface Sticker {
  face: number;
  u: number;
  v: number;
  rot: number;
  reach: number;
  h: number;
  /** Which of a painter's motifs this is, when it scatters more than one. */
  kind: number;
}

/** A sticker and where a sample point falls on it, in the sticker's own frame. */
type StickerHit = { s: Sticker; lx: number; ly: number };

/**
 * A set of stickers over the die, indexed by face so a sample only looks
 * at the stickers that could reach it: those on its own face, and those
 * on a neighbouring face that hang over the shared edge.
 */
export class StickerSheet {
  private readonly byFace: Sticker[][] = [[], [], [], [], [], []];

  constructor(stickers: readonly Sticker[]) {
    const half = SIZE / 2;
    for (const s of stickers) {
      this.byFace[s.face].push(s);
      const F = FACE_FRAMES[s.face];
      for (let g = 0; g < 6; g++) {
        if (g === s.face) continue;
        const G = FACE_FRAMES[g];
        const gu = dot3(G.n, F.u);
        const gv = dot3(G.n, F.v);
        if (gu === 0 && gv === 0) continue;
        // Distance from the sticker's centre to the edge it shares with g.
        const toEdge = half - (gu * s.u + gv * s.v);
        if (toEdge < s.reach) this.byFace[g].push(s);
      }
    }
  }

  /** Every sticker under a cube point, nearest centre first. */
  hits(P: readonly number[]): StickerHit[] {
    const out: StickerHit[] = [];
    for (const s of this.byFace[cubeFace(P)]) {
      const uv = unfoldOnto(P, s.face);
      if (!uv) continue;
      const dx = uv[0] - s.u;
      const dy = uv[1] - s.v;
      if (Math.abs(dx) > s.reach || Math.abs(dy) > s.reach) continue;
      const c = Math.cos(s.rot);
      const n = Math.sin(s.rot);
      out.push({ s, lx: dx * c + dy * n, ly: -dx * n + dy * c });
    }
    if (out.length > 1) out.sort((a, b) => Math.hypot(a.lx, a.ly) - Math.hypot(b.lx, b.ly));
    return out;
  }
}

/**
 * Stickers scattered over the die, the same number on every face so no
 * side is left bare, each kept clear of the colour sticker in the
 * middle of its face and of every corner of the die — a round drawing
 * folded over a corner would have nowhere to put its third quarter.
 * They may hang over an edge, which is the point. Deterministic: the
 * shelf and the table must show the same die.
 */
export function scatterStickers(
  seed: number,
  perFace: number,
  reach: number,
  /** The least distance between two centres, in texels. */
  gap: number,
  /** How far outside the colour sticker a centre must sit. */
  clear = reach * 0.6,
  /**
   * How far from every corner of the die a centre must sit. A drawing
   * folded over a corner loses the quarter that would lie beyond both
   * edges, so a round motif keeps its whole reach clear; a long thin one
   * can come closer.
   */
  cornerClear = reach,
  /** The motifs to deal out, in turn, on each face: see Sticker.kind. */
  kinds: readonly number[] = [0],
): Sticker[] {
  const out: Sticker[] = [];
  const half = SIZE / 2;
  const pos3 = stickerPoint;
  for (let face = 0; face < 6; face++) {
    let placed = 0;
    for (let k = 0; k < 400 && placed < perFace; k++) {
      const h1 = hashCell(seed + face * 97 + k * 3, seed * 7 + 1);
      const h2 = hashCell(seed + face * 97 + k * 3, seed * 7 + 2);
      const h3 = hashCell(seed + face * 97 + k * 3, seed * 7 + 3);
      const s: Sticker = {
        face,
        u: (h1 - 0.5) * 2 * half,
        v: (h2 - 0.5) * 2 * half,
        rot: h3 * Math.PI * 2,
        reach,
        h: hashCell(seed + face * 97 + k * 3, seed * 7 + 4),
        kind: kinds[placed % kinds.length],
      };
      if (Math.hypot(s.u, s.v) < STICKER_RADIUS + clear) continue;
      if (Math.hypot(half - Math.abs(s.u), half - Math.abs(s.v)) < cornerClear) continue;
      const p = pos3(s);
      let crowded = false;
      for (const o of out) {
        const q = pos3(o);
        if (Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < gap) {
          crowded = true;
          break;
        }
      }
      if (crowded) continue;
      out.push(s);
      placed++;
    }
  }
  return out;
}

/** A sticker's centre on the die, in texels from the die's centre. */
export function stickerPoint(s: Sticker): number[] {
  const F = FACE_FRAMES[s.face];
  const half = SIZE / 2;
  return [0, 1, 2].map((i) => F.n[i] * half + F.u[i] * s.u + F.v[i] * s.v);
}

/**
 * Stickers on a staggered lattice over every side, each nudged by up to
 * `jitter` texels so the rows do not read as a grid. Cells must divide
 * the side; a centre pushed past an edge belongs to the next side and is
 * dropped, since that side has its own lattice.
 */
function latticeStickers(seed: number, cell: number, jitter: number, reach: number): Sticker[] {
  const out: Sticker[] = [];
  const n = Math.round(SIZE / cell);
  for (let face = 0; face < 6; face++) {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const h1 = hashCell(seed + face * 53 + c, r * 7 + 1);
        const h2 = hashCell(seed + face * 53 + c, r * 7 + 2);
        const u = -SIZE / 2 + (c + 0.5 + (r % 2) * 0.5) * cell + (h1 - 0.5) * 2 * jitter;
        const v = -SIZE / 2 + (r + 0.5) * cell + (h2 - 0.5) * 2 * jitter;
        if (Math.abs(u) > SIZE / 2 || Math.abs(v) > SIZE / 2) continue;
        if (Math.hypot(u, v) < STICKER_RADIUS - reach) continue;
        out.push({ face, u, v, rot: 0, reach, h: hashCell(seed + face * 53 + c, r * 7 + 3), kind: 0 });
      }
    }
  }
  return out;
}

/**
 * The seam curve as a pair of light bands round the die — what gives
 * gold, silver, copper, ruby, amethyst and the satin dice their shine.
 *
 * A polished die drawn unlit has to have its light painted in, and it
 * used to be painted per side: one diagonal bar on each face, placed by
 * the face's own coordinates, so the highlight stopped dead at every
 * edge. Now the light is one sweep round the whole die: a band of it
 * follows the seam curve (seamAt), which runs round the die through a
 * corner of every side and never under a sticker, and a small second
 * glint sits in the opposite corner — the ring near the far corners of
 * the die's diagonal. Both are functions of the point IN SPACE, so the
 * band turns the edges and corners unbroken, and every one of the six
 * sides catches the light.
 */
function sweepOfLight(
  P: readonly number[],
  /** Width of the bright core and of the glow round it, in texels. */
  core: number,
  glow: number,
  coreStrength: number,
  glowStrength: number,
  /** The second glint: its width and strength. */
  second: number,
  secondStrength: number,
): number {
  const { off } = seamAt(P);
  const g = dot3(P, SEAM_AXIS);
  // The far corners: 45 along the diagonal reaches the three faces round
  // the +++ corner and the three round the --- corner, as a small
  // triangle at each; every side gets one.
  const far = Math.abs(g) - 45;
  const main =
    Math.exp(-Math.pow(off / core, 2)) * coreStrength + Math.exp(-Math.pow(off / glow, 2)) * glowStrength;
  const corner = Math.exp(-Math.pow(far / second, 2)) * secondStrength;
  return main + corner;
}

/** The thirty-two patterns painted in full colour rather than through a mask. */
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
  // Lemon Slice, 21 Oct 2026: peel, pith and flesh are three tones.
  | 'citrus'
  | 'slate' | 'ocean'
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
  // The Supporter die, 19 Oct 2026: gold rope, gold points, and the
  // sticker as the compass's heart — three golds and a teal deepening
  // outward, which a one-ink mask cannot draw.
  | 'supporterCompass'
  // Neon, 20 Oct 2026: the first die sold on its own for real money.
  | 'neon'
  | 'patches' | 'bands' | 'diamonds' | 'tigerStripes' | 'honeycomb'
  // Cookie, 19 Oct 2026: a chocolate chunk is dark with a lit shoulder
  // and a glint, over golden dough that goes toasted — four colours,
  // and a mask's one ink made the chunks read as splats of mud.
  | 'cookie'
  // Bubbles joined them on 27 Aug: a soap film is iridescent, and one
  // ink cannot be iridescent.
  | 'bubbles'
  // Blossom, 31 Aug 2026: a cherry flower is white petals, a pink
  // blush at their base and a GOLD heart — three colours a mask's one
  // ink cannot mix.
  | 'blossom'
  // Lavender, 31 Aug 2026: a sprig is a GREEN stem under PURPLE buds —
  // two hues on a lilac shell, which is one more than a mask has.
  | 'lavender'
  // Fish, 31 Aug 2026: the mask version was mid-blue fish on light-blue
  // water, and at die scale the whole school vanished. A goldfish is
  // ORANGE with a white eye — two hues a blue mask cannot reach.
  | 'fish'
  // Embers, 29 Sep 2026, for the Fire dice — flames on every side since
  // 30 Sep: gold, amber, orange and red over a dark ember ground.
  | 'embers'
  // Ice, 30 Sep 2026, for the Ice dice: facets of pale blue, deeper
  // blue in the cracks, white where they catch the light.
  | 'ice';
type MaskPatternId = Exclude<PatternId, 'plain' | ColorPatternId>;

/*
  The circuit board's traces, laid on the die itself.

  Each colour sticker is a chip, with eight pins round it; every pin's
  trace jogs outward and runs to the nearest edge of the die, where it
  meets the matching trace of the next side coming the other way — so
  each of the twelve edges carries two traces across it, and the chips
  are wired to one another. Round every corner of the die a third trace
  turns the corner on each of its three sides. The layout is the same on
  every side and mirror-symmetric about every edge, which is what lets
  it meet itself across edges whose texture runs the other way.
*/
/**
 * One run of the circuit's wiring on a side, as a polyline in texels
 * from the side's centre. The same twelve runs are on every side.
 *
 *  - `pin`: from a chip's pin out to an edge of the die, where the next
 *    side's matching run comes the other way, so the two make one wire
 *    from chip to chip. `edge` says which edge it reaches: `v` is the
 *    edge at v = ±SIZE/2, `u` the edge at u = ±SIZE/2.
 *  - `corner`: in from one edge, round a via, out to the other — one of
 *    the three pieces of the loop round that corner of the die.
 *
 * Exported for circuitPulse.ts, which runs the pulses along them.
 */
export interface CircuitRoute {
  kind: 'pin' | 'corner';
  su: 1 | -1;
  sv: 1 | -1;
  edge: 'u' | 'v';
  points: readonly (readonly [number, number])[];
}
export const CIRCUIT_ROUTES: readonly CircuitRoute[] = (() => {
  const out: CircuitRoute[] = [];
  const H = SIZE / 2;
  for (const su of [-1, 1] as const) {
    for (const sv of [-1, 1] as const) {
      // The pin at the top (or bottom) of the chip: out, jog outward, then to the edge.
      out.push({ kind: 'pin', su, sv, edge: 'v', points: [[su * 9, sv * 23], [su * 9, sv * 26], [su * 13, sv * 26], [su * 13, sv * H]] });
      // The pin at the side of the chip, the same the other way round.
      out.push({ kind: 'pin', su, sv, edge: 'u', points: [[su * 23, sv * 9], [su * 26, sv * 9], [su * 26, sv * 13], [su * H, sv * 13]] });
      // Round the corner: in from the v edge, turn at the via, out to the u edge.
      out.push({ kind: 'corner', su, sv, edge: 'v', points: [[su * 24, sv * H], [su * 24, sv * 24], [su * H, sv * 24]] });
    }
  }
  return out;
})();

interface TraceSegment {
  face: number;
  a: readonly [number, number];
  b: readonly [number, number];
}
const CIRCUIT_TRACES: readonly TraceSegment[] = (() => {
  const out: TraceSegment[] = [];
  for (let face = 0; face < 6; face++) {
    for (const route of CIRCUIT_ROUTES) {
      for (let i = 1; i < route.points.length; i++) out.push({ face, a: route.points[i - 1], b: route.points[i] });
    }
  }
  return out;
})();

/** Pads at the pins, dots at the jogs and vias at the corner turns: (u, v, radius, hole). */
const CIRCUIT_PADS: readonly (readonly [number, number, number, number])[] = (() => {
  const out: [number, number, number, number][] = [];
  for (const su of [-1, 1]) {
    for (const sv of [-1, 1]) {
      out.push([su * 9, sv * 23, 2.2, 0], [su * 23, sv * 9, 2.2, 0]);
      out.push([su * 13, sv * 26, 1.5, 0], [su * 26, sv * 13, 1.5, 0]);
      out.push([su * 24, sv * 24, 2.1, 0.8]);
    }
  }
  return out;
})();

/** How far a cube point is from the nearest trace, in texels. */
function traceDistance(P: readonly number[]): number {
  const f = cubeFace(P);
  let best = Infinity;
  for (const t of CIRCUIT_TRACES) {
    if (t.face !== f) continue;
    const uv = unfoldOnto(P, f);
    if (!uv) continue;
    best = Math.min(best, segDist(uv[0], uv[1], t.a[0], t.a[1], t.b[0], t.b[1]));
  }
  return best;
}

const PAINTERS: Record<MaskPatternId, Painter> = {
  /**
   * Zebra stripes — bent, tapered and soft-edged.
   *
   * This was `Math.floor((x + y) / 8) % 2` — perfectly regular 45-degree
   * bands, every one the same width, dead straight, returning a hard 0
   * or 1 with no ramp at all. It was the only painter in the file with
   * no antialiasing, so the edges were raw pixel staircases, and it read
   * as a barber pole or a rugby shirt rather than as an animal. A real
   * zebra's stripes bend, swell and come to points.
   *
   * Three changes, each borrowed from a painter that already worked:
   * warp the stripe coordinate through the tiling fbm the way `marble`
   * does, band it through a smoothstep ramp the way `wood` does, and
   * swell the band width along its length with a slow wrapped noise.
   * Used only by the zebra skin, so there is nothing else to keep happy.
   */
  stripes: (x, y) => {
    const warp =
      fbm(x, y, [32, 16], [1, 0.45]) * 11 + fbm(x + 23, y + 7, [16, 8], [1, 0.4]) * 3.5;
    const bands = 4;
    const phase = ((((x + y + warp) * bands) / (SIZE * 2)) % 1 + 1) % 1;
    // How wide the dark band runs HERE — slow along the stripe, so each
    // one swells and thins instead of being a ruled line.
    const swell = 0.34 + wrappedNoise(x - y + 40, x + y, 32) * 0.22;
    const edge = 0.055;
    return (
      smoothstep(0.5 - swell - edge, 0.5 - swell + edge, phase) *
      (1 - smoothstep(0.5 + swell - edge, 0.5 + swell + edge, phase))
    );
  },

  // Evenly spaced dots on a staggered grid.
  spots: (x, y) => {
    const cell = 16;
    const row = Math.floor(y / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;
    const cx = mod(x + offset, cell) - cell / 2;
    const cy = mod(y, cell) - cell / 2;
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
  /*
    Three later fixes, all found by looking at the render beside Frost:

    - `cell = 21` does not divide the 64px tile, so the pattern wrapped
      a pixel short. SIZE / 4 does.
    - The shape test returned a hard 0 or 1, so every point was a
      staircase, which showed badly next to Frost's cleanly-ramped arms.
      It is supersampled 3x3 and averaged now, as `blossom` is.
    - Nine identical upright stars in perfect rows and columns read as
      wallpaper, not as a night sky. Alternate rows are offset by half a
      cell, and each star takes a small size and rotation jitter from a
      hash of its own row and column, the way `frost` does.
  */
  stars: (x, y) => {
    const cell = SIZE / 4;
    const row = Math.floor(y / cell);
    // A quarter cell along, so no star is centred on an edge of the die
    // and no cell boundary lies along one (20 Oct 2026).
    const offset = (row % 2 === 0 ? 0 : cell / 2) + cell / 4;
    // Wrapped once round the die, so the star the strip ends on is the
    // star it started with.
    const col = mod(Math.floor((x + offset) / cell), RING / cell);
    const h = hashCell(col + 3, row + 11);
    const spin = (hashCell(col + 17, row + 5) - 0.5) * 1.2;
    // Small enough that there is night sky between them: at 0.82-1.12
    // the stars crowded into each other and the sky disappeared.
    const size = 0.6 + h * 0.24;

    const points = 5;
    const sector = (Math.PI * 2) / points;
    const half = sector / 2;
    const INNER = 0.42;

    // 3x3 supersample: without it the five thin points are a staircase.
    let hit = 0;
    for (let sy = 0; sy < 3; sy++) {
      for (let sx = 0; sx < 3; sx++) {
        const px = x + (sx - 1) / 3;
        const py = y + (sy - 1) / 3;
        const cx = ((((px + offset) % cell) + cell) % cell - cell / 2) / (cell / 2);
        const cy = ((((py % cell) + cell) % cell) - cell / 2) / (cell / 2);
        const r = Math.hypot(cx, cy) / size;
        if (r > 1) continue;
        // +PI/2 stands the star upright rather than resting on a point.
        const a = Math.atan2(cy, cx) + Math.PI / 2 + spin;
        const folded = ((a % sector) + sector) % sector;
        const t = Math.abs(folded - half) / half;
        if (r <= (INNER + (1 - INNER) * t) * 0.95) hit++;
      }
    }
    return hit / 9;
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
    const offset = mod(row, 2) === 0 ? 0 : cell / 2;
    // The column counts the row's offset, as the flake's centre does.
    // Without it every flake on an offset row was cut down the middle,
    // each half drawn at a different size and angle. Wrapped at RING so
    // the strip closes up round the die.
    const col = mod(Math.floor((x + offset) / cell), RING / cell);

    // Deterministic per-cell variation. No Math.random — the shelf and the
    // table have to show the same dice.
    const hash = Math.abs((Math.sin(row * 12.9898 + col * 78.233) * 43758.5453) % 1);
    const reach = (cell / 2) * (0.82 + hash * 0.16);
    const spin = hash * Math.PI;
    const sector = Math.PI / 3;

    /** Is this exact point inside the flake? Coordinates are in pixels. */
    const inside = (px: number, py: number): boolean => {
      const dx = mod(px + offset, cell) - cell / 2;
      const dy = mod(py, cell) - cell / 2;
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
    // Full strength. At 0.82 with a #7f8792 ink on a #f2efe8 body, the
    // most expensive die in the Store read as a near-white cube with
    // almost nothing on it — hard to tell from a plain pale one in a
    // thumbnail. It is still quiet under the face sticker; it is just
    // actually visible now.
    const vein = (1 - smoothstep(0, width, Math.abs(field))) * 1.0;
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
    // Widened twice. 0.02 fell between pixels wherever the field's
    // gradient is steep and drew a dotted line; 0.045 still did it often
    // enough that the veining read as speckle or a printing fault rather
    // than as stone, which at 525 coins is the most expensive die in the
    // Store looking like the least finished. 0.08 holds a continuous line.
    const hair = (1 - smoothstep(0, 0.08, Math.abs(field - 0.52))) * 0.22;

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
    /*
      SPARSE flecks, not a per-pixel jitter.

      Every pixel used to be perturbed by up to 0.17 — the same amplitude
      as the coarse mottle below — so the two-scale structure that tells
      stone from noise was completely swamped, and the surface crawled
      and fizzed as the die tumbled, which is the one texture artefact
      that always gets noticed in motion. Now only the top and bottom
      tenth of the hash draw anything, harder each, and the rest of the
      face is clean rock.
    */
    const hash = Math.abs((Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1);
    const fleck =
      hash > 0.9 ? (hash - 0.9) * 3.4 : hash < 0.1 ? (hash - 0.1) * 2.6 : 0;

    // Two smooth scales of mottling under the flecks. Two rather than one
    // is what still tells stone from noise: broad patches of lighter and
    // darker rock, with a finer drift inside them. Raised now that the
    // flecks are not drowning them.
    // Whole turns round the die (4, 7 and 2 — the nearest to the old
    // x/11, x/5.5 and x/17), so the stone closes up round the back.
    const turn = (x * Math.PI * 2) / RING;
    const coarse = Math.sin(turn * 4 + Math.sin(y / 8) * 1.6) * 0.24;
    const fine = Math.sin(turn * 7 + y / 6.5 + Math.sin(turn * 2) * 1.3) * 0.12;
    return coarse + fine + fleck;
  },

  /**
   * Polished metal: a bright band with dark either side, brushed.
   *
   * This is the one pattern that exists purely because the dice are drawn
   * unlit. On a lit die, gold would catch a highlight as it turned; with
   * lighting off it is a flat yellow cube. So the highlight is painted in:
   * a band of light rolling across the die, with the surface falling away
   * to shadow on both sides of it, plus fine brush lines.
   *
   * ONE SWEEP ROUND THE WHOLE DIE, since 21 Oct 2026. From 11 Sep 2026
   * each face caught its own light — a diagonal bar placed by the face's
   * own coordinates — because a sweep placed on the flat sheet fell on
   * two faces and missed the rest. Painting the sweep on the die itself
   * (sweepOfLight) gets both: the band follows the seam curve, which
   * runs round the die through a corner of every side, so every side
   * catches it AND it turns each edge unbroken. The small second glint
   * sits in the opposite corner of each side.
   *
   * SHINY IS A NARROW HIGHLIGHT, NOT A BRIGHT ONE. David, 11 Sep 2026:
   * "make the gold dice shinier." The first instinct is to turn the light
   * up, and a peak above the mask's range threw a third of the face away
   * as a flat stripe of cream — brushed satin, rendered and looked at.
   * What makes a surface look polished is the SIZE of the hotspot
   * relative to the falloff: a narrow core that only just reaches the top
   * of the range inside a broad soft glow, with the metal falling further
   * into shadow either side. Chrome has a small hard glint and dark
   * surroundings; matte paint has a big soft one.
   */
  sheen: (x, y) => {
    const P = sheetToCube(x, y);
    const light = sweepOfLight(P, 3.3, 14.7, 0.72, 0.5, 4.8, 0.34);
    /*
      Warm bounce in the shadows. Real gold is never black in the dark
      parts: it picks up its own colour reflected off everything around
      it, which is the difference between metal and a yellow cube. A
      shallow ripple along the die's diagonal, always small, so it can
      only deepen or lift the shell rather than tint it.
    */
    const g = dot3(P, SEAM_AXIS);
    const bounce = Math.sin((g / SIZE) * 7.3 + 1.1) * 0.06;
    /*
      Brushing: fine polishing lines running along the band. Slow enough
      not to alias at 64 texels (the old 1.1 radians a texel came out as
      stair-steps), faint, and faded out inside the hotspot: polishing
      marks disappear in a specular highlight, they do not sit on top of
      it.
    */
    const { along } = seamAt(P);
    const core = Math.exp(-Math.pow(seamAt(P).off / 3.3, 2)) * 0.72;
    const brush = Math.sin(along * 15 + g * 0.11) * 0.035 * (1 - core / 0.72);
    return light - 0.46 + bounce + brush;
  },

  /**
   * Ivory: the material, painted at a whisper.
   *
   * The default die shipped as a flat pure-white square — the one skin in
   * the set whose material name delivered nothing, and it reads as an
   * unloaded texture rather than as a prize tusk. Real ivory is a warm
   * cream with faint near-parallel grain and a soft polished sheen, and
   * the dice are unlit, so all of that has to be painted in.
   *
   * Everything here is deliberately tiny: this is the shell every new
   * player reads their first roll on, so the face stickers must dominate.
   * At arm's length it should still say "plain pale die" — ceramic, not
   * vector fill.
   *
   * All of it is measured on the die itself since 21 Oct 2026: the
   * sheen is satin's one sweep round the whole die (it used to be a
   * band per face), and the grain runs along one axis of the block the
   * way a tusk's does — down the four sides and across the top and
   * bottom — bent by noise of the point in space, so it meets itself
   * over every edge.
   */
  ivory: (x, y) => {
    const P = sheetToCube(x, y);
    const sheen = sweepOfLight(P, 16.6, 16.6, 0.55, 0, 10, 0.16) - 0.1;

    // The grain: fine near-parallel lines, gently wavy, each only a few
    // percent darker than the body. The weight drifts along a line's
    // length — fading out here, pressing in there — which is what
    // separates grain from a comb. A slow octave carries the bend; the
    // first cut of this warped by too little and rendered as dead-straight
    // pinstripe wallpaper.
    const warp = cubeFbm([P[0] + 11, P[1] + 3, P[2] + 7], [32, 16], [1, 0.3]) * 5.5;
    const lines = 9;
    const s = (P[0] + P[2]) * 0.85 + P[1] * 0.08;
    const phase = ((((s + warp) * lines) / SIZE) % 1 + 1) % 1;
    const core = smoothstep(0.34, 0.5, phase) * (1 - smoothstep(0.5, 0.66, phase));
    const grain = -core * (0.05 + cubeNoise([P[0] + 40, P[1] + 23, P[2]], 32) * 0.11);

    // The faintest cream mottle, so the ground is dentine rather than one
    // flat fill.
    const mottle = cubeFbm([P[0] + 27, P[1] + 31, P[2] + 5], [32, 16], [1, 0.5]) * 0.04;

    return sheen + grain + mottle;
  },

  /**
   * The quietest shell in the file: ivory's sheen and nothing else.
   *
   * Mint, Bubblegum and Midnight were `plain` — a single flat fill, no
   * shell material at all. Ivory got grain and a sheen on 31 Aug for
   * exactly this reason, and the three of them missed it, so the ladder
   * PRIZES ended up looking blanker than the die a player starts with.
   *
   * Just the sheen, though. The grain and the mottle are what make
   * ivory read as bone; these three are painted plastic, and the flat
   * ladder / patterned store split is deliberate. One broad sweep of
   * light is enough to say "this is a solid object" without taking any
   * attention off the face stickers — and since 21 Oct 2026 it is one
   * sweep round the whole die (sweepOfLight) rather than a band stamped
   * on each side.
   */
  satin: (x, y) => {
    const P = sheetToCube(x, y);
    return sweepOfLight(P, 16.6, 16.6, 0.55, 0, 10, 0.16) - 0.1;
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
    /*
      Each rosette sits in a cell of a staggered lattice, jittered, and
      its ring can reach past the cell: so every texel looks in the
      neighbouring cells too (20 Oct 2026). Before that a rosette was cut
      off at its cell's edge, which showed wherever a cell boundary fell,
      and the lattice's rows fall exactly on the top and bottom edges of
      every side.
    */
    const cell = 16;
    const cols = RING / cell;
    // The rows a quarter cell up, for the same reason the columns are
    // slid: the rows' edges fell on the top and bottom edges of every
    // side, and every ring's rim crossed them in the same place.
    const row0 = Math.floor((y + cell / 4) / cell);
    for (let oy = -1; oy <= 1; oy++) {
      const row = row0 + oy;
      // Each row slid along by its own amount, not the alternate half
      // cell of a brick lattice: with a regular stagger every other row's
      // rosettes line up in columns, and a column's rings all cross the
      // same edge of the die at the same point, which read as a seam
      // there. A leopard's spots are not in columns anyway.
      const offset = hashCell(row + 77, 3) * cell;
      const col0 = Math.floor((x + offset) / cell);
      for (let ox = -1; ox <= 1; ox++) {
        const col = mod(col0 + ox, cols);
        const h = hashCell(col, row);
        // Jittered by up to six texels each way (it was one and a half):
        // looser, as a leopard's spots are, and no row's rings all reach
        // the same line, so no edge of the die gets a row of rims.
        const cx = x - ((col0 + ox) * cell - offset + cell / 2 - (h - 0.5) * 12);
        const cy = y - (row * cell - cell / 4 + cell / 2 - (hashCell(col + 9, row) - 0.5) * 12);
        const r = Math.hypot(cx, cy);
        const ring = 4.6 + h * 1.4;
        // The ring, BROKEN in one or two places — an unbroken ring is a
        // polka dot with a hole, not a rosette.
        const a = Math.atan2(cy, cx);
        const gapAt = h * Math.PI * 2;
        const inGap = Math.abs(Math.atan2(Math.sin(a - gapAt), Math.cos(a - gapAt))) < 0.7;
        if (Math.abs(r - ring) < 1.6 && !inGap) return 0.95;
        // A smaller solid freckle in the middle of about half of them.
        if (h > 0.5 && r < 1.8) return 0.95;
      }
    }
    return 0;
  },

  /** Tiger: vertical stripes that wave and TAPER to points. */
  giraffe: (x, y) => {
    const cell = 16;
    let d1 = 99;
    let d2 = 99;
    // Half a cell off, so the plates' seams run across the die's edges
    // rather than along them (20 Oct 2026).
    const gx = Math.floor((x + cell / 2) / cell);
    const gy = Math.floor((y + cell / 2) / cell);
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const hx = mod(gx + ox, RING / cell);
        const px = (gx + ox + (hashCell(hx, gy + oy) - 0.5) * 0.8) * cell;
        const py = (gy + oy + (hashCell(hx + 7, gy + oy) - 0.5) * 0.8) * cell;
        const d = Math.hypot(x - px, y - py);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      }
    }
    return smoothstep(1.2, 2.6, d2 - d1) * 0.92;
  },

  paws: (x, y) => {
    // Three to a side, twelve round the die: 21px did not go round a whole
    // number of times, so the prints broke where the strip closed up.
    const cell = SIZE / 3;
    const row = Math.floor(y / cell);
    const offset = mod(row, 2) === 0 ? 0 : cell / 2;
    const cx = mod(x + offset, cell) - cell / 2;
    const cy = mod(y, cell) - cell / 2;
    /*
      Each shape fades over about a texel at its rim rather than stopping
      dead (18 Oct 2026). A print that was in or out per texel came out
      as a staircase, and on the mitred top of the die, where two sides
      meet along a diagonal, it was the one design with nothing between
      its two colours.
    */
    const rim = (d: number) => smoothstep(0.55, -0.55, d);
    // Main pad: a wide ellipse low in the cell. Trimmed from 3.4 so
    // there is still visible ground between the pad and the toe row.
    let ink = rim((Math.hypot(cx / 1.3, cy - 2.5) - 3.1) * 1.15);
    /*
      FOUR toes on an arc, which is what a cat's or a dog's print
      actually has. With three, this was the only animal skin in the set
      whose name could not be guessed from the picture — it read as a
      mushroom, or a little crowned figure. The radius comes down from
      1.7 so four fit in the 21px cell with clear gaps between them.
    */
    for (const [tx, ty] of [
      [-4.4, -1.6], [-1.7, -3.7], [1.7, -3.7], [4.4, -1.6],
    ] as const) {
      ink = Math.max(ink, rim(Math.hypot(cx - tx, cy - ty) - 1.5));
    }
    return ink * 0.95;
  },

  /**
   * Basketball: the classic four seams — one vertical, one horizontal,
   * two side arcs — over a faint pebbled grain.
   */
  /*
    Tennis and baseball were drawn per face until 18 Oct 2026: two arcs on
    every side, so the seams stopped dead at each edge and started again
    on the next side. A real ball's seam is ONE curve, and so is this —
    drawn on the cube itself (seamAt), so it runs unbroken over every
    edge, crosses each side once, and stays clear of every sticker.
  */
  tennis: (x, y) => {
    const { off } = seamAt(sheetToCube(x, y));
    if (Math.abs(off) < 1.8) return 0.95;
    // Felt: the faintest fuzz so the ground is not a flat wash.
    return (hashCell(x, y) - 0.5) * 0.08;
  },

  baseball: (x, y) => {
    const { off, along } = seamAt(sheetToCube(x, y));
    const side = Math.abs(off);
    // Stitches either side of a bare seam line, in a steady rhythm along
    // it — forty-eight stitches right round the die.
    if (side < 3.2 && side > 0.8 && Math.abs(Math.sin(along * 24)) > 0.55) return 0.9;
    return 0;
  },

  /** Candy cane: wide, soft-edged diagonal stripes. */
  candyStripes: (x, y) => {
    // Whole turns across the tile, like the metals' sweep — an odd count
    // reads as off-kilter in a good way.
    const wave = tiling(x + y, 3);
    return smoothstep(-0.15, 0.35, wave) * 0.96;
  },

  circuit: (x, y) => {
    /*
      A circuit board. The traces used to run in lanes across each side
      from its left edge, every side the same, each one stopping dead at
      the edge; since 21 Oct 2026 the board is wired round the whole die
      (CIRCUIT_TRACES): the colour stickers are the chips, each with
      eight pins, and every pin's trace jogs out at a right angle and
      runs to an edge of the die, where it meets the next chip's trace
      coming the other way, so every edge has traces crossing it and the
      six chips are wired together. A third trace turns each corner of
      the die. Pads on the pins, dots at the jogs, vias at the turns.
    */
    const P = sheetToCube(x, y);
    const F = FACE_FRAMES[cubeFace(P)];
    const u = dot3(P, F.u);
    const v = dot3(P, F.v);
    for (const [pu, pv, r, hole] of CIRCUIT_PADS) {
      const d = Math.hypot(u - pu, v - pv);
      if (d < hole) return 0.2;
      if (d < r) return 0.95;
    }
    const d = traceDistance(P);
    if (d < 0.9) return 0.7;
    // The board itself: a faint weave in the laminate.
    return (cubeNoise(P, 16) - 0.5) * 0.08 + smoothstep(1.6, 0.9, d) * 0.25;
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
 * The thirty-two patterns that need MORE than base-plus-ink.
 *
 * The mask system deliberately keeps every pattern to two colours, which
 * is right for materials — but a watermelon is red, white, green and
 * black, and no mask can say so. These painters return finished pixels.
 * The skin's `body` still matters (it is what the face-separation check
 * reads, so each painter's dominant colour must match its skin's body),
 * and `ink` is unused — kept on the skin so the texture tests can treat
 * every patterned skin alike.
 */
/**
 * Lemon slices over the die: three to a side, two sizes, some lying
 * across an edge.
 */
const LEMON_SLICES = new StickerSheet(scatterStickers(11, 3, 12.5, 19, 3, 12.5, [0, 1, 0]));

/** Cherry flowers and loose petals, strewn over the whole die. */
const BLOSSOMS = new StickerSheet(scatterStickers(13, 2, 11, 18, 4));
const BLOSSOM_PETALS = new StickerSheet(scatterStickers(17, 2, 4.5, 9, 2));

/** Fried drumsticks over the waffle: one or two to a side. */
const DRUMSTICKS = new StickerSheet(scatterStickers(19, 2, 13.5, 22, 3, 7));

/** The donut's sprinkles: a jittered lattice over every side. */
const SPRINKLES = new StickerSheet(
  latticeStickers(23, SIZE / 6, 3, 3.5).map((s) => ({ ...s, rot: s.h * Math.PI })),
);

/**
 * The four corners of the die the donut's glaze did not reach: alternate
 * ones, so every side has cake in two opposite corners.
 */
const BARE_CORNERS: readonly (readonly [number, number, number])[] = [
  [32, 32, 32], [32, -32, -32], [-32, 32, -32], [-32, -32, 32],
];

/** The goldfish on the still picture of the Fish dice: two to a side, each headed its own way. */
const GOLDFISH = new StickerSheet(scatterStickers(29, 2, 15.5, 20, 3, 10, [0, 1]));
const FISH_BUBBLES = new StickerSheet(scatterStickers(37, 3, 2.2, 7, 1));

/**
 * The Fish dice's water at a point on the die: rippling blue with a few
 * bubbles, no fish. Shared by the still picture (the `fish` painter) and
 * the die on the board (fishSwim.ts), which paints the water alone and
 * slides the fish over it — so the water under the swimming fish is the
 * water on the card, and both run unbroken over every edge.
 */
export function fishWaterAt(P: readonly number[]): Rgb {
  for (const { s, lx, ly } of FISH_BUBBLES.hits(P)) {
    if (Math.hypot(lx, ly) < 1.1 + s.h * 0.8) return BUBBLE;
  }
  return waterAt(cubeNoise(P, 16));
}

/**
 * The pizza's toppings, scattered over the die: on every side three
 * pepperoni, an olive and a basil leaf, some lying across an edge.
 */
const PIZZA_TOPPINGS = new StickerSheet(scatterStickers(7, 5, 6.8, 12.5, 2.5, 6.8, [0, 0, 1, 0, 2]));

/** The pizza at a sub-texel sheet point; `pizza` averages nine of these. */
function pizzaAt(x: number, y: number): [number, number, number] {
  const SAUCE = rgb('#b3342a');
  const CHEESE = rgb('#f4d27a');
  const CHEESE_BROWN = rgb('#d49a45');
  const PEP = rgb('#c23a2f');
  const PEP_RIM = rgb('#83241e');
  const PEP_FAT = rgb('#e0806a');
  const BASIL = rgb('#2f9a3a');
  const BASIL_VEIN = rgb('#8fd06a');
  const OLIVE = rgb('#22201f');
  const P = sheetToCube(x, y);
  // Melted cheese, browned where it blistered, and the sauce showing
  // through where the cheese ran thin.
  let px = mixRgb(CHEESE, CHEESE_BROWN, smoothstep(0.55, 0.85, cubeNoise([P[0] + 13, P[1] + 41, P[2]], 16)) * 0.7);
  const blister = cubeNoise([P[0] * 1 + 5, P[1] + 9, P[2] + 3], 2.4);
  px = mixRgb(px, CHEESE_BROWN, smoothstep(0.78, 0.9, blister) * 0.75);
  const thin = cubeNoise([P[0] + 30, P[1] + 10, P[2] + 21], 11);
  px = mixRgb(px, SAUCE, smoothstep(0.6, 0.74, thin) * 0.95);
  px = mixRgb(px, rgb('#8d2a22'), smoothstep(0.74, 0.86, thin) * 0.5);
  let under: [number, number, number] | null = null;
  for (const { s, lx, ly } of PIZZA_TOPPINGS.hits(P)) {
    const d = Math.hypot(lx, ly);
    if (s.kind === 0) {
      // Pepperoni: a big round, cupped — a dark rim, a lighter fleck of
      // fat here and there, a glint on the far side.
      const R = 5.7 + s.h * 0.9;
      if (d < R) {
        let pep = d > R - 1.3 ? PEP_RIM : PEP;
        if (hashCell(Math.floor(lx * 1.5 + s.h * 40), Math.floor(ly * 1.5 + s.h * 90)) > 0.86 && d < R - 1.6) pep = mixRgb(pep, PEP_FAT, 0.7);
        if (Math.hypot(lx + 2, ly + 2) < 1.4) pep = mixRgb(pep, rgb('#f2b8a8'), 0.6);
        if (!under) under = pep;
      } else if (d < R + 0.8 && !under) {
        // A soft shadow where the slice sits in the cheese.
        px = mixRgb(px, CHEESE_BROWN, 0.6);
      }
    } else if (s.kind === 1) {
      // A black olive: a ring with a hole, the cheese showing through it.
      if (d < 3.3 && d > 1.3) return d < 1.8 ? rgb('#4a4541') : OLIVE;
    } else {
      // A basil leaf lying on the cheese, a pale vein down its middle.
      const u = lx / 5.4;
      const v = ly / 2.4;
      if (u * u + v * v < 1 && Math.abs(v) < 1 - u * u * 0.5) return Math.abs(ly) < 0.35 ? BASIL_VEIN : BASIL;
    }
  }
  return under ?? px;
}

/** Distance from (x, y) to the segment a-b. */
export function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(x - ax - vx * t, y - ay - vy * t);
}

/**
 * The bowling ball's finger holes: a tight triangle of three in a corner
 * of the front, and two more sets on other sides, so a die at rest shows
 * holes from almost any angle. Each triangle sits in a different corner
 * of its side.
 */
const BOWLING_HOLES = new StickerSheet(
  (
    [
      [4, -23, -23], [4, -13, -26], [4, -25, -12],
      [2, 23, 22], [2, 13, 26], [2, 26, 12],
      [1, 22, -23], [1, 12, -26], [1, 26, -13],
    ] as const
  ).map(([face, u, v]) => ({ face, u, v, rot: 0, reach: 4.6, h: 0, kind: 0 })),
);

/** A watermelon seed, from its middle to its tip, in texels. */
const SEED_TIP = 1.7 * 1.45;

/**
 * The watermelon's seeds: a staggered lattice on every side, jittered,
 * none in the rind, each turned to point at the rind the way a melon's
 * seeds point outward.
 *
 * A seed near an edge of the die either lies clearly across it or keeps
 * clear of it. One whose tip happened to fall within a texel of an edge
 * looked cut off by the edge — and measured as a seam, the one edge of
 * the whole set that failed tests/continuity.test.ts on 21 Oct 2026. So
 * a centre within 0.8 of an edge stays, half the seed on each side, and
 * one between that and a seed's length of the edge is dropped.
 */
const WATERMELON_SEEDS = new StickerSheet(
  latticeStickers(31, 12.8, 2.4, 3.2)
    .filter((s) => Math.abs(seamAt(stickerPoint(s)).off) > 12)
    .filter((s) =>
      [s.u, s.v].every((c) => {
        const toEdge = SIZE / 2 - Math.abs(c);
        return toEdge < 0.8 || toEdge >= SEED_TIP + 0.55;
      }),
    )
    .map((s) => {
      const F = FACE_FRAMES[s.face];
      const Q = stickerPoint(s);
      const e = 0.5;
      const gu =
        seamAt([Q[0] + F.u[0] * e, Q[1] + F.u[1] * e, Q[2] + F.u[2] * e]).g -
        seamAt([Q[0] - F.u[0] * e, Q[1] - F.u[1] * e, Q[2] - F.u[2] * e]).g;
      const gv =
        seamAt([Q[0] + F.v[0] * e, Q[1] + F.v[1] * e, Q[2] + F.v[2] * e]).g -
        seamAt([Q[0] - F.v[0] * e, Q[1] - F.v[1] * e, Q[2] - F.v[2] * e]).g;
      // Toward the rind is toward the seam, which is where g crosses zero.
      const sign = seamAt(Q).g > 0 ? -1 : 1;
      return { ...s, rot: Math.atan2(gv * sign, gu * sign) - Math.PI / 2 + (s.h - 0.5) * 0.5 };
    }),
);

/**
 * The cow's markings, over the whole strip: the four sides (y 0..64) and
 * the parts of it the top and bottom are painted from (above 64, below
 * 0). Centre x and y, radii, turn. The first six are the original front
 * face; the rest were scattered once, kept clear of each other, and
 * written down here, so the die is the same die every time.
 */
const COW_PATCHES: readonly (readonly [number, number, number, number, number, number, number])[] = (
  [
    [14, 12, 13, 9, 0.5], [46, 20, 9, 14, -0.9], [24, 44, 15, 10, 1.2],
    [56, 52, 8, 7, 0.2], [4, 34, 6, 11, -0.4], [38, 60, 11, 6, 0.8],
    [85, -9, 8, 12, 1.5], [221, -8, 14, 8, 1.4], [13, 90, 14, 9, -1.3],
    [178, 43, 8, 7, 1.6], [79, 36, 12, 11, 0], [136, -28, 11, 7, 0.5],
    [149, 18, 9, 13, -1], [205, 38, 9, 9, -0.6], [164, -17, 10, 12, -1.5],
    [238, 55, 9, 7, 0.8], [71, 72, 6, 10, 0.9], [185, 11, 12, 7, -1.5],
    [120, 5, 9, 13, 0.4], [114, 62, 14, 6, -1.0], [41, -21, 8, 12, -0.6],
    [155, 85, 8, 10, 0.6], [16, -35, 8, 12, -1.5], [240, 99, 6, 12, 0.7],
    [103, 86, 6, 9, 0], [199, 83, 7, 10, 0.5], [42, 94, 7, 11, 0.2],
    [106, -29, 7, 13, 0], [194, -21, 7, 13, -0.1], [229, 22, 11, 11, 0],
    [244, -25, 12, 8, 0.4], [148, 55, 13, 12, 0.2], [127, 89, 7, 7, 0.3],
    [98, 18, 6, 7, 0], [122, 35, 13, 7, 1.2], [63, -34, 6, 11, -1.4],
    [215, 64, 9, 8, 0.4], [80, 96, 12, 7, 1.1], [176, 75, 6, 8, -1.4],
    [219, -34, 6, 9, 0.5], [176, 98, 10, 7, 0.6], [192, 61, 7, 7, 0.6],
  ] as const
).map(([cx, cy, rx, ry, spin]) => [
  cx,
  cy,
  rx,
  ry,
  Math.cos(spin),
  Math.sin(spin),
  // The furthest the chewed edge can reach: the noise can push the
  // boundary out to 1.65 radii.
  Math.max(rx, ry) * 1.7,
]);

const COLOR_PAINTERS: Record<ColorPatternId, ColorPainter> = {
  neon: (x, y) => {
    /*
      Neon, 20 Oct 2026. David asked for "a new cool dice that is worth
      one or two dollars" and picked this of three: an arcade at night.
      Near-black glass with a faint purple grid, glowing tubes of magenta
      and cyan, and the light trail it leaves when it rolls (diceNeon.ts).

      BENT ROUND THE DIE since 21 Oct 2026. It was a square pink tube and
      four cyan corner marks stamped on every side. Now the tubes are
      two closed curves of glass wound right round the die (seamAt, on
      two of its body diagonals): the pink one through one corner of
      every side, the cyan one through another, crossing each other
      where they meet at the edges — a neon sign bent round a cube. The
      grid is planes through the die eight texels apart, so its lines
      meet themselves over every edge, and a faint cyan ring round each
      colour sticker gives every side its glow.
    */
    const P = sheetToCube(x, y);
    let px = rgb('#0c0a18');
    const F = FACE_FRAMES[cubeFace(P)];
    const gu = Math.abs(mod(dot3(P, F.u), 8) - 4);
    const gv = Math.abs(mod(dot3(P, F.v), 8) - 4);
    px = mixRgb(px, rgb('#3a2470'), smoothstep(0.9, 0.2, Math.min(4 - gu, 4 - gv)) * 0.5);
    // A faint cyan ring round the sticker, like a sign's border.
    const halo = Math.abs(Math.hypot(dot3(P, F.u), dot3(P, F.v)) - 24.5);
    px = mixRgb(px, rgb('#2ee6ff'), Math.exp(-halo / 1.6) * 0.45);
    const pink = Math.abs(seamAt(P).off);
    const cyan = Math.abs(seamAt(P, SEAM_SWING, SEAM_FRAME_B).off);
    px = mixRgb(px, rgb('#2ee6ff'), Math.exp(-cyan / 2.0) * 0.85);
    px = mixRgb(px, rgb('#d8fbff'), smoothstep(1.0, 0.3, cyan));
    px = mixRgb(px, rgb('#ff2fb4'), Math.exp(-pink / 2.2) * 0.9);
    px = mixRgb(px, rgb('#ffd0f0'), smoothstep(1.1, 0.3, pink));
    return px;
  },

  supporterCompass: (x, y) => {
    /*
      The Supporter die, 19 Oct 2026. David: "make the supporter dice
      look better or give me new ideas for how it should look", then of
      five compass variations, "I like the teal one, the first one."

      Every side is a compass rose with the colour sticker as its heart:
      a ring of gold ticks round the sticker and eight gold points
      radiating from it, the four cardinal ones longest, each drawn as
      two facets, one lit and one in shade, the way a chart's compass
      rose is. Teal deepening toward the edges, so the gold reads warm
      against it from across the table.

      ONE CHART since 21 Oct 2026. The twisted gold rope used to frame
      each side; now it is one rope along every edge of the DIE, its
      twist measured along the edge in space so it folds over each edge
      unbroken. And every rose throws rhumb lines — the thin rays an old
      chart's roses are joined by — that carry straight on over the edges
      onto the neighbouring sides, each cardinal line running into the
      next rose's cardinal point, so the six roses are one web.
    */
    const GOLD = rgb('#d6b25e');
    const GOLD_LIT = rgb('#f0d48a');
    const GOLD_SHADE = rgb('#9c7b36');
    const P = sheetToCube(x, y);
    const f = cubeFace(P);
    const F = FACE_FRAMES[f];
    const dx = dot3(P, F.u);
    const dy = dot3(P, F.v);
    const r = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    let px = mixRgb(rgb('#14555c'), rgb('#0e4248'), smoothstep(14, 32, r) * 0.6);
    px = mixRgb(px, rgb('#1a6670'), (cubeNoise(P, 16) - 0.5) * 0.3);
    // Rhumb lines: from this side's rose and from each neighbour's,
    // unfolded over the shared edge, every 22.5 degrees, fading with
    // distance. Only outside the ring of ticks.
    let rhumb = 0;
    for (let g = 0; g < 6; g++) {
      const uv = g === f ? [dx, dy] : unfoldOnto(P, g);
      if (!uv) continue;
      const rr = Math.hypot(uv[0], uv[1]);
      if (rr < 25.5) continue;
      const sector = Math.PI / 8;
      const ang = Math.atan2(uv[1], uv[0]);
      const off = Math.abs((((ang % sector) + sector) % sector) - sector / 2);
      const across = rr * Math.sin(off);
      rhumb = Math.max(rhumb, smoothstep(0.9, 0.3, across) * smoothstep(78, 30, rr) * 0.5);
    }
    px = mixRgb(px, GOLD, rhumb);
    // The rope along every edge of the die: two twisted strands, as a
    // band of slanted gold dashes, its twist counted along the edge.
    const edge = Math.min(SIZE / 2 - Math.abs(dx), SIZE / 2 - Math.abs(dy));
    if (edge > 1.2 && edge < 4.2) {
      // The axis the edge runs along is the one that is neither the
      // face's nor the border's.
      const alongU = SIZE / 2 - Math.abs(dx) < SIZE / 2 - Math.abs(dy);
      const along = alongU ? dy : dx;
      const twist = mod(along + (edge - 2.7) * 2.2, 5);
      px = mixRgb(GOLD_SHADE, GOLD_LIT, smoothstep(0.5, 2.5, twist) * smoothstep(5, 3, twist));
    }
    // Ticks round the sticker, every fifteen degrees.
    if (r > 22.5 && r < 25 && mod(a / (Math.PI / 12), 1) < 0.22) px = mixRgb(px, GOLD, 0.8);
    // Eight points: the cardinals reach the rope, the diagonals stop short.
    for (let k = 0; k < 8; k++) {
      const pa = (k * Math.PI) / 4;
      const len = k % 2 === 0 ? 31 : 27;
      const along = dx * Math.cos(pa) + dy * Math.sin(pa);
      const across = -dx * Math.sin(pa) + dy * Math.cos(pa);
      if (along < 19 || along > len) continue;
      const half = 3.2 * (1 - (along - 19) / (len - 19));
      if (Math.abs(across) <= half) px = across < 0 ? mixRgb(GOLD, GOLD_LIT, 0.5) : GOLD_SHADE;
    }
    return px;
  },

  watermelon: (x, y) => {
    /*
      A watermelon, cut: pink-red flesh with black seeds, and the rind —
      green stripes outside, white pith inside — where the flesh ends.

      It was one wedge per side: the rind as an arc across one corner of
      every face and the same seeds on every face. Since 21 Oct 2026 the
      rind is ONE band wound right round the die along the seam curve
      (seamAt), green on its outer face and white pith on its inner,
      the flesh paling toward it as a melon's does; it crosses every side
      once through a corner region and turns every edge unbroken. The
      seeds are stickers on the die (StickerSheet), a staggered lattice
      on every side with a few hanging over an edge, each pointed at the
      rind the way a melon's seeds point outward — and none sits in the
      rind.
    */
    const P = sheetToCube(x, y);
    const { off, along } = seamAt(P);
    const toRind = Math.abs(off);
    // Outer rind: two greens striped along the arc.
    if (toRind < 3.6) {
      const stripe = Math.sin(along * 26 + off * 0.4);
      return stripe > 0 ? rgb('#3f8f4a') : rgb('#2e6e38');
    }
    if (toRind < 6.6) return mixRgb(rgb('#e8f0d8'), rgb('#f4f7ea'), smoothstep(3.6, 6.6, toRind));
    // The flesh pales slightly toward the pith, as the fruit does. Pinker
    // than a real melon on purpose: #e05a5a sat ΔLab 17.7 from the red
    // FACE sticker, and a shell that close swallows the face.
    //
    // #f78787, a shade lighter than the skin's nominal #f08585: that one
    // has a red of exactly 240, the bottom of a 16-level band, so the
    // faint mottle below tipped a texel into the next band or not
    // depending on where the noise fell on each side — and
    // tests/textures.test.ts, which counts colours in those bands, read
    // two sides as having 62% of the design of the others, a whisker
    // above its bar, over a difference no eye can see. The flesh now
    // sits mid-band in every channel and the mottle travels less than
    // half a band, so every side counts the same.
    let px = mixRgb(rgb('#f78787'), rgb('#f7b8b8'), smoothstep(12, 6.6, toRind));
    px = mixRgb(px, rgb('#ea7474'), cubeNoise(P, 16) * 0.3);
    // The seeds are kept out of the rind by where they are placed, not
    // by a test here: a cut-off of the paint at some distance from the
    // rind, measured across whichever side the texel is on, would cut a
    // seed that lies across an edge.
    for (const { lx, ly } of WATERMELON_SEEDS.hits(P)) {
      const seed = Math.hypot(lx / 0.78, ly / 1.45);
      if (seed < 1.7) return mixRgb(rgb('#2a2418'), rgb('#4a4030'), smoothstep(1.2, 0.2, seed) * Math.max(0, -ly) * 0.3);
    }
    return px;
  },

  citrus: (x, y) => {
    /*
      Lemon slices on a lemon.

      This was a single wheel of ten segments with its hub dead centre —
      under the colour sticker, so a Lemon die was a plain yellow square
      — and then four quarter-slices in the corners of every side, the
      same four six times. Since 21 Oct 2026 the slices are whole, and
      stickers on the die (LEMON_SLICES): three to a side at two sizes,
      several lying across an edge with half on each side, over a ground
      of dimpled lemon peel. Full colour since the same day, because a
      slice is peel, white pith and pale flesh with paler walls — three
      tones from one ink was the old mask's whole trouble.
    */
    const P = sheetToCube(x, y);
    // The peel: the skin's own yellow, pitted.
    const pit = cubeNoise([P[0] + 3, P[1] + 7, P[2] + 11], 2.6);
    let px = mixRgb(rgb('#f5e69a'), rgb('#e6cf74'), smoothstep(0.45, 0.8, pit) * 0.55);
    px = mixRgb(px, rgb('#fbf1bd'), smoothstep(0.5, 0.25, pit) * 0.35);
    for (const { s, lx, ly } of LEMON_SLICES.hits(P)) {
      const R = s.kind === 0 ? 11 + s.h * 1.5 : 7.5 + s.h;
      const r = Math.hypot(lx, ly);
      if (r > R) continue;
      if (r > R - 1.8) return rgb('#e0b43c'); // peel
      if (r > R - 3.4) return rgb('#fbf6dc'); // pith
      if (r < R * 0.12) return rgb('#fbf6dc'); // the hub the segments meet at
      const a = Math.atan2(ly, lx) + s.h;
      // Walls between ten segments.
      if (Math.abs(Math.sin(a * 5)) > 0.9 && r > R * 0.16) return rgb('#fbf6dc');
      // Flesh: pale juice, sparkling a little where the sacs catch light.
      const sac = cubeNoise([P[0] * 1 + 17, P[1] + 23, P[2] + 5], 1.8);
      return mixRgb(rgb('#f3d55e'), rgb('#fae99a'), smoothstep(0.4, 0.8, sac) * 0.7);
    }
    return px;
  },

  pizza: (x, y) => {
    /*
      Redrawn 20 Oct 2026. David: "make the pizza dice look better." It
      had been one corner of a round pizza per side, which read as a
      cracker with stickers on it, and became a whole square pan pizza
      on every side — the same pizza six times, with a crust framing
      each face.

      ONE PIZZA ROUND THE WHOLE DIE since 21 Oct 2026. The die is cut
      from the middle of the pie: melted cheese everywhere, browned where
      it blistered, tomato sauce showing through in patches, and the
      toppings — big cupped pepperoni, black olives, basil leaves —
      scattered over all six sides as stickers on the die
      (PIZZA_TOPPINGS), a pepperoni that lies across an edge carrying on
      whole onto the next side. The crust went with the frames: a cube
      has no outside edge for one to sit on. Supersampled 3x3, so the
      toppings have clean round edges at shelf size.
    */
    const N = 3;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let sy = 0; sy < N; sy++) {
      for (let sx = 0; sx < N; sx++) {
        const c = pizzaAt(x + (sx + 0.5) / N - 0.5, y + (sy + 0.5) / N - 0.5);
        r += c[0];
        g += c[1];
        b += c[2];
      }
    }
    return [r / (N * N), g / (N * N), b / (N * N)];
  },

  donut: (x, y) => {
    /*
      Pink glaze with sprinkles, and the cake showing where the glaze
      ran out.

      The scallops of that edge used to be finer than the texture could
      resolve and aliased into a staircase of big square steps; and the
      edge was a margin stamped on the lower right of every side. Since
      21 Oct 2026 the die is one dipped cake: the glaze did not reach
      four of its eight corners — alternate ones, so every side shows
      cake in two opposite corners — and its lip round each bare corner
      is one scalloped curve over the three sides that meet there,
      measured from the corner itself so it turns the edges unbroken.
      The sprinkles are stickers on the die (SPRINKLES), a jittered
      lattice over every side, each a short capsule in one of five
      colours turned its own way, and none on the bare cake.
    */
    const P = sheetToCube(x, y);
    const cakePx = mixRgb(rgb('#d9a55c'), rgb('#c2882e'), cubeNoise([P[0] + 4, P[1] + 8, P[2] + 2], 3.2) * 0.5);
    // How far this point is from the nearest bare corner, scalloped.
    let bare = Infinity;
    for (const [cx, cy, cz] of BARE_CORNERS) {
      bare = Math.min(bare, Math.hypot(P[0] - cx, P[1] - cy, P[2] - cz));
    }
    const lip = 13 + (cubeNoise([P[0] + 11, P[1] + 3, P[2] + 7], 5) - 0.5) * 5;
    // Blended across about two texels rather than a hard boolean, so the
    // icing has a lip instead of a cut.
    const cake = smoothstep(lip + 1, lip - 1, bare);
    if (cake >= 1) return cakePx;
    let glaze = rgb('#e8a8b8');
    // Poured icing: a little thicker and paler here and there, and one
    // soft sweep of gloss round the whole die, the way a glaze shines.
    glaze = mixRgb(glaze, rgb('#f6c9d6'), smoothstep(0.45, 0.9, cubeNoise([P[0] + 20, P[1] + 30, P[2] + 40], 14)) * 0.5);
    glaze = mixRgb(glaze, rgb('#d9909f'), smoothstep(0.55, 0.9, cubeNoise([P[0] + 3, P[1] + 50, P[2] + 9], 9)) * 0.35);
    glaze = mixRgb(glaze, rgb('#fdeaf0'), Math.min(1, sweepOfLight(P, 7, 18, 0.4, 0.35, 6, 0.25)));
    const jimmies = ['#e84a6e', '#3fa35c', '#3f7fd0', '#f0c020', '#ffffff'];
    for (const { s, lx, ly } of SPRINKLES.hits(P)) {
      if (Math.abs(lx) < 3 && Math.abs(ly) < 1.1) {
        glaze = rgb(jimmies[Math.floor(s.h * jimmies.length) % jimmies.length]);
        // A sprinkle is a little rod: shaded along one side.
        glaze = mixRgb(glaze, rgb('#000000'), smoothstep(0.3, 1.1, ly) * 0.25);
        break;
      }
    }
    return mixRgb(glaze, cakePx, cake);
  },

  /** Six soft bands on the diagonal, sky between. */
  rainbow: (x, y) => {
    const order = ['#e05a5a', '#e8963d', '#e8d23d', '#57b366', '#4a7fd0', '#9a6ee0'];
    const d = (x + y) / 2;
    // Bands of 32/3px rather than 9, so the colours come round a whole
    // number of times and close up round the die.
    const band = mod(d / (SIZE / 6), order.length);
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
    // Measured the short way round the die: the core sits near the left
    // edge of the front, so its disc spills onto the side round the back.
    const ox = mod(x - gx + RING / 2, RING) - RING / 2;
    // The disc, tilted, and the core burning at one end of it.
    const ux = ox * 0.94 + (y - gy) * 0.34;
    const uy = -ox * 0.34 + (y - gy) * 0.94;
    px = mixRgb(px, rgb('#6e3aa8'), Math.exp(-(Math.pow(ux / 30, 2) + Math.pow(uy / 10, 2))) * 0.55);
    px = mixRgb(px, rgb('#ffeccc'), Math.exp(-Math.pow(Math.hypot(ox, y - gy) / 8, 2)));
    // A second, smaller galaxy high on the far side of the die (the -X
    // side of the strip), tilted the other way, so no side is left as
    // thin cloud and pinpricks now that the sides differ (20 Oct 2026).
    const ox2 = mod(x - SIZE * 3.5 + RING / 2, RING) - RING / 2;
    const oy2 = y - SIZE * 0.22;
    const vx = ox2 * 0.9 - oy2 * 0.44;
    const vy = ox2 * 0.44 + oy2 * 0.9;
    px = mixRgb(px, rgb('#9a4ab0'), Math.exp(-(Math.pow(vx / 22, 2) + Math.pow(vy / 7, 2))) * 0.5);
    px = mixRgb(px, rgb('#ffe2c0'), Math.exp(-Math.pow(Math.hypot(ox2, oy2) / 5.5, 2)) * 0.9);
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
    // Pins on the bands' far edges rather than on the die's edges, where
    // they sat before the strip (20 Oct 2026).
    const pinH = Math.abs(tiling(y + 12, 2)) > 0.985;
    const pinV = Math.abs(tiling(x + 12, 2)) > 0.985;
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
    // Fourteen plates round the die (10.56px, from 10.5), so the lattice
    // closes up round the back.
    const size = RING / (14 * Math.sqrt(3));
    const cell = hexCell(x, y, size);
    // The hexagon's own boundary, not a circle: scutes tile a shell with
    // no gaps, and round plates leave gaps.
    const t = cell.t;
    const tone = hashCell(mod(cell.q, 14) * 5 + 2, cell.r * 9 + 4);
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
    // Three eyes to a side, so they go round the die a whole number of
    // times (21px did not).
    const cell = SIZE / 3;
    const row = Math.floor(y / cell);
    const offset = mod(row, 2) === 0 ? 0 : cell / 2;
    const cx = mod(x + offset, cell) - cell / 2;
    const cy = mod(y, cell) - cell / 2;
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
      Chicken and waffles, and you can tell which is which.

      The chicken was once two round lumps painted in the waffle's own
      brown, which read as two burnt patches. A drumstick needs a bone,
      and a bone has to be PALER than the meat it sticks out of — exactly
      what a single dark ink cannot do.

      ONE WAFFLE since 21 Oct 2026. The pockets are cut by planes through
      the die sixteen texels apart, so the waffle's walls run along its
      edges and the grid meets itself over every one — it was a grid per
      side, four pockets square, and only looked joined. The drumsticks
      are stickers on the die (DRUMSTICKS): one or two to a side, every
      side, some lying over an edge. The old two stood on the painter's
      own canvas, which is what the Store card shows, and on no side of
      the die at all — every card promised chicken and every die was a
      plain waffle.
    */
    const P = sheetToCube(x, y);
    const F = FACE_FRAMES[cubeFace(P)];
    const cell = 16;
    const inX = mod(dot3(P, F.u), cell);
    const inY = mod(dot3(P, F.v), cell);
    const edge = Math.min(inX, cell - inX, inY, cell - inY);
    let px = edge < 2
      ? mixRgb(rgb('#f0c878'), rgb('#e8b45c'), 0.4)
      : mixRgb(rgb('#d9a04a'), rgb('#a8742a'), smoothstep(2, 8, edge));
    // Baked unevenly: a little darker here and there.
    px = mixRgb(px, rgb('#9a6424'), smoothstep(0.6, 0.85, cubeNoise(P, 12)) * 0.3);
    for (const { s, lx, ly } of DRUMSTICKS.hits(P)) {
      const ux = lx;
      const uy = ly;
      // The bone and its knuckle, out of the narrow end.
      if (Math.hypot(ux - 10.6, uy - 0.4) < 2.8 || (Math.abs(uy) < 1.8 && ux > 3.2 && ux < 10.8)) {
        return mixRgb(rgb('#f2e6c9'), rgb('#cbbb99'), smoothstep(-1, 2.2, uy));
      }
      const lump = cubeFbm([P[0] + s.h * 30, P[1] + 7, P[2] + s.h * 50], [16, 8], [1, 0.6]) * 1.7;
      const meat = Math.hypot((ux + 3.2) / 8, uy / 6.4) + lump * 0.1;
      if (meat < 1.42) {
        // Crust: craggy fried skin, darkest at the rim, which fades over
        // a texel or two rather than stopping dead — a hard rim that
        // happened to lie along an edge of the die read as a seam.
        const crust = mixRgb(
          mixRgb(rgb('#c9762e'), rgb('#9e5418'), cubeNoise([P[0] + 2, P[1] + 5, P[2] + 9], 2.2)),
          rgb('#6e360e'),
          smoothstep(0.55, 1, meat),
        );
        return mixRgb(crust, px, smoothstep(1.0, 1.42, meat));
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
    /*
      Two later fixes, both from looking at the render.

      The pale ring round every seed was the loudest thing on the face,
      so at a glance the die read as pink polka dots or bubble wrap and
      only became a strawberry once you noticed the yellow. It is a
      narrow, weak lip now, and the dimple under it is deeper to
      compensate, so a seed reads as SUNK into the skin rather than
      ringed on top of it.

      And the seeds sat on a tidy repeating grid, which is wallpaper
      rather than fruit skin — so each one takes the same per-cell
      jitter the cookie painter already uses for its chocolate chips.
    */
    // Twenty-three seeds round the die, from 11px apart, so they fit.
    const cell = RING / 23;
    const row = Math.floor(y / cell);
    const offset = mod(row, 2) === 0 ? 0 : cell / 2;
    // A quarter cell along, so no seed sits on the join where the strip
    // closes up round the die (20 Oct 2026).
    const col = mod(Math.floor((x + offset + cell / 4) / cell), 23);
    const h = hashCell(col + 5, row + 13);
    const jx = (h - 0.5) * 3;
    const jy = (hashCell(col + 19, row + 2) - 0.5) * 3;
    const cx = mod(x + offset + cell / 4, cell) - cell / 2 - jx;
    const cy = mod(y, cell) - cell / 2 - jy;
    const d = Math.hypot(cx, cy);
    let px = mixRgb(rgb('#c93a52'), rgb('#e0687a'), wrappedNoise(x, y, 16) * 0.9);
    px = mixRgb(px, rgb('#9e2a40'), smoothstep(4.6, 1.9, d) * 0.7);
    px = mixRgb(px, rgb('#ef939c'), smoothstep(2.0, 3.0, d) * smoothstep(4.4, 3.0, d) * 0.22);
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
    /*
      One cloth all the way round, since 18 Oct 2026, rather than one
      patch per side. The weave counts in fours instead of threes, which
      is what lets it go round the die a whole number of times. The
      topstitching sits 11px in from every edge (y mod 64), so on the
      sides it runs right round the die and on the top and bottom it is a
      stitched square — two rows of stitching either side of each edge,
      like a sewn bean bag.
    */
    const diag = tiling(x * 2 - y * 2, 16);
    let px = mixRgb(rgb('#22395c'), rgb('#5480ad'), smoothstep(0.12, 0.9, diag));
    px = mixRgb(px, rgb('#a3c2d9'), mod(x + y, 4) === 0 ? 0.3 : 0);
    px = mixRgb(px, rgb('#16263f'), mod(x - y, 4) === 0 ? 0.22 : 0);
    if (hashCell(x, Math.floor(y / 4)) > 0.978) px = mixRgb(px, rgb('#cfe0ea'), 0.75);
    const inFace = mod(y, SIZE);
    for (const sy of [11, 52]) {
      const near = Math.abs(inFace - sy);
      if (near < 4) px = mixRgb(px, rgb('#16263f'), smoothstep(4, 1.6, near) * 0.35);
      if (near < 1.5 && mod(x + Math.floor(y), 8) < 4) {
        px = mixRgb(rgb('#d99a35'), rgb('#a5701f'), mod(x, 2) * 0.5);
      }
    }
    return px;
  },
  embers: (x, y) => {
    /*
      FIRE, over the whole die.

      David, 30 Sep 2026: "Make the color of the fire dice more orange.
      Not just orange, I mean more fire colors." It was charred wood with
      thin orange cracks — a die that had BEEN on fire. Now it is burning:
      tongues of flame, pale gold at their roots, then amber, orange and
      red toward the tips, over a deep ember ground with sparks in it.

      ONE FIRE since 21 Oct 2026, rather than flames rising from the
      bottom of each side, which met the next side's embers at every
      edge. The die burns from underneath: its bottom is the bed of the
      fire, white-hot, and the flames flare out over the bottom edges,
      up all four sides and over the top edges, their tips licking in
      toward the middle of the top. Every point is given its height up
      the fire and its place round it in space (bottom centre, out over
      the rim, up the sides, in over the top), so the tongues run
      unbroken over every edge.

      THE STICKER KEEPS A DARK RING. Fire is made of exactly the colours
      of three of the six faces — red, orange and yellow — and a flame
      running right up to the orange sticker would swallow it, which is
      the one thing no shell may do. So a band of charcoal circles the
      middle of every side, and the colour sticker sits on black whatever
      burns around it. Every colour named below is also at least 15 ΔLab
      from every face colour (screen.test.ts checks the ones written here).
    */
    const P = sheetToCube(x, y);
    const f = cubeFace(P);
    // Where this point is round the die (a strip position, 0..RING) and
    // how far up the fire it is: 0 at the bottom's middle, 32 at the
    // bottom rim, 96 at the top rim, 128 at the top's middle.
    let theta: number;
    let L: number;
    if (f === 2 || f === 3) {
      const rs = Math.max(Math.abs(P[0]), Math.abs(P[2]));
      const sc = SIZE / 2 / Math.max(1e-6, rs);
      const ex = P[0] * sc;
      const ez = P[2] * sc;
      // The rim point this point looks out through, as a strip position.
      if (Math.abs(ez) >= Math.abs(ex)) theta = ez > 0 ? ex + 31.5 : 2 * SIZE - ex + 31.5;
      else theta = ex > 0 ? SIZE - ez + 31.5 : 3 * SIZE + ez + 31.5;
      L = f === 3 ? rs : 3 * SIZE / 2 + (SIZE / 2 - rs);
    } else {
      theta = mod(x, RING);
      L = SIZE + P[1];
    }
    const sway = Math.sin(L * 0.14 + (theta * Math.PI * 2 * 3) / RING) * 0.5;
    const tongues =
      0.66 +
      0.24 * Math.abs(Math.sin((theta * Math.PI * 2 * 6) / RING + sway)) +
      0.1 * Math.sin((theta * Math.PI * 2 * 14.5) / RING + 1.1) +
      cubeFbm(P, [16, 8], [1, 0.5]) * 0.08;
    // The tips reach from the middle of a side to well over the top.
    const tip = 30 + 90 * Math.max(0.2, tongues);
    const t = L / tip; // 0 at the root, 1 at the tip
    // Glowing embers, not soot: deep red, brightening where it is hottest.
    let ember = mixRgb(rgb('#5a1407'), rgb('#9e2a0a'), smoothstep(-0.3, 0.7, cubeFbm([P[0] + 7, P[1] + 3, P[2]], [32, 16], [1, 0.5])));
    // Heat glowing in the cracks of the ember, orange and gold.
    const vein = Math.abs(cubeFbm([P[0] + 21, P[1] + 9, P[2] + 33], [12, 6], [1, 0.5]));
    const heat = smoothstep(0.09, 0.02, vein);
    // Charred patches in the ember, and the ember warming toward each
    // crack, then the crack itself glowing.
    ember = mixRgb(ember, rgb('#3b0c05'), smoothstep(0.55, 0.8, cubeNoise([P[0] + 50, P[1] + 20, P[2] + 60], 9)) * 0.6);
    ember = mixRgb(ember, rgb('#c43d0c'), smoothstep(0.22, 0.08, vein) * 0.6);
    ember = mixRgb(ember, mixRgb(rgb('#ff6a14'), rgb('#ffa42e'), cubeNoise([P[0] + 2, P[1] + 44, P[2] + 8], 6)), heat * 0.85);
    let px: [number, number, number];
    if (t < 1) {
      px = mixRgb(rgb('#fff0b0'), rgb('#ffc75a'), smoothstep(0.0, 0.3, t));
      px = mixRgb(px, rgb('#ffa42e'), smoothstep(0.25, 0.5, t));
      px = mixRgb(px, rgb('#ff6a14'), smoothstep(0.45, 0.72, t));
      px = mixRgb(px, rgb('#c43d0c'), smoothstep(0.7, 0.95, t));
      // Hotter and cooler patches within the flame, so the bed of the
      // fire is not one flat pale wash.
      const patch = cubeFbm([P[0] + 19, P[1] + 5, P[2] + 11], [16, 8], [1, 0.5]);
      px = mixRgb(px, rgb('#ffa42e'), smoothstep(0.1, 0.5, patch) * (1 - t) * 0.7);
      px = mixRgb(px, rgb('#fff0b0'), smoothstep(-0.1, -0.5, patch) * (1 - t) * 0.5);
      // Deeper orange in the cracks of the bed, where the fire is fed.
      px = mixRgb(px, rgb('#ff6a14'), heat * (1 - t) * 0.6);
      // A soft edge into the dark above, rather than a cut-out.
      px = mixRgb(px, ember, smoothstep(0.9, 1, t));
    } else {
      px = ember;
      // Sparks drifting up out of the fire.
      const h = cubeSpeck(P);
      if (h > 0.985) px = mixRgb(px, rgb('#ffa42e'), 0.85);
      else if (hash3(Math.round(P[0] * 2) + 3, Math.round(P[1] * 2), Math.round(P[2] * 2)) > 0.975) px = mixRgb(px, rgb('#c43d0c'), 0.7);
    }
    // The dark ring round the sticker, feathered at its outer edge.
    // Thin: just enough black for the sticker's edge to read, and the
    // fire right up to it everywhere else.
    const F = FACE_FRAMES[f];
    const d = Math.hypot(dot3(P, F.u), dot3(P, F.v));
    const r = STICKER_FRACTION * SIZE;
    return mixRgb(px, rgb('#2a201c'), smoothstep(r * 1.3, r * 1.14, d));
  },
  ice: (x, y) => {
    /*
      A block of clear ice: facets where it has fractured, each a
      slightly different pale blue; thin white cracks along the facet
      edges with a deeper blue shadow beside them; bubbles trapped in
      it; and a frosted bloom where the surface has iced over.

      Kept pale on purpose, like the shell: the Blue face sticker is a
      deep royal blue, and a shell anywhere near it would crowd that
      face. (No hex here — screen.test.ts reads every colour written in
      this section and checks it against the faces.)
    */
    const cell = 16;
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    // Nearest and second-nearest jittered cell centre: their difference
    // is the distance to a facet edge.
    let d1 = 1e9;
    let d2 = 1e9;
    let owner = 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const hx = mod(gx + ox, RING / cell);
        const cx = (gx + ox) * cell + hashCell(hx, gy + oy) * cell;
        const cy = (gy + oy) * cell + hashCell(hx + 31, gy + oy + 17) * cell;
        const d = Math.hypot(x - cx, y - cy);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          owner = hashCell(hx + 5, gy + oy + 9);
        } else if (d < d2) d2 = d;
      }
    }
    const edge = d2 - d1;
    let px = mixRgb(rgb('#a6d4ea'), rgb('#d2eef9'), owner * 0.8 + fbm(x, y, [32, 16], [1, 0.5]) * 0.2);
    // Depth: a darker blue shadow either side of a crack...
    px = mixRgb(px, rgb('#7fb9d6'), smoothstep(3.2, 1.2, edge) * 0.55);
    // ...and the crack itself catching the light.
    px = mixRgb(px, rgb('#f6fdff'), smoothstep(1.1, 0.2, edge) * 0.9);
    // Frosted bloom on the surface.
    const frost = fbm(x + 40, y + 13, [16, 8], [1, 0.6]);
    px = mixRgb(px, rgb('#eef8fd'), smoothstep(0.2, 0.7, frost) * 0.45);
    // Bubbles: small bright rings with a dark heart.
    const h = hashCell(Math.floor(x / 5), Math.floor(y / 5));
    if (h > 0.93) {
      const bx = Math.floor(x / 5) * 5 + 2.5;
      const by = Math.floor(y / 5) * 5 + 2.5;
      const r = Math.hypot(x - bx, y - by);
      if (r < 1.8) px = mixRgb(px, rgb(r < 0.9 ? '#8cc3dc' : '#ffffff'), 0.7);
    }
    return px;
  },
  slate: (x, y) => {
    // Slate splits along its bedding: flat planes, a stepped edge where
    // one layer sits proud of the next, and the fine cleavage grain.
    // fbm(x * 0.5, y * 2.2, [32, 16]) as it was, with the halving of x
    // moved into the periods: a half-scaled x wraps after TWO trips round
    // the die, and the strip has to close after one.
    const bed = fbm(x, y * 4.4, [64, 32], [1, 0.5]);
    let px = mixRgb(rgb('#454d59'), rgb('#6e7784'), (bed + 0.6) * 0.8);
    const step = Math.abs(((((y + bed * 9) % 17) + 17) % 17) - 8.5);
    px = mixRgb(px, rgb('#2b323c'), smoothstep(2.2, 0.4, step) * 0.55);
    px = mixRgb(px, rgb('#8a939e'), smoothstep(3.6, 2.4, step) * 0.4);
    return mixRgb(px, rgb('#39404a'), (hashCell(x, y) - 0.5) * 0.24 + 0.12);
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
    // 0.375 and 0.35 across (from 0.42 and 0.34), so both trains of waves
    // go round the die a whole number of times and meet themselves.
    const roll = Math.sin(((y + x * 0.375) / SIZE) * Math.PI * 4 + wander);
    // Shorter waves riding it, turned a little across the roll.
    const rip = Math.sin(((y * 0.85 - x * 0.35) / SIZE) * Math.PI * 10 + wander * 1.7 + roll * 0.75);
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
      A golf ball: white on white, so all of it is shading.

      REDRAWN A THIRD TIME, 9 Sep 2026, because David said it still did
      not look good. Two things were wrong, and the second was the loud
      one.

      THE BAND HAD TO GO. The previous pass added a bold navy diagonal —
      a driving-range stripe — so the silhouette would stay nameable when
      the dimples blurred out. Rendered, it was not a stripe on a ball:
      it was a slash across the face, hard-aliased along the diagonal,
      and all six faces carried their own, so the die read as damaged
      rather than decorated. Its justification was that a plain white
      cube would be mistaken for the baseball — but the baseball is cream
      with bold RED STITCHING and never looked blank. A golf ball is a
      white ball covered in dimples. If the dimples do their job it needs
      nothing else; if they do not, a stripe does not rescue it.

      SO THE DIMPLES HAVE TO DO THEIR JOB, and three earlier attempts at
      that are worth recording because each failed differently.

      Multiplying "how deep into the pit" by "where across the pit" put
      maximum shading nowhere — depth peaks at the centre, sideways-ness
      at the rim — and drew faint diagonal dashes. Sharpening the mask to
      compensate only made them hard-edged dashes. Scaling the flat
      offset by the radius to fake a normal let nx²+ny² pass 1 near the
      rim, nz collapsed to zero, and every pit grew a notch on one side.

      What works is shading from the real normal of a shallow bowl, held
      to unit length by building it from an ANGLE, and — the part that
      actually mattered — a ball that is not already pure white. The lit
      wall of a dimple has to be BRIGHTER than the surface around it, and
      nothing is brighter than #ffffff, so on a white ball only the
      shadow could speak and every pit read as half a crescent. Dropping
      the shell to a soft grey-white gives both walls somewhere to go.

      WHICH WAY A HOLLOW SHADES. Light comes from the upper left. Inside
      a hollow the upper-left wall faces AWAY from it and goes dark; the
      lower-right wall faces INTO it and catches the light. Painted the
      other way round these same circles read as pearls stuck onto the
      ball — a render proved that before this comment did.
    */
    /*
      REDRAWN A FOURTH TIME, 19 Oct 2026 — David: "make the golf ball
      look better." Rendered on the table, the 9 Sep ball was a GREY,
      KNOBBLY cube: the dimples were big (six to a face), the shading
      inside each ran the full way from dark to white, and at the size a
      die is seen that contrast reads as pebbles stuck on, not hollows
      cut in. The grey came from starting the shell at #c9d1c9.

      A golf ball seen from arm's length is a bright white ball with a
      fine grid of faint grey dots — each dimple catches a little less
      light than the flat around it, and that is nearly all the eye
      gets. So: the shell is white; the dimples are smaller, over nine
      to a face; most of what each one carries is a soft darkening at
      its centre, with only a whisper of the lit and shadowed walls on
      top so a close look still shows a bowl; and the lattice is
      slightly turned so the rows do not line up with the face's edges
      and read as a grid.
    */
    // Thirty-four dimples round the die (20 Oct 2026), so the lattice
    // closes up behind it. It used to be turned eleven degrees so the
    // rows did not run with the edges; a turned lattice never comes back
    // to where it started round the die, so it runs straight now.
    const size = RING / (34 * Math.sqrt(3));
    const R = size * 0.58;
    const rx = x;
    const ry = y;
    const cell = hexCell(rx, ry, size);
    const u = Math.min(1, cell.d / R);
    const inside = smoothstep(1, 0.86, u);
    const tilt = u * 0.72 * (Math.PI / 2);
    const dir = cell.d > 1e-6 ? 1 / cell.d : 0;
    const nx = -(rx - cell.cx) * dir * Math.sin(tilt);
    const ny = -(ry - cell.cy) * dir * Math.sin(tilt);
    const nz = Math.cos(tilt);
    const L = 1 / Math.sqrt(3);
    const delta = (-nx * L - ny * L + nz * L - L) * inside;
    // The hollow as a whole sits a little in shade: deepest at the
    // centre, nothing at the rim.
    const hollow = inside * (1 - u * u) * 0.3;

    // A flat shell, just off white so a lit rim still has somewhere to
    // go. The old painted fall-off across the sheet is gone: the die's
    // shade map (dieShading.ts) rounds the body far better than paint
    // can, and the paint left one side paler than the rest.
    let px: [number, number, number] = rgb('#f5f8f9');
    px = mixRgb(px, rgb('#b8c2c6'), hollow);
    if (delta < 0) px = mixRgb(px, rgb('#9aa6ab'), Math.min(1, -delta * 0.9));
    else px = mixRgb(px, rgb('#ffffff'), Math.min(1, delta * 1.2));
    return px;
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

      SINCE 18 OCT 2026 IT IS THE BALL ITSELF. A flat hex lattice cannot
      be folded round a cube without breaking at the edges, and a real
      football is not a lattice anyway: it is twelve pentagons and twenty
      hexagons that close up into one ball. So the die is painted from
      that ball (soccerPanelAt) — every panel where a real one would be,
      every seam a straight stitched line, and nothing breaking at any
      edge or corner. The pentagons are never neighbours by construction.
    */
    const panel = soccerPanelAt(sheetToCube(x, y));

    // White leather, with the grain barely showing.
    let px = mixRgb(rgb('#f7f5f0'), rgb('#dcd8cf'), wrappedNoise(x, y, 16) * 0.55);
    if (panel.pent) px = rgb('#1b1826');
    // The seam: one thin stitched line on every panel edge. Kept narrow
    // on purpose — a wide soft groove either side of a black panel read
    // as a smudge at 64 texels a side, not as an edge.
    return mixRgb(px, rgb('#77727e'), smoothstep(1.0, 0.35, panel.seam) * 0.85);
  },

  basketball: (x, y) => {
    /*
      A basketball, redrawn 19 Oct 2026 — David: "make the basketball
      dice look better." The last version was a brown box: a rust hide
      under a heavy pebble, with seams so close to the face's edges that
      each side wore a dark rounded frame rather than a ball's panels.

      Now the hide is the bright orange a basketball actually is, the
      pebble is fine and quiet, and the seams are a BALL'S seams since
      21 Oct 2026: two of them, each one closed curve wound round a body
      diagonal of the die (seamAt, the baseball's curve, on two of the
      four diagonals), so each runs unbroken over every edge, crosses
      every side once through a corner region, and never runs under a
      colour sticker. From any side the sticker sits in the ball the way
      a logo does, with a black seam bowing round it on each side — and
      because the two curves take different corners on different sides,
      no two sides are the same picture.
    */
    const P = sheetToCube(x, y);
    const seam = Math.min(Math.abs(seamAt(P).off), Math.abs(seamAt(P, SEAM_SWING, SEAM_FRAME_B).off));
    // Pebble: a fine bumpy grain of the point in space, lit from one
    // direction, so it is the same pebble seen from every side.
    const d = 0.9;
    const lit =
      (cubeNoise([P[0] - d, P[1] - d, P[2] - d], 2.6) - cubeNoise([P[0] + d, P[1] + d, P[2] + d], 2.6)) * 1.6;
    let px = mixRgb(rgb('#e0691f'), rgb('#f08a3c'), cubeNoise(P, 32));
    px = mixRgb(px, rgb('#f7ab66'), Math.max(0, lit) * 0.32);
    px = mixRgb(px, rgb('#a84a14'), Math.max(0, -lit) * 0.3);
    // The seam: a black channel with the hide lipping over its edges.
    px = mixRgb(px, rgb('#1a1418'), smoothstep(2.4, 1.2, seam));
    px = mixRgb(px, rgb('#9a4514'), smoothstep(3.6, 2.4, seam) * 0.45);
    return px;
  },
  cookie: (x, y) => {
    /*
      A regular, classic chocolate-chip cookie. Full colour since
      19 Oct 2026, and this is the third paint of the day.

      David: "make the cookie dice look better" — then "I still don't
      like the cookie" — then "No, make it look like a regular classic
      chocolate chip cookie." The first redo had ragged chips that read
      as mud; the second swung the other way to pale sand with neat
      little ovals stuck on, which is a sugar cookie with buttons.

      A classic cookie is warm tan-brown dough, not pale gold — baked,
      lumpy, a little darker where it browned — and the chips are
      proper morsels: rounded, slightly irregular, a good size, in a
      warm chocolate brown rather than black, each sunk a little into
      the dough with the dough darkened round its base where it
      melted. No sugar sparkle, no pale cracks: nothing a plain cookie
      does not have.
    */
    const DOUGH = rgb('#d59d5c');
    const RISEN = rgb('#e6b878');
    const TOASTED = rgb('#ad6f30');
    const CHOC = rgb('#4e2b17');
    const CHOC_LIT = rgb('#80502e');
    const CHOC_EDGE = rgb('#30190c');
    const GLINT = rgb('#a9815f');
    const MELT = rgb('#9a5f27');

    // The dough: lumpy, lit from the upper left, browner in patches.
    const slope = wrappedNoise(x - 1.2 + 7, y - 1.2 + 3, 16) - wrappedNoise(x + 1.2 + 7, y + 1.2 + 3, 16);
    // Whole-number scales only: a fractional one never comes back round
    // the die (see fbm's note), and this showed as a join at the seam.
    const brown = wrappedNoise(x + 33, y + 15, 32);
    const fine = wrappedNoise(x * 2 + 21, y * 2 + 9, 8);
    let px = mixRgb(DOUGH, RISEN, Math.max(0, slope) * 1.6);
    px = mixRgb(px, TOASTED, Math.max(0, -slope) * 1.3);
    px = mixRgb(px, TOASTED, smoothstep(0.55, 0.78, brown) * 0.45);
    px = mixRgb(px, mixRgb(DOUGH, TOASTED, 0.5), (fine - 0.5) * 0.18 + 0.09);

    /*
      The morsels. One big per 16-cell and a small one where it lands
      clear of it; the three-by-three neighbourhood is searched so a
      chip straddling a cell's edge carries on, and the cells go once
      round the die (RING), so the four sides carry different chips.
    */
    const CELL = 16;
    const N = RING / CELL;
    const cx0 = Math.floor(x / CELL);
    const cy0 = Math.floor(y / CELL);
    let cover = 0;
    let melt = 0;
    let chip: [number, number, number] = CHOC;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const gx = cx0 + ox;
        const gy = cy0 + oy;
        const wx = ((gx % N) + N) % N;
        const wy = ((gy % N) + N) % N;
        const p1x = 4.5 + hashCell(wx * 4, wy * 4 + 2) * (CELL - 9);
        const p1y = 4.5 + hashCell(wx * 4, wy * 4 + 3) * (CELL - 9);
        for (let k = 0; k < 2; k++) {
          const h = hashCell(wx * 4 + k, wy * 4 + 1);
          const lx = k === 0 ? p1x : 2.5 + hashCell(wx * 4 + 1, wy * 4 + 2) * (CELL - 5);
          const ly = k === 0 ? p1y : 2.5 + hashCell(wx * 4 + 1, wy * 4 + 3) * (CELL - 5);
          if (k === 1 && (h < 0.5 || Math.hypot(lx - p1x, ly - p1y) < 10)) continue;
          const R = k === 0 ? 3.2 + h * 1.2 : 1.6 + h * 0.5;
          const dx = x - (gx * CELL + lx);
          const dy = y - (gy * CELL + ly);
          if (Math.abs(dx) > R + 2.5 || Math.abs(dy) > R + 2.5) continue;
          // A morsel: rounded, a little irregular, turned its own way.
          const ang = h * Math.PI;
          const u = dx * Math.cos(ang) + dy * Math.sin(ang);
          const v = -dx * Math.sin(ang) + dy * Math.cos(ang);
          const a = Math.atan2(v, u);
          const wobble = 1 + 0.09 * Math.sin(3 * a + h * 11) + 0.05 * Math.sin(5 * a + h * 29);
          const e = Math.hypot(u / (R * wobble), v / (R * (0.8 + h * 0.2) * wobble));
          const c = smoothstep(1.0, 0.86, e);
          // The dough darkens where the chocolate melted into it.
          melt = Math.max(melt, smoothstep(1.55, 1.0, e) * 0.5);
          if (c <= cover) continue;
          cover = c;
          const toward = (-dx - dy) / (R * 1.6);
          let col = mixRgb(CHOC, CHOC_LIT, Math.max(0, Math.min(1, toward * 0.7 + 0.35)));
          col = mixRgb(col, CHOC_EDGE, smoothstep(0.66, 0.96, e) * 0.6);
          if (Math.hypot(dx + R * 0.33, dy + R * 0.38) < R * 0.17) col = GLINT;
          chip = col;
        }
      }
    }
    px = mixRgb(px, MELT, melt * (1 - cover));
    return mixRgb(px, chip, cover);
  },

  laces: (x, y) => {
    /*
      A football, redrawn 19 Oct 2026 — David: "make the football dice
      look better", then of the first redo, "I don't like this football."
      This is the football everybody draws: a warm chestnut hide, smooth
      but for the faintest grain, one clean white spine with fat laces
      across it, and two thin white stripes toward the ends.

      ON THE BALL since 21 Oct 2026, not once per side. The ball's long
      axis is the die's long diagonal: the laced spine runs round the die
      along the seam curve (seamAt), so it crosses every side once,
      through a corner region, and turns every edge unbroken; the two
      stripes are the rings near the two ends of that axis — a small
      triangle of white round the +++ corner and another round the ---
      corner — so each side carries laces in one corner and a stripe in
      the opposite one, and the laces never run under a sticker.
    */
    const P = sheetToCube(x, y);
    const d = 0.8;
    const lit =
      (cubeNoise([P[0] - d, P[1] - d, P[2] - d], 2.2) - cubeNoise([P[0] + d, P[1] + d, P[2] + d], 2.2)) * 1.2;
    let px = mixRgb(rgb('#b45a30'), rgb('#cd7343'), cubeNoise(P, 32));
    px = mixRgb(px, rgb('#e08a58'), Math.max(0, lit) * 0.14);
    px = mixRgb(px, rgb('#7e3a1a'), Math.max(0, -lit) * 0.14);
    // Lit from one side of the die, so the hide reads as curved.
    px = mixRgb(px, rgb('#e39560'), smoothstep(40, -40, P[0] + P[1] + P[2]) * 0.22);

    const WHITE = rgb('#f8f4ea');
    const CREAM = rgb('#d9cfb9');
    const { off, along, g } = seamAt(P);
    // The spine, and laces across it in a steady rhythm along the seam:
    // twenty-one right round the die, each a rounded bar.
    const side = Math.abs(off);
    let lace = smoothstep(2.0, 1.3, side);
    const rhythm = (along / (Math.PI * 2)) * 21;
    // Signed texels from the nearest lace along the seam: the seam is
    // about 270 texels round, so the laces sit about 13 apart.
    const s = (rhythm - Math.round(rhythm)) * 13;
    const across = Math.max(0, side - 4.2);
    lace = Math.max(lace, smoothstep(1.9, 1.1, Math.hypot(across, s)));
    if (lace > 0) {
      // A lace is a round cord: lit on top, a little shaded underneath.
      const under = smoothstep(0.2, 1.2, s);
      px = mixRgb(px, mixRgb(WHITE, CREAM, under * 0.5), lace);
    }
    // The two stripes: rings round the ends of the ball's axis.
    const stripe = Math.abs(Math.abs(g) - 40);
    px = mixRgb(px, mixRgb(WHITE, CREAM, 0.2), smoothstep(1.6, 0.8, stripe));
    return px;
  },

  volleyball: (x, y) => {
    /*
      A volleyball, redrawn 19 Oct 2026 — David: "make the volleyball
      dice look better." The old one split every face into four quarters
      with their own diagonal stripes and read as a harlequin quilt. A
      volleyball is a white ball with blue and yellow panels sweeping
      round it in curved bands, and that sweep is what the eye wants.

      ROUND THE WHOLE BALL since 21 Oct 2026. It was one curve of panels
      per side, the same picture six times, stopping dead at every edge.
      Now the bands are wound round the die's long diagonal — the seam
      curve's own value (seamAt's `g`) cut into panels of equal width —
      so each band bends across a side, turns the edge and carries on
      round the next, with a clean dark seam between each pair and a soft
      dome of light on every panel. Every side carries white, blue and
      yellow, and no two sides show the same stretch of it.
    */
    const P = sheetToCube(x, y);
    // A bigger swing than the seam's: the panels are meant to curve.
    const { g } = seamAt(P, 0.16);
    const W = 13.5;
    const t = (g + 61) / W;
    const band = ((Math.floor(t) % 3) + 3) % 3;
    const frac = t - Math.floor(t);
    const WHITE = rgb('#f4f1ea');
    const BLUE = rgb('#2b4f9e');
    const YELLOW = rgb('#dca81a');
    let px = band === 1 ? BLUE : band === 2 ? YELLOW : WHITE;
    // Each panel is domed: lighter down its middle, shaded at its seams.
    const dome = 0.5 - Math.abs(frac - 0.5);
    px = mixRgb(px, rgb('#ffffff'), dome * 0.35);
    px = mixRgb(px, rgb('#000000'), smoothstep(0.3, 0.5, Math.abs(frac - 0.5)) * 0.12);
    // The seam: a dark channel, with the leather lipping over its edges.
    // 0.816 is the band's slope across a face: every face sits at the
    // same angle to the diagonal, so the panels are the same width on all.
    const seam = (Math.min(frac, 1 - frac) * W) / 0.816;
    px = mixRgb(px, rgb('#4a4842'), smoothstep(1.2, 0.5, seam) * 0.85);
    px = mixRgb(px, rgb('#ffffff'), smoothstep(2.4, 1.2, seam) * smoothstep(0.5, 1.2, seam) * 0.25);
    // The faintest grain of synthetic leather.
    return mixRgb(px, rgb('#000000'), (cubeSpeck(P) - 0.5) * 0.04 + 0.02);
  },
  bowling: (x, y) => {
    /*
      Polished resin: a swirl marbled through it, a hard gloss highlight,
      and finger holes with depth. It was a flat dark cube with a corner
      glow — the least visible pattern in the whole set.

      ONE BALL since 21 Oct 2026. The swirl was a wave of the sheet, the
      gloss a dot placed on each side and the three holes stamped on
      every side; now the swirl is noise of the point in space, so it
      runs over every edge and diagonal without a kink, the gloss is one
      sweep of light round the whole die (sweepOfLight, the metals'
      highlight) so every side catches it, and the finger holes are
      stickers on the die (StickerSheet) — three on the front, in the
      corner, as a bowling ball has — with two more sets on other sides
      so a resting die shows holes from almost any angle.
    */
    const P = sheetToCube(x, y);
    let px = mixRgb(rgb('#221d30'), rgb('#463a66'), cubeNoise(P, 32) * 0.9);
    const swirl = Math.sin((P[0] * 0.9 + P[1] * 0.4 + P[2] * 0.6) * 0.12 + cubeFbm(P, [32, 16], [1, 0.5]) * 6);
    px = mixRgb(px, rgb('#6b4da3'), smoothstep(0.25, 1, swirl) * 0.6);
    // The gloss: a soft sheet of light with a hard glint in it.
    const gloss = sweepOfLight(P, 2.6, 11, 0.55, 0.5, 4.2, 0.4);
    px = mixRgb(px, rgb('#bfb2e0'), Math.min(1, gloss) * 0.6);
    px = mixRgb(px, rgb('#ffffff'), smoothstep(0.5, 0.95, gloss) * 0.55);
    for (const { lx, ly } of BOWLING_HOLES.hits(P)) {
      const d = Math.hypot(lx, ly);
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

      Since 18 Oct 2026 they are placed over the WHOLE die (COW_PATCHES)
      instead of six repeated on every side, which printed the same
      markings six times over. The front keeps the original six.
    */
    let px = mixRgb(rgb('#efece4'), rgb('#ffffff'), wrappedNoise(x, y, 16));
    let inside = false;
    // The edge of every patch is chewed by the same noise, worked out
    // once and only when a patch is near (it used to be worked out six
    // times a pixel, once per patch, which made this the slowest die).
    let chew = NaN;
    for (const [cx, cy, rx, ry, cos, sin, reach] of COW_PATCHES) {
      // Measured the short way round the die, so a patch near the back
      // edge comes round onto the front.
      const dx = mod(x - cx + RING / 2, RING) - RING / 2;
      const dy = y - cy;
      if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue;
      if (Number.isNaN(chew)) chew = fbm(x * 2, y * 2, [32, 16], [1, 0.6]) * 0.5 - 0.15;
      const ux = dx * cos + dy * sin;
      const uy = -dx * sin + dy * cos;
      if (Math.hypot(ux / rx, uy / ry) + chew < 1) {
        inside = true;
        break;
      }
    }
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
    // Fifty-eight scales round the die (4.41px, from 4.4).
    const scale = RING / 58;
    const su = (x + y) / scale;
    const sv = (x - y) / scale;
    const fu = su - Math.floor(su) - 0.5;
    const fv = sv - Math.floor(sv) - 0.5;
    const keel = -(fu + fv) * 1.4;
    let px = mixRgb(
      rgb('#97ac60'),
      rgb('#c6d393'),
      hashCell(mod(Math.floor(su), 58), mod(Math.floor(sv), 58)) * 0.7,
    );
    px = mixRgb(px, rgb('#e4ecc1'), Math.max(0, keel) * 0.4);
    px = mixRgb(px, rgb('#606f37'), Math.max(0, -keel) * 0.45);
    px = mixRgb(px, rgb('#4e5b2d'), smoothstep(0.4, 0.5, Math.max(Math.abs(fu), Math.abs(fv))) * 0.5);
    /*
      The saddles. Bigger than the scales by a long way, wandering with
      the noise so they are not a stamped grid, and edged in cream — the
      edging is most of what makes a snake read as a snake.
    */
    // Unscaled: x * 0.7 does not go round the die a whole number of times.
    const wobble = fbm(x, y, [32, 16], [1, 0.5]) * 9 - 4.5;
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
      Comb, rebuilt 31 Aug 2026. The first pass took the min edge-
      distance across three stripe axes — which draws the triangular
      DUAL of a hex grid, a fine gold mesh with not one hexagon in it,
      and the sweeping `lit` gradient over the top read as brushed
      metal. Hexagons are the entire signal of this skin, so this one
      uses hexCell (the soccer ball's lattice) for real cells, LARGE —
      about three across a face, because at die scale fine cells
      collapse into shimmer. Amber wax floors that sink darker toward
      each hole's middle, honey-brown walls a couple of pixels thick
      with a lit flank and a shadowed one, light spilling over each
      cell's top rim, and about a third of the cells flooded to the
      brim with glossy honey.
    */
    // Twelve cells round the die (12.3px, from 12), so the comb closes.
    const h = hexCell(x, y, RING / (12 * Math.sqrt(3)));
    // Roughly how many pixels this point sits in from the cell wall.
    const rim = (1 - h.t) * 10.9;
    const dy = (y - h.cy) / 12;
    // The wax floor: amber, deeper and darker toward the hole's middle.
    const grain = wrappedNoise(x, y, 16);
    let px = mixRgb(rgb('#c8891f'), rgb('#e2a83c'), grain);
    px = mixRgb(px, rgb('#74470e'), smoothstep(2.2, 7.5, rim) * 0.58);
    // Light spills over the top rim; the near wall shades the bottom.
    px = mixRgb(px, rgb('#f6d478'), smoothstep(3.4, 1.1, rim) * smoothstep(0.1, -0.45, dy) * 0.7);
    px = mixRgb(px, rgb('#5c3a0e'), smoothstep(3.4, 1.1, rim) * smoothstep(-0.1, 0.45, dy) * 0.35);
    // A random third of the cells are full: glossy pooled honey.
    if (hashCell(mod(h.q, 12) * 5 + 13, h.r * 7 + 4) < 0.34) {
      let honey = mixRgb(rgb('#a85708'), rgb('#d98a16'), smoothstep(0.5, 6, rim));
      honey = mixRgb(honey, rgb('#f2b14a'), smoothstep(0.15, -0.4, dy) * 0.4);
      const gleam = Math.hypot(x - h.cx + 3.2, y - h.cy + 3.6) / 12;
      honey = mixRgb(honey, rgb('#ffe9a8'), smoothstep(0.3, 0.06, gleam) * 0.72);
      px = mixRgb(px, honey, smoothstep(1.2, 2.6, rim));
    }
    // The wall itself: dark honey-brown, its sunward flank lit wax.
    const flank = 0.5 + ((y - h.cy) / Math.max(h.d, 0.001)) * 0.45;
    const wallTone = mixRgb(rgb('#4e300a'), rgb('#d9a84e'), flank);
    return mixRgb(px, wallTone, smoothstep(2.0, 0.8, rim));
  },

  bubbles: (x, y) => {
    /*
      Real soap bubbles: round, overlapping, thin-walled, with a bright
      specular dot near the top left of each and the faint rainbow a
      soap film throws. The mask version could only tint toward one ink,
      so every bubble was the same flat outline in the same one colour.
    */
    // Seventeen bubbles round the die (15.06px, from 15).
    const cell = RING / 17;
    let px = mixRgb(rgb('#bfe2f7'), rgb('#dff0fc'), fbm(x, y, [32, 16], [1, 0.5]));
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const row = Math.floor(y / cell) + dy;
        const col = Math.floor(x / cell) + dx;
        const h = hashCell(mod(col, 17), row);
        const offset = ((row % 2) + 2) % 2 === 0 ? 0 : cell / 2;
        const cx = col * cell + offset + (h - 0.5) * 4 + cell / 2;
        const cy = row * cell + (hashCell(mod(col, 17) + 9, row) - 0.5) * 4 + cell / 2;
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

  /**
   * Blossom: scattered five-petal cherry flowers and a few drifting
   * petals on the pink shell. Until 31 Aug 2026 this skin was `plain` —
   * the one skin whose name promised a picture and delivered a flat
   * pink cube.
   *
   * Built the way frost's snowflakes are: fixed, deterministic shapes
   * (no Math.random — the shelf and the table must show the same dice),
   * SUPERSAMPLED because a 1px petal rim on a 64px grid shreds into
   * stair-steps at any rotation. It mixes its own paint: white petal
   * tips, a pink blush at their base, a deeper pink outline and a gold
   * heart are four colours, and a mask only travels toward one ink.
   *
   * The flowers are stickers on the die since 21 Oct 2026 (BLOSSOMS): it
   * used to be the same four flowers and two half-flowers on every side,
   * and now they are strewn over the whole die, two whole flowers and
   * two loose petals to a side, some lying across an edge.
   */
  blossom: (x, y) => {
    const flower = (
      dx: number,
      dy: number,
      R: number,
    ): [number, number, number] | null => {
      const r = Math.hypot(dx, dy);
      if (r > R * 1.15) return null;
      // The gold heart, ringed darker where the stamens meet the petals.
      if (r < R * 0.22) return r > R * 0.15 ? rgb('#cd9033') : rgb('#f0c14d');
      // Fold into one of five sectors, exactly as frost folds into six.
      const sector = (Math.PI * 2) / 5;
      const a = Math.atan2(dy, dx);
      const folded = (((a % sector) + sector) % sector) - sector / 2;
      const along = (r * Math.cos(folded)) / R;
      const across = Math.abs(r * Math.sin(folded)) / R;
      // Each petal is an ellipse pushed out along its sector's axis.
      const e = Math.hypot((along - 0.55) / 0.45, across / 0.3);
      if (e < 1) {
        // White at the tip, blushing pink toward the heart.
        return mixRgb(rgb('#fff7fa'), rgb('#f6b9d0'), 1 - smoothstep(0.3, 0.62, along));
      }
      // A deeper pink outline — it is what keeps a white flower legible
      // on a pink die at arm's length, and it draws the seams between
      // neighbouring petals for free.
      if (e < 1.35) return rgb('#df7fa6');
      return null;
    };

    const petal = (u: number, v: number): [number, number, number] | null => {
      const e = Math.hypot(u / 3.4, v / 2);
      // Deeper pink than the flowers' petals: a petal on its own has no
      // outline of neighbours to lift it off the shell.
      if (e < 1) return mixRgb(rgb('#f2aac7'), rgb('#fdeaf2'), smoothstep(-2.5, 2.5, u));
      if (e < 1.45) return rgb('#df7fa6');
      return null;
    };

    // Flowers first, so a drifting petal that reaches one slides UNDER
    // it rather than across its face.
    const sample = (P: readonly number[]): [number, number, number] | null => {
      for (const { s, lx, ly } of BLOSSOMS.hits(P)) {
        const hit = flower(lx, ly, 8 + s.h * 1.5);
        if (hit) return hit;
      }
      for (const { lx, ly } of BLOSSOM_PETALS.hits(P)) {
        const hit = petal(lx, ly);
        if (hit) return hit;
      }
      return null;
    };

    // Supersample 3x3 — frost's lesson: thin edges on a 64px grid only
    // survive rotation with partial coverage along every boundary.
    const N = 3;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let sy = 0; sy < N; sy++) {
      for (let sx = 0; sx < N; sx++) {
        const P = sheetToCube(x + (sx + 0.5) / N - 0.5, y + (sy + 0.5) / N - 0.5);
        // The shell between the flowers: the skin's own pink, gently
        // mottled so the ground reads as petal-strewn air, not plastic.
        const c = sample(P) ?? mixRgb(rgb('#f5d7e3'), rgb('#eec6d8'), cubeNoise(P, 16) * 0.6);
        sr += c[0];
        sg += c[1];
        sb += c[2];
      }
    }
    return [Math.round(sr / (N * N)), Math.round(sg / (N * N)), Math.round(sb / (N * N))];
  },

  /**
   * Lavender: sprigs of the plant itself — a thin green stem curving up
   * to a spike of purple buds, a pair of leaves at its foot — strewn
   * over the lilac shell, with a few loose buds adrift between them.
   * Until 31 Aug 2026 this skin was `plain`: next to frost's snowflakes
   * it was a paint swatch, and the name promised a flower it never drew.
   *
   * Built the way blossom was, and for the same reasons: fixed
   * deterministic shapes (no Math.random), 3x3 supersampled because a
   * 1px stem on a 64px grid shreds into stair-steps without partial
   * coverage, and its own paint — green stems under purple buds is two
   * hues on a lilac ground, one more than a mask's single ink.
   *
   * The sprigs are stickers on the die since 21 Oct 2026 (LAVENDER
   * below): the same five sprigs used to stand on every side, and now
   * they lie every which way over the whole die, two to a side, some
   * bending over an edge. One sprig's geometry (stem bowed, buds
   * staggered up the spike) is worked out once, in the sprig's own
   * frame, and every sticker is that sprig turned and placed.
   */
  lavender: (() => {
    type Ellipse = { cx: number; cy: number; ca: number; sa: number; t: number };
    // The sprig stands in its own frame: the foot at (0, 9.5), the stem
    // rising to the tip at the top, bowed a little to one side.
    const LEN = 19;
    const BOW = 1.6;
    const FOOT = 9.5;
    const pos = (t: number): [number, number] => [BOW * t * t, FOOT - LEN * t];
    const tangentAngle = (t: number) => Math.atan2(-LEN, 2 * BOW * t);
    const ellipse = (t: number, side: number, out: number, tilt: number): Ellipse => {
      const [cx, cy] = pos(t);
      const a = tangentAngle(t) + side * tilt;
      return { cx: cx + side * out, cy, ca: Math.cos(a), sa: Math.sin(a), t };
    };
    // The spike: staggered pairs up the top half of the stem, tilted
    // outward like the real plant's whorls, and one terminal bud.
    const BUDS = [
      ellipse(0.52, 1, 1.7, 0.55),
      ellipse(0.64, -1, 1.7, 0.55),
      ellipse(0.76, 1, 1.7, 0.55),
      ellipse(0.88, -1, 1.7, 0.55),
      ellipse(1.03, 0, 0, 0),
    ];
    const LEAVES = [ellipse(0.18, 1, 2.2, 0.9), ellipse(0.34, -1, 2.2, 0.9)];
    /*
      Three to a side: at two, rendered on the table, the lilac shell
      showed through more than the plant did.

      Which three matters. A sprig is thin, and one lying over an edge
      gives half its paint to the next side while one pointed at a
      corner loses its spike past it — so with three a side, which
      sides end up carrying the plant depends on where they fell. The
      first scatter tried (seed 41, centres 7 from a corner) left the
      front with half the sprig of the top, and tests/textures.test.ts
      rightly called that a blank side. This one was picked by
      measuring every seed up to 120: every side carries within a tenth
      of the same amount, and keeping the centres a sprig's length from
      the corners means no spike is ever lost round one.
    */
    const SPRIGS = new StickerSheet(scatterStickers(89, 3, 13.5, 15, 3, 13));
    const LOOSE = new StickerSheet(scatterStickers(43, 2, 3, 8, 1));

    // A bud, shaded deep purple at its base toward a paler tip.
    const budPaint = (u: number): [number, number, number] =>
      mixRgb(rgb('#6a49b0'), rgb('#9a76dd'), smoothstep(-2.4, 2.4, u));

    const inEllipse = (px: number, py: number, e: Ellipse, ra: number, rb: number): number | null => {
      const ox = px - e.cx;
      const oy = py - e.cy;
      const u = ox * e.ca + oy * e.sa;
      const v = -ox * e.sa + oy * e.ca;
      return Math.hypot(u / ra, v / rb) < 1 ? u : null;
    };

    const sample = (P: readonly number[]): [number, number, number] | null => {
      for (const { lx, ly } of SPRIGS.hits(P)) {
        // Buds first: the spike sits over the stem's tip.
        for (const b of BUDS) {
          const u = inEllipse(lx, ly, b, 2.4, 1.4);
          if (u !== null) return budPaint(u);
        }
        for (const l of LEAVES) {
          const u = inEllipse(lx, ly, l, 3.0, 1.0);
          if (u !== null) return mixRgb(rgb('#4f7345'), rgb('#6f9a60'), smoothstep(-3, 3, u));
        }
        // The stem: how far up it this point is, then the distance to
        // the bowed stem there. The bow is small enough that the
        // projection error is far under a pixel.
        const t = Math.max(0, Math.min(1, (FOOT - ly) / LEN));
        const [cx, cy] = pos(t);
        if (Math.hypot(lx - cx, ly - cy) < 0.8) return mixRgb(rgb('#46683c'), rgb('#5e8752'), t);
      }
      for (const { lx, ly } of LOOSE.hits(P)) {
        const u = inEllipse(lx, ly, { cx: 0, cy: 0, ca: 1, sa: 0, t: 1 }, 2.4, 1.4);
        if (u !== null) return budPaint(u);
      }
      return null;
    };

    return (x: number, y: number): [number, number, number] => {
      // Supersample 3x3 — blossom's lesson, which was frost's lesson:
      // thin edges on a 64px grid only survive rotation with partial
      // coverage along every boundary.
      const N = 3;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const P = sheetToCube(x + (sx + 0.5) / N - 0.5, y + (sy + 0.5) / N - 0.5);
          let c = sample(P);
          if (!c) {
            // The shell between the sprigs: the skin's own lilac, gently
            // mottled, with a sparse darker-purple speckle so the ground
            // reads as a field of distant florets rather than plastic.
            c = mixRgb(rgb('#c0b0ea'), rgb('#9d89d6'), cubeNoise(P, 16) * 0.4);
            c = mixRgb(c, rgb('#8f7ac9'), smoothstep(0.8, 0.92, cubeNoise([P[0] + 9, P[1] + 4, P[2] + 2], 2.2)) * 0.6);
          }
          sr += c[0];
          sg += c[1];
          sb += c[2];
        }
      }
      return [Math.round(sr / (N * N)), Math.round(sg / (N * N)), Math.round(sb / (N * N))];
    };
  })(),

  fish: (() => {
    /*
      Goldfish, 31 Aug 2026.

      David, 26 Aug 2026: "the fish should have fish on it" — and the
      first pass at that drew sixteen thumbnail fish in mid-blue on
      light-blue water, which at die size read as plain speckled blue.
      Rebuilt as big orange goldfish — the one hue no blue-shell mask
      could mix, and the only orange-on-blue die in the set.

      SWIMMING ROUND THE DIE since 21 Oct 2026. The same four fish used
      to sit on every side; now the school is strewn over the whole die
      as stickers (GOLDFISH), two to a side with some crossing an edge,
      each headed its own way, over water whose ripple is noise of the
      point in space, so nothing breaks at any edge.

      This is the STILL picture — the shop card. The die on the board
      paints the water and the fish apart so the fish can swim
      (fishSwim.ts); both take their shapes from goldfish.ts.
    */
    const RIGHT: readonly FishPlace[] = [[0, 0, 1, 0]];
    const LEFT: readonly FishPlace[] = [[0, 0, -1, 0]];
    return (x: number, y: number): [number, number, number] => {
      // Supersample 3x3 — blossom's lesson: tilted edges on a 64px grid
      // only survive with partial coverage along every boundary.
      const N = 3;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const P = sheetToCube(x + (sx + 0.5) / N - 0.5, y + (sy + 0.5) / N - 0.5);
          let c: Rgb | null = null;
          for (const { s, lx, ly } of GOLDFISH.hits(P)) {
            c = goldfishAt(lx, ly, s.kind === 0 ? RIGHT : LEFT);
            if (c) break;
          }
          c = c ?? fishWaterAt(P);
          sr += c[0];
          sg += c[1];
          sb += c[2];
        }
      }
      return [Math.round(sr / (N * N)), Math.round(sg / (N * N)), Math.round(sb / (N * N))];
    };
  })(),
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
 * One shell colour at a sheet coordinate, unrounded.
 */
type Sampler = (sx: number, sy: number) => [number, number, number];

/**
 * The colour of a pattern at any SHEET coordinate, fractions included.
 * `base` is the skin's own colour and `ink` is the pattern colour drawn
 * over it; a colour painter ignores the ink and mixes its own paint.
 *
 * Every design is asked for its place on the whole sheet. Until 21 Oct
 * 2026 a third of them — a pizza per side, a compass per side, a
 * highlight per side — were asked for their place on their own face
 * instead (PER_FACE_MOTIFS, now gone), which stamped one picture on each
 * side and left a seam at every edge. David: "Make sure EVERY DICE has a
 * continuous pattern that flows on every side of it." They are painted
 * on the die now, like everything else; see "Painting on the cube
 * itself" above.
 *
 * patternPixels asks it once per texel; edge texels are asked again at
 * sub-texel points (see SMOOTH_EDGES). Exported so the suite can check
 * that every painter on that list really is a smooth function of
 * position.
 */
export function shellSampler(
  pattern: Exclude<PatternId, 'plain'>,
  base: string,
  ink: string,
): Sampler {
  // The full-colour patterns paint their own pixels outright.
  if (COLOR_IDS.has(pattern)) {
    const paintColor = COLOR_PAINTERS[pattern as ColorPatternId];
    return (sx, sy) => paintColor(sx, sy);
  }

  const [br, bg, bb] = rgb(base);
  const [ir, ig, ib] = rgb(ink);
  const paint = PAINTERS[pattern as MaskPatternId];
  return (sx, sy) => {
    const mask = Math.max(-1, Math.min(1, paint(sx, sy)));
    // Positive tints toward the ink, negative darkens the shell itself.
    const mix = (b: number, i: number) =>
      mask >= 0 ? b + (i - b) * mask : b * (1 + mask * SHADE_DEPTH);
    return [mix(br, ir), mix(bg, ig), mix(bb, ib)];
  };
}

/**
 * The painters whose hard edges are smoothed by sampling again INSIDE
 * the texel, on the texels that sit on an edge.
 *
 * 18 Oct 2026, "crisper at the shelf and preview sizes". A painter that
 * decides in or out per texel — a leopard's rosette, a cow's patch, a
 * snake's diamond — draws its edges as a raw 64px staircase. On the
 * table a face is about 190 real pixels across and the Store card 174,
 * so every texel is magnified about three times and the staircase is
 * the first thing the eye finds: the spots look knitted. A texel that
 * straddles an edge now takes the AVERAGE of five points inside it, so
 * the boundary is partly-in and partly-out, which is what keeps an edge
 * straight when it is magnified.
 *
 * WHY ONLY ON EDGES. Five samples everywhere is five times the warm-up,
 * which paints 336 of these. A texel that matches its neighbours is
 * already right, and only the ones that differ sharply are re-asked, so
 * the cost lands where the staircase is and nowhere else.
 *
 * WHY A LIST and not every painter. Some painters are deliberately NOT
 * functions of a continuous position: denim's weave is `x % 2`, stars
 * and granite hash each whole texel into a sparkle or a speck. Asked at
 * x + 0.25 those give a different random texel, and averaging would
 * wash the speckle out rather than smooth an edge. Painters that already
 * supersample themselves (fish, blossom, waffle) gain nothing and would
 * pay nine times over. tests/textures.test.ts checks that everything
 * here is continuous, so a painter that grows a per-texel hash cannot
 * stay on the list unnoticed.
 */
export const SMOOTH_EDGES: ReadonlySet<string> = new Set([
  // Animals, where the staircase showed most.
  'rosettes',
  'tigerStripes',
  'patches',
  'giraffe',
  'diamonds',
  'shell',
  'peacock',
  // Balls and food: round shapes and seams.
  'soccer',
  'baseball',
  'tennis',
  'laces',
  'bowling',
  'dimples',
  'cookie',
  'candyStripes',
  'citrus',
  'chocolate',
  'strawberry',
  'honeycomb',
  'watermelon',
  'donut',
  'waffle',
  // Materials and the rest.
  'bubbles',
  'stars',
  'frost',
  'lavender',
  'tartan',
]);

/**
 * How far apart two neighbouring texels must be, in the largest of the
 * three channels, before they count as an edge. Below this a painter's
 * own ramp is doing the work already.
 */
const EDGE_STEP = 56;

/** Points inside a texel, as offsets from its sample point. */
const SUBSAMPLES: readonly (readonly [number, number])[] = [
  [-1 / 3, 1 / 6],
  [1 / 3, -1 / 6],
];

/** A colour for a texel of one square, fractions of a texel allowed. */
type TexelSampler = (x: number, y: number) => [number, number, number];

/**
 * Paint one 64x64 square from a texel sampler, smoothing the hard edges
 * of the painters on SMOOTH_EDGES. Shared by the shelf picture and every
 * side of the die, so the two cannot drift apart.
 */
function paintSquare(texel: TexelSampler, smooth: boolean): number[] {
  const px = new Float64Array(SIZE * SIZE * 3);
  for (let y = 0, i = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++, i += 3) {
      const c = texel(x, y);
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
    }
  }

  if (smooth) {
    // Mark both texels of every sharp step, across and down.
    const edge = new Uint8Array(SIZE * SIZE);
    const step = (a: number, b: number) =>
      Math.max(
        Math.abs(px[a] - px[b]),
        Math.abs(px[a + 1] - px[b + 1]),
        Math.abs(px[a + 2] - px[b + 2]),
      ) > EDGE_STEP;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const k = y * SIZE + x;
        if (x + 1 < SIZE && step(k * 3, (k + 1) * 3)) edge[k] = edge[k + 1] = 1;
        if (y + 1 < SIZE && step(k * 3, (k + SIZE) * 3)) edge[k] = edge[k + SIZE] = 1;
      }
    }
    for (let k = 0; k < SIZE * SIZE; k++) {
      if (!edge[k]) continue;
      const x = k % SIZE;
      const y = (k - x) / SIZE;
      const i = k * 3;
      let r = px[i];
      let g = px[i + 1];
      let b = px[i + 2];
      for (const [dx, dy] of SUBSAMPLES) {
        // Kept on this square, so an edge texel is averaged over its own
        // texel and not its neighbour's.
        const c = texel(
          Math.min(SIZE - 1, Math.max(0, x + dx)),
          Math.min(SIZE - 1, Math.max(0, y + dy)),
        );
        r += c[0];
        g += c[1];
        b += c[2];
      }
      const n = SUBSAMPLES.length + 1;
      px[i] = r / n;
      px[i + 1] = g / n;
      px[i + 2] = b / n;
    }
  }

  // Rounded to whole bytes. A Uint8Array used to truncate these for
  // free; the PNG encoder takes a plain array and a fractional byte
  // corrupts the stream.
  const out = new Array<number>(SIZE * SIZE * 3);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(px[i]);
  return out;
}

/**
 * Raw RGB bytes for a pattern, one triple per pixel.
 *
 * Shared by the 3D shell texture and the 2D preview in the Store and the
 * Inventory, so what is on the shelf cannot drift away from what ends up
 * in your hand. With no cell given this is the die's FRONT, exactly as
 * dieFacePixels paints it for +Z.
 */
export function patternPixels(
  pattern: Exclude<PatternId, 'plain'>,
  base: string,
  ink: string,
  /**
   * Where this square sits on the sheet, in whole squares. Every painter
   * is a function of position, so the square one to the right is the
   * CONTINUATION of the pattern rather than a copy of it. Defaults to the
   * origin — the front of the die, and what the shelf pictures show.
   */
  cellX = 0,
  cellY = 0,
): number[] {
  const sample = shellSampler(pattern, base, ink);
  const ox = cellX * SIZE;
  const oy = cellY * SIZE;
  return paintSquare((x, y) => sample(x + ox, y + oy), SMOOTH_EDGES.has(pattern));
}

/** The size every pattern is drawn at. */
export const PATTERN_SIZE = SIZE;

/**
 * Where each side of the die sits in the strip, in three.js's own face
 * order (+X, -X, +Y, -Y, +Z, -Z): a number 0..3 is a square of the strip,
 * and null is the top or the bottom, which are painted from the strip
 * carrying on over their four edges (see dieFaceSampler).
 *
 * David, 18 Oct 2026: "make all the dice have a continuous flowing design
 * instead of the same design copied and pasted to every side." The paper
 * cube net this replaced (UP over FRONT, LEFT-FRONT-RIGHT-BACK in a row)
 * looked continuous on paper and was not on the die. Rendering it showed
 * why: a face's texture is laid on with its own u running a particular
 * way round the box, and the net had put UP under FRONT rather than over
 * it — v runs upward on a side, so the row below on the sheet is the
 * BOTTOM. Of twelve edges, three joined.
 *
 * Read off RoundedBoxGeometry rather than assumed: on every side v runs
 * up the die, and u runs round it the same way on all four — +Z's u
 * leads onto +X, +X's onto -Z, -Z's onto -X and -X's back onto +Z. So
 * painting the four as consecutive squares in THAT order makes the
 * design run unbroken round the die, and because the painters repeat
 * across RING the strip closes up behind it too.
 */
export const DIE_FACE_SLOTS: readonly (number | null)[] = [1, 3, null, null, 0, 2];

/**
 * How far the top and bottom blend the two sides they carry on from, in
 * texels either side of the diagonal where they meet. Just enough to
 * draw that line smooth rather than as a staircase.
 */
const MITRE = 1;

/*
  The top and bottom, as the strip carrying on over each of their four
  edges.

  A cube cannot be unfolded flat with every edge joined, but every edge
  CAN join if each cap is cut into four triangles along its diagonals,
  each one painted as the continuation of the side it borders — the way
  a picture frame is mitred. All twelve edges of the die then flow, and
  the only joins left are the four diagonals of the top and bottom, which
  run from the corners into the middle, where the sticker covers half of
  each.

  For each edge: its distance from a texel (tx, ty) of the cap, and the
  sheet position that carries the side's design straight on over it.
  Worked out from RoundedBoxGeometry's UVs — the top's u runs along +X
  and its v toward -Z; the bottom's u along +X and its v toward +Z — and
  checked by tests/continuity.test.ts, which finds each edge's neighbours
  from the geometry itself.
*/
type CapRoute = [(tx: number, ty: number) => number, (tx: number, ty: number) => [number, number]];
const TOP_ROUTES: readonly CapRoute[] = [
  [(tx, ty) => ty + 0.5, (tx, ty) => [tx, SIZE + ty]], // over +Z
  [(tx) => SIZE - 0.5 - tx, (tx, ty) => [SIZE + ty, 2 * SIZE - 1 - tx]], // over +X
  [(tx, ty) => SIZE - 0.5 - ty, (tx, ty) => [3 * SIZE - 1 - tx, 2 * SIZE - 1 - ty]], // over -Z
  [(tx) => tx + 0.5, (tx, ty) => [RING - 1 - ty, SIZE + tx]], // over -X
];
const BOTTOM_ROUTES: readonly CapRoute[] = [
  [(tx, ty) => SIZE - 0.5 - ty, (tx, ty) => [tx, ty - SIZE]], // under +Z
  [(tx) => SIZE - 0.5 - tx, (tx, ty) => [2 * SIZE - 1 - ty, tx - SIZE]], // under +X
  [(tx, ty) => ty + 0.5, (tx, ty) => [3 * SIZE - 1 - tx, -1 - ty]], // under -Z
  [(tx) => tx + 0.5, (tx, ty) => [3 * SIZE + ty, -1 - tx]], // under -X
];

/**
 * The colour of any texel of one side of the die, from a sheet sampler.
 *
 * Exported so the edge test can paint a plain gradient through exactly
 * the mapping the dice use, and so can the preview tools.
 */
export function dieFaceSampler(sample: Sampler, face: number): TexelSampler {
  const slot = DIE_FACE_SLOTS[face];
  if (slot !== null) return (tx, ty) => sample(slot * SIZE + tx, ty);
  const routes = face === 2 ? TOP_ROUTES : BOTTOM_ROUTES;
  return (tx, ty) => {
    // The nearest edge, and the next nearest.
    let near = 0;
    let next = 1;
    let dNear = Infinity;
    let dNext = Infinity;
    for (let i = 0; i < 4; i++) {
      const d = routes[i][0](tx, ty);
      if (d < dNear) {
        next = near;
        dNext = dNear;
        near = i;
        dNear = d;
      } else if (d < dNext) {
        next = i;
        dNext = d;
      }
    }
    const [ax, ay] = routes[near][1](tx, ty);
    const a = sample(ax, ay);
    const gap = dNext - dNear;
    if (gap >= MITRE) return a;
    // On the mitre: half and half exactly on the diagonal.
    const [bx, by] = routes[next][1](tx, ty);
    const b = sample(bx, by);
    const w = 0.5 + 0.5 * smoothstep(0, MITRE, gap);
    return [b[0] + (a[0] - b[0]) * w, b[1] + (a[1] - b[1]) * w, b[2] + (a[2] - b[2]) * w];
  };
}

/** Raw RGB for one side of the die, in three.js face order. */
export function dieFacePixels(
  pattern: Exclude<PatternId, 'plain'>,
  base: string,
  ink: string,
  face: number,
): number[] {
  return paintSquare(dieFaceSampler(shellSampler(pattern, base, ink), face), SMOOTH_EDGES.has(pattern));
}

/**
 * Six textures, one per side, cut from one continuous design.
 *
 * Costs six squares of painting rather than one, and is built once per
 * skin per run by the same cache everything else uses. The shelf
 * pictures still paint a single square — the front — so the Store and
 * the Inventory are unaffected.
 */
export function createDieFaceTextures(
  pattern: Exclude<PatternId, 'plain'>,
  base: string,
  ink: string,
): THREE.DataTexture[] {
  /*
    Through the app-wide cache, not a useMemo.

    Six squares is six times the painting — about 115ms for a whole die
    on a desktop and more on a phone. DieMesh's useMemo only caches for
    the life of one component, and there are two dice on the table that
    remount whenever the scene rebuilds, so without this the cost would
    land again on every roll of a newly equipped skin. Keyed on
    everything the painting depends on, so two skins cannot collide.
  */
  return DIE_FACE_SLOTS.map(
    (_, face) =>
      cachedTexture(`die:${pattern}:${base}:${ink}:face${face}`, () =>
        textureFromPixels(dieFacePixels(pattern, base, ink, face)),
      ) as THREE.DataTexture,
  );
}

export function createPatternTexture(
  pattern: Exclude<PatternId, 'plain'>,
  base: string,
  ink: string,
): THREE.DataTexture {
  return textureFromPixels(patternPixels(pattern, base, ink));
}

/** The shared tail: raw RGB in, a configured three.js texture out. */
function textureFromPixels(rgb: number[]): THREE.DataTexture {
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
