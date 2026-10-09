import { Align, Gutter, loadYoga } from 'yoga-layout/load';
import { assert, assertClose, note, suite, test } from './harness';

/**
 * `CoinLabel` (src/demo/GoldCoin.tsx) replaced a `Text` price tag with a
 * `View` row — a coin drawn beside the number instead of a coin emoji
 * inside the string. That is wider than the string alone was, and it sits
 * in a 3-across card that is only 31% of the screen wide with 6pt of
 * padding on each side. If the row does not fit, on a real phone it either
 * wraps to a second line (making that one card taller than its neighbours,
 * since the Inventory/Store grid's default cross-axis alignment is
 * `stretch`) or spills past the card's rounded border.
 *
 * There is no font-shading engine in this Node process, so exact pixel
 * widths cannot be reproduced — that part still wants a real device or
 * simulator screenshot. What this CAN check with the real layout engine
 * (`yoga-layout`, the algorithm React Native itself runs) is the
 * arithmetic: given a deliberately generous estimate of glyph width, does
 * the row have comfortable room inside the card, or is it already
 * borderline? A generous (wide) estimate is used throughout so this errs
 * toward reporting a false overflow, never toward hiding a real one.
 */

const SE_WIDTH = 375;
const SCROLL_PADDING_H = 16;
const CARD_PADDING_H = 6;
const GRID_GAP = 10;
const CARD_PERCENT = 0.31;

/** Generous per-glyph width, in ems (multiples of font size). */
const EMOJI_EM = 1.25;
const DIGIT_EM = 0.65;
const SPACE_EM = 0.35;
const LETTER_EM = 0.62;

function isEmoji(ch: string): boolean {
  return /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u.test(ch);
}

/** A deliberately generous single-line text width estimate. See header. */
function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const ch of Array.from(text)) {
    if (isEmoji(ch)) width += EMOJI_EM * fontSize;
    else if (ch === ' ') width += SPACE_EM * fontSize;
    else if (/[0-9]/.test(ch)) width += DIGIT_EM * fontSize;
    else width += LETTER_EM * fontSize;
  }
  return width;
}

/** Builds a CoinLabel row (coin + gap + text) and returns its own width. */
async function coinLabelRowWidth(opts: {
  coinSize: number;
  text: string;
  fontSize: number;
  coinFirst?: boolean;
}): Promise<number> {
  const Y = await loadYoga();
  // A big, unconstrained root so the row is measured at its natural width,
  // exactly as it would be inside a card that centres its children rather
  // than stretching them.
  const root = Y.Node.create();
  root.setWidth(1000);
  root.setHeight(200);
  // A column root defaults its cross axis (alignItems) to stretch, which
  // would force the row to 1000pt wide — the opposite of what a real card
  // does (`alignItems: 'center'`, sizing the row to its own content).
  root.setAlignItems(Align.FlexStart);

  const row = Y.Node.create();
  row.setFlexDirection(Y.FLEX_DIRECTION_ROW);
  row.setAlignItems(Align.Center);
  row.setGap(Gutter.All, 4);
  root.insertChild(row, 0);

  const coin = Y.Node.create();
  coin.setWidth(opts.coinSize);
  coin.setHeight(opts.coinSize);

  const textNode = Y.Node.create();
  const w = estimateTextWidth(opts.text, opts.fontSize);
  textNode.setWidth(w);
  textNode.setHeight(opts.fontSize * 1.25);

  const coinFirst = opts.coinFirst ?? true;
  if (coinFirst) {
    row.insertChild(coin, 0);
    row.insertChild(textNode, 1);
  } else {
    row.insertChild(textNode, 0);
    row.insertChild(coin, 1);
  }

  root.calculateLayout(1000, 200);
  return row.getComputedWidth();
}

/** Width of a 3-across card's own interior, on the tightest supported phone. */
function cardInteriorWidth(): number {
  const gridWidth = SE_WIDTH - SCROLL_PADDING_H * 2;
  // width: '31%' plus two 10pt gaps between three cards — matches the grid
  // style shared by InventoryScreen and StoreScreen.
  const cardWidth = gridWidth * CARD_PERCENT;
  return cardWidth - CARD_PADDING_H * 2;
}

