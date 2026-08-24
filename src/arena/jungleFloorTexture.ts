import * as THREE from 'three';

/**
 * The Jungle Clearing's ground: damp earth, moss and fallen leaves.
 *
 * The jungle used to roll its dice on `createFlagstoneTexture` tinted
 * green — the castle's laid stone slabs, grout and all, in another colour.
 * That is the surface the camera is centred on and the dice come to rest
 * on, so of everything in the arena it was the piece doing the most to
 * make the jungle look like the castle repainted.
 *
 * A forest floor has no grid in it. It is earth, patched unevenly with
 * moss, under a scatter of leaves that fell where they fell.
 *
 * Deterministic — no Math.random, unlike the flagstone it replaces. A
 * floor that is different on every launch cannot be checked by a test, and
 * this project has no way to look at a rendered scene.
 */

const SIZE = 128;

/** Repeatable hash in 0..1. */
function hash2(x: number, y: number): number {
  return Math.abs((Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1);
}

/**
 * Smooth value noise that WRAPS at `period`.
 *
 * Plain noise would seam at the tile edge, and a seam on a floor this size
 * reads as a straight line ruled across the clearing — the very grid the
 * flagstone was being replaced to get rid of.
 */
function wrappedNoise(x: number, y: number, period: number): number {
  const gx = Math.floor(x / period);
  const gy = Math.floor(y / period);
  const fx = x / period - gx;
  const fy = y / period - gy;
  const cells = SIZE / period;
  const at = (ix: number, iy: number) =>
    hash2(((ix % cells) + cells) % cells, ((iy % cells) + cells) % cells);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const sx = smooth(fx);
  const sy = smooth(fy);
  const top = at(gx, gy) + (at(gx + 1, gy) - at(gx, gy)) * sx;
  const bottom = at(gx, gy + 1) + (at(gx + 1, gy + 1) - at(gx, gy + 1)) * sx;
  return top + (bottom - top) * sy;
}

const EARTH = { r: 74, g: 58, b: 38 };
const MOSS = { r: 78, g: 108, b: 56 };
const LEAF_COLORS = [
  { r: 138, g: 106, b: 46 },
  { r: 116, g: 82, b: 38 },
  { r: 158, g: 132, b: 58 },
  { r: 96, g: 116, b: 52 },
];

/**
 * Raw RGB bytes for the floor, one triple per pixel.
 *
 * The pixels are the primary thing and the texture wraps them, the same
 * way the dice patterns are built — so the floor can be measured in the
 * test suite without a GPU or a THREE image buffer to unwrap.
 */
export function jungleFloorPixels(): number[] {
  const out: number[] = [];

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // Damp earth, mottled at two scales so it is never a flat brown.
      const damp = wrappedNoise(x, y, 32) * 0.7 + wrappedNoise(x, y, 8) * 0.3;
      let r = EARTH.r * (0.72 + damp * 0.5);
      let g = EARTH.g * (0.72 + damp * 0.5);
      let b = EARTH.b * (0.72 + damp * 0.5);

      // Moss, in patches with soft edges rather than a wash over the lot.
      // Moss grows where it is damp, so it follows the same noise.
      //
      // THREE octaves, not one. A single octave is interpolated across an
      // 8x8 grid of cells, and the bilinear blend between them leaves
      // diamond and square corners on every patch — the moss came out
      // looking like camouflage. The finer octaves break those edges up.
      const mossNoise =
        wrappedNoise(x, y, 32) * 0.55 +
        wrappedNoise(x, y, 16) * 0.3 +
        wrappedNoise(x, y, 8) * 0.15;
      const mossAmount = Math.max(0, Math.min(1, (mossNoise - 0.44) * 3.4));
      if (mossAmount > 0) {
        const speckle = 0.86 + hash2(x * 3.1, y * 3.1) * 0.28;
        r += (MOSS.r * speckle - r) * mossAmount;
        g += (MOSS.g * speckle - g) * mossAmount;
        b += (MOSS.b * speckle - b) * mossAmount;
      }

      // Fallen leaves. Cell-based so they scatter without overlapping into
      // mush, each one an ellipse turned to its own angle.
      const CELL = 16;
      const cx0 = Math.floor(x / CELL);
      const cy0 = Math.floor(y / CELL);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const cells = SIZE / CELL;
          const cx = ((cx0 + ox) % cells + cells) % cells;
          const cy = ((cy0 + oy) % cells + cells) % cells;
          const h = hash2(cx, cy);
          // Only about half the cells carry a leaf, so the litter is
          // scattered rather than laid out on a grid.
          if (h < 0.45) continue;
          const h2 = hash2(cx + 41, cy + 17);
          const h3 = hash2(cx + 7, cy + 91);
          const lx = (cx0 + ox) * CELL + 3 + h2 * (CELL - 6);
          const ly = (cy0 + oy) * CELL + 3 + h3 * (CELL - 6);
          const angle = h * Math.PI;
          const dx = x - lx;
          const dy = y - ly;
          const u = dx * Math.cos(angle) + dy * Math.sin(angle);
          const v = -dx * Math.sin(angle) + dy * Math.cos(angle);
          const len = 3.1 + h2 * 2.2;
          const wide = 1.15 + h3 * 0.75;
          if ((u * u) / (len * len) + (v * v) / (wide * wide) > 1) continue;
          const leaf = LEAF_COLORS[Math.floor(h3 * LEAF_COLORS.length) % LEAF_COLORS.length];
          // The midrib: a slightly darker line down the leaf.
          const rib = Math.abs(v) < 0.5 ? 0.82 : 1;
          r = leaf.r * rib;
          g = leaf.g * rib;
          b = leaf.b * rib;
        }
      }

      // Fine soil grain over everything.
      const grain = 0.94 + hash2(x * 7.7, y * 5.3) * 0.12;
      out.push(
        Math.round(Math.min(255, r * grain)),
        Math.round(Math.min(255, g * grain)),
        Math.round(Math.min(255, b * grain)),
      );
    }
  }
  return out;
}

export function createJungleFloorTexture(): THREE.DataTexture {
  const rgb = jungleFloorPixels();
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0, p = 0; i < rgb.length; i += 3, p += 4) {
    data[p] = rgb[i];
    data[p + 1] = rgb[i + 1];
    data[p + 2] = rgb[i + 2];
    data[p + 3] = 255;
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

/** The size the floor is drawn at, for tests. */
export const JUNGLE_FLOOR_SIZE = SIZE;
