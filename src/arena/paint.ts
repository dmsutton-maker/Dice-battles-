import * as THREE from 'three';

/**
 * The small toolkit the four hand-built battlefields paint with.
 *
 * React Native has no canvas, so every surface is written a pixel at a
 * time in JavaScript, the same way the flagstone and the jungle floor
 * always have been. What is shared here is only the arithmetic: a
 * repeatable hash (never Math.random — a floor that changes on every
 * launch cannot be tested, and the old flagstone did exactly that), a
 * smooth noise, and the step from bytes to a texture.
 */

/** Repeatable hash of two numbers, in 0..1. */
export function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * The noise lattice, hashed once and then only looked up.
 *
 * A floor is 131,072 texels and most of them ask for noise six or more
 * times; hashing four corners each time was a quarter of a second of
 * `Math.sin` on a desktop before anything was drawn. A 256-square table
 * costs 65,536 hashes once per app run and turns every later corner into
 * an array read.
 */
const LATTICE = 256;
let lattice: Float32Array | null = null;
function latticeTable(): Float32Array {
  if (!lattice) {
    lattice = new Float32Array(LATTICE * LATTICE);
    for (let j = 0; j < LATTICE; j++) {
      for (let i = 0; i < LATTICE; i++) lattice[j * LATTICE + i] = hash(i, j);
    }
  }
  return lattice;
}

/** Smooth value noise on a unit lattice, in 0..1. Repeats every 256 units. */
export function noise(x: number, y: number): number {
  const t = latticeTable();
  const gx = Math.floor(x);
  const gy = Math.floor(y);
  const fx = x - gx;
  const fy = y - gy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const ix = gx & 255;
  const iy = gy & 255;
  const ix1 = (ix + 1) & 255;
  const iy1 = (iy + 1) & 255;
  const a = t[iy * LATTICE + ix];
  const b = t[iy * LATTICE + ix1];
  const c = t[iy1 * LATTICE + ix];
  const d = t[iy1 * LATTICE + ix1];
  const top = a + (b - a) * sx;
  const bottom = c + (d - c) * sx;
  return top + (bottom - top) * sy;
}

/**
 * Value noise that repeats every `period` lattice units (a power of two),
 * for textures that tile: a surface repeated across a field shows its
 * seams as a ruled grid unless its noise wraps at the tile edge.
 */
export function noiseWrap(x: number, y: number, period: number): number {
  const t = latticeTable();
  const m = period - 1;
  const gx = Math.floor(x);
  const gy = Math.floor(y);
  const fx = x - gx;
  const fy = y - gy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const ix = gx & m;
  const iy = gy & m;
  const ix1 = (ix + 1) & m;
  const iy1 = (iy + 1) & m;
  const a = t[iy * LATTICE + ix];
  const b = t[iy * LATTICE + ix1];
  const c = t[iy1 * LATTICE + ix];
  const d = t[iy1 * LATTICE + ix1];
  const top = a + (b - a) * sx;
  const bottom = c + (d - c) * sx;
  return top + (bottom - top) * sy;
}

/**
 * Three octaves of noise. One octave interpolated on a lattice leaves
 * diamond corners on every patch (the jungle floor's camouflage lesson);
 * three hide them.
 */
export function fbm(x: number, y: number): number {
  return noise(x, y) * 0.55 + noise(x * 2.03 + 17, y * 2.03 + 5) * 0.3 + noise(x * 4.1 + 3, y * 4.1 + 29) * 0.15;
}

export type Rgb = [number, number, number];

export function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Blend `a` toward `b` by `t`, in place, and return it. */
export function mixInto(a: Rgb, b: Rgb, t: number): Rgb {
  const k = clamp01(t);
  a[0] += (b[0] - a[0]) * k;
  a[1] += (b[1] - a[1]) * k;
  a[2] += (b[2] - a[2]) * k;
  return a;
}

/** RGBA bytes plus their size: what every painter here returns. */
export interface Painting {
  data: Uint8Array;
  width: number;
  height: number;
}

export function blank(width: number, height: number): Painting {
  return { data: new Uint8Array(width * height * 4), width, height };
}

export function put(p: Painting, x: number, y: number, r: number, g: number, b: number): void {
  const i = (y * p.width + x) * 4;
  p.data[i] = r < 0 ? 0 : r > 255 ? 255 : Math.round(r);
  p.data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : Math.round(g);
  p.data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : Math.round(b);
  p.data[i + 3] = 255;
}

/**
 * A texture over a painting's bytes. The bytes are SHARED, not copied —
 * painters cache their output, so two textures from one painting (a
 * floor at two repeats) cost the pixels once.
 */
export function paintingTexture(p: Painting, repeat = false): THREE.DataTexture {
  const texture = new THREE.DataTexture(p.data, p.width, p.height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  // Stated, not assumed: every painter here writes row 0 as v = 0.
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * A box whose UVs are in WORLD units divided by `unitsPerRepeat`, so one
 * repeating texture lays at the same scale on a 10-long wall and a
 * 0.5-wide merlon. A stock box stretches 0..1 over every face, which
 * makes the stone blocks on a long wall twice the size of those on a
 * short one.
 *
 * Built imperatively, so whoever builds one disposes it.
 */
export function worldUvBox(w: number, h: number, d: number, unitsPerRepeat = 1): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // BoxGeometry's faces, in order: +x, -x, +y, -y, +z, -z; four corners each.
  const dims: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / unitsPerRepeat, (uv.getY(i) * dims[f][1]) / unitsPerRepeat);
    }
  }
  uv.needsUpdate = true;
  return g;
}

/** Scale a geometry's UVs in place (for cylinders: circumference, height). */
export function scaleUv<T extends THREE.BufferGeometry>(g: T, su: number, sv: number): T {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return g;
}
