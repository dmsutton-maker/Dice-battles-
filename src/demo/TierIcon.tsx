import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { Tier } from '../game/progress';
import { tierItem } from '../game/tierItem';
import { ARENA_ART } from '../arena/arenaArt';
import { ARENAS } from '../arena/arenas';
import { DiceSwatch } from './DiceSwatch';
import { GoldCoin } from './GoldCoin';
import { SHAPE, THEME } from '../ui/theme';

/**
 * The picture for a rung of the ladder — the thing it hands over.
 *
 * Marc, 27 Aug 2026: "make the emojis on the ladder section just the
 * icons for each item." The ladder drew a hand-picked emoji for every
 * rung — a cherry for Ruby Dice, a volcano for Volcano Rim — while the
 * Store and the Inventory, two taps away, show the real painted die and
 * the real picture of the battlefield. Same items, same app, and only
 * that screen showed a picture of fruit.
 *
 * David, 10 Sep 2026, about the "Next unlock: … at … trophies" line on
 * the home screen: "it has an emoji to represent the item but it should
 * be the drawn icons instead." Same complaint, one screen along — which
 * is why this moved OUT of LeaderboardScreen.tsx and into a file of its
 * own rather than being written twice. Two copies of a picture rule
 * drift, and then the ladder and the home screen disagree about what
 * Ruby Dice looks like.
 *
 * Which rung gives which item is data, and lives in tierItem.ts.
 */
export const TIER_ICON = 30;

export function TierIcon({ tier, size = TIER_ICON }: { tier: Tier; size?: number }) {
  const item = tierItem(tier);
  if (item.kind === 'die') return <DiceSwatch skin={item.skin} size={size} />;
  if (item.kind === 'arena') {
    return (
      <Image
        source={ARENA_ART[item.arena]}
        // The sky underneath, so the rung is never a white hole for the
        // frame it takes the picture to decode.
        style={[
          styles.art,
          {
            width: size,
            height: size,
            borderRadius: size * 0.24,
            backgroundColor: ARENAS[item.arena].skyColor,
          },
        ]}
        accessibilityIgnoresInvertColors
      />
    );
  }
  /*
    Courtyard Treasure is the only rung that hands over no thing of its
    own — it adds the pile of gold to the Castle Courtyard. It used to
    keep its emoji for want of anything better; a drawn coin is what the
    pile is made of, and it means there is no emoji left on either
    screen.
  */
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <GoldCoin size={size * 0.8} />
    </View>
  );
}

const styles = StyleSheet.create({
  art: {
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
});
