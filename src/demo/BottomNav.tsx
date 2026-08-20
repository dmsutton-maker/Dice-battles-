import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { playClick } from '../audio/sounds';
import { BOTTOM_INSET } from '../game/safeArea';

/**
 * The menu bar along the bottom — the way Clash Royale does it.
 *
 * The Store, Leaderboard and Inventory used to be buttons scattered on the
 * home screen that opened modals over it. As pages behind a fixed bar they
 * are all one tap from anywhere, and which one you are on is always
 * visible. It hides during a battle: the board wants the whole screen.
 */
export type Tab =
  | 'play'
  | 'cups'
  | 'news'
  | 'store'
  | 'inventory'
  | 'leaderboard'
  | 'settings';

/**
 * Seven across, with Battle dead centre — the thing you came to do sits
 * under your thumb, and everything else is one reach either side.
 */
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'cups', label: 'Cups', icon: '🏆' },
  { id: 'store', label: 'Store', icon: '🛒' },
  { id: 'inventory', label: 'Items', icon: '🎒' },
  { id: 'play', label: 'Battle', icon: '⚔️' },
  { id: 'leaderboard', label: 'Ranks', icon: '🏅' },
  { id: 'news', label: 'News', icon: '📰' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function BottomNav({
  active,
  onSelect,
}: {
  active: Tab;
  onSelect: (tab: Tab) => void;
}) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const on = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            style={styles.item}
            onPress={() => {
              if (on) return;
              playClick();
              onSelect(tab.id);
            }}
          >
            <View style={[styles.pill, on && styles.pillOn]}>
              <Text style={styles.icon}>{tab.icon}</Text>
            </View>
            <Text
              style={[styles.label, on && styles.labelOn]}
              /*
                Seven cells across the narrowest iPhone leaves about 53pt
                each. "Settings" and "Battle" have to hold one line inside
                that, and a player who has turned up the system text size
                must not be the one who breaks the row — so this label does
                not scale with it.
              */
              numberOfLines={1}
              allowFontScaling={false}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * How much room the bar takes, so pages can pad clear of it.
 *
 * The bar itself is a fixed 82pt of buttons, PLUS whatever the phone
 * reserves for its home indicator. It used to be a flat 82 with 18pt of
 * bottom padding, which is about half of what an iPhone 15 needs — so the
 * labels sat in the home indicator strip and the row read as not fitting.
 */
const BAR_CONTENT_HEIGHT = 82;
export const BOTTOM_NAV_HEIGHT = BAR_CONTENT_HEIGHT + BOTTOM_INSET;

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BOTTOM_NAV_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    // The original 18pt of breathing room, and then clear of the home
    // indicator on top of it.
    paddingBottom: 18 + BOTTOM_INSET,
    paddingTop: 6,
    backgroundColor: 'rgba(16,11,34,0.97)',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255,255,255,0.10)',
    // Above the menu pages (20) and the stats HUD (30), below the reward
    // popup (40) — the bar should never be the thing covering a reward.
    zIndex: 35,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  pill: {
    // 10pt each side crowded the icons at seven-across on a small phone.
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillOn: {
    backgroundColor: 'rgba(255,229,33,0.18)',
  },
  icon: {
    fontSize: 20,
  },
  label: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0,
  },
  labelOn: {
    color: '#ffe521',
  },
});
