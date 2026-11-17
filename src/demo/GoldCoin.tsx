import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

/**
 * A gold coin, drawn rather than an emoji.
 *
 * 🪙 renders differently on every platform and version — silver on some,
 * a flat disc on others — so "gold coins" was never guaranteed to be gold.
 * This one always is: a darker raised rim, a bright face with a milled
 * inset ring, an embossed sparkle stamped in the middle, and a highlight
 * off the top left so it reads as struck metal rather than a yellow dot.
 */
export function GoldCoin({ size = 16 }: { size?: number }) {
  const face = size * 0.7;
  const shine = size * 0.22;
  const bar = Math.max(1, size * 0.1);
  const star = size * 0.34;
  return (
    <View
      style={[
        styles.rim,
        { width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(1, size * 0.09) },
      ]}
    >
      {/*
        The face carries its own inset ring — the milled edge every real
        coin has, and the thing that separates "a coin" from "a yellow
        dot" at 13 points.
      */}
      <View
        style={[
          styles.face,
          {
            width: face,
            height: face,
            borderRadius: face / 2,
            borderWidth: Math.max(1, size * 0.05),
          },
        ]}
      />
      {/* The embossed mark: a four-point sparkle stamped into the face. */}
      <View style={[styles.emboss, { width: bar, height: star, borderRadius: bar }]} />
      <View style={[styles.emboss, { width: star, height: bar, borderRadius: bar }]} />
      <View
        style={[
          styles.shine,
          {
            width: shine,
            height: shine,
            borderRadius: shine / 2,
            top: size * 0.14,
            left: size * 0.17,
          },
        ]}
      />
    </View>
  );
}

/**
 * A number with the drawn coin beside it — a price on a card, a coin count
 * in Your Records.
 *
 * It exists so there is ONE way to show coins. The HUD was already drawing
 * the gold coin while every price tag still printed the coin emoji, so
 * the same currency wore two different faces one tab apart.
 *
 * The coin is a View, so it cannot sit inside a Text the way an emoji did;
 * this lays the two out in a row instead. Spacing that used to live on the
 * text (a marginTop under the card) belongs on `containerStyle` now, or the
 * text drifts a few points below the coin.
 */
export function CoinLabel({
  children,
  size = 13,
  coinFirst = true,
  style,
  containerStyle,
}: {
  children: React.ReactNode;
  size?: number;
  /** False puts the coin after the number, as the Inventory tags read. */
  coinFirst?: boolean;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.labelRow, containerStyle]}>
      {coinFirst && <GoldCoin size={size} />}
      <Text style={style}>{children}</Text>
      {!coinFirst && <GoldCoin size={size} />}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  rim: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0a415',
    borderColor: '#a16f12',
  },
  face: {
    backgroundColor: '#ffd75e',
    borderColor: '#e8b32a',
  },
  emboss: {
    position: 'absolute',
    backgroundColor: '#c8890f',
  },
  shine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
});
