import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { DiceSkin } from '../game/diceSkins';
import { cachedShellPreviewUri, onShelfPicture, shellPreviewUri } from '../dice/preview';
import { prioritiseShelfPictures } from '../dice/warmPreviews';

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
  const uri = useShelfPicture(skin);
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

/**
 * The skin's shelf picture once it is painted, and null until then.
 *
 * David, 3 Nov 2026: "The game runs very slow when you open it ... it all
 * has to be lightning fast." This card used to paint its own picture in
 * the frame it was drawn — 40ms on a desktop for an ordinary die and a
 * quarter of a second for the Pizza die, several times that on a phone —
 * so a shelf drawn before the warm-up had finished stalled for every
 * missing picture at once. Now a card never paints: until its picture is
 * ready it shows the die's own shell colour (the way a plain die always
 * looks), asks for its picture to be painted next, and swaps it in when
 * it lands — a few frames later at most.
 *
 * Only when nothing is painting at all (a tool or a test, or the warm-up
 * paused while the game was in a pocket) does it paint for itself, after
 * the frame rather than during it.
 */
function useShelfPicture(skin: DiceSkin): string | null {
  // Read from the cache on every draw; this only asks for a redraw when
  // the picture lands.
  const [, redraw] = useState(0);
  const shown = cachedShellPreviewUri(skin);
  useEffect(() => {
    if (skin.pattern === 'plain') return;
    if (cachedShellPreviewUri(skin) !== null) {
      // Painted between this draw and now: show it.
      if (shown === null) redraw((n) => n + 1);
      return;
    }
    const stop = onShelfPicture((id) => {
      if (id === skin.id) redraw((n) => n + 1);
    });
    if (!prioritiseShelfPictures([skin.id])) {
      shellPreviewUri(skin);
      redraw((n) => n + 1);
    }
    return stop;
  }, [skin, shown]);
  return shown;
}
