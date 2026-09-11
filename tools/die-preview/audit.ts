/**
 * Which sides of which dice are BLANK.
 *
 * David, 11 Sep 2026: "a lot of skins don't have any of the designs on
 * some of their sides and it's just a blank one or two colors."
 *
 * The same fault gold, silver, copper and ruby had, spread across the
 * whole set. Since v1.76.0 each side of a die takes its own square of one
 * continuous design, laid out as a paper cube net — so a painter that
 * places its design at particular SHEET coordinates puts it on the two or
 * three squares it happens to cover and leaves the rest empty. It looks
 * perfect on the shelf thumbnail, which only ever shows the middle
 * square.
 *
 * This measures every square of every die: how much its brightest point
 * differs from its darkest, and how many distinct colours are on it. A
 * side far quieter than the busiest side of the same die is a blank one.
 *
 *     npx tsx tools/die-preview/audit.ts
 */
import { DICE_SKINS } from '../../src/game/diceSkins';
import { patternPixels, CUBE_NET_CELLS, PatternId } from '../../src/dice/patterns';

const lum = (px: number[], i: number) =>
  0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];

interface FaceStat {
  range: number;
  colours: number;
}

function faceStats(px: number[]): FaceStat {
  let hi = 0;
  let lo = 255;
  const seen = new Set<number>();
  for (let i = 0; i < px.length; i += 3) {
    const l = lum(px, i);
    if (l > hi) hi = l;
    if (l < lo) lo = l;
    // Quantised, so a smooth gradient does not read as a thousand colours.
    seen.add(((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4));
  }
  return { range: hi - lo, colours: seen.size };
}

const rows: { id: string; pattern: string; worst: number; best: number; ratio: number; colours: number }[] = [];

/*
  `satin` and `plain` carry no shape at all, on purpose — they are the
  three ladder prizes (Mint, Bubblegum, Midnight) and the starting Ivory,
  told apart by colour alone. Flagging them as blank is true and useless.
*/
const SHAPELESS = ['plain', 'satin'];

for (const skin of DICE_SKINS) {
  if (SHAPELESS.includes(skin.pattern)) continue;
  const stats = CUBE_NET_CELLS.map(([cx, cy]) =>
    faceStats(
      patternPixels(
        skin.pattern as Exclude<PatternId, 'plain'>,
        skin.body,
        skin.ink ?? skin.body,
        cx,
        cy,
      ),
    ),
  );
  const ranges = stats.map((s) => s.range);
  const worst = Math.min(...ranges);
  const best = Math.max(...ranges);
  rows.push({
    id: skin.id,
    pattern: skin.pattern,
    worst,
    best,
    ratio: best === 0 ? 1 : worst / best,
    colours: Math.min(...stats.map((s) => s.colours)),
  });
}

rows.sort((a, b) => a.ratio - b.ratio);
console.log('skin'.padEnd(14), 'pattern'.padEnd(16), 'quietest', 'busiest', 'ratio', 'colours');
for (const r of rows) {
  /*
    RATIO ONLY. The first version also flagged anything with fewer than
    six distinct colours, and that fired on paws, fish, leopard, cookie
    and tartan — designs that are simply made of two or three colours and
    are IDENTICAL on all six sides, which is the opposite of the fault.
    What "a blank side" means is one side much quieter than another side
    of the same die.
  */
  const flag = r.ratio < 0.5 ? '  <-- BLANK SIDE' : '';
  console.log(
    r.id.padEnd(14),
    r.pattern.padEnd(16),
    r.worst.toFixed(0).padStart(8),
    r.best.toFixed(0).padStart(7),
    r.ratio.toFixed(2).padStart(5),
    String(r.colours).padStart(7),
    flag,
  );
}
const bad = rows.filter((r) => r.ratio < 0.5);
console.log(`\n${bad.length} of ${rows.length} skins have at least one blank side`);
