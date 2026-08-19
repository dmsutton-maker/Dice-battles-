import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
        <Text style={styles.icon}>🏆</Text>
        <Text style={styles.value}>{trophies}</Text>
      </View>
      <View style={styles.pill}>
        {/* Gold coins, per David — it used to be a generic token. */}
        <Text style={styles.icon}>🪙</Text>
        <Text style={[styles.value, styles.coinValue]}>{coins}</Text>
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  icon: {
    fontSize: 15,
  },
  value: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  coinValue: {
    color: '#ffd54a',
  },
});
