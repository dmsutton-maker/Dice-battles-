import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { playClick } from '../audio/sounds';

/**
 * Settings and News, as two small buttons in the top corner.
 *
 * They used to be two of seven tabs along the bottom. Neither is somewhere
 * you go during play — one you visit once to turn the music down, the
 * other you read when something changes — so they were taking prime thumb
 * space from the five things you actually move between. Up here they are
 * out of the way but still one tap.
 *
 * Icon only, no label: the gear and the newspaper are understood without
 * being told, and a label would make these as big as the tabs they left.
 */
export function TopButtons({
  onSettings,
  onNews,
}: {
  onSettings: () => void;
  onNews: () => void;
}) {
  const buttons: { icon: string; label: string; press: () => void }[] = [
    { icon: '📰', label: 'News', press: onNews },
    { icon: '⚙️', label: 'Settings', press: onSettings },
  ];

  return (
    <View style={styles.row}>
      {buttons.map((b) => (
        <Pressable
          key={b.label}
          style={styles.button}
          accessibilityLabel={b.label}
          hitSlop={8}
          onPress={() => {
            playClick();
            b.press();
          }}
        >
          <Text style={styles.icon}>{b.icon}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    // Level with the trophy and coin pills, which sit at the top left.
    top: 52,
    right: 18,
    flexDirection: 'row',
    gap: 8,
    // Same layer as the stats HUD: part of the furniture of the home
    // screen, above the pages, below the popups they open.
    zIndex: 30,
  },
  button: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    // Matches the trophy/coin pills opposite, so the top of the screen
    // reads as one row of furniture rather than two designs.
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  icon: {
    fontSize: 18,
  },
});
