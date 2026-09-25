import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TrophyIcon } from '../ui/Icon';
import { SHAPE, THEME, TYPE } from '../ui/theme';
import { GoldCoin } from './GoldCoin';

/**
 * Your trophies and your coins, in the same place on every screen.
 *
 * One component rather than a header on each screen, because they used to
 * disagree: the Store showed coins, the Leaderboard showed trophies, and
 * the Home screen showed both in a different style. It sits top-LEFT so it
 * can never collide with the settings gear top-right, which is what it
 * used to do on the Store, Leaderboard and Inventory.
 *
 * The Leaderboard deliberately does not show it — Your Records on that
 * screen already spells both numbers out, and repeating them at the top
 * just says the same thing twice.
 */
export function StatsHud({
  trophies,
  coins,
}: {
  trophies: number;
  coins: number;
}) {
  return (
    <View style={styles.row} pointerEvents="none">
      <View style={styles.pill}>
        <TrophyIcon size={15} />
        <Text style={styles.value}>{trophies}</Text>
      </View>
      <View style={styles.pill}>
        {/* Drawn, not 🪙 — see GoldCoin for why. */}
        <GoldCoin size={16} />
        <Text style={styles.value}>{coins}</Text>
      </View>
    </View>
  );
}

/** Height the HUD occupies, so screens underneath can pad clear of it. */
export const STATS_HUD_HEIGHT = 40;

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    top: 52,
    left: 18,
    flexDirection: 'row',
    gap: 8,
    zIndex: 30,
  },
  /*
   * A small white card, not a glass pill: the HUD sits over the live 3D
   * board on the home screen and over paper pages everywhere else, and a
   * solid card with an ink outline reads on both — translucency is the
   * old design's habit.
   */
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: SHAPE.radiusSm,
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  value: {
    color: THEME.ink,
    fontSize: 15,
    fontWeight: TYPE.cardTitle.fontWeight,
  },
});
