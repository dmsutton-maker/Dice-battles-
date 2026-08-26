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
  const uri = encodePng(rgb, SIZE, SIZE);
  cache.set(skin.id, uri);
  return uri;
}
