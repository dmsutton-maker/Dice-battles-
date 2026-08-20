import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * A gold coin, drawn rather than an emoji.
 *
 * 🪙 renders differently on every platform and version — silver on some,
 * a flat disc on others — so "gold coins" was never guaranteed to be gold.
 * Three circles always are: a darker rim, a bright face, and a highlight
 * off the top left so it reads as metal rather than a yellow dot.
 */
export function GoldCoin({ size = 16 }: { size?: number }) {
  const face = size * 0.66;
  const shine = size * 0.26;
  return (
    <View
      style={[
        styles.rim,
        { width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(1, size * 0.09) },
      ]}
    >
      <View
        style={[
          styles.face,
          { width: face, height: face, borderRadius: face / 2 },
        ]}
      />
      <View
        style={[
          styles.shine,
          {
            width: shine,
            height: shine,
            borderRadius: shine / 2,
            top: size * 0.16,
            left: size * 0.18,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rim: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0a415',
    borderColor: '#a16f12',
  },
  face: {
    backgroundColor: '#ffd75e',
  },
  shine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
});
