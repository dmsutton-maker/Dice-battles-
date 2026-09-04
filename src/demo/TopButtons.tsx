import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { playClick } from '../audio/sounds';
import { GearIcon, HelpIcon, NewsIcon } from '../ui/Icon';
import { SHAPE, THEME } from '../ui/theme';

/**
 * How to play, News and Settings, as three small buttons in the top corner.
 *
 * They used to be tabs along the bottom. None is somewhere you go during
 * play — one you visit once to turn the music down, another you read when
 * something changes — so they were taking prime thumb space from the five
 * things you actually move between. Up here they are out of the way but
 * still one tap.
 *
 * Icon only, no label: the gear and the newspaper are understood without
 * being told, and a label would make these as big as the tabs they left.
 * The icons are drawn (src/ui/Icon.tsx), not emoji — same reason as the
 * tab bar.
 */
export function TopButtons({
  onHowToPlay,
  onSettings,
  onNews,
}: {
  onHowToPlay: () => void;
  onSettings: () => void;
  onNews: () => void;
}) {
  type IconFn = (props: { size?: number; color?: string }) => React.ReactElement;
  const buttons: { Icon: IconFn; label: string; press: () => void }[] = [
    // First in the row: it opens on its own the first time, and after that
    // the person reaching for it is the one who does not know how to play.
    { Icon: HelpIcon, label: 'How to play', press: onHowToPlay },
    { Icon: NewsIcon, label: 'News', press: onNews },
    { Icon: GearIcon, label: 'Settings', press: onSettings },
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
          <b.Icon size={19} />
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
    borderRadius: SHAPE.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    // Matches the trophy/coin cards opposite, so the top of the screen
    // reads as one row of furniture rather than two designs.
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
});
