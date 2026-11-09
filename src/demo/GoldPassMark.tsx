import React from 'react';
import { Image } from 'react-native';

/**
 * The Gold Pass's mark: one gold die seen from a corner, a disc on each
 * face the way every die in the game carries a colour sticker, and a
 * sparkle off the top. Marc chose it on 4 Nov 2026 from four drawn
 * options ("I like A, use it"), as the one thing about the pass that
 * stays the same every month while the seasons change round it.
 *
 * It is a picture, not Views: the app has no vector drawing, and the
 * die's three shaded faces and gradients are more than a stack of
 * rounded boxes can do. assets/logo/gold-pass.png is 64 px, with @2x and
 * @3x beside it for sharper phones; the words "Gold Pass" are never in
 * the picture, so they stay text the phone can size and read aloud.
 */
export function GoldPassMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/logo/gold-pass.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessible={false}
    />
  );
}
