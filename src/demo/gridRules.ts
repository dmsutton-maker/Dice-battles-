/**
 * How wide a card in the Inventory and Store grids should be.
 *
 * ## Why this is not just `width: '31%'` any more
 *
 * It was, and on every iPhone ever shipped that was fine: three cards a
 * row, each about 112pt, holding a 58pt thumbnail. Three is right because
 * the screen is about 390pt wide and nothing else fits.
 *
 * Then the screen stopped being about 390pt wide. Apple's folding iPhone
 * is 640pt across unfolded, and 31% of that is a 190pt card with the same
 * 58pt thumbnail adrift in the middle of it — the grid does not use the
 * room, it just stretches into it. Seen on 10 Sep 2026 in the first
 * pictures of the menus at Duo size (tools/duo-preview). An iPad has had
 * the same problem the whole time and nobody had looked.
 *
 * So the COLUMN COUNT follows the screen and the card keeps a sensible
 * size, instead of the column count being fixed and the card following
 * the screen.
 *
 * ## The numbers, and why they do not disturb anything shipped
 *
 * Aiming at a 160pt card and rounding gives three columns on every real
 * iPhone — 393pt lands on a 113pt card against the 112pt it draws today,
 * which is a difference nobody can see. Only a screen genuinely wider
 * than a phone gets a fourth or fifth column. That is the safe shape for
 * this change: new hardware gains, old hardware is untouched.
 *
 * ## Why the arithmetic lives apart from the hook
 *
 * Exactly the split safeAreaRules.ts and safeArea.ts already use, for
 * exactly the same reason: this file imports nothing from react-native,
 * so the headless suite can check the reasoning without a device. The
 * hook that reads the real window is three lines, in grid.ts.
 */

/** The gap between cards, and the padding either side of the grid. */
export const GRID_GAP = 10;
export const GRID_EDGE = 16;

/** Roughly the card width to aim for. Not a minimum or a maximum. */
export const TARGET_CARD_WIDTH = 160;

/** Three is what a phone fits; beyond five the thumbnails look lost. */
export const MIN_COLUMNS = 3;
export const MAX_COLUMNS = 5;

export function gridColumns(windowWidth: number): number {
  const inner = windowWidth - GRID_EDGE * 2;
  // +GRID_GAP on both sides because n cards have n-1 gaps, which is the
  // same as n cards each carrying one gap, minus one gap overall.
  const wanted = Math.round((inner + GRID_GAP) / (TARGET_CARD_WIDTH + GRID_GAP));
  return Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, wanted));
}

/**
 * The card width in POINTS rather than a percentage.
 *
 * A percentage cannot know about the 10pt gaps between the cards, which
 * is why the old value was 31% and not 33% — a hand-tuned number that
 * happened to leave room on a 390pt screen and would have to be re-tuned
 * for every column count. Points do the arithmetic properly.
 */
export function gridCardWidth(windowWidth: number): number {
  const columns = gridColumns(windowWidth);
  const inner = windowWidth - GRID_EDGE * 2;
  return Math.floor((inner - GRID_GAP * (columns - 1)) / columns);
}

/**
 * The live width. A hook, because unfolding a phone changes the answer
 * without the app relaunching — the same reason useBottomInset is one.
 */
