import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import {
  blank,
  clamp01,
  fbm,
  hash,
  mixInto,
  noise,
  noiseWrap,
  Painting,
  paintingTexture,
  put,
  Rgb,
  rgb,
} from './paint';
import { brazierSpots, DUSK_SILHOUETTES, fallenStones, ruinHeightAt, STUMP_RADIUS } from './ruin';
import { CORNER_TOWERS } from '../game/stations';

/**
 * The floors of the four hand-built battlefields — Castle Courtyard,
 * Sunset Castle, Jungle Clearing and Space Station — and the few small
 * surfaces their walls are dressed in.
 *
 * ── WHY THEY ARE PAINTED WHOLE, NOT TILED ──
 *
 * The floor is the largest thing on screen by a distance (the tray fills
 * most of the frame; see groundTexture.ts), and three of the four used to
 * be one eight-by-eight grid in different paint. Each is now ONE picture
 * of the whole tray, painted in world units: a slab is the same size at
 * the near wall as at the far one, a root starts at the corner tree it
 * grows from, a lantern pool sits under the brazier that lights it, and a
 * shadow falls from the wall that casts it. None of that is possible on a
 * floor that repeats.
 *
 * 256 by 512 texels over 5.6 by 10.2 world units is about 46 to the unit:
 * a texel is a little over one screen pixel at the size a phone draws the
 * tray, which is what the themed floors settled on after Marc's "the floor
 * is too blurry" (28 Aug 2026).
 *
 * ── GENTLE, ON PURPOSE ──
 *
 * Ivory dice with colour stickers and brightly dressed prisoners have to
 * read against all of this. So relief is carried by VALUE (a lit bevel, a
 * dark joint) inside a narrow band, never by saturated colour, and nothing
 * here is a pure primary.
 *
 * Every painter is deterministic and caches its bytes: painted once per
 * app run, wanted again the moment the Inventory opens (textureCache.ts).
 */

const { innerWidth, innerDepth, wallThickness } = TUNING.tray;
/** The floor plane each arena lays: tray plus walls, in world units. */
export const FLOOR_W = innerWidth + wallThickness * 2;
export const FLOOR_D = innerDepth + wallThickness * 2;
export const FLOOR_TX = 256;
export const FLOOR_TY = 512;

/** World x/z of a texel's centre. Row 0 is v = 0, the NEAR edge (+z). */
const worldX = (x: number) => -FLOOR_W / 2 + ((x + 0.5) / FLOOR_TX) * FLOOR_W;
const worldZ = (y: number) => FLOOR_D / 2 - ((y + 0.5) / FLOOR_TY) * FLOOR_D;

/**
 * Where the key light comes from, flattened onto the floor, as a unit
 * vector pointing TOWARD it. Relief is painted lit from the same side the
 * scene's real light falls from; a floor whose bevels are lit from the
 * opposite side to everything standing on it reads as a hole.
 */
function toward(x: number, z: number): [number, number] {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
}
/** Midday, see DAYLIGHT in arenas.tsx: key at (4, 12, 6). */
const DAY_LIGHT = toward(4, 6);
/** Dusk, see SUNSET_LIGHT: key at (-14, 2.4, -3), low on the left. */
const DUSK_LIGHT = toward(-14, -3);

/**
 * A soft darkening along the foot of the walls, 1 in the open and down to
 * about 0.8 where floor meets wall. There are no real shadows in this
 * game (no shadow maps — they cost a render pass on a phone), and without
 * a contact shade a wall seems to hover over the floor instead of
 * standing on it.
 */
function wallFoot(wx: number, wz: number): number {
  const d = Math.min(innerWidth / 2 - Math.abs(wx), innerDepth / 2 - Math.abs(wz));
  return d >= 0.28 ? 1 : 0.8 + 0.2 * clamp01(d / 0.28) * clamp01(d / 0.28);
}

const caches = new Map<string, Painting>();
function cached(key: string, paint: () => Painting): Painting {
  const found = caches.get(key);
  if (found) return found;
  const p = paint();
  caches.set(key, p);
  return p;
}

/** Test-only: forget every painting so a suite can time a fresh one. */
export function clearBespokeFloorCacheForTests(): void {
  caches.clear();
}

// ─────────────────────────────────────────────────────────────────────
// Castle Courtyard — worn flagstones
// ─────────────────────────────────────────────────────────────────────

/** Three stones, close in value, so the courtyard is calm under dice. */
const SLAB_STONES = [rgb('#9f9788'), rgb('#958e80'), rgb('#a59a85')];
const SLAB_GROUT = rgb('#5d574e');
const SLAB_MOSS = rgb('#6f7a4c');

/**
 * Laid in courses across the tray, each course its own height and each
 * slab its own width, the way a real courtyard is laid from the stone the
 * mason had — not the old 8x8 chequerboard of identical squares.
 */
function courtyardLayout(): { z0: number; z1: number; edges: number[] }[] {
  const rows: { z0: number; z1: number; edges: number[] }[] = [];
  let z = -FLOOR_D / 2;
  let r = 0;
  while (z < FLOOR_D / 2) {
    const h = 0.52 + hash(r, 1.7) * 0.36;
    const edges: number[] = [];
    let x = -FLOOR_W / 2 - hash(r, 8.1) * 0.9;
    let k = 0;
    while (x < FLOOR_W / 2) {
      edges.push(x);
      x += 0.58 + hash(r * 3.1, k * 1.9) * 0.66;
      k++;
    }
    edges.push(x);
    rows.push({ z0: z, z1: Math.min(z + h, FLOOR_D / 2 + 0.5), edges });
    z += h;
    r++;
  }
  return rows;
}

