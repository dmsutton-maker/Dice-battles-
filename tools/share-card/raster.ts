import { CARD, DrawItem } from '../../src/share/shareCard';
import { Rgba } from './pngio';

/**
 * Draw a card's list of rectangles (src/share/shareCard.ts) in
 * software, the way composeCard.ts draws it on the phone: each picture
 * sampled bilinearly over its rectangle, multiplied by its tint, and
 * blended over what is already there by its alpha.
 *
 * For the sample card and the tests, which have no GL. The layout is
 * the same code either way; only the painter differs.
 */
export function rasterCard(
  items: DrawItem[],
  pictures: Record<string, Rgba>,
  background: readonly [number, number, number],
): Rgba {
  const { width, height } = CARD;
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    out[i * 4] = Math.round(background[0] * 255);
    out[i * 4 + 1] = Math.round(background[1] * 255);
    out[i * 4 + 2] = Math.round(background[2] * 255);
    out[i * 4 + 3] = 255;
  }

  for (const item of items) {
    const src = pictures[item.art];
    if (!src) continue;
    const [u0, v0, u1, v1] = item.uv;
    const x0 = Math.max(0, Math.floor(item.x));
    const y0 = Math.max(0, Math.floor(item.y));
    const x1 = Math.min(width, Math.ceil(item.x + item.w));
    const y1 = Math.min(height, Math.ceil(item.y + item.h));
    for (let y = y0; y < y1; y++) {
      const v = v0 + ((y + 0.5 - item.y) / item.h) * (v1 - v0);
      for (let x = x0; x < x1; x++) {
        const u = u0 + ((x + 0.5 - item.x) / item.w) * (u1 - u0);
        const [r, g, b, a] = sample(src, u, v);
        const o = (y * width + x) * 4;
        const alpha = a / 255;
        out[o] = Math.round(out[o] * (1 - alpha) + r * item.tint[0] * alpha);
        out[o + 1] = Math.round(out[o + 1] * (1 - alpha) + g * item.tint[1] * alpha);
        out[o + 2] = Math.round(out[o + 2] * (1 - alpha) + b * item.tint[2] * alpha);
      }
    }
  }
  return { width, height, data: out };
}

/** Bilinear sample at (u, v) in 0..1, clamped at the edges like CLAMP_TO_EDGE. */
function sample(src: Rgba, u: number, v: number): [number, number, number, number] {
  const fx = Math.min(Math.max(u * src.width - 0.5, 0), src.width - 1);
  const fy = Math.min(Math.max(v * src.height - 0.5, 0), src.height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, src.width - 1);
  const y1 = Math.min(y0 + 1, src.height - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const result: [number, number, number, number] = [0, 0, 0, 0];
  const corners: [number, number, number][] = [
    [x0, y0, (1 - tx) * (1 - ty)],
    [x1, y0, tx * (1 - ty)],
    [x0, y1, (1 - tx) * ty],
    [x1, y1, tx * ty],
  ];
  for (const [x, y, w] of corners) {
    const o = (y * src.width + x) * 4;
    result[0] += src.data[o] * w;
    result[1] += src.data[o + 1] * w;
    result[2] += src.data[o + 2] * w;
    result[3] += src.data[o + 3] * w;
  }
  return result;
}
