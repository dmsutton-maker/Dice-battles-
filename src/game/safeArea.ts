import { Dimensions, Platform } from 'react-native';
import { bottomInsetFor } from './safeAreaRules';

/**
 * How much room to leave at the bottom of the screen on THIS device.
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
 * Read once: the game is portrait-locked and the home indicator does not
 * come and go, so re-measuring every render would buy nothing.
 */
export const BOTTOM_INSET = bottomInsetFor({
  os: Platform.OS,
  isPad: Platform.OS === 'ios' && Platform.isPad,
  longSide: Math.max(
    Dimensions.get('window').width,
    Dimensions.get('window').height,
  ),
});
