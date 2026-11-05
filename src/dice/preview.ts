import { DiceSkin } from '../game/diceSkins';
import { CARD_SAMPLERS, neonTubesAt, PatternId, sheetToCube, shellSampler, SMOOTH_EDGES, squareJob } from './patterns';

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
/** Told whenever a picture lands in the cache, with the skin's id. */
const listeners = new Set<(skinId: string) => void>();

/**
 * The shell of this skin as a data URI, or null for a plain skin — those
 * are one flat colour and a plain View draws them without any of this.
 *
 * Paints it NOW if it is not cached yet. The shelves no longer call this
 * (they read cachedShellPreviewUri and wait for the warm-up): it is for
 * the tests and the tools, which want the picture whatever it costs.
 */
export function shellPreviewUri(skin: DiceSkin): string | null {
  if (skin.pattern === 'plain') return null;
  const hit = cache.get(skin.id);
  if (hit) return hit;
  const job = shelfPictureJob(skin);
  while (job && !job.step());
  return cache.get(skin.id) ?? null;
}

/**
 * The picture if it is already painted, and null otherwise — never paints.
 *
 * David, 3 Nov 2026: "The game runs very slow when you open it ... it all
 * has to be lightning fast." A shelf card used to paint its own picture
 * in the frame it was drawn, so a Store built before the warm-up had
 * finished paid for every missing picture at once. A card now shows its
 * shell colour until the picture is ready (DiceSwatch), which the
 * warm-up paints a few texels at a time.
 */
export function cachedShellPreviewUri(skin: DiceSkin): string | null {
  return skin.pattern === 'plain' ? null : cache.get(skin.id) ?? null;
}

/**
 * Every painted picture, by skin id — for shelfStore.ts to keep between
 * launches.
 */
export function paintedShelfPictures(): Record<string, string> {
  return Object.fromEntries(cache);
}

/**
 * Take a picture kept from an earlier launch (shelfStore.ts). Only for a
 * skin with nothing painted yet; the listeners hear it like a painting.
 */
export function adoptShelfPicture(skinId: string, uri: string): void {
  if (cache.has(skinId)) return;
  cache.set(skinId, uri);
  for (const listener of listeners) {
    try {
      listener(skinId);
    } catch {
      // As above.
    }
  }
}

/** Test-only: forget every painted picture, so a suite can paint from cold. */
export function clearShelfPicturesForTests(): void {
  cache.clear();
}