export function courtyardFloorPixels(): Painting {
  return cached('courtyard', () => {
    const p = blank(FLOOR_TX, FLOOR_TY);
    const rows = courtyardLayout();
    const [lx, lz] = DAY_LIGHT;
    const c: Rgb = [0, 0, 0];
    for (let y = 0; y < FLOOR_TY; y++) {
      const wz = worldZ(y);
      let ri = 0;
      while (ri < rows.length - 1 && wz >= rows[ri].z1) ri++;
      const row = rows[ri];
      for (let x = 0; x < FLOOR_TX; x++) {
        const wx = worldX(x);
        let si = 0;
        while (si < row.edges.length - 2 && wx >= row.edges[si + 1]) si++;
        const x0 = row.edges[si];
        const x1 = row.edges[si + 1];
        // Nearest edge of this slab, and the way that edge faces.
        const dl = wx - x0;
        const dr = x1 - wx;
        const dn = row.z1 - wz; // toward +z, the near side
        const df = wz - row.z0;
        let d = dl;
        let nx = -1;
        let nz = 0;
        if (dr < d) { d = dr; nx = 1; nz = 0; }
        if (dn < d) { d = dn; nx = 0; nz = 1; }
        if (df < d) { d = df; nx = 0; nz = -1; }
        // Worn, chipped arrises rather than sawn ones.
        d -= (noise(wx * 11, wz * 11) - 0.5) * 0.045;

        const id = ri * 31 + si;
        const base = SLAB_STONES[Math.floor(hash(id, 2.9) * SLAB_STONES.length)];
        const tone = 0.93 + hash(id, 5.3) * 0.12;
        const wear = fbm(wx * 1.6 + id, wz * 1.6);
        c[0] = base[0] * tone;
        c[1] = base[1] * tone;
        c[2] = base[2] * tone;
        // Foot-worn: the middle of a slab polished a shade paler.
        const centre = Math.min(dl, dr, dn, df);
        const polish = clamp01(centre * 3) * 0.06 * wear;
        let shade = 1 + polish + (wear - 0.5) * 0.1;

        const GROUT = 0.026;
        const BEVEL = 0.095;
        if (d < GROUT) {
          c[0] = SLAB_GROUT[0];
          c[1] = SLAB_GROUT[1];
          c[2] = SLAB_GROUT[2];
          // Moss in the joints, where the feet do not go.
          mixInto(c, SLAB_MOSS, clamp01((fbm(wx * 0.9, wz * 0.9) - 0.52) * 3) * 0.7);
          shade = 0.92 + hash(x, y) * 0.12;
        } else if (d < BEVEL) {
          // The bevel: edges facing the light catch it, edges facing away
          // drop into shade. This is the relief.
          const t = 1 - (d - GROUT) / (BEVEL - GROUT);
          shade *= 1 + (nx * lx + nz * lz) * 0.5 * t - 0.08 * t;
        }
        // A hairline crack across one slab in four.
        if (hash(id, 9.9) < 0.25 && d >= GROUT) {
          const a = hash(id, 4.4) * Math.PI;
          const cx = (x0 + x1) / 2;
          const cz = (row.z0 + row.z1) / 2;
          const off = (wx - cx) * Math.sin(a) - (wz - cz) * Math.cos(a);
          const wob = (noise(wx * 7 + id, wz * 7) - 0.5) * 0.05;
          const dist = Math.abs(off + wob);
          if (dist < 0.009) shade *= 0.72;
          else if (dist < 0.02) shade *= 1.05;
        }
        const grain = 0.965 + hash(x * 1.31, y * 0.77) * 0.07;
        // Contact shade at the foot of the walls, so they stand ON the floor.
        shade *= wallFoot(wx, wz);
        shade *= grain;
        put(p, x, y, c[0] * shade, c[1] * shade, c[2] * shade);
      }
    }
    return p;
  });
}

export function createCourtyardFloorTexture(): THREE.DataTexture {
  return paintingTexture(courtyardFloorPixels());
}

// ─────────────────────────────────────────────────────────────────────
// Sunset Castle — cobbles, lantern pools, long shadows
// ─────────────────────────────────────────────────────────────────────

const COBBLES = [rgb('#dccdb8'), rgb('#cfc0ad'), rgb('#e0cbb0'), rgb('#c9baa8'), rgb('#d8cab8')];
const COBBLE_JOINT = rgb('#8a7a6a');
const COBBLE_WEED = rgb('#5d6a3c');
const COBBLE_EARTH = rgb('#958068');
/** The lantern's colour on stone. */
const POOL = rgb('#ffb066');
/** Shadow at dusk is skylight: cool, not black. */
const SHADE_TINT: Rgb = [0.86, 0.88, 1.0];

/**
 * How far the ruin's shadows reach, per unit of wall height.
 *
 * The real sun is ten degrees up, which would throw every shadow right
 * across the courtyard and turn the floor dark. This keeps the GESTURE of
 * a low sun — long, raking, all leaning one way — while leaving most of
 * the floor in light for the dice.
 */
const SHADOW_REACH = 1.0;

/**
 * The wall's height, sampled every centimetre once rather than worked out
 * again for each of the 131,072 texels that ask.
 */
function profile(side: 'left' | 'far'): (along: number) => number {
  const table = new Float32Array(1201);
  for (let i = 0; i < table.length; i++) table[i] = ruinHeightAt(side, i / 100 - 6);
  return (along) => table[Math.max(0, Math.min(1200, Math.round((along + 6) * 100)))];
}

/** How much of a texel is in shadow, 0..1, softened at the edges. */
function duskShadow(
  wx: number,
  wz: number,
  leftHeight: (along: number) => number,
  farHeight: (along: number) => number,
): number {
  // Walk back toward the sun until a wall or a tower stump is met.
  const [sx, sz] = DUSK_LIGHT;
  const innerL = -innerWidth / 2;
  const innerF = -innerDepth / 2;
  let s = 0;
  // The left wall (the sun's side).
  const tL = (wx - innerL) / -sx;
  if (tL > 0) {
    const zAt = wz + sz * tL;
    const reach = leftHeight(zAt) * SHADOW_REACH;
    s = Math.max(s, clamp01((reach - tL) / 0.22));
  }
  // The far wall, which the low sun rakes along.
  const tF = (wz - innerF) / -sz;
  if (tF > 0) {
    const xAt = wx + sx * tF;
    if (xAt > innerL && xAt < -innerL) {
      const reach = farHeight(xAt) * SHADOW_REACH;
      s = Math.max(s, clamp01((reach - tF) / 0.22));
    }
  }
  // The two tower stumps on the sun's side, which stand tallest.
  for (const t of CORNER_TOWERS) {
    if (t.x > 0) continue;
    const dx = wx - t.x;
    const dz = wz - t.z;
    const along = -(dx * sx + dz * sz);
    if (along <= 0) continue;
    const across = Math.abs(dx * sz - dz * sx);
    const reach = (t.z < 0 ? 2.4 : 1.8) * SHADOW_REACH;
    if (across < STUMP_RADIUS + 0.1) s = Math.max(s, clamp01((reach - along) / 0.3) * clamp01((STUMP_RADIUS + 0.1 - across) / 0.12));
  }
  return s;
}

