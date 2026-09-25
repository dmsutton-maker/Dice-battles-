import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { bottomInsetFor } from '../game/safeAreaRules';

/**
 * A live readout of the window size, for looking at the game on a screen
 * shape nobody in the family owns yet.
 *
 * ## Why this exists
 *
 * Apple announced the iPhone Duo on 9 Sep 2026 and the layout was fixed
 * for it the same day (see safeAreaRules.ts), but every one of those fixes
 * was reasoned out and checked in a headless test — there is no folding
 * phone here and no renderer in the suite. The only way to answer "does it
 * LOOK right" is to put the game on a screen of that size and look.
 *
 * On a Mac that means Xcode's resizable simulator, whose window you drag
 * to whatever size you want. Dragging is easy; knowing when you have hit
 * 474x696pt is not — the simulator reports pixels, in a menu, if at all.
 * So the app says its own size out loud, and names the shape when it
 * recognises one. Drag until it says "iPhone Duo (folded)".
 *
 * ## Why it is safe to leave in
 *
 * `__DEV__` is false in every release bundle and every over-the-air
 * update, so this never renders for a player. It is mounted behind that
 * flag in App.tsx and imports nothing native. Tap it to get it out of the
 * way; tap the dot to bring it back.
 */

/** Screens worth recognising, as portrait width x height in points. */
const KNOWN: readonly (readonly [number, number, string])[] = [
  [474, 696, 'iPhone Duo (folded)'],
  [640, 904, 'iPhone Duo (unfolded)'],
  [320, 904, 'iPhone Duo, half of it (Split View)'],
  [320, 568, 'iPhone SE (1st gen)'],
  [375, 667, 'iPhone SE (2nd/3rd gen)'],
  [414, 736, 'iPhone 8 Plus'],
  [375, 812, 'iPhone X / 11 Pro / 13 mini'],
  [390, 844, 'iPhone 13 / 14 / 16e'],
  [393, 852, 'iPhone 15 / 16 Pro'],
  [402, 874, 'iPhone 16 Pro'],
  [428, 926, 'iPhone 12/13 Pro Max'],
  [430, 932, 'iPhone 15/16 Plus / Pro Max'],
  [440, 956, 'iPhone 16 Pro Max'],
];

/** Within a point or two counts — a dragged window lands where it lands. */
function nameFor(shortSide: number, longSide: number): string {
  const near = KNOWN.find(
    ([w, h]) => Math.abs(w - shortSide) <= 2 && Math.abs(h - longSide) <= 2,
  );
  return near ? near[2] : 'not a shape we know';
}

export function ScreenRuler() {
  const [open, setOpen] = useState(true);
  const { width, height } = useWindowDimensions();
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  const inset = bottomInsetFor({
    os: Platform.OS,
    isPad: Platform.OS === 'ios' && Platform.isPad,
    longSide,
    shortSide,
  });

  if (!open) {
    return (
      <Pressable style={[styles.pill, styles.dot]} onPress={() => setOpen(true)}>
        <Text style={styles.text}>◧</Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.pill} onPress={() => setOpen(false)}>
      <View>
        <Text style={styles.text}>
          {Math.round(width)} x {Math.round(height)} pt
        </Text>
        <Text style={styles.text}>{nameFor(shortSide, longSide)}</Text>
        <Text style={styles.text}>bottom inset {inset}pt</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(29, 26, 46, 0.82)',
    zIndex: 9999,
  },
  dot: { paddingHorizontal: 6 },
  text: {
    color: '#fdf6ec',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});
