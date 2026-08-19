import { assert, assertEqual, suite, test } from './harness';
import { COLOR_SYMBOLS, SymbolId } from '../src/game/colorblind';
import { PRISONER_COLORS, PrisonerColorId } from '../src/game/colors';
import { createSymbolTexture } from '../src/dice/symbols';

/**
 * Colourblind mode adds a SHAPE to every colour. If two colours ever share
 * a shape, or a shape covers so little of the sticker that it cannot be
 * seen mid-tumble, the mode is worse than useless — it looks like help
 * while giving none.
 */
suite('colorblind · symbols', () => {
  test('every colour has a symbol, and no two share one', () => {
    for (const c of PRISONER_COLORS) {
      assert(
        COLOR_SYMBOLS[c.id] !== undefined,
        `${c.label} has no colourblind symbol`,
      );
    }
    const used = Object.values(COLOR_SYMBOLS);
    assertEqual(
      new Set(used).size,
      used.length,
      `two colours share a symbol: ${used.join(', ')}`,
    );
  });

  test('every symbol actually marks the sticker', () => {
    // A shape covering almost none of the face is not a signal. Measured
    // against the face colour, since the ink flips with the background.
    for (const c of PRISONER_COLORS) {
      const tex = createSymbolTexture(COLOR_SYMBOLS[c.id], c.hex);
      const data = tex.image.data as Uint8Array;
      const face = [
        parseInt(c.hex.slice(1, 3), 16),
        parseInt(c.hex.slice(3, 5), 16),
        parseInt(c.hex.slice(5, 7), 16),
      ];
      let inked = 0;
      const pixels = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const differs =
          Math.abs(data[i] - face[0]) +
          Math.abs(data[i + 1] - face[1]) +
          Math.abs(data[i + 2] - face[2]);
        if (differs > 30) inked++;
      }
      const share = inked / pixels;
      assert(
        share > 0.08,
        `${c.label}'s ${COLOR_SYMBOLS[c.id]} covers only ${(share * 100).toFixed(1)}% of the face`,
      );
      assert(
        share < 0.75,
        `${c.label}'s ${COLOR_SYMBOLS[c.id]} covers ${(share * 100).toFixed(1)}% — the colour is being swamped`,
      );
    }
  });

  test('the ink stays readable against every face colour', () => {
    // Yellow needs dark ink, navy needs light. Whatever is chosen has to
    // clear a real contrast gap against the face it sits on.
    for (const c of PRISONER_COLORS) {
      const tex = createSymbolTexture(COLOR_SYMBOLS[c.id], c.hex);
      const data = tex.image.data as Uint8Array;
      const lum = (r: number, g: number, b: number) =>
        (r * 299 + g * 587 + b * 114) / 1000;
      const face = lum(
        parseInt(c.hex.slice(1, 3), 16),
        parseInt(c.hex.slice(3, 5), 16),
        parseInt(c.hex.slice(5, 7), 16),
      );
      // The centre of the sticker is inside the shape for all six.
      const mid = ((32 * 64) + 32) * 4;
      const ink = lum(data[mid], data[mid + 1], data[mid + 2]);
      assert(
        Math.abs(ink - face) > 60,
        `${c.label}'s symbol is nearly the same brightness as the face`,
      );
    }
  });

  test('every colour id in the palette is covered', () => {
    const ids = PRISONER_COLORS.map((c) => c.id).sort();
    const mapped = (Object.keys(COLOR_SYMBOLS) as PrisonerColorId[]).sort();
    assertEqual(mapped.join(','), ids.join(','), 'symbol map is out of step');
  });

  test('symbols are drawn the same way every time', () => {
    const first = createSymbolTexture('star' as SymbolId, '#ffe521')
      .image.data as Uint8Array;
    const second = createSymbolTexture('star' as SymbolId, '#ffe521')
      .image.data as Uint8Array;
    assert(
      first.every((v, i) => v === second[i]),
      'the same symbol rendered differently twice',
    );
  });
});