export function sunsetFloorPixels(): Painting {
  return cached('sunset', () => {
    const p = blank(FLOOR_TX, FLOOR_TY);
    const [lx, lz] = DUSK_LIGHT;
    const CELL = 0.3;
    const pools = brazierSpots().map((b) => {
      // The pool lies on the floor just inside the wall the brazier is on.
      const x = (b.side === 'left' ? -1 : 1) * (innerWidth / 2 - 0.55);
      return [x, b.along] as [number, number];
    });
    const leftHeight = profile('left');
    const farHeight = profile('far');
    // One stone centre per cell of a jittered grid, worked out once.
    const gx0 = Math.floor(-FLOOR_W / 2 / CELL) - 2;
    const gz0 = Math.floor(-FLOOR_D / 2 / CELL) - 2;
    const gw = Math.ceil(FLOOR_W / CELL) + 5;
    const gh = Math.ceil(FLOOR_D / CELL) + 5;
    const ptX = new Float32Array(gw * gh);
    const ptZ = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const ix = gx0 + i;
        const iz = gz0 + j;
        ptX[j * gw + i] = (ix + 0.5 + (hash(ix, iz) - 0.5) * 0.7) * CELL;
        ptZ[j * gw + i] = (iz + 0.5 + (hash(iz + 3.3, ix) - 0.5) * 0.7) * CELL;
      }
    }
    const c: Rgb = [0, 0, 0];
    for (let y = 0; y < FLOOR_TY; y++) {
      const wz = worldZ(y);
      for (let x = 0; x < FLOOR_TX; x++) {
        const wx = worldX(x);
        // Cobbles: the nearest stone centre, and the second nearest, whose
        // difference is the joint between them.
        const gi = Math.floor(wx / CELL) - gx0;
        const gj = Math.floor(wz / CELL) - gz0;
        let f1 = 9;
        let f2 = 9;
        let cx = 0;
        let cz = 0;
        let id = 0;
        for (let oj = -1; oj <= 1; oj++) {
          for (let oi = -1; oi <= 1; oi++) {
            const k = (gj + oj) * gw + gi + oi;
            const dx = wx - ptX[k];
            const dz = (wz - ptZ[k]) * 1.12;
            const dd = Math.sqrt(dx * dx + dz * dz);
            if (dd < f1) {
              f2 = f1;
              f1 = dd;
              cx = ptX[k];
              cz = ptZ[k];
              id = k;
            } else if (dd < f2) {
              f2 = dd;
            }
          }
        }
        const edge = f2 - f1;
        const base = COBBLES[Math.floor(hash(id, 1.1) * COBBLES.length)];
        const tone = 0.92 + hash(id, 6.6) * 0.14;
        c[0] = base[0] * tone;
        c[1] = base[1] * tone;
        c[2] = base[2] * tone;
        let shade = 1;
        // Where cobbles have been lost, packed earth shows through.
        const lost = clamp01((fbm(wx * 0.7 + 4, wz * 0.7) - 0.64) * 6);
        if (edge < 0.035) {
          c[0] = COBBLE_JOINT[0];
          c[1] = COBBLE_JOINT[1];
          c[2] = COBBLE_JOINT[2];
          mixInto(c, COBBLE_WEED, clamp01((fbm(wx * 1.4, wz * 1.4 + 9) - 0.5) * 3));
          shade = 0.9 + hash(x, y) * 0.15;
        } else {
          // A domed stone: lit on the sun's side, falling off at the rim.
          const rim = clamp01(1 - edge / 0.13);
          const dx = wx - cx;
          const dz = wz - cz;
          const dl = Math.sqrt(dx * dx + dz * dz) || 1;
          shade = 1 + ((dx / dl) * lx + (dz / dl) * lz) * 0.3 * rim - 0.1 * rim * rim;
        }
        if (lost > 0) {
          const e: Rgb = [COBBLE_EARTH[0], COBBLE_EARTH[1], COBBLE_EARTH[2]];
          mixInto(c, e, lost * 0.85);
          shade = shade + (1 - shade) * lost * 0.8;
        }
        shade *= (0.96 + hash(x * 0.71, y * 1.33) * 0.08) * wallFoot(wx, wz);
        let r = c[0] * shade;
        let g = c[1] * shade;
        let b = c[2] * shade;
        // Long shadows from the ruin, cool where the sun cannot reach.
        const s = duskShadow(wx, wz, leftHeight, farHeight);
        if (s > 0) {
          const k = 1 - s * 0.22;
          r *= k * (1 - s * (1 - SHADE_TINT[0]));
          g *= k * (1 - s * (1 - SHADE_TINT[1]));
          b *= k * (1 - s * (1 - SHADE_TINT[2]));
        }
        // Lantern pools under the braziers: warm, soft, brightest at the foot.
        let pool = 0;
        for (const [px, pz] of pools) {
          const d2 = (wx - px) * (wx - px) + (wz - pz) * (wz - pz);
          pool += Math.exp(-d2 / 0.9);
        }
        if (pool > 0.01) {
          const k = Math.min(1, pool) * 0.5;
          r = r * (1 + k * 0.5) + POOL[0] * k * 0.22;
          g = g * (1 + k * 0.25) + POOL[1] * k * 0.12;
          b = b * (1 - k * 0.1) + POOL[2] * k * 0.02;
        }
        put(p, x, y, r, g, b);
      }
    }
    return p;
  });
}