/** Call `listener` with a skin's id each time its picture is painted. */
export function onShelfPicture(listener: (skinId: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The shelf picture of `skin`, as a job a few texels at a time, or null
 * if there is nothing to paint (plain, or already cached).
 *
 * The same painting shellPreviewUri always did — the front square, the
 * effect painted over it, then the PNG — cut into steps so the warm-up
 * and the loading screen can stop between any two (slicedPaint.ts).
 */
export function shelfPictureJob(skin: DiceSkin): { step(): boolean } | null {
  // Only a PLAIN skin has no picture. A missing `ink` used to stand in
  // for that, which silently gave every colour-painted skin a blank card
  // the moment one arrived without a dummy ink to satisfy the check.
  if (skin.pattern === 'plain' || cache.has(skin.id)) return null;
  const shell = shellSampler(
    skin.pattern as Exclude<PatternId, 'plain'>,
    skin.body,
    // A colour painter ignores this; a mask painter cannot do without it.
    skin.ink ?? skin.body,
  );
  // The card's own composition, where a crop of the die would mislead.
  const card = CARD_SAMPLERS[skin.pattern as PatternId];
  const square = squareJob(
    card ? card(shell) : shell,
    SMOOTH_EDGES.has(skin.pattern),
  );
  // The square, then the effect painted over it, then the PNG: three
  // steps, since the effect alone is 10-20ms on a desktop.
  let rgb: number[] | null = null;
  return {
    step() {
      if (cache.has(skin.id)) return true;
      if (!rgb) {
        if (!square.step()) return false;
        rgb = square.pixels();
        if (skin.effect !== undefined) return false;
      } else {
        if (skin.effect === 'fire') paintFlames(rgb);
        if (skin.effect === 'ice') paintIce(rgb);
        if (skin.effect === 'sun') paintSun(rgb);
        if (skin.effect === 'moon') paintMoon(rgb);
        if (skin.effect === 'neon') paintNeon(rgb);
      }
      cache.set(skin.id, encodePng(rgb, SIZE, SIZE));
      for (const listener of listeners) {
        try {
          listener(skin.id);
        } catch {
          // One card failing to redraw must not stop the rest hearing.
        }
      }
      return true;
    },
  };
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
      /*
        A glowing ember ground first, over the whole card. Since 30 Sep
        2026 the shell keeps a dark ring round each colour sticker, and
        the card shows no sticker — so without this the ring was a black
        disc in the middle of the picture.
      */
      const glowUp = 0.35 + 0.65 * (1 - v);
      rgb[i] = Math.round(90 + 68 * glowUp);
      rgb[i + 1] = Math.round(20 + 22 * glowUp);
      rgb[i + 2] = Math.round(7 + 3 * glowUp);
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

/*
  The sun on the shelf picture of the Sun dice, season 2 (21 Oct 2026).

  The shell carries the sun on one corner and its rays everywhere, and it
  keeps a dark ring round each colour sticker so the sticker's edge reads
  — and the card shows no sticker, so the middle of the picture was a
  dark disc, exactly the fault the Fire card had. The card gets the sun
  itself in that space: a white-hot heart, a gold rim and a corona laid
  over the rays, and a few sparkles of light out among them.
  Deterministic, like the flames.
*/
const SUN_HEART = [255, 246, 208];
const SUN_GOLD = [255, 226, 154];
const SUN_RIM = [255, 190, 48];
const SUN_SPARKLES: readonly (readonly [number, number])[] = [
  [0.18, 0.2],
  [0.8, 0.26],
  [0.22, 0.8],
];

export function paintSun(rgb: number[]): void {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x + 0.5 - SIZE / 2;
      const dy = y + 0.5 - SIZE / 2;
      const d = Math.hypot(dx, dy);
      const i = (y * SIZE + x) * 3;
      // The corona over whatever is there, then the disc.
      const corona = Math.min(1, Math.max(0, 1 - (d - 18) / 14));
      mixInto(rgb, i, SUN_RIM, corona * 0.8);
      if (d < 17) mixInto(rgb, i, SUN_GOLD, Math.min(1, (17 - d) / 2));
      if (d < 11) mixInto(rgb, i, SUN_HEART, Math.min(1, (11 - d) / 3));
      // Sparkles: four-pointed glints out in the rays.
      for (const [sx, sy] of SUN_SPARKLES) {
        const ax = Math.abs(x + 0.5 - sx * SIZE);
        const ay = Math.abs(y + 0.5 - sy * SIZE);
        const arm = (ax < 0.7 && ay < 4) || (ay < 0.7 && ax < 4);
        if (arm) mixInto(rgb, i, SUN_HEART, 1 - Math.max(ax, ay) / 5);
      }
    }
  }
}

/*
  Moonlight on the shelf picture of the Moon dice — the same reason: the
  shell keeps a thin ring of moonlight round each sticker, which on a
  card with no sticker was a ring round nothing. The card gets a pool of
  soft moonlight in the middle, so the ring reads as the edge of a halo,
  and a few more sparkles. Deterministic, like the rest.
*/
const MOON_SILVER = [201, 210, 232];
const MOON_WHITE = [244, 244, 255];
const MOON_SPARKLES: readonly (readonly [number, number])[] = [
  [0.2, 0.22],
  [0.78, 0.18],
  [0.16, 0.78],
];

export function paintMoon(rgb: number[]): void {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x + 0.5 - SIZE / 2, y + 0.5 - SIZE / 2);
      const i = (y * SIZE + x) * 3;
      mixInto(rgb, i, MOON_SILVER, Math.max(0, 1 - d / 26) * 0.5);
      mixInto(rgb, i, MOON_WHITE, Math.max(0, 1 - d / 12) * 0.55);
      for (const [sx, sy] of MOON_SPARKLES) {
        const ax = Math.abs(x + 0.5 - sx * SIZE);
        const ay = Math.abs(y + 0.5 - sy * SIZE);
        const arm = (ax < 0.7 && ay < 4.5) || (ay < 0.7 && ax < 4.5);
        if (arm) mixInto(rgb, i, MOON_WHITE, 1 - Math.max(ax, ay) / 5.5);
      }
    }
  }
}

