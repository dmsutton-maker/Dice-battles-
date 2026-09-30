import { DiceSkin } from '../game/diceSkins';
import { patternPixels, PatternId } from './patterns';

/**
 * A picture of a dice skin for the Store and the Inventory.
 *
 * The point is that what you are buying looks like what you get. The
 * shelf used to show a flat colour square with an emoji on it — 🦓 on
 * white for Zebra — which tells you nothing about the dice you end up
 * rolling.
 *
 * It is drawn by the SAME painter that builds the 3D texture
 * (src/dice/patterns.ts), so the two cannot drift apart. That mattered:
 * Frost and Starry once shared a pattern and nobody noticed, because
 * nothing in the menus showed the real thing.
 *
 * React Native has no canvas, so the pixels are wrapped into a PNG by
 * hand and handed to <Image> as a data URI. The PNG uses stored (that is,
 * uncompressed) deflate blocks — no compression to implement, and at
 * 64x64 the size does not matter.
 */

const SIZE = 64;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes: number[], start = 0, end = bytes.length): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: number[]): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

const be32 = (n: number): number[] => [
  (n >>> 24) & 255,
  (n >>> 16) & 255,
  (n >>> 8) & 255,
  n & 255,
];

function chunk(type: string, data: number[]): number[] {
  const body = [...type].map((c) => c.charCodeAt(0)).concat(data);
  return [...be32(data.length), ...body, ...be32(crc32(body))];
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : B64[b2 & 63];
  }
  return out;
}

/** Wrap raw RGB rows into a PNG. `rows` is SIZE rows of SIZE*3 bytes. */
function encodePng(rgb: number[], width: number, height: number): string {
  // Each scanline is prefixed with filter type 0 (none).
  const raw: number[] = [];
  for (let y = 0; y < height; y++) {
    raw.push(0);
    for (let x = 0; x < width * 3; x++) raw.push(rgb[y * width * 3 + x]);
  }

  // zlib: header, then stored deflate blocks, then the Adler checksum.
  const z: number[] = [0x78, 0x01];
  const MAX = 65535;
  for (let i = 0; i < raw.length; i += MAX) {
    const slice = raw.slice(i, i + MAX);
    const last = i + MAX >= raw.length ? 1 : 0;
    z.push(last, slice.length & 255, (slice.length >> 8) & 255);
    z.push(~slice.length & 255, (~slice.length >> 8) & 255);
    z.push(...slice);
  }
  z.push(...be32(adler32(raw)));

  const png = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', [...be32(width), ...be32(height), 8, 2, 0, 0, 0]),
    ...chunk('IDAT', z),
    ...chunk('IEND', []),
  ];
  return `data:image/png;base64,${base64(png)}`;
}

const cache = new Map<string, string>();

/**
 * The shell of this skin as a data URI, or null for a plain skin — those
 * are one flat colour and a plain View draws them without any of this.
 */
export function shellPreviewUri(skin: DiceSkin): string | null {
  // Only a PLAIN skin has no picture. A missing `ink` used to stand in
  // for that, which silently gave every colour-painted skin a blank card
  // the moment one arrived without a dummy ink to satisfy the check.
  if (skin.pattern === 'plain') return null;
  const hit = cache.get(skin.id);
  if (hit) return hit;

  const rgb = patternPixels(
    skin.pattern as Exclude<PatternId, 'plain'>,
    skin.body,
    // A colour painter ignores this; a mask painter cannot do without it.
    skin.ink ?? skin.body,
  );
  if (skin.effect === 'fire') paintFlames(rgb);
  if (skin.effect === 'ice') paintIce(rgb);
  const uri = encodePng(rgb, SIZE, SIZE);
  cache.set(skin.id, uri);
  return uri;
}

/*
  Flames on the shelf picture of the Fire dice.

  David, 30 Sep 2026, on the Store card: "the picture of it when you're
  looking at it just shows a black die with a red line on it, it doesn't
  show fire. Can it show fire in the image?" He was right to expect it:
  the fire is the whole of what this die is, and the shell painter only
  knows the charred wood underneath, because the flames on the table are
  particles drawn by the scene, not paint.

  So the picture gets flames painted over the shell: four tongues rising
  from the bottom edge, white-yellow at the root, orange, then red at the
  tips, with a hotter core inside. Deterministic, like every painter —
  the card must be the same picture every time it is drawn.

  The 3D shell is untouched. This is the shelf's picture of the effect,
  and the effect itself is in src/dice/diceFire.ts.
*/
const TONGUES: readonly (readonly [number, number, number])[] = [
  // centre across the picture, height as a share of it, half-width
  [0.14, 0.62, 0.16],
  [0.4, 0.86, 0.19],
  [0.64, 0.7, 0.16],
  [0.88, 0.78, 0.15],
];