export function createSunsetFloorTexture(): THREE.DataTexture {
  return paintingTexture(sunsetFloorPixels());
}

// ─────────────────────────────────────────────────────────────────────
// Jungle Clearing — leaf litter on earth and moss, roots from the trees
// ─────────────────────────────────────────────────────────────────────

/*
  GREEN still leads. David's verdict on the first jungle floor, which was
  mostly brown earth under thick litter, was "garbage dump" (see
  jungleFloorTexture.ts) — so earth shows through the moss in patches,
  and the litter is crisp individual leaves, not a covering of debris.
  The roots are what is new: they are what a jungle floor has that no
  other floor in the game does, and they grow from the four buttress
  trees standing at the corners of the clearing.
*/
const MOSS = rgb('#56713a');
const MOSS_DEEP = rgb('#435d30');
const EARTH = rgb('#6e5539');
const LEAVES = [rgb('#6f7f3c'), rgb('#86763c'), rgb('#66583a'), rgb('#5f7a3a'), rgb('#8a6a3a'), rgb('#76804a')];
const ROOT = rgb('#5e4a33');
const ROOT_LIT = rgb('#80664a');

/** A root, as a polyline with a width that tapers along it. */
function jungleRoots(): { pts: [number, number][]; w0: number; w1: number }[] {
  const out: { pts: [number, number][]; w0: number; w1: number }[] = [];
  const hx = innerWidth / 2;
  const hz = innerDepth / 2;
  // From each corner tree, two roots reaching into the clearing.
  const starts: [number, number, number][] = [
    [-hx, -hz, 0.7], [-hx, -hz, 1.25],
    [hx, -hz, 2.45], [hx, -hz, 1.9],
    [-hx, hz, -0.75], [-hx, hz, -1.3],
    [hx, hz, -2.4], [hx, hz, -1.85],
  ];
  // And a few surfacing from under the long walls, from trees outside.
  starts.push([-hx, -1.2, 0.3], [hx, 1.6, Math.PI - 0.25]);
  starts.forEach(([x0, z0, heading], i) => {
    let x = x0;
    let z = z0;
    let a = heading;
    const pts: [number, number][] = [[x, z]];
    const corner = i < 8;
    const steps = (corner ? 7 : 5) + Math.floor(hash(i, 3.3) * 5);
    for (let s = 0; s < steps; s++) {
      a += (hash(i * 7.1, s) - 0.5) * 0.6;
      const len = 0.22 + hash(s, i * 1.9) * 0.12;
      x += Math.cos(a) * len;
      z += Math.sin(a) * len;
      pts.push([x, z]);
    }
    out.push({ pts, w0: (corner ? 0.1 : 0.075) + hash(i, 5.5) * 0.03, w1: 0.02 });
    // One side shoot from part way along.
    const mid = pts[Math.floor(pts.length * 0.45)];
    let bx = mid[0];
    let bz = mid[1];
    let ba = a + (i % 2 ? 0.9 : -0.9);
    const branch: [number, number][] = [[bx, bz]];
    for (let s = 0; s < 5; s++) {
      ba += (hash(i * 3.3, s + 9) - 0.5) * 0.8;
      bx += Math.cos(ba) * 0.2;
      bz += Math.sin(ba) * 0.2;
      branch.push([bx, bz]);
    }
    out.push({ pts: branch, w0: 0.06, w1: 0.015 });
  });
  return out;
}

