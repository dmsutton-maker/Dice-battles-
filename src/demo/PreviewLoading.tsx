import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';
import { THEME } from '../ui/theme';

/**
 * Where the board goes while a previewed item is being painted.
 *
 * Marc, 5 Nov 2026: "Make it load better, or give a very brief loading
 * thing while it loads in." The sky of the battlefield the preview will
 * show, so the board arrives into its own colour, and the game's spinner
 * in the middle. The spinner fades in over a beat, so an item that takes
 * a moment barely shows it; both are drawn and turned by the native side,
 * so they keep moving while the JavaScript thread paints.
 *
 * `pointerEvents="none"`: the preview's ✕ and button sit over this and
 * must answer at once.
 */
export function PreviewLoading({ sky }: { sky: string }) {
  const shown = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(shown, { toValue: 1, duration: 160, delay: 120, useNativeDriver: true }).start();
  }, [shown]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: sky }]}>
      <Animated.View style={{ opacity: shown }}>
        <ActivityIndicator size="large" color={THEME.ink} accessibilityLabel="Loading" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