function flameHeight(u: number, v: number, scale: number): number {
  // A little sideways sway that grows toward the tips, so the tongues
  // lick rather than standing up like teeth.
  const sway = u + Math.sin(v * 13 + u * 5) * 0.035 * v;
  let h = 0.2 * scale;
  for (const [c, height, w] of TONGUES) {
    const d = (sway - c) / w;
    if (Math.abs(d) < 1) h = Math.max(h, height * scale * Math.pow(1 - d * d, 1.6));
  }
  return h;
}

function mixInto(rgb: number[], i: number, color: readonly number[], a: number): void {
  for (let k = 0; k < 3; k++) rgb[i + k] = Math.round(rgb[i + k] + (color[k] - rgb[i + k]) * a);
}

const HOT = [255, 244, 176];
const ORANGE = [255, 150, 38];
const RED = [214, 58, 22];

export function paintFlames(rgb: number[]): void {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = (x + 0.5) / SIZE;
      const v = 1 - (y + 0.5) / SIZE;
      const i = (y * SIZE + x) * 3;
      // A warm glow on the char just above the flames.
      const outer = flameHeight(u, v, 1);
      const glow = Math.max(0, 1 - (v - outer) / 0.18);
      if (v > outer && glow > 0) mixInto(rgb, i, RED, glow * glow * 0.35);
      if (v <= outer) {
        const t = v / outer;
        // Soft edge rather than a cut-out.
        const edge = Math.min(1, (1 - t) / 0.12);
        const color =
          t < 0.45
            ? ORANGE
            : ORANGE.map((c, k) => Math.round(c + (RED[k] - c) * ((t - 0.45) / 0.55)));
        mixInto(rgb, i, color, 0.95 * edge);
      }
      // The hot core: a smaller flame of the same shape, white-yellow.
      const inner = flameHeight(u, v, 0.48);
      if (v <= inner) {
        const t = v / inner;
        mixInto(rgb, i, HOT, 0.9 * Math.min(1, (1 - t) / 0.2));
      }
    }
  }
}

/*
  Ice on the shelf picture of the Ice dice — the same reason as the
  flames above: the shell painter draws the ice the die is made of, and
  the cold coming off it is drawn by the scene. So the card gets
  icicles hanging from the top edge, frost creeping in from the sides,
  and a few sparkles. Deterministic, like the flames.
*/
const ICICLES: readonly (readonly [number, number, number])[] = [
  // centre across the picture, length as a share of it, half-width
  [0.08, 0.3, 0.06],
  [0.22, 0.5, 0.07],
  [0.37, 0.28, 0.05],
  [0.52, 0.62, 0.08],
  [0.68, 0.36, 0.06],
  [0.82, 0.48, 0.07],
  [0.95, 0.24, 0.05],
];
const SPARKLES: readonly (readonly [number, number])[] = [
  [0.3, 0.72],
  [0.74, 0.8],
  [0.6, 0.34],
];
const WHITE = [248, 253, 255];
const PALE = [214, 238, 250];
const DEEP = [120, 180, 214];

export function paintIce(rgb: number[]): void {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = (x + 0.5) / SIZE;
      const v = (y + 0.5) / SIZE; // 0 at the top
      const i = (y * SIZE + x) * 3;
      // A band of frost along the top edge that the icicles hang from.
      const band = 0.12 + Math.sin(u * 23) * 0.015;
      if (v < band) mixInto(rgb, i, WHITE, 0.9 * Math.min(1, (band - v) / 0.03 + 0.4));
      // Icicles: tapering spikes, with a shaded side and a lit edge.
      for (const [c, len, w] of ICICLES) {
        const reach = band + len * 0.75;
        if (v >= reach || v < band - 0.02) continue;
        const t = (v - band) / (reach - band); // 0 at the root, 1 at the tip
        const half = w * (1 - Math.max(0, t));
        const d = (u - c) / Math.max(half, 0.004);
        if (Math.abs(d) >= 1) continue;
        const color = d < -0.3 ? WHITE : d > 0.45 ? DEEP : PALE;
        mixInto(rgb, i, color, 0.92 * Math.min(1, (1 - Math.abs(d)) / 0.3));
      }
      // Frost creeping in from the left, right and bottom edges.
      const fromEdge = Math.min(u, 1 - u, 1 - v);
      const creep = 0.07 + Math.abs(Math.sin(v * 31 + u * 7)) * 0.05;
      if (fromEdge < creep) mixInto(rgb, i, WHITE, 0.75 * (1 - fromEdge / creep));
      // Sparkles: a four-pointed glint.
      for (const [sx, sy] of SPARKLES) {
        const dx = Math.abs(u - sx) * SIZE;
        const dy = Math.abs(v - sy) * SIZE;
        const arm = (dx < 0.7 && dy < 4) || (dy < 0.7 && dx < 4);
        if (arm) mixInto(rgb, i, WHITE, 1 - Math.max(dx, dy) / 5);
      }
    }
  }
}