export function jungleTrayPixels(): Painting {
  return cached('jungle-tray', () => {
    const W = FLOOR_TX;
    const H = FLOOR_TY;
    const p = blank(W, H);
    const [lx, lz] = DAY_LIGHT;
    const texelX = FLOOR_W / W;
    const texelZ = FLOOR_D / H;

    // Roots are stamped into a height field first, then shaded from its
    // slope — so a root is rounded, lit on one flank and shadowed on the
    // other, and darkens the ground beside it.
    const height = new Float32Array(W * H);
    const nearRoot = new Float32Array(W * H);
    for (const root of jungleRoots()) {
      const n = root.pts.length - 1;
      for (let s = 0; s < n; s++) {
        const [ax, az] = root.pts[s];
        const [bx, bz] = root.pts[s + 1];
        const w = root.w0 + (root.w1 - root.w0) * (s / n);
        const reach = w * 2.4;
        const minX = Math.max(0, Math.floor((Math.min(ax, bx) - reach + FLOOR_W / 2) / texelX));
        const maxX = Math.min(W - 1, Math.ceil((Math.max(ax, bx) + reach + FLOOR_W / 2) / texelX));
        const minY = Math.max(0, Math.floor((FLOOR_D / 2 - Math.max(az, bz) - reach) / texelZ));
        const maxY = Math.min(H - 1, Math.ceil((FLOOR_D / 2 - Math.min(az, bz) + reach) / texelZ));
        const ex = bx - ax;
        const ez = bz - az;
        const len2 = ex * ex + ez * ez || 1;
        for (let y = minY; y <= maxY; y++) {
          const wz = worldZ(y);
          for (let x = minX; x <= maxX; x++) {
            const wx = worldX(x);
            const t = clamp01(((wx - ax) * ex + (wz - az) * ez) / len2);
            const dx = wx - (ax + ex * t);
            const dz = wz - (az + ez * t);
            const d = Math.sqrt(dx * dx + dz * dz);
            const i = y * W + x;
            if (d < w) height[i] = Math.max(height[i], Math.sqrt(1 - (d / w) * (d / w)) * w);
            else if (d < reach) nearRoot[i] = Math.max(nearRoot[i], 1 - (d - w) / (reach - w));
          }
        }
      }
    }

    // The litter, decided once per cell: whether a leaf fell there, where,
    // at what angle, how big and what colour. Thicker toward the walls,
    // where it drifts.
    const LEAF_CELL = 0.2;
    const lx0 = Math.floor(-FLOOR_W / 2 / LEAF_CELL) - 2;
    const lz0 = Math.floor(-FLOOR_D / 2 / LEAF_CELL) - 2;
    const lw = Math.ceil(FLOOR_W / LEAF_CELL) + 5;
    const lh = Math.ceil(FLOOR_D / LEAF_CELL) + 5;
    const leafOn = new Uint8Array(lw * lh);
    const leafX = new Float32Array(lw * lh);
    const leafZ = new Float32Array(lw * lh);
    const leafCos = new Float32Array(lw * lh);
    const leafSin = new Float32Array(lw * lh);
    const leafLen = new Float32Array(lw * lh);
    const leafWide = new Float32Array(lw * lh);
    const leafTone = new Float32Array(lw * lh);
    const leafColor = new Uint8Array(lw * lh);
    for (let j = 0; j < lh; j++) {
      for (let i = 0; i < lw; i++) {
        const ix = lx0 + i;
        const iz = lz0 + j;
        const k = j * lw + i;
        const px = (ix + 0.2 + hash(ix, iz + 5) * 0.6) * LEAF_CELL;
        const pz = (iz + 0.2 + hash(iz, ix + 8) * 0.6) * LEAF_CELL;
        const wall = Math.min(innerWidth / 2 - Math.abs(px), innerDepth / 2 - Math.abs(pz));
        const drift = 0.13 + clamp01((0.9 - wall) * 0.5);
        if (hash(ix * 1.3, iz * 2.7) > drift) continue;
        const a = hash(ix + 2, iz) * Math.PI;
        const len = 0.06 + hash(ix, iz * 3) * 0.05;
        leafOn[k] = 1;
        leafX[k] = px;
        leafZ[k] = pz;
        leafCos[k] = Math.cos(a);
        leafSin[k] = Math.sin(a);
        leafLen[k] = len;
        leafWide[k] = len * (0.38 + hash(iz, ix * 3) * 0.16);
        leafTone[k] = 0.95 + hash(ix, iz * 7) * 0.12;
        leafColor[k] = Math.floor(hash(ix * 5.1, iz) * LEAVES.length) % LEAVES.length;
      }
    }
    const sx = lx * 0.018;
    const sz = lz * 0.018;

    const c: Rgb = [0, 0, 0];
    for (let y = 0; y < H; y++) {
      const wz = worldZ(y);
      for (let x = 0; x < W; x++) {
        const wx = worldX(x);
        const i = y * W + x;
        // Moss, deeper in the hollows.
        const m = fbm(wx * 1.1, wz * 1.1);
        c[0] = MOSS[0] + (MOSS_DEEP[0] - MOSS[0]) * m;
        c[1] = MOSS[1] + (MOSS_DEEP[1] - MOSS[1]) * m;
        c[2] = MOSS[2] + (MOSS_DEEP[2] - MOSS[2]) * m;
        // Earth, worn through in soft patches and at the foot of the walls.
        const wall = Math.min(innerWidth / 2 - Math.abs(wx), innerDepth / 2 - Math.abs(wz));
        const worn = clamp01((fbm(wx * 0.8 + 21, wz * 0.8 + 7) - 0.56) * 3.2) + clamp01((0.35 - wall) * 2) * 0.5;
        mixInto(c, EARTH, Math.min(0.75, worn));
        let shade = 0.94 + noise(wx * 9, wz * 9) * 0.1;

        // Leaf litter: crisp single leaves, each with a midrib and a soft
        // shadow under it on the side away from the light.
        const gi = Math.floor(wx / LEAF_CELL) - lx0;
        const gj = Math.floor(wz / LEAF_CELL) - lz0;
        let leafHit = false;
        let leafShadow = false;
        for (let oj = -1; oj <= 1 && !leafHit; oj++) {
          for (let oi = -1; oi <= 1; oi++) {
            const k = (gj + oj) * lw + gi + oi;
            if (!leafOn[k]) continue;
            const len = leafLen[k];
            const wide = leafWide[k];
            const co = leafCos[k];
            const si = leafSin[k];
            const dx = wx - leafX[k];
            const dz = wz - leafZ[k];
            const u = dx * co + dz * si;
            const v = -dx * si + dz * co;
            if ((u * u) / (len * len) + (v * v) / (wide * wide) <= 1) {
              const leaf = LEAVES[leafColor[k]];
              c[0] = leaf[0];
              c[1] = leaf[1];
              c[2] = leaf[2];
              shade = (Math.abs(v) < wide * 0.12 ? 0.82 : 1) * leafTone[k];
              // Lit on the side facing the light, like everything else.
              shade *= 1 + (v / wide) * 0.08;
              leafHit = true;
              break;
            }
            const su = (dx + sx) * co + (dz + sz) * si;
            const sv = -(dx + sx) * si + (dz + sz) * co;
            if ((su * su) / (len * len) + (sv * sv) / (wide * wide) <= 1) leafShadow = true;
          }
        }
        if (!leafHit && leafShadow) shade *= 0.8;

        // Roots on top of everything.
        const hgt = height[i];
        if (hgt > 0) {
          const up = y > 0 ? height[i - W] : hgt;
          const down = y < H - 1 ? height[i + W] : hgt;
          const left = x > 0 ? height[i - 1] : hgt;
          const right = x < W - 1 ? height[i + 1] : hgt;
          // Slope in world x and z (rows run toward -z).
          const gxs = (right - left) / (2 * texelX);
          const gzs = (up - down) / (2 * texelZ);
          const facing = -(gxs * lx + gzs * lz);
          c[0] = ROOT[0];
          c[1] = ROOT[1];
          c[2] = ROOT[2];
          mixInto(c, ROOT_LIT, clamp01(facing * 0.9 + 0.3));
          shade = 0.9 + facing * 0.25 + noise(wx * 30, wz * 4) * 0.12;
        } else if (nearRoot[i] > 0) {
          shade *= 1 - nearRoot[i] * 0.3;
        }
        shade *= 0.97 + hash(x * 1.7, y * 0.9) * 0.06;
        put(p, x, y, c[0] * shade, c[1] * shade, c[2] * shade);
      }
    }
    return p;
  });
}

export function createJungleTrayTexture(): THREE.DataTexture {
  return paintingTexture(jungleTrayPixels());
}

