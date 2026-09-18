import * as THREE from 'three';
import { SymbolId } from '../game/colorblind';

/**
 * The face stickers for colourblind mode: the palette colour with a shape
 * stamped on it.
 *
 * Built pixel by pixel for the same reason as the shell patterns — there
 * is no canvas on React Native, and shipping six more PNGs would mean six
 * more assets to keep in step with the palette.
 *
 * The ink is chosen from the colour's own luminance so the shape stays
 * readable on both the pale yellow and the dark blue.
 */

const SIZE = 64;

type Mask = (nx: number, ny: number) => boolean;

/** All shapes are drawn in a -1..1 square, centred on the sticker. */
const MASKS: Record<SymbolId, Mask> = {
  circle: (x, y) => Math.hypot(x, y) < 0.52,

  square: (x, y) => Math.abs(x) < 0.46 && Math.abs(y) < 0.46,

  // Point up, sitting on a flat base.
  triangle: (x, y) => {
    if (y > 0.46 || y < -0.56) return false;
    // Width shrinks to nothing at the apex.
    const halfWidth = ((0.46 - y) / 1.02) * 0.62;
    return Math.abs(x) < halfWidth;
  },

  star: (x, y) => {
    const r = Math.hypot(x, y);
    if (r > 0.62) return false;
    const points = 5;
    const sector = (Math.PI * 2) / points;
    // +sector/2 puts a POINT straight up rather than a valley. Symbol
    // space has +y upward (the caller flips it), which is why this differs
    // from the shell pattern's star.
    const a = Math.atan2(y, x) + Math.PI / 2 + sector / 2;
    const folded = ((a % sector) + sector) % sector;
    const t = Math.abs(folded - sector / 2) / (sector / 2);
    const INNER = 0.42;
    return r <= (INNER + (1 - INNER) * t) * 0.62;
  },

  diamond: (x, y) => Math.abs(x) + Math.abs(y) < 0.6,

  hexagon: (x, y) => {
    // Flat-top hexagon: intersection of three slabs.
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    const R = 0.58;
    return ay < R * 0.866 && ax * 0.866 + ay * 0.5 < R * 0.866;
  },
};

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Perceived brightness (Rec. 601). Used only to pick black or white ink —
 * yellow needs dark, navy needs light.
 */
function luminance([r, g, b]: [number, number, number]): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

export function createSymbolTexture(
  symbol: SymbolId,
  faceHex: string,
): THREE.DataTexture {
  const face = parseHex(faceHex);
  const ink: [number, number, number] =
    luminance(face) > 140 ? [26, 22, 40] : [255, 255, 255];
  const mask = MASKS[symbol];

  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // Sample at pixel centres so shapes stay symmetric.
      const nx = ((x + 0.5) / SIZE) * 2 - 1;
      const ny = ((y + 0.5) / SIZE) * 2 - 1;
      const on = mask(nx, -ny);
      const [r, g, b] = on ? ink : face;
      const i = (y * SIZE + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, SIZE, SIZE);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
