/**
 * Where each menu page was scrolled to, remembered across a preview.
 *
 * David, 26 Aug 2026: "after you exit a preview it should keep you where
 * you were on the screen and not put you back to the top of the screen."
 *
 * The cause is that opening a preview UNMOUNTS the menu page — the Store
 * and the Inventory are rendered only while `preview === null`, so that
 * the board behind them is visible while you look at the thing. A
 * ScrollView that is unmounted and mounted again is a new ScrollView, and
 * a new one starts at the top. With fifty-three dice and twenty
 * battlefields on those shelves, that is now a long way from wherever you
 * were.
 *
 * So the offset is kept out here, in a module rather than in React state,
 * for the same reason it has to be kept at all: the component holding it
 * is the thing that goes away. Deliberately NOT persisted to storage —
 * this is where you were a second ago, not a preference, and a shelf that
 * opened halfway down the morning after would be a bug of its own.
 */

const offsets = new Map<string, number>();

/** Remember where a page is scrolled to. Called as the page scrolls. */
export function rememberScroll(page: string, y: number): void {
  // A bounce past the top reports a negative offset on iOS, and restoring
  // to one leaves the page hanging below its own header.
  offsets.set(page, Math.max(0, y));
}

/** Where to put a page that is opening again. Zero if never scrolled. */
export function recallScroll(page: string): number {
  return offsets.get(page) ?? 0;
}

/** Test-only: forget everything, so suites cannot leak into each other. */
export function resetScrollForTests(): void {
  offsets.clear();
}