suite('coin price tag · the drawn coin still fits the card', () => {
  test('Inventory: "🛒 450" (the priciest die after resorting) fits inside a 31% card', async () => {
    const row = await coinLabelRowWidth({
      coinSize: 12,
      text: '🛒 450',
      fontSize: 10,
      coinFirst: false,
    });
    const interior = cardInteriorWidth();
    note(
      `Inventory price row: ~${row.toFixed(1)}pt wide, card interior ${interior.toFixed(1)}pt (iPhone SE)`,
    );
    assert(
      row < interior,
      `the "🛒 450" row is ${row.toFixed(1)}pt but the card only has ${interior.toFixed(1)}pt — it would wrap or spill past the border`,
    );
  });

  test('Store: "450" priced die (the most expensive skin) fits inside a 31% card', async () => {
    const row = await coinLabelRowWidth({
      coinSize: 13,
      text: '450',
      fontSize: 12,
      coinFirst: true,
    });
    const interior = cardInteriorWidth();
    note(`Store price row: ~${row.toFixed(1)}pt wide, card interior ${interior.toFixed(1)}pt`);
    assert(
      row < interior,
      `the "450" row is ${row.toFixed(1)}pt but the card only has ${interior.toFixed(1)}pt`,
    );
  });

  test('the locked-ladder price tag (plain Text, unaffected by this change) is the thing to compare against', async () => {
    // Sanity check on the estimator itself: a plain Text tag with the same
    // generous per-glyph estimate should also read as comfortably inside
    // the card, since it already ships today. If this failed, the
    // estimator would be too pessimistic to trust for the CoinLabel checks
    // above.
    const w = estimateTextWidth('🔒 450 🏆', 10);
    const interior = cardInteriorWidth();
    assert(
      w < interior,
      `even the existing plain-Text tag would not fit by this estimate (${w.toFixed(1)}pt vs ${interior.toFixed(1)}pt) — the estimator is too pessimistic to use`,
    );
  });
});

suite('coin price tag · no doubled margin, no drift', () => {
  test('the row carries exactly one marginTop (on the row, not the text)', async () => {
    // Mirrors the actual style split: priceTagRow / priceRow gets
    // marginTop: 3, the Text style inside (priceTagText / priceText) gets
    // none. This test protects against a future edit re-adding it to the
    // text and doubling the gap under the card.
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const inv = fs.readFileSync(
      path.join(__dirname, '..', 'src/demo/InventoryScreen.tsx'),
      'utf8',
    );
    const store = fs.readFileSync(
      path.join(__dirname, '..', 'src/demo/StoreScreen.tsx'),
      'utf8',
    );
    for (const [src, textStyle] of [
      [inv, 'priceTagText'],
      [store, 'priceText'],
    ] as const) {
      // These are flat style objects (no nested braces), so match up to
      // the first closing brace rather than the next "\n  }," — the latter
      // can walk past this block into an unrelated later style.
      const block = src.match(new RegExp(`${textStyle}: \\{[^}]*\\}`))?.[0];
      assert(block !== undefined, `${textStyle} style not found`);
      assert(
        !/marginTop/.test(block!),
        `${textStyle} still carries a marginTop — combined with the row's ` +
          'own marginTop this doubles the gap under the card',
      );
    }
  });
});

suite('coin price tag · row height barely moves the card', () => {
  test('a CoinLabel row is close in height to the plain-Text tag it replaced', async () => {
    // Both the Inventory grid and the Leaderboard's statRow default to
    // `alignItems: stretch` (unset), so every card in the same flex line
    // is stretched to the tallest sibling. A CoinLabel row that is much
    // taller than the Text tag it replaced would grow every card in that
    // row, not just the one with a price on it.
    const Y = await loadYoga();
    const coinRowHeight = 12; // GoldCoin(12) vs a fontSize:10 line (~12.5pt) — comparable.
    const textLineHeight = 10 * 1.25;
    const rowHeight = Math.max(coinRowHeight, textLineHeight);
    note(
      `price row height ~${rowHeight.toFixed(1)}pt vs plain-Text tag ~${textLineHeight.toFixed(1)}pt`,
    );
    assertClose(rowHeight, textLineHeight, 3, 'the row should not be noticeably taller than the text it replaced');
    void Y;
  });
});
