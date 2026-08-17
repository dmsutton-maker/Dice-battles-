import * as THREE from 'three';

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
export type PatternId = 'plain' | 'stripes' | 'spots' | 'stars' | 'grain';

const SIZE = 64;

type Painter = (x: number, y: number) => number;

/** Returns a 0..1 mask: 1 = full pattern colour, 0 = base shell colour. */
const PAINTERS: Record<Exclude<PatternId, 'plain'>, Painter> = {
  // Diagonal stripes.
  stripes: (x, y) => (Math.floor((x + y) / 8) % 2 === 0 ? 1 : 0),

  // Evenly spaced dots on a staggered grid.
  spots: (x, y) => {
    const cell = 16;
    const row = Math.floor(y / cell);
    const offset = row % 2 === 0 ? 0 : cell / 2;
    const cx = ((x + offset) % cell) - cell / 2;
    const cy = (y % cell) - cell / 2;
    return Math.hypot(cx, cy) < 4.2 ? 1 : 0;
  },

  // Five-pointed stars, drawn as a polar petal function.
  stars: (x, y) => {
    const cell = 21;
    const cx = ((x % cell) - cell / 2) / (cell / 2);
    const cy = ((y % cell) - cell / 2) / (cell / 2);
    const r = Math.hypot(cx, cy);
    if (r > 1) return 0;
    const angle = Math.atan2(cy, cx);
    const points = 5;
    const spikes = 0.55 + 0.45 * Math.abs(Math.cos((angle * points) / 2));
    return r < spikes * 0.62 ? 1 : 0;
  },

  // Soft wood/marble grain: wavy bands with a little noise.
  grain: (x, y) => {
    const wave = Math.sin(x / 5 + Math.sin(y / 11) * 1.6);
    return wave > 0.35 ? 0.75 : 0;
  },
};

/**
 * Build the shell texture for a pattern. `base` is the skin's own colour
 * and `ink` is the pattern colour drawn over it.
 */
export function createPatternTexture(
  pattern: Exclude<PatternId, 'plain'>,
  base: string,
  ink: string,
): THREE.DataTexture {
  const parse = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [br, bg, bb] = parse(base);
  const [ir, ig, ib] = parse(ink);
  const paint = PAINTERS[pattern];

  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const mask = Math.max(0, Math.min(1, paint(x, y)));
      const i = (y * SIZE + x) * 4;
      data[i] = br + (ir - br) * mask;
      data[i + 1] = bg + (ig - bg) * mask;
      data[i + 2] = bb + (ib - bb) * mask;
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
