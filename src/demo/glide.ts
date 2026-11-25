/**
 * A scroll that travels, rather than one that jumps.
 *
 * David, 18 Oct 2026: "When you click 'get the gold pass' on cups it
 * should take you directly to the bottom of the page on the shop where it
 * shows the gold pass. Make sure to make the scrolling flowing and not
 * just like teleporting."
 *
 * iOS's own `scrollTo({ animated: true })` covers any distance in the
 * same quarter of a second, so the whole Store — seventy cards — flashed
 * past in a blur that read as a jump. A glide here is driven one frame at
 * a time with a duration that grows with the distance, and an ease that
 * starts and lands gently, so you can watch the shop go by on the way
 * down. Pure numbers only, so the feel can be tested in node.
 */

/** Ease in and out: slow start, quick middle, soft landing. */
export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Shortest and longest a glide may take, in milliseconds. */
export const GLIDE_MIN_MS = 550;
export const GLIDE_MAX_MS = 1100;

/**
 * How long a glide of `distance` points takes. Long enough to read as
 * travel, never so long that the player is kept waiting for a tap they
 * already made.
 */
export function glideDuration(distance: number): number {
  const ms = 450 + Math.abs(distance) * 0.12;
  return Math.round(Math.min(GLIDE_MAX_MS, Math.max(GLIDE_MIN_MS, ms)));
}

/**
 * Where to scroll so a card ends up in view.
 *
 * Aims to put the card in the middle of the screen, but never past the
 * bottom of the page — the Gold Pass is the last thing on the Store, so in
 * practice this lands at the very bottom with the card showing.
 */
export function glideTarget(args: {
  /** The card's top, measured from the top of the scrolling content. */
  cardY: number;
  cardHeight: number;
  viewportHeight: number;
  contentHeight: number;
}): number {
  const { cardY, cardHeight, viewportHeight, contentHeight } = args;
  const centred = cardY - (viewportHeight - cardHeight) / 2;
  const bottom = Math.max(0, contentHeight - viewportHeight);
  return Math.round(Math.min(bottom, Math.max(0, centred)));
}