// ─────────────────────────────────────────────────────────────────────
// Space Station — deck plates, hazard chevrons, inset lights
// ─────────────────────────────────────────────────────────────────────

const PLATES = [rgb('#606a7b'), rgb('#596272'), rgb('#666f80')];
const SEAM = rgb('#2a2f3a');
const HAZARD_A = rgb('#e0a63c');
const HAZARD_B = rgb('#2c2f37');
const LAMP = rgb('#7ff4ff');
const PANEL_LIGHT = rgb('#c6f6ff');

/** A deck plate is this big: four across the tray, eight down it. */
const PLATE = innerWidth / 4;
/** The striped band painted inside the hull, all the way round. */
const HAZARD_BAND = 0.2;

/**
 * Both maps at once: the plate colour, and the light the deck gives off.
 * They are painted together because they describe the same lamps — a
 * light strip in the emissive map has to sit exactly in the slot painted
 * for it in the colour map.
 */
function deckPaint(): { color: Painting; glow: Painting } {
  const color = blank(FLOOR_TX, FLOOR_TY);
  const glow = blank(FLOOR_TX, FLOOR_TY);
  const [lx, lz] = DAY_LIGHT;
  const hx = innerWidth / 2;
  const hz = innerDepth / 2;
  const c: Rgb = [0, 0, 0];
  for (let y = 0; y < FLOOR_TY; y++) {
    const wz = worldZ(y);
    for (let x = 0; x < FLOOR_TX; x++) {
      const wx = worldX(x);
      // Plate coordinates, measured from the inner tray corner so plates
      // meet the hull cleanly instead of being cut off at random.
      const u = (wx + hx) / PLATE;
      const v = (wz + hz) / PLATE;
      const pu = Math.floor(u);
      const pv = Math.floor(v);
      const fu = (u - pu) * PLATE;
      const fv = (v - pv) * PLATE;
      const id = pu * 17 + pv;
      const kind = hash(id, 2.1);
      const base = PLATES[Math.floor(hash(id, 4.4) * PLATES.length)];
      c[0] = base[0];
      c[1] = base[1];
      c[2] = base[2];
      let shade = 1;
      let gr = 0;
      let gg = 0;
      let gb = 0;

      // Seams, bevelled like a pressed plate.
      const dl = fu;
      const dr = PLATE - fu;
      const dn = PLATE - fv;
      const df = fv;
      let d = dl;
      let nx = -1;
      let nz = 0;
      if (dr < d) { d = dr; nx = 1; nz = 0; }
      if (dn < d) { d = dn; nx = 0; nz = 1; }
      if (df < d) { d = df; nx = 0; nz = -1; }
      if (d < 0.02) {
        c[0] = SEAM[0];
        c[1] = SEAM[1];
        c[2] = SEAM[2];
      } else if (d < 0.06) {
        shade *= 1 + (nx * lx + nz * lz) * 0.3 * (1 - (d - 0.02) / 0.04);
      } else {
        const cu = fu - PLATE / 2;
        const cv = fv - PLATE / 2;
        if (kind < 0.42) {
          // Tread plate: raised diamonds in a lattice.
          const s = 0.115;
          const a = (cu + cv) / s;
          const b = (cu - cv) / s;
          const da = a - Math.round(a);
          const db = b - Math.round(b);
          const onRib = Math.abs(da) < 0.16 && Math.abs(db) < 0.42;
          const onRib2 = Math.abs(db) < 0.16 && Math.abs(da) < 0.42 && (Math.round(a) + Math.round(b)) % 2 === 0;
          if (onRib || onRib2) shade *= 1.1 + (onRib ? da : db) * 0.5;
        } else if (kind < 0.62) {
          // A vent grille: slots, dark inside, lit on one lip.
          if (Math.abs(cu) < 0.36 && Math.abs(cv) < 0.24) {
            const slot = (cv + 0.24) / 0.06;
            const f = slot - Math.floor(slot);
            shade *= f < 0.55 ? 0.42 : f < 0.7 ? 1.18 : 0.9;
          }
        } else if (kind < 0.74) {
          /*
            A light BAR set into the plate, never a lit square. The first
            version was a square panel of pale light, and from above a pale
            square the size of a die face is exactly what an ivory die
            looks like — the deck was laying decoys for the dice.
          */
          const barU = 0.4;
          const barV = 0.045;
          if (Math.abs(cu) < barU && Math.abs(cv) < barV + 0.02) {
            if (Math.abs(cv) >= barV || Math.abs(cu) > barU - 0.02) shade *= 0.5;
            else {
              const k = 0.65 + (1 - Math.abs(cv) / barV) * 0.35;
              mixInto(c, PANEL_LIGHT, 0.8);
              gr = PANEL_LIGHT[0] * k * 0.6;
              gg = PANEL_LIGHT[1] * k * 0.6;
              gb = PANEL_LIGHT[2] * k * 0.6;
            }
          }
        } else {
          // Brushed plain plate: faint streaks along it.
          shade *= 0.97 + noise(wx * 2, wz * 60) * 0.06;
        }
        // Rivets at every plate's corners.
        const ru = fu < PLATE / 2 ? 0.1 : PLATE - 0.1;
        const rv = fv < PLATE / 2 ? 0.1 : PLATE - 0.1;
        const rd = Math.sqrt((fu - ru) * (fu - ru) + (fv - rv) * (fv - rv));
        if (rd < 0.028) shade *= 1 + (((fu - ru) * lx + (fv - rv) * lz) / 0.028) * 0.35;
      }

      // Inset lamps where four plates meet: a small cyan grid of lights.
      const ju = Math.round(u);
      const jv = Math.round(v);
      const ju2 = (u - ju) * PLATE;
      const jv2 = (v - jv) * PLATE;
      const jd = Math.sqrt(ju2 * ju2 + jv2 * jv2);
      if (ju > 0 && ju < 4 && jv > 0 && jv < 8 && jd < 0.05) {
        mixInto(c, LAMP, 0.9);
        const k = 1 - jd / 0.05;
        gr = LAMP[0] * k;
        gg = LAMP[1] * k;
        gb = LAMP[2] * k;
      }

      // Hazard band inside the hull: diagonal stripes, worn at the edges.
      const toWall = Math.min(hx - Math.abs(wx), hz - Math.abs(wz));
      if (toWall >= 0 && toWall < HAZARD_BAND) {
        const stripe = ((wx + wz) / 0.17) % 2;
        const s = stripe < 0 ? stripe + 2 : stripe;
        const paint = s < 1 ? HAZARD_A : HAZARD_B;
        const worn = clamp01((noise(wx * 14, wz * 14) - 0.25) * 2.5);
        c[0] = paint[0];
        c[1] = paint[1];
        c[2] = paint[2];
        shade = (0.82 + worn * 0.2) * (toWall < 0.025 ? 0.7 : 1);
        gr = gg = gb = 0;
      }

      // Painted chevrons down the middle lane, pointing at the player's
      // end: the walkway the rescued prisoners are marched along.
      const chev = Math.abs(wx) < 0.5 ? (wz + Math.abs(wx) * 0.9) / 1.15 : -1;
      if (chev >= 0 && Math.abs(wz) < hz - 0.6) {
        const f = chev - Math.floor(chev);
        if (f < 0.14 && Math.abs(wx) > 0.06) {
          const worn = clamp01((noise(wx * 12 + 3, wz * 12) - 0.3) * 2);
          mixInto(c, HAZARD_A, 0.55 * worn);
        }
      }

      shade *= (0.97 + hash(x * 0.9, y * 1.1) * 0.05) * wallFoot(wx, wz);
      put(color, x, y, c[0] * shade, c[1] * shade, c[2] * shade);
      put(glow, x, y, gr, gg, gb);
    }
  }
  return { color, glow };
}

