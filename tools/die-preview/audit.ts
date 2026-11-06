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
  /** Brightest point minus darkest, in luminance. */
  range: number;
  /** Distinct colours, quantised so a gradient is not a thousand of them. */
  colours: number;
  /**
   * How much of the face is NOT its most common colour.
   *
   * The measure that matters, and the one the first version of this tool
   * did not have. A face can have plenty of light and dark in it — a
   * rippling blue background, a mottled denim weave — while the thing
   * the skin is actually OF is missing entirely. Fish scored perfectly
   * on range with four of its six sides showing nothing but water.
   */
  design: number;
}

function faceStats(px: number[]): FaceStat {
  let hi = 0;
  let lo = 255;
  const counts = new Map<number, number>();
  for (let i = 0; i < px.length; i += 3) {
    const l = lum(px, i);
    if (l > hi) hi = l;
    if (l < lo) lo = l;
    const q = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
    counts.set(q, (counts.get(q) ?? 0) + 1);
  }
  const commonest = Math.max(...counts.values());
  return {
    range: hi - lo,
    colours: counts.size,
    design: 1 - commonest / (px.length / 3),
  };
}

const rows: { id: string; pattern: string; range: number; design: number; colours: number }[] = [];

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
  /*
    THREE RATIOS, each face against the BUSIEST face of the same die.
    Never a fixed threshold: ruby is a dark stone and volleyball is
    nearly white, and any number suiting one would libel the other.
  */
  const ratio = (pick: (s: FaceStat) => number) => {
    const values = stats.map(pick);
    const best = Math.max(...values);
    return best === 0 ? 1 : Math.min(...values) / best;
  };
  rows.push({
    id: skin.id,
    pattern: skin.pattern,
    range: ratio((s) => s.range),
    design: ratio((s) => s.design),
    colours: ratio((s) => s.colours),
  });
}

const worst = (r: { range: number; design: number; colours: number }) =>
  Math.min(r.range, r.design, r.colours);

rows.sort((a, b) => worst(a) - worst(b));
console.log('skin'.padEnd(14), 'pattern'.padEnd(16), '  light/dark', '  design', ' colours');
for (const r of rows) {
  const flag = worst(r) < 0.6 ? '  <-- BLANK SIDE' : '';
  console.log(
    r.id.padEnd(14),
    r.pattern.padEnd(16),
    r.range.toFixed(2).padStart(12),
    r.design.toFixed(2).padStart(8),
    r.colours.toFixed(2).padStart(8),
    flag,
  );
}
const bad = rows.filter((r) => worst(r) < 0.6);
console.log(`\n${bad.length} of ${rows.length} skins have at least one blank side`);
