import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { playClick } from '../audio/sounds';
import { FriendsIcon, GearIcon, NewsIcon } from '../ui/Icon';
import { SHAPE, THEME } from '../ui/theme';

/**
 * Friends, News and Settings, as three small buttons in the top corner.
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
 *
 * FRIENDS TOOK HOW-TO-PLAY'S SLOT on 10 Sep 2026, David's call, and the
 * swap is the right way round. How to play opens itself the very first
 * time the game is launched and is then never needed again by most
 * people, so it was holding a permanent corner for a one-off; it now
 * lives in Settings, which is where you go looking for the thing you
 * only want occasionally. Friends is the opposite — somewhere you check
 * repeatedly — and it was buried two taps deep behind the Ranks tab.
 */
export function TopButtons({
  onFriends,
  friendsReady,
  onSettings,
  onNews,
}: {
  onFriends: () => void;
  /**
   * False until the identity has been read. The button is drawn faded
   * and does nothing rather than swallowing the tap and opening a
   * screen with a blank friend code on it some seconds later.
   */
  friendsReady: boolean;
  onSettings: () => void;
  onNews: () => void;
}) {
  type IconFn = (props: { size?: number; color?: string }) => React.ReactElement;
  const buttons: {
    Icon: IconFn;
    label: string;
    press: () => void;
    ready?: boolean;
  }[] = [
    // First in the row: the one people come back to.
    {
      Icon: FriendsIcon,
      label: friendsReady ? 'Friends' : 'Friends — one moment',
      press: onFriends,
      ready: friendsReady,
    },
    { Icon: NewsIcon, label: 'News', press: onNews },
    { Icon: GearIcon, label: 'Settings', press: onSettings },
  ];

  return (
    <View style={styles.row}>
      {buttons.map((b) => (
        <Pressable
          key={b.label}
          style={[styles.button, b.ready === false && styles.waiting]}
          accessibilityLabel={b.label}
          accessibilityState={{ disabled: b.ready === false }}
          disabled={b.ready === false}
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
  // Faded, not hidden: the row must not change width when the identity
  // finishes loading, or the other two buttons jump under a thumb.
  waiting: { opacity: 0.45 },
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
