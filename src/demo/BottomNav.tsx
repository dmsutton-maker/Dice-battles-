import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { playClick } from '../audio/sounds';
import { BOTTOM_INSET } from '../game/safeArea';
import { BagIcon, BracketIcon, CrateIcon, DieIcon, RanksIcon } from '../ui/Icon';
import { MIN_TAP, SHAPE, THEME, TYPE } from '../ui/theme';

/**
 * The menu bar along the bottom — the way Clash Royale does it.
 *
 * The Store, Leaderboard and Inventory used to be buttons scattered on the
 * home screen that opened modals over it. As pages behind a fixed bar they
 * are all one tap from anywhere, and which one you are on is always
 * visible. It hides during a battle: the board wants the whole screen.
 */
/**
 * Settings and News are NOT here. They are popups opened from two small
 * buttons at the top of the home screen: neither is somewhere you go
 * during play, so neither should take thumb space from the five things
 * you actually move between.
 */
export type Tab = 'store' | 'inventory' | 'play' | 'cups' | 'leaderboard';

/**
 * Five across, with Battle dead centre — the thing you came to do sits
 * under your thumb, and two reaches either side of it. Seven cells left
 * about 53pt each on a small phone; five leave 75, which is room for a
 * comfortable tap rather than a careful one.
 */
type IconFn = (props: { size?: number; color?: string }) => React.ReactElement;

/**
 * The icons are DRAWN (src/ui/Icon.tsx), not emoji.
 *
 * 🛒 🎒 ⚔️ 🏆 🏅 was the loudest single reason the game read as one from
 * 2010, and emoji also render differently on every platform and version —
 * so the game could not be sure what its own navigation looked like.
 */
const TABS: { id: Tab; label: string; Icon: IconFn }[] = [
  { id: 'store', label: 'Store', Icon: BagIcon },
  { id: 'inventory', label: 'Items', Icon: CrateIcon },
  { id: 'play', label: 'Battle', Icon: DieIcon },
  { id: 'cups', label: 'Cups', Icon: BracketIcon },
  { id: 'leaderboard', label: 'Ranks', Icon: RanksIcon },
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
              <tab.Icon size={21} />
            </View>
            <Text
              style={[styles.label, on && styles.labelOn]}
              /*
                It scales, but only so far.

                This label used to be pinned at 10pt with scaling off
                entirely, which made the NAVIGATION the one place in the
                game that ignored a grandparent's larger-text setting —
                exactly backwards, since it is the thing you have to read
                to get anywhere. Five cells on the narrowest iPhone leave
                about 75pt each, and the longest label is "Battle": at
                1.6x that is still one comfortable line, so the cap is
                where the row would break rather than at no scaling at
                all.
              */
              numberOfLines={1}
              maxFontSizeMultiplier={1.6}
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

/**
 * The area a menu page gets: the whole screen ABOVE the bar.
 *
 * The bar is drawn over the pages, so every page used to be responsible
 * for remembering to pad around it — and three of them did not, which cut
 * the bottom off Ranks, Items and Settings. Making each page END where the
 * bar begins turns that from something to remember into something that
 * cannot go wrong: the bar is its own section of the screen, and a page
 * has no room down there to lose.
 *
 * A page's own paddingBottom is now just breathing room, not clearance.
 */
export const MENU_PAGE_AREA = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: BOTTOM_NAV_HEIGHT,
} as const;

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
    backgroundColor: THEME.surface,
    borderTopWidth: SHAPE.line,
    borderTopColor: THEME.ink,
    // Above the menu pages (20) and the stats HUD (30), below the reward
    // popup (40) — the bar should never be the thing covering a reward.
    zIndex: 35,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // The theme's own floor, stated rather than assumed. MIN_TAP was
    // declared "Nothing tappable is smaller than this" and then imported
    // by nothing at all, which made it a comment.
    minHeight: MIN_TAP,
    gap: 2,
  },
  pill: {
    // Back to a generous pill now there are five cells rather than seven.
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: SHAPE.radiusSm,
    borderWidth: SHAPE.line,
    // Every cell carries the border so the selected one does not grow by
    // 4pt when it gains one and shove the row sideways.
    borderColor: 'transparent',
  },
  pillOn: {
    backgroundColor: THEME.gold,
    borderColor: THEME.ink,
  },
  label: {
    color: THEME.inkFaint,
    ...TYPE.nav,
  },
  labelOn: {
    color: THEME.ink,
  },
});