let deckCache: { color: Painting; glow: Painting } | null = null;
export function deckPixels(): { color: Painting; glow: Painting } {
  if (!deckCache) deckCache = deckPaint();
  return deckCache;
}

export function createDeckTexture(): THREE.DataTexture {
  return paintingTexture(deckPixels().color);
}
export function createDeckGlowTexture(): THREE.DataTexture {
  return paintingTexture(deckPixels().glow);
}

// ─────────────────────────────────────────────────────────────────────
// Ground beyond the walls (tiling)
// ─────────────────────────────────────────────────────────────────────

/**
 * The castle lawn: mown in stripes, with clover and the odd daisy. It
 * tiles — it is laid over the whole visible field — so its noise wraps at
 * the edge (noiseWrap) and its stripes divide the tile exactly.
 *
 * Mown stripes are deliberate: the day castle's shape language is order,
 * and a kept lawn is order you can see from the air.
 */
export function meadowPixels(): Painting {
  return cached('meadow', () => {
    const S = 128;
    const p = blank(S, S);
    const light = rgb('#7aa65a');
    const dark = rgb('#678f4b');
    const clover = rgb('#5b8443');
    const c: Rgb = [0, 0, 0];
    for (let y = 0; y < S; y++) {
      // Two stripes per tile, soft-edged.
      const stripe = 0.5 + 0.5 * Math.sin((y / S) * Math.PI * 4);
      for (let x = 0; x < S; x++) {
        c[0] = dark[0];
        c[1] = dark[1];
        c[2] = dark[2];
        mixInto(c, light, 0.25 + stripe * 0.55);
        const n = noiseWrap(x / 8, y / 8, 16) * 0.6 + noiseWrap(x / 4, y / 4, 32) * 0.4;
        mixInto(c, clover, clamp01((n - 0.55) * 3) * 0.6);
        let shade = 0.9 + hash(x * 2.1, y * 1.3) * 0.16;
        // Daisies: one in a few hundred texels, a white dot with a gold eye.
        const d = hash(Math.floor(x / 4) * 7.1, Math.floor(y / 4) * 3.3);
        if (d > 0.985 && (x % 4) > 0 && (x % 4) < 3 && (y % 4) > 0 && (y % 4) < 3) {
          c[0] = 236;
          c[1] = 232;
          c[2] = 214;
          if ((x % 4) === 1 && (y % 4) === 1) {
            c[0] = 226;
            c[1] = 186;
            c[2] = 80;
          }
          shade = 1;
        }
        put(p, x, y, c[0] * shade, c[1] * shade, c[2] * shade);
      }
    }
    return p;
  });
}

export function createMeadowTexture(): THREE.DataTexture {
  return paintingTexture(meadowPixels(), true);
}

/** The patch of ground the dusk painter covers, centred on the frame. */
export const DUSK_GROUND = { width: 10.4, depth: 20.8, centerZ: -1.4 };

/**
 * The ground beyond the ruin at dusk: the last light, warm at the horizon
 * end of the frame and falling to violet toward the player, over rough
 * turf — with the ruin's long shadow lying across the right-hand strip,
 * and a dark footing under every fallen stone and broken tower, so they
 * sit ON the ground instead of hovering over a flat wash of colour.
 *
 * The sky dome it replaced was never once on screen: the camera looks
 * almost straight down, so the dusk gradient is laid where it DOES look.
 * Unlit (the arena draws it with a basic material), so the gradient is
 * the light.
 */