/*
  The light on the shelf picture of the Neon dice, 1 Nov 2026.

  On the table a head of light chases round each tube (neonGlow.ts) and
  the bends sparkle; the shell painter only knows the tubes themselves,
  and a card is a still. So the card gets one moment of it: the pink
  head a third of the way round, the cyan head going the other way, a
  tail fading behind each, and a glint where a tube leaves the picture.
  Drawn from the same tubes as the paint and the glow map (neonTubesAt),
  so it cannot sit beside the tube. Deterministic, like the rest.
*/
const NEON_PINK_HEAD = [255, 236, 250];
const NEON_CYAN_HEAD = [236, 255, 255];
/**
 * Where round the die each head is caught, 0..1. The front of the die
 * shows 0.67..0.83 of the pink tube and 0.17..0.33 of the cyan, so each
 * head sits near the end of its run across the card with its tail
 * trailing back across the picture.
 */
const NEON_PINK_HEAD_AT = 0.78;
const NEON_CYAN_HEAD_AT = 0.28;
/** How quickly the tail fades behind the head; a long one paled the whole tube. */
const NEON_CARD_TAIL = 16;

/** How much of a texel `off` texels from a tube's middle the card's light covers. */
const neonCardOn = (off: number) => Math.max(0, 1 - Math.max(0, off - 1) / 3);

export function paintNeon(rgb: number[]): void {
  // The edge of the light is supersampled 2x2 so the card matches the
  // die (4 Nov 2026, Marc: "make the neon dice less pixelated"); "how
  // far round" is read at the texel's centre, as the glow map does.
  const SS = 2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const t = neonTubesAt(sheetToCube(x, y));
      const i = (y * SIZE + x) * 3;
      let pinkOn = 0;
      let cyanOn = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const s = neonTubesAt(sheetToCube(x + (sx + 0.5) / SS - 0.5, y + (sy + 0.5) / SS - 0.5));
          pinkOn += neonCardOn(s.pinkOff) / (SS * SS);
          cyanOn += neonCardOn(s.cyanOff) / (SS * SS);
        }
      }
      const pinkBehind = ((NEON_PINK_HEAD_AT - t.pinkAlong) % 1 + 1) % 1;
      const cyanBehind = ((NEON_CYAN_HEAD_AT - t.cyanAlong) % 1 + 1) % 1;
      mixInto(rgb, i, NEON_PINK_HEAD, pinkOn * Math.exp(-pinkBehind * NEON_CARD_TAIL) * 0.8);
      mixInto(rgb, i, NEON_CYAN_HEAD, cyanOn * Math.exp(-cyanBehind * NEON_CARD_TAIL) * 0.8);
      // The glint where a tube bends over the edge of the die.
      const toEdge = Math.min(x, SIZE - 1 - x, y, SIZE - 1 - y) / SIZE;
      const bend = Math.max(0, 1 - toEdge / 0.05) * Math.max(pinkOn, cyanOn);
      mixInto(rgb, i, [255, 250, 255], bend * 0.5);
    }
  }
}
