/**
 * How much room the bottom of the screen needs, as pure arithmetic.
 *
 * Kept free of any react-native import so the headless tests can check the
 * reasoning without a device — the file that reads the real screen size
 * (safeArea.ts) is a three-line wrapper around this.
 */

/**
 * Apple's own insets.
 */
export const IPHONE_INDICATOR = 34;
export const IPAD_INDICATOR = 20;

/** A little clearance for Android gesture navigation. */
export const ANDROID_GESTURE_BAR = 12;

/**
 * Kept for the tests that still name it, and for the record.
 *
 * This used to be the whole rule: 812pt or taller meant a home indicator,
 * shorter meant a home button, "because nothing lives in the gap". See
 * HOME_BUTTON_SCREENS for why that stopped being true on 9 Sep 2026.
 */
export const SHORTEST_INDICATOR_IPHONE = 812;

/**
 * Every iPhone screen that has a physical home button, as an exact
 * width×height pair in portrait points.
 *
 * WHY A LIST AND NOT A HEIGHT THRESHOLD. The old rule asked "is this
 * screen at least 812pt tall?" and answered "then it has an indicator,
 * otherwise a home button". That was sound while every iPhone was one
 * rigid slab: home-button phones topped out at 736pt, indicator phones
 * started at 812pt, and nothing lived in the gap.
 *
 * A FOLDING iPHONE BREAKS IT. Apple announced the iPhone Duo on 9 Sep
 * 2026. Its folded screen is reported at 1422×2088 physical pixels, which
 * at @3x is 474×696pt — SHORTER than the 736pt iPhone 8 Plus. It plainly
 * has no home button; no phone shipped since 2022 does. The old rule would
 * have looked at 696pt, concluded "home button", returned an inset of
 * ZERO, and drawn the navigation labels into the home-indicator strip —
 * the exact fault this file was written to fix, reappearing on new
 * hardware because its premise quietly expired.
 *
 * Short no longer implies old. So the home-button phones are named
 * exactly — they are a closed set that will never grow — and everything
 * else is assumed to have an indicator. That is the safe direction to be
 * wrong in: a needless 34pt of padding costs a little room, while a
 * missing 34pt puts a button where the system takes the swipe.
 *
 * Matched on BOTH sides rather than height alone, so a future folded
 * screen that happens to be exactly 667pt tall is not mistaken for an
 * iPhone SE — it would have to be 375pt wide as well.
 */
const HOME_BUTTON_SCREENS: readonly (readonly [number, number])[] = [
  [320, 480], // iPhone 4 / 4s
  [320, 568], // iPhone 5 / 5s / 5c / SE (1st gen)
  [375, 667], // iPhone 6 / 6s / 7 / 8 / SE (2nd and 3rd gen)
  [414, 736], // iPhone 6 Plus / 6s Plus / 7 Plus / 8 Plus
];

export interface ScreenFacts {
  os: string;
  isPad: boolean;
  /** The longer side of the window, in points. */
  longSide: number;
  /**
   * The shorter side, in points.
   *
   * Optional only so a caller that genuinely cannot measure it still gets
   * an answer — and that answer errs towards leaving the inset in.
   */
  shortSide?: number;
}

/** Is this exactly one of the four screens Apple gave a home button? */
export function hasHomeButton(longSide: number, shortSide?: number): boolean {
  return HOME_BUTTON_SCREENS.some(
    ([w, h]) => h === longSide && (shortSide === undefined || w === shortSide),
  );
}

export function bottomInsetFor({ os, isPad, longSide, shortSide }: ScreenFacts): number {
  if (os !== 'ios') return ANDROID_GESTURE_BAR;
  if (isPad) return IPAD_INDICATOR;
  return hasHomeButton(longSide, shortSide) ? 0 : IPHONE_INDICATOR;
}
