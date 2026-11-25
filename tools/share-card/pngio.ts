import { deflateSync, inflateSync } from 'node:zlib';

/**
 * Just enough PNG for the tools and the tests: read the 8-bit,
 * non-interlaced files make_art.py and the App Store screenshots are,
 * and write an RGB or RGBA one back. Node only (zlib); the phone never
 * runs this — there, expo-gl decodes and encodes natively.
 */
export interface Rgba {
  width: number;
  height: number;
  /** Row-major RGBA, 4 bytes a pixel. */
  data: Uint8Array;
}

export interface PngHeader {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlace: number;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

function readBe32(bytes: Uint8Array, at: number): number {
  return ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
}

/** The IHDR of a PNG, without decoding it. Throws if it is not a PNG. */
export function pngHeader(bytes: Uint8Array): PngHeader {
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== SIGNATURE[i]) throw new Error('not a PNG');
  }
  const type = String.fromCharCode(...bytes.subarray(12, 16));
  if (type !== 'IHDR') throw new Error('IHDR is not the first chunk');
  return {
    width: readBe32(bytes, 16),
    height: readBe32(bytes, 20),
    bitDepth: bytes[24],
    colorType: bytes[25],
    interlace: bytes[28],
  };
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Decode an 8-bit grey, grey+alpha, RGB or RGBA non-interlaced PNG to RGBA. */
export function readPng(bytes: Uint8Array): Rgba {
  const header = pngHeader(bytes);
  if (header.bitDepth !== 8) throw new Error(`bit depth ${header.bitDepth} not supported`);
  if (header.interlace !== 0) throw new Error('interlaced PNG not supported');
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[header.colorType];
  if (!channels) throw new Error(`colour type ${header.colorType} not supported`);

  const parts: Uint8Array[] = [];
  let at = 8;
  while (at < bytes.length) {
    const length = readBe32(bytes, at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    if (type === 'IDAT') parts.push(bytes.subarray(at + 8, at + 8 + length));
    if (type === 'IEND') break;
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts.map((p) => Buffer.from(p))));

  const { width, height } = header;
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  const line = new Uint8Array(stride);
  const prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const start = y * (stride + 1) + 1;
    for (let i = 0; i < stride; i++) {
      const x = raw[start + i];
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v: number;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: v = x + paeth(a, b, c); break;
        default: throw new Error(`filter ${filter}`);
      }
      line[i] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const s = x * channels;
      if (channels === 1) {
        out[o] = out[o + 1] = out[o + 2] = line[s];
        out[o + 3] = 255;
      } else if (channels === 2) {
        out[o] = out[o + 1] = out[o + 2] = line[s];
        out[o + 3] = line[s + 1];
      } else {
        out[o] = line[s];
        out[o + 1] = line[s + 1];
        out[o + 2] = line[s + 2];
        out[o + 3] = channels === 4 ? line[s + 3] : 255;
      }
    }
    prev.set(line);
  }
  return { width, height, data: out };
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) body[i] = type.charCodeAt(i);
  body.set(data, 4);
  const out = new Uint8Array(12 + data.length);
  out.set(be32(data.length), 0);
  out.set(body, 4);
  out.set(be32(crc32(body)), 8 + data.length);
  return out;
}

/** Encode RGBA pixels as a PNG; `alpha: false` drops the channel for an opaque picture. */
export function writePng(img: Rgba, options: { alpha?: boolean } = {}): Uint8Array {
  const alpha = options.alpha ?? true;
  const channels = alpha ? 4 : 3;
  const { width, height } = img;
  const raw = new Uint8Array(height * (width * channels + 1));
  for (let y = 0; y < height; y++) {
    const row = y * (width * channels + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      const d = row + 1 + x * channels;
      raw[d] = img.data[s];
      raw[d + 1] = img.data[s + 1];
      raw[d + 2] = img.data[s + 2];
      if (alpha) raw[d + 3] = img.data[s + 3];
    }
  }
  const ihdr = new Uint8Array([...be32(width), ...be32(height), 8, alpha ? 6 : 2, 0, 0, 0]);
  const idat = new Uint8Array(deflateSync(Buffer.from(raw), { level: 6 }));
  const parts = [new Uint8Array(SIGNATURE), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
