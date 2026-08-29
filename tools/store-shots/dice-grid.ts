/* A grid of real dice shells, painted by the game's own painter. */
import { patternPixels, PATTERN_SIZE } from '/home/user/Dice-battles-/src/dice/patterns';
import { DICE_SKINS } from '/home/user/Dice-battles-/src/game/diceSkins';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const S = PATTERN_SIZE, SCALE = 2, TILE = S * SCALE;
const PICK = ['gold','ruby','ocean','mint','bubblegum','midnight','copper','zebra','bubbles','cow',
  'golf','bee','tennis','turtle','soccer','basketball','football','snake','tiger','leopard',
  'watermelon','pizza','galaxy','rainbow','honeycomb','volleyball','denim','marble','peacock','strawberry'];
const COLS = 5, ROWS = Math.ceil(PICK.length / COLS);
const W = COLS * TILE, H = ROWS * TILE;
const out = new Array(W * H * 4).fill(0);
PICK.forEach((id, k) => {
  const s = (DICE_SKINS as any[]).find((x) => x.id === id);
  if (!s) { console.log('missing', id); return; }
  const px = s.pattern === 'plain' ? null : patternPixels(s.pattern, s.body, s.ink ?? s.body);
  const body = [1,3,5].map((i)=>parseInt(s.body.slice(i,i+2),16));
  const cx = (k % COLS) * TILE, cy = Math.floor(k / COLS) * TILE;
  const r = TILE * 0.5, rad = TILE * 0.22;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    // Rounded-square die face with a small margin.
    const m = TILE * 0.07, w = TILE - m * 2;
    const lx = x - m, ly = y - m;
    if (lx < 0 || ly < 0 || lx >= w || ly >= w) continue;
    const dx = Math.max(rad - lx, 0, lx - (w - rad)), dy = Math.max(rad - ly, 0, ly - (w - rad));
    if (Math.hypot(dx, dy) > rad) continue;
    const sx = Math.floor((lx / w) * S), sy = Math.floor((ly / w) * S);
    const c = px ? px.slice((sy * S + sx) * 3, (sy * S + sx) * 3 + 3) : body;
    // A soft sheen down the top-left, so it reads as a die not a tile.
    const sheen = Math.max(0, 1 - (lx + ly) / (w * 0.9)) * 0.22;
    const o = ((cy + y) * W + (cx + x)) * 4;
    for (let i = 0; i < 3; i++) out[o + i] = Math.min(255, c[i] + (255 - c[i]) * sheen);
    out[o + 3] = 255;
  }
});
function png(w: number, h: number, rgba: number[]) {
  const raw: number[] = [];
  for (let y = 0; y < h; y++) { raw.push(0); for (let x = 0; x < w; x++) raw.push(...rgba.slice((y*w+x)*4, (y*w+x)*4+4)); }
  const t = [...Array(256)].map((_, n) => { let c = n; for (let k=0;k<8;k++) c = c&1 ? 0xedb88320^(c>>>1) : c>>>1; return c>>>0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = t[(c^v)&255]^(c>>>8); return (c^0xffffffff)>>>0; };
  const ch = (tag: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const b = Buffer.concat([Buffer.from(tag), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(b)); return Buffer.concat([l, b, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w,0); ih.writeUInt32BE(h,4); ih[8]=8; ih[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), ch('IHDR',ih), ch('IDAT',deflateSync(Buffer.from(raw))), ch('IEND',Buffer.alloc(0))]);
}
writeFileSync('/tmp/dice-grid.png', png(W, H, out));
console.log('dice grid', W, 'x', H, PICK.length, 'skins');
