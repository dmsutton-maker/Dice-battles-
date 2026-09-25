/**
 * All SIX sides of one die, side by side, straight to a PNG.
 *
 * Written on 11 Sep 2026 for "make the gold dice shinier", and it earned
 * itself in one run: the shelf picture showed a perfectly good highlight
 * while FOUR of the six real faces were flat, because the sheen was
 * positioned across the unwrapped net and landed on two of them. You
 * only ever see three faces at once, so most of the time the gold die
 * was a plain yellow cube — and no amount of looking at the shelf
 * picture would have shown that.
 *
 * Look at the net, not the thumbnail, whenever a skin's own shape
 * depends on WHERE it is on the sheet.
 *
 *     npx tsx tools/die-preview/shot-net.ts /tmp/gold-net.png gold
 */
import { writeFileSync } from 'node:fs';
import { DICE_SKINS } from '../../src/game/diceSkins';
import { patternPixels, CUBE_NET_CELLS, PatternId } from '../../src/dice/patterns';


const id = process.argv[3];
const skin = DICE_SKINS.find((s) => s.id === id)!;
const SIZE = 64;
const cols = 6;
const W = SIZE * cols;
const out = new Array(W * SIZE * 3).fill(0);
CUBE_NET_CELLS.forEach(([cx, cy], i) => {
  const px = patternPixels(skin.pattern as Exclude<PatternId, 'plain'>, skin.body, skin.ink ?? skin.body, cx, cy);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const src = (y * SIZE + x) * 3;
      const dst = (y * W + i * SIZE + x) * 3;
      out[dst] = px[src]; out[dst + 1] = px[src + 1]; out[dst + 2] = px[src + 2];
    }
  }
});
// Minimal PNG, written here rather than reaching into preview.ts.
import zlib = require('node:zlib');
const raw: number[] = [];
for (let y = 0; y < SIZE; y++) { raw.push(0); for (let x = 0; x < W * 3; x++) raw.push(out[y * W * 3 + x]); }
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(SIZE, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(process.argv[2], Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.from(raw))), chunk('IEND', Buffer.alloc(0))]));
console.log(process.argv[2]);