export function duskGroundPixels(): Painting {
  return cached('dusk-ground', () => {
    const stones = fallenStones();
    const towers = DUSK_SILHOUETTES;
    const W = 128;
    const H = 256;
    const p = blank(W, H);
    const stops = ['#3d2c46', '#5a3a4c', '#8a4f4a', '#c77a4e', '#e8a062'].map(rgb);
    const c: Rgb = [0, 0, 0];
    const { width, depth, centerZ } = DUSK_GROUND;
    for (let y = 0; y < H; y++) {
      // Row 0 is the NEAR end (+z), like every painter here.
      const v = (y + 0.5) / H;
      const wz = centerZ + depth / 2 - v * depth;
      // Gradient across the part of the ground the camera sees, z 7.8 to
      // -10.5, rather than across the whole plane.
      const g = clamp01((7.8 - wz) / 18.3) * (stops.length - 1);
      const i0 = Math.min(stops.length - 2, Math.floor(g));
      const t = g - i0;
      for (let x = 0; x < W; x++) {
        const wx = -width / 2 + ((x + 0.5) / W) * width;
        c[0] = stops[i0][0] + (stops[i0 + 1][0] - stops[i0][0]) * t;
        c[1] = stops[i0][1] + (stops[i0 + 1][1] - stops[i0][1]) * t;
        c[2] = stops[i0][2] + (stops[i0 + 1][2] - stops[i0][2]) * t;
        // Rough turf.
        let shade = 0.88 + fbm(wx * 1.6, wz * 1.6) * 0.18 + (hash(x, y) - 0.5) * 0.06;
        // The ruin's shadow, thrown away from the sun across the right strip.
        const outer = innerWidth / 2 + wallThickness;
        if (wx > outer) {
          const reach = ruinHeightAt('right', wz) * 0.9;
          shade *= 1 - clamp01((reach - (wx - outer)) / 0.25) * 0.3;
        }
        // Footings.
        for (const s of stones) {
          const dx = wx - s.position[0] - 0.06;
          const dz = wz - s.position[2];
          const r = s.size * 1.1;
          const d2 = (dx * dx + dz * dz) / (r * r);
          if (d2 < 1) shade *= 0.55 + d2 * 0.45;
        }
        for (const tw of towers) {
          const dx = wx - tw.x - 0.15;
          const dz = wz - tw.z;
          const r = tw.r * 1.35;
          const d2 = (dx * dx + dz * dz) / (r * r);
          if (d2 < 1) shade *= 0.5 + d2 * 0.5;
        }
        put(p, x, y, c[0] * shade, c[1] * shade, c[2] * shade);
      }
    }
    return p;
  });
}

export function createDuskGroundTexture(): THREE.DataTexture {
  return paintingTexture(duskGroundPixels());
}

/**
 * The station's outer hull plating, around the deck: one plate per tile,
 * seams and rivets, darker than the deck so the deck stays the brightest
 * floor on screen.
 */
export function hullPlatePixels(): Painting {
  return cached('hull-plate', () => {
    const S = 64;
    const p = blank(S, S);
    const base = rgb('#3d4456');
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        let shade = 0.94 + noiseWrap(x / 16, y / 2, 4) * 0.1;
        if (x === 0 || y === 0) shade = 0.55;
        else if (x === 1 || y === 1) shade *= 1.15;
        else if (x === S - 1 || y === S - 1) shade *= 0.85;
        const rx = x < S / 2 ? 5 : S - 5;
        const ry = y < S / 2 ? 5 : S - 5;
        if ((x - rx) * (x - rx) + (y - ry) * (y - ry) < 3) shade *= 1.3;
        if (y > 26 && y < 38 && x > 10 && x < 54 && y % 3 === 0) shade *= 0.7;
        put(p, x, y, base[0] * shade, base[1] * shade, base[2] * shade);
      }
    }
    return p;
  });
}

export function createHullPlateTexture(): THREE.DataTexture {
  return paintingTexture(hullPlatePixels(), true);
}

// ─────────────────────────────────────────────────────────────────────
// Small surfaces for walls and light
// ─────────────────────────────────────────────────────────────────────

/**
 * Dressed stone blocks for the day castle's walls: one world unit square,
 * four courses of two blocks, running bond. Repeats across walls built
 * with `worldUvBox`, so a block is the same size on every face.
 */
export function stoneBlockPixels(): Painting {
  return cached('stone-blocks', () => {
    const S = 64;
    const p = blank(S, S);
    const stones = [rgb('#a7a39a'), rgb('#9d9a93'), rgb('#aeaa9f'), rgb('#96938c')];
    for (let y = 0; y < S; y++) {
      const course = Math.floor(y / 16);
      const fy = y % 16;
      for (let x = 0; x < S; x++) {
        const xs = (x + (course % 2 ? 16 : 0)) % S;
        const block = Math.floor(xs / 32);
        const fx = xs % 32;
        const id = course * 2 + block;
        const base = stones[Math.floor(hash(id, 3.3) * stones.length)];
        let shade = 0.94 + hash(id, 8.8) * 0.1 + (noise(x * 0.4, y * 0.4) - 0.5) * 0.08;
        // Mortar along the bottom and left of each block; a lit top lip
        // and a shaded underside — light on a wall comes from above.
        if (fy === 0 || fx === 0) shade = 0.6;
        else if (fy === 1) shade *= 0.85;
        else if (fy === 15) shade *= 1.12;
        else if (fx === 1) shade *= 1.05;
        else if (fx === 31) shade *= 0.9;
        shade *= 0.96 + hash(x * 1.9, y * 2.3) * 0.08;
        put(p, x, y, base[0] * shade, base[1] * shade, base[2] * shade);
      }
    }
    return p;
  });
}

export function createStoneBlockTexture(): THREE.DataTexture {
  return paintingTexture(stoneBlockPixels(), true);
}

/**
 * A soft round glow, white at the centre and transparent at the rim, for
 * flames and beacons seen from above. Additive blending on it is what
 * makes a flame read as a light rather than an orange cone — without a
 * bloom pass, which would cost a render target on a phone.
 */
export function createGlowTexture(): THREE.DataTexture {
  const S = 32;
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - S / 2 + 0.5, y - S / 2 + 0.5) / (S / 2);
      const a = Math.pow(clamp01(1 - d), 2.2);
      const i = (y * S + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const t = new THREE.DataTexture(data, S, S);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/**
 * The station's containment field: strongest at the hull it rises from,
 * fading as it climbs, crossed by faint scan lines. Used as an alpha map,
 * so the field reads as energy rising off the emitters rather than as a
 * sheet of tinted glass.
 */
export function createFieldTexture(): THREE.DataTexture {
  const H = 64;
  const W = 4;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    const fade = 0.25 + Math.pow(1 - t, 1.6) * 0.75;
    const scan = y % 8 === 0 ? 1.6 : 1;
    const v = Math.round(clamp01(fade * scan) * 255);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H);
  tex.flipY = false;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
