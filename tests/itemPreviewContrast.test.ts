import { readFileSync } from 'node:fs';
import { assert, note, suite, test } from './harness';

/**
 * The preview bar's DEAD button (`locked` / `unaffordable` — see
 * src/demo/ItemPreviewBar.tsx `actionDead`) is the one state that is not a
 * solid, opaque colour. `equip`/`buy` sit on solid yellow with dark text,
 * `equipped` sits on solid green with dark text — both always readable no
 * matter what is behind them, because nothing is behind them. `actionDead`
 * lets the live board show through, so what it reads as depends on which
 * battlefield you happen to be standing on.
 *
 * It shipped as a white wash under white text, which over the sunlit
 * castle floor came out at 1.65:1 — the one combination that was never
 * going to read. This computes the real composite (button tint over the
 * arena floor's own base colour, then text over that) and the real WCAG
 * contrast ratio, the same maths a screen does.
 *
 * The colours are READ OUT OF THE COMPONENT, not copied into this file.
 * The first version of this test transcribed them as constants, which
 * meant it went on reporting 1.65:1 after the button had already been
 * fixed — a test that cannot see the code it guards is not a guard.
 */

type RGB = [number, number, number];

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: RGB): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function composite(fg: RGB, alpha: number, bg: RGB): RGB {
  return [0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha)) as RGB;
}

function contrastRatio(a: RGB, b: RGB): number {
  const l1 = relativeLuminance(a) + 0.05;
  const l2 = relativeLuminance(b) + 0.05;
  return Math.max(l1, l2) / Math.min(l1, l2);
}

const BAR_SOURCE = readFileSync('src/demo/ItemPreviewBar.tsx', 'utf8');

/** `#rrggbb` or `rgba(r,g,b,a)` → colour plus its alpha. */
function parseColor(text: string): { rgb: RGB; alpha: number } {
  const rgba = text.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/,
  );
  if (rgba) {
    return {
      rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])],
      alpha: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }
  const hex = text.match(/#([0-9a-f]{6})/i);
  if (!hex) throw new Error(`cannot read a colour out of ${text}`);
  const n = parseInt(hex[1], 16);
  return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
}

/** Pull one property out of one StyleSheet entry in the component. */
function styleColor(styleName: string, prop: string): { rgb: RGB; alpha: number } {
  // Stop at the closing brace so a property is never read out of the NEXT
  // style block, which is how a regex like this quietly reads the wrong
  // colour and reports a number nobody can trace.
  const block = BAR_SOURCE.match(
    new RegExp(`\\n  ${styleName}: \\{([^}]*)\\}`),
  );
  assert(block !== null, `styles.${styleName} is gone from ItemPreviewBar`);
  const line = block![1].match(new RegExp(`${prop}:\\s*'([^']+)'`));
  assert(line !== null, `styles.${styleName} has no ${prop}`);
  return parseColor(line![1]);
}

/**
 * The three distinct floor base colours the arenas actually use (see the
 * createFlagstoneTexture calls in src/arena/*Arena.tsx). Sunset Castle
 * reuses the castle floor under different lighting, so it is not a fourth.
 */
const ARENA_FLOORS: Record<string, RGB> = {
  castle: [208, 184, 144],
  jungle: [148, 162, 118],
  space: [118, 124, 138],
};

suite('preview bar · the dead button reads over the live board behind it', () => {
  const button = styleColor('actionDead', 'backgroundColor');
  const text = styleColor('actionTextDead', 'color');

  for (const [arena, floor] of Object.entries(ARENA_FLOORS)) {
    test(`${arena}: "N more to go" text is readable against the actual floor colour`, () => {
      const buttonBg = composite(button.rgb, button.alpha, floor);
      const textColor = composite(text.rgb, text.alpha, buttonBg);
      const ratio = contrastRatio(textColor, buttonBg);
      note(
        `${arena}: dead button reads as rgb(${buttonBg.map((v) => v.toFixed(0)).join(',')}), text/bg contrast ${ratio.toFixed(2)}:1`,
      );
      // WCAG AA wants 4.5:1 for text this size (16px, below the 18.66px-bold
      // cutoff for "large text"). This is a number a five-year-old has to
      // read off a moving 3D board, so hold it to the real bar.
      assert(
        ratio >= 4.5,
        `${arena}: dead button text contrast is only ${ratio.toFixed(2)}:1 — ` +
          `needs 4.5:1 for 16px text. This is the button that says how many ` +
          `trophies you still need, so it is the one that most has to be read.`,
      );
    });
  }

  test('the dead button is backed darkly, like the rest of the bar', () => {
    // The title and the hint both solved this with a dark, nearly opaque
    // backing. The dead button is the only piece that ever drifted, and it
    // drifted by being light, so name that rule rather than only its
    // numeric consequence.
    assert(
      relativeLuminance(button.rgb) < 0.1,
      'the dead button tint is light again — white text over it will not read',
    );
    assert(
      button.alpha >= 0.8,
      `the dead button is only ${button.alpha} opaque, so the board shows through it`,
    );
  });
});
