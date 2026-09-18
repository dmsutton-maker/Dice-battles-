import { useMemo } from 'react';
import { Dimensions, Platform, useWindowDimensions } from 'react-native';
import { bottomInsetFor } from './safeAreaRules';

/**
 * How much room to leave at the bottom of the screen.
 *
 * Modern iPhones reserve a strip at the bottom for the home indicator —
 * the bar you swipe up on. Anything drawn there is either sitting under
 * that bar or unreachable, because the system takes the swipe. The tab row
 * was drawn with a flat 18pt of padding, about half what an iPhone 15
 * needs, so the labels crowded into the strip and read as not fitting.
 *
 * The usual source for this number is react-native-safe-area-context, but
 * that is a NATIVE module: adding it needs a fresh build through Apple
 * rather than an over-the-air update, so a layout fix would sit unshipped
 * for days. The insets are fixed properties of the hardware, so working
 * them out from the window size costs nothing and ships today. If
 * safe-area-context is ever added for other reasons, replace this — a real
 * measurement always beats a table of known devices.
 *
 * THE SCREEN CAN NOW CHANGE SIZE WHILE THE GAME IS OPEN. Until 9 Sep 2026
 * this file read the window once, at module scope, and said so:
 *
 *     "Read once: the game is portrait-locked and the home indicator does
 *      not come and go, so re-measuring every render would buy nothing."
 *
 * Apple's folding iPhone ended that. Unfolding one swaps a 474×696pt
 * screen for a 640×904pt one without relaunching the app, and a constant
 * computed at startup keeps the old answer for ever. The same was already
 * quietly true of iPad Split View and Stage Manager; the fold just makes
 * it impossible to miss.
 */

/**
 * The live inset. Re-measures whenever the window changes size, which is
 * what a fold, a rotation or a Split View drag actually does.
 *
 * A hook, so React re-renders what depends on it. Everything derived from
 * it has to be computed during render too — a StyleSheet built at module
 * scope freezes whatever the value was when the file was first imported.
 */
export function useBottomInset(): number {
  const { width, height } = useWindowDimensions();
  return useMemo(
    () =>
      bottomInsetFor({
        os: Platform.OS,
        isPad: Platform.OS === 'ios' && Platform.isPad,
        longSide: Math.max(width, height),
        shortSide: Math.min(width, height),
      }),
    [width, height],
  );
}

/**
 * The inset as it was at launch.
 *
 * ONLY for the handful of places that genuinely cannot use a hook — a
 * StyleSheet constant, or a module read at import time. On a phone whose
 * screen never changes size this equals `useBottomInset()`; on a folding
 * one it is the value from whichever way it was open at launch, so prefer
 * the hook wherever a component can call one.
 */
export const BOTTOM_INSET_AT_LAUNCH = bottomInsetFor({
  os: Platform.OS,
  isPad: Platform.OS === 'ios' && Platform.isPad,
  longSide: Math.max(
    Dimensions.get('window').width,
    Dimensions.get('window').height,
  ),
  shortSide: Math.min(
    Dimensions.get('window').width,
    Dimensions.get('window').height,
  ),
});
