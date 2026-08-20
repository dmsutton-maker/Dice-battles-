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
export type PatternId =
  | 'plain'
  | 'stripes'
  | 'spots'
  | 'stars'
  | 'grain'
  | 'bubbles'
  | 'frost';

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

  /**
   * Five-pointed stars.
   *
   * This used to be `0.55 + 0.45 * |cos(5a/2)|`, which is a cosine lobe —
   * it draws five ROUNDED bumps, and rendered out as a blob. Rendering the
   * texture to an image is the only way that shows up. Here the angle is
   * folded into one of five sectors and the boundary runs straight from
   * the inner vertex out to the point, which is what a star actually is.
   */
  stars: (x, y) => {
    const cell = 21;
    const cx = ((x % cell) - cell / 2) / (cell / 2);
    const cy = ((y % cell) - cell / 2) / (cell / 2);
    const r = Math.hypot(cx, cy);
    if (r > 1) return 0;

    const points = 5;
    const sector = (Math.PI * 2) / points;
    // +PI/2 stands the star upright rather than resting on a point.
    const a = Math.atan2(cy, cx) + Math.PI / 2;
    const folded = ((a % sector) + sector) % sector;
    const half = sector / 2;
    // 0 in the valley between two points, `half` along a point.
    const t = Math.abs(folded - half) / half;

    const INNER = 0.42;
    const boundary = INNER + (1 - INNER) * t;
    return r <= boundary * 0.95 ? 1 : 0;
  },

  /**
   * Frost: thin needles crossing on a grid, the way ice grows on a window.
   *
   * Frost used to share the `stars` painter with Starry, so the two skins
   * were the same picture in two colours — indistinguishable in the
   * Inventory and on the table. This is deliberately a different SHAPE,
   * not a different tint.
   */
  frost: (x, y) => {
    const cell = 16;
    const cx = ((x % cell) - cell / 2) / (cell / 2);
    const cy = ((y % cell) - cell / 2) / (cell / 2);
    const r = Math.hypot(cx, cy);
    if (r > 1) return 0;

    // Three needles at 0deg, 60deg and 120deg through the centre.
    const ARMS = 3;
    const THICKNESS = 0.17;
    for (let i = 0; i < ARMS; i++) {
      const t = (Math.PI * i) / ARMS;
      // Perpendicular distance from the line through the centre.
      const across = Math.abs(-Math.sin(t) * cx + Math.cos(t) * cy);
      // Needles taper: wide at the middle, fine at the tips.
      if (across < THICKNESS * (1 - r * 0.65)) return 1;
    }
    // A small bright core where the needles meet.
    return r < 0.13 ? 1 : 0;
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
  bubbles: (x, y) => {
    const cell = 16;
    const row = Math.floor(y / cell);
    const col = Math.floor(x / cell);
    // Deterministic per-cell jitter — no Math.random, so the texture is
    // identical every time it is built.
    const hash = (Math.sin(row * 12.9898 + col * 78.233) * 43758.5453) % 1;
    const wobble = Math.abs(hash);
    const radius = 4.6 + wobble * 2.2;

    const offset = row % 2 === 0 ? 0 : cell / 2;
    const cx = ((x + offset) % cell) - cell / 2;
    const cy = (y % cell) - cell / 2;
    const d = Math.hypot(cx, cy);

    // The glint: a small dot up and to the left inside the bubble.
    const gd = Math.hypot(cx + radius * 0.34, cy + radius * 0.34);
    if (gd < radius * 0.2) return 1;

    // The rim.
    const thickness = 2.1;
    if (d < radius && d > radius - thickness) return 0.9;

    // Hollow inside — the faintest wash so it reads as glass, not a hole.
    if (d <= radius - thickness) return 0.12;

    return 0;
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
/**
 * Raw RGB bytes for a pattern, one triple per pixel.
 *
 * Shared by the 3D shell texture and the 2D preview in the Store and the
 * Inventory, so what is on the shelf cannot drift away from what ends up
 * in your hand.
 */
export function patternPixels(
  pattern: Exclude<PatternId, 'plain'>,
  base: string,
  ink: string,
): number[] {
  const parse = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [br, bg, bb] = parse(base);
  const [ir, ig, ib] = parse(ink);
  const paint = PAINTERS[pattern];

  const out: number[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const mask = Math.max(0, Math.min(1, paint(x, y)));
      // Rounded to whole bytes. A Uint8Array used to truncate these for
      // free; the PNG encoder takes a plain array and a fractional byte
      // corrupts the stream.
      out.push(
        Math.round(br + (ir - br) * mask),
        Math.round(bg + (ig - bg) * mask),
        Math.round(bb + (ib - bb) * mask),
      );
    }
  }
  return out;
}

/** The size every pattern is drawn at. */
export const PATTERN_SIZE = SIZE;

/**
 * Build the shell texture for a pattern. `base` is the skin's own colour
 * and `ink` is the pattern colour drawn over it.
 */
export function createPatternTexture(
  pattern: Exclude<PatternId, 'plain'>,
  base: string,
  ink: string,
): THREE.DataTexture {
  const rgb = patternPixels(pattern, base, ink);
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 3) {
    data[i] = rgb[p];
    data[i + 1] = rgb[p + 1];
    data[i + 2] = rgb[p + 2];
    data[i + 3] = 255;
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
