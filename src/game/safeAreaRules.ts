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
 * 2026. Its folded screen is 1398×2034 pixels by Apple's tech specs,
 * which at @3x is 466×678pt — SHORTER than the 736pt iPhone 8 Plus. It
 * plainly has no home button; no phone shipped since 2022 does. The old
 * rule would have looked at 678pt, concluded "home button", returned an inset of
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

/*
 * ── The rest of the screen's edges, measured rather than assumed ──
 *
 * David, 1 Nov 2026, with Apple's "Designing for iPhone Duo" guidance:
 * "make sure the game design matches iphone duo design when needed."
 *
 * Until then the top of every screen assumed what every iPhone since the
 * X had: a status bar drawn ACROSS THE TOP, so the trophy and coin pills
 * sat at a fixed y52 and every menu page started at y100. The Duo breaks
 * that on its outer screen. Apple: "the system places toolbars and tab
 * bars on the side ... Controls on the side include both system and app
 * elements: the Dynamic Island, the status bar". The status bar and the
 * camera run down one SIDE there, the top is free, and a fixed 52pt band
 * wastes the top of the shortest screen the game runs on (678pt). The
 * inner screen hides its camera behind the display until it is in use.
 *
 * Apple's rule is "use safe area insets ... avoid fixed widths and
 * display-specific dependencies", so the four edges now come from the
 * system's own safe area (safeInsets.tsx measures it), and these rules
 * turn them into where the furniture goes.
 *
 * NO PHONE THE FAMILY HAS TODAY MOVES. Every iPhone in portrait reports a
 * top inset of at least 20pt (a status bar across the top), and for all
 * of them the pills stay at y52, exactly where they were. Only a screen
 * whose system bars are NOT across the top (the Duo's outer screen, or an
 * app built so the system keeps it out from under the bar) has the band
 * given back.
 */

/** The four safe edges, in points. */
export interface Insets {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/** Where the pills have always sat: clear of any status bar across the top. */
export const HUD_TOP = 52;
/** The pills' distance from the side of the screen. */
export const HUD_SIDE = 18;
/** A status bar across the top is at least this tall on every iPhone. */
export const TOP_BAR_MIN = 20;
/** How far below a measured edge the furniture sits when there is no top bar. */
export const EDGE_GAP = 14;

/**
 * Where the top-of-screen furniture goes: the trophy and coin pills, the
 * Settings row, the battle's quit button and scoreboard, and the first
 * line of every menu page.
 *
 * `shift` is how far everything in that band moves from where it was
 * designed (0 on every iPhone with a status bar across the top; negative
 * when the screen gives the band back). `left` and `right` keep the pills
 * clear of anything the system has down either side.
 */
export function hudFrame(measured: Insets | null): { top: number; shift: number; left: number; right: number } {
  if (!measured) return { top: HUD_TOP, shift: 0, left: HUD_SIDE, right: HUD_SIDE };
  const top =
    measured.top >= TOP_BAR_MIN
      ? // A status bar across the top. 52 has always cleared it beside
        // the Dynamic Island (inset 59-62); only a taller one than any
        // iPhone has pushes the pills down.
        Math.max(HUD_TOP, measured.top - 10)
      : // No bar across the top: the band is free.
        Math.max(0, measured.top) + EDGE_GAP;
  return {
    top,
    shift: top - HUD_TOP,
    left: Math.max(HUD_SIDE, measured.left + 12),
    right: Math.max(HUD_SIDE, measured.right + 12),
  };
}

/**
 * The bottom inset: the system's own figure when it has been measured on
 * iOS, the table above until then (and on Android, where the measuring
 * view pads nothing).
 */
export function bottomInsetWith(measured: Insets | null, facts: ScreenFacts): number {
  if (measured && facts.os === 'ios') return Math.max(0, measured.bottom);
  return bottomInsetFor(facts);
}

/**
 * The four insets from where a view padded by the safe area landed
 * inside a window of this size (safeInsets.tsx). Rounded to whole points,
 * and never negative.
 */
export function insetsFromLayout(
  inner: { x: number; y: number; width: number; height: number },
  window: { width: number; height: number },
): Insets {
  const clamp = (n: number) => Math.max(0, Math.round(n));
  return {
    top: clamp(inner.y),
    left: clamp(inner.x),
    right: clamp(window.width - inner.x - inner.width),
    bottom: clamp(window.height - inner.y - inner.height),
  };
}
