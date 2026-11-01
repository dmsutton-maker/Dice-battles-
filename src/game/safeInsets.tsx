import React, { useSyncExternalStore } from 'react';
// The core SafeAreaView, imported from its own file rather than the
// react-native index, which logs a deprecation warning on every read. It
// is NATIVE but has been in React Native's core binary for years, so this
// needs no build: it ships over the air to every install. When the game
// next gets a build for a new SDK, react-native-safe-area-context is the
// replacement (see safeArea.ts).
import { Platform, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent, type ViewProps } from 'react-native';
// Its typings declare a named class, its module a default export; read
// the default and give it the plain View props it takes.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SafeAreaView = require('react-native/Libraries/Components/SafeAreaView/SafeAreaView')
  .default as React.ComponentType<ViewProps>;
import { insetsFromLayout, type Insets } from './safeAreaRules';

/**
 * The screen's real safe edges, measured, for everything that used to
 * assume a status bar across the top (see hudFrame in safeAreaRules.ts).
 *
 * HOW IT MEASURES. An invisible SafeAreaView covers the whole window and
 * pads itself by the system's safe-area insets; the empty view inside it
 * reports where it ended up. Its offset from each edge IS the inset on
 * that edge, as the system sees it right now: after a fold, a rotation,
 * the Duo's inner camera switching on, or anything Apple adds next. No
 * table of devices, which is what Apple's guidance asks for.
 *
 * Until the first measurement arrives (one frame), and on Android, where
 * SafeAreaView is a plain View, `measured` is null and every caller falls
 * back to the old fixed figures, so nothing can draw worse than before.
 */

let current: Insets | null = null;
const listeners = new Set<() => void>();

/** Hand on a new measurement; ignored when nothing changed. */
export function publishInsets(next: Insets | null): void {
  const same =
    (current === null && next === null) ||
    (current !== null &&
      next !== null &&
      current.top === next.top &&
      current.left === next.left &&
      current.right === next.right &&
      current.bottom === next.bottom);
  if (same) return;
  current = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const read = () => current;

/** The measured insets, or null until (and unless) there are some. */
export function useSafeInsets(): Insets | null {
  return useSyncExternalStore(subscribe, read, read);
}

/**
 * Mount once, at the root, under everything. Draws nothing and takes no
 * touches.
 */
export function SafeInsetsProbe() {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'ios') return null;
  return (
    <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={probe.fill}
        pointerEvents="none"
        onLayout={(e: LayoutChangeEvent) =>
          publishInsets(insetsFromLayout(e.nativeEvent.layout, { width, height }))
        }
      />
    </SafeAreaView>
  );
}

const probe = StyleSheet.create({
  fill: { flex: 1 },
});
