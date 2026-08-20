/**
 * How much room the bottom of the screen needs, as pure arithmetic.
 *
 * Kept free of any react-native import so the headless tests can check the
 * reasoning without a device — the file that reads the real screen size
 * (safeArea.ts) is a three-line wrapper around this.
 */

/**
 * Every iPhone with a home indicator is at least 812pt tall in portrait
 * (iPhone X and everything after it); every iPhone with a physical home
 * button is at most 736pt (iPhone 8 Plus). Nothing lives in the gap, which
 * is what makes deciding on height alone safe.
 */
export const SHORTEST_INDICATOR_IPHONE = 812;

/** Apple's own insets. */
export const IPHONE_INDICATOR = 34;
export const IPAD_INDICATOR = 20;

/** A little clearance for Android gesture navigation. */
export const ANDROID_GESTURE_BAR = 12;

export interface ScreenFacts {
  os: string;
  isPad: boolean;
  /** The longer side of the window, in points. */
  longSide: number;
}

export function bottomInsetFor({ os, isPad, longSide }: ScreenFacts): number {
  if (os !== 'ios') return ANDROID_GESTURE_BAR;
  if (isPad) return IPAD_INDICATOR;
  return longSide >= SHORTEST_INDICATOR_IPHONE ? IPHONE_INDICATOR : 0;
}
