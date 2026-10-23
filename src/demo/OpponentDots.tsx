import React from 'react';
import { StyleSheet, View } from 'react-native';
import { inkOn, PRISONER_COLORS, PrisonerColorId } from '../game/colors';
import { CrossIcon } from '../ui/Icon';

/**
 * The six colours, crossed off as your opponent takes them.
 *
 * David, 25 Sep 2026: "put a little x over the color when your opponent
 * gets it in game."
 *
 * It used to say this by fading the dot to 22% opacity, which is a
 * difference in BRIGHTNESS between two small circles — read from across
 * a room, at speed, mid-battle. That is the hardest kind of difference
 * to read and the easiest to mistake for a shadow, and it is the one
 * thing on the scoreboard a player needs at a glance. A cross is a
 * SHAPE, and a shape survives being small.
 *
 * Both signals are kept rather than one: the untaken dots still sit back
 * at low opacity, so the row reads as "these are gone, these are still
 * out there" even before you look at any individual mark.
 *
 * ITS OWN FILE so it can be looked at. DiceDemoScreen is three thousand
 * lines wrapped around a live 3D canvas and cannot be rendered in a
 * browser; this can, through tools/screen-preview, using the real
 * component rather than a copy of its markup that would drift.
 */
export function OpponentDots({
  taken,
  size = 13,
}: {
  /** The colours the opponent has claimed. */
  taken: PrisonerColorId[];
  size?: number;
}) {
  return (
    <View style={styles.row}>
      {PRISONER_COLORS.map((c) => {
        const gone = taken.includes(c.id);
        return (
          <View
            key={c.id}
            style={[
              styles.dot,
              { width: size, height: size, borderRadius: size / 2 },
              { backgroundColor: c.hex },
              !gone && styles.pending,
            ]}
          >
            {/*
              The ink is chosen from the colour underneath. There is no
              single one that works: a dark cross vanishes on the
              palette's Blue and a white one vanishes on its Yellow. See
              `inkOn`, which is the same rule the colourblind face
              stickers use.
            */}
            {gone && <CrossIcon size={size} color={inkOn(c.hex)} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3 },
  dot: { alignItems: 'center', justifyContent: 'center' },
  pending: { opacity: 0.22 },
});
