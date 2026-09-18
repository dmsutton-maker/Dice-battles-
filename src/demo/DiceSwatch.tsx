import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { DiceSkin } from '../game/diceSkins';
import { shellPreviewUri } from '../dice/preview';

/**
 * What a dice skin actually looks like, for the Store and the Inventory.
 *
 * These cards used to show a flat colour square with the skin's emoji on
 * it — 🦓 on white for Zebra, 🫧 on pale blue for Bubbles — which told a
 * player nothing about the dice they were about to spend coins on.
 *
 * The picture comes from the same painter that builds the 3D shell, so
 * the shelf and the table cannot disagree. Plain skins need no picture:
 * they are one flat colour, which a View draws directly.
 *
 * Drawn as a rounded square with a highlight, so it reads as a die rather
 * than a tile. Skins never touch the six face colours — the shell IS the
 * whole of what changes — so no face sticker is shown, because inventing
 * one would suggest the dice come in that colour.
 */
export function DiceSwatch({
  skin,
  size = 58,
}: {
  skin: DiceSkin;
  size?: number;
}) {
  const uri = shellPreviewUri(skin);
  const radius = size * 0.24;

  return (
    <View
      style={[
        styles.die,
        { width: size, height: size, borderRadius: radius },
        uri === null && { backgroundColor: skin.body },
      ]}
    >
      {uri !== null && (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
          resizeMode="cover"
        />
      )}
      {/* A soft sheen down the top-left, the way a real die catches light. */}
      <View
        style={[
          styles.sheen,
          {
            width: size * 0.44,
            height: size * 0.44,
            borderTopLeftRadius: radius,
            borderBottomRightRadius: size * 0.4,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  die: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.18)',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
