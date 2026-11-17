/*
 * The dice-set cards for the collection shot, painted by the game's own
 * painter: the same `shellSampler` + `cardSquare` the Store shelf uses
 * (src/dice/preview.ts), with the same effect painted over the cards
 * that have one. Written one PNG per die into $SHOTS_TMP/cards, which
 * build-shots.py lays out.
 *
 * Only dice a player can get TODAY. Never a `retired` die (the ball dice
 * Marc took off the shelf on 4 Nov 2026 — soccer, tennis, basketball,
 * baseball, football, bowling, volleyball) and never a `prize` die
 * (Amethyst exists only when a board cup offers it). Season pass dice are
 * left to the season shot: they leave the pass when their season ends,
 * and a screenshot outlives a season.
 *
 * Run: npx tsx tools/store-shots/dice-grid.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';
import { cardSquare, CARD_SCALE, PatternId, shellSampler, SMOOTH_EDGES, squareJob } from '../../src/dice/patterns';
import { paintFlames, paintIce, paintMoon, paintNeon, paintSun } from '../../src/dice/preview';
import { DICE_SKINS } from '../../src/game/diceSkins';

/**
 * In reading order. Neighbours kept apart in colour so the grid sparkles.
 * GRID=a,b,c paints other cards instead, to try a die out.
 */
export const GRID_DICE = process.env.GRID ? process.env.GRID.split(',') : [
  'neon', 'pizza', 'ocean', 'leopard', 'galaxy',
  'watermelon', 'rainbow', 'tiger', 'candycane', 'peacock',
  'gold', 'fish', 'donut', 'turtle', 'ruby',
  'cow', 'starry', 'strawberry', 'supporter', 'honeycomb',
];

/** How many card pixels per texel of the die, for a skin without an effect. */
const SCALE = 4;

const OUT = join(process.env.SHOTS_TMP || '/tmp/store-shots', 'cards');
mkdirSync(OUT, { recursive: true });

function png(w: number, h: number, rgb: ArrayLike<number>): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let i = 0; i < w * 3; i++) raw[y * (w * 3 + 1) + 1 + i] = rgb[y * w * 3 + i];
  }
  const t = [...Array(256)].map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const v of b) c = t[(c ^ v) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const ch = (tag: string, d: Buffer) => {
    const l = Buffer.alloc(4);
    l.writeUInt32BE(d.length);
    const b = Buffer.concat([Buffer.from(tag), d]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(b));
    return Buffer.concat([l, b, c]);
  };
  const ih = Buffer.alloc(13);
  ih.writeUInt32BE(w, 0);
  ih.writeUInt32BE(h, 4);
  ih[8] = 8;
  ih[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    ch('IHDR', ih),
    ch('IDAT', deflateSync(raw)),
    ch('IEND', Buffer.alloc(0)),
  ]);
}

for (const id of GRID_DICE) {
  const s = DICE_SKINS.find((x) => x.id === id);
  if (!s) throw new Error(`no such die: ${id}`);
  if (s.retired || s.prize || s.pass) throw new Error(`${id} cannot be got today, keep it out of the grid`);
  if (s.pattern === 'plain') throw new Error(`${id} is plain; the grid is for patterned dice`);
  const pattern = s.pattern as Exclude<PatternId, 'plain'>;
  const shell = shellSampler(pattern, s.body, s.ink ?? s.body);
  const hasEffect = s.effect !== undefined;
  let { texel, size } = cardSquare(pattern, shell, hasEffect);
  // Sharper than the shelf, the way CARD_SCALE sharpens Tiger: the
  // painters are functions of position, so asked between texels they give
  // real detail. An effect is painted over a 64-pixel square, as on the
  // shelf, so those stay at the shelf's size.
  if (!hasEffect && size === 64 && !(pattern in CARD_SCALE)) {
    texel = (x, y) => shell((x + 0.5) / SCALE - 0.5, (y + 0.5) / SCALE - 0.5);
    size = 64 * SCALE;
  }
  const job = squareJob(texel, SMOOTH_EDGES.has(pattern), size);
  while (!job.step());
  const rgb = job.pixels();
  if (s.effect === 'fire') paintFlames(rgb);
  if (s.effect === 'ice') paintIce(rgb);
  if (s.effect === 'sun') paintSun(rgb);
  if (s.effect === 'moon') paintMoon(rgb);
  if (s.effect === 'neon') paintNeon(rgb);
  writeFileSync(join(OUT, `${id}.png`), png(size, size, rgb));
  console.log('card', id, size);
}
// The order, for build-shots.py to lay the cards out in.
writeFileSync(join(OUT, 'order.json'), JSON.stringify(GRID_DICE));
