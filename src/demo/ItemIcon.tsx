import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ARENA_ART } from '../arena/arenaArt';
import { ARENAS, ArenaId } from '../arena/arenas';
import { skinById } from '../game/diceSkins';
import { TIERS } from '../game/progress';
import { TrophyIcon } from '../ui/Icon';
import { SHAPE, THEME } from '../ui/theme';
import { DiceSwatch } from './DiceSwatch';
import { GoldCoin } from './GoldCoin';
import { TierIcon } from './TierIcon';

/**
 * The picture of a thing the game hands over — never an emoji.
 *
 * David, 30 Sep 2026: "Get rid of any emojis and use the proper icons for
 * each item." The ladder and the home screen had already been through
 * this (TierIcon.tsx, Marc and David in August and September); the
 * reward popup, the season pass, the cup prize chips and the matchmaking
 * card had not, and still drew a cherry for Ruby Dice and a volcano for
 * Volcano Rim. Every one of them now draws the thing itself — the painted
 * die, the picture of the battlefield — or the game's own drawn coin and
 * trophy for a payout in coins or trophies.
 *
 * One component so there is one rule: a screen names WHAT it is showing
 * and this decides how it looks.
 */
export type ItemPicture =
  | { kind: 'die'; id: string }
  | { kind: 'arena'; id: ArenaId }
  /** A rung of the trophy ladder — whatever it hands over. */
  | { kind: 'tier'; id: string }
  | { kind: 'coins' }
  | { kind: 'trophy' };

/** The picture for an item a prize or a purchase resolved to. */
export function pictureOfItem(item: { kind: 'dice' | 'arena'; id: string }): ItemPicture {
  return item.kind === 'dice'
    ? { kind: 'die', id: item.id }
    : { kind: 'arena', id: item.id as ArenaId };
}

export function ItemIcon({ picture, size = 40 }: { picture: ItemPicture; size?: number }) {
  switch (picture.kind) {
    case 'die':
      return <DiceSwatch skin={skinById(picture.id)} size={size} />;
    case 'arena':
      return (
        <Image
          source={ARENA_ART[picture.id]}
          style={[
            styles.art,
            {
              width: size,
              height: size,
              borderRadius: size * 0.24,
              // The sky underneath, so it is never a white hole while
              // the picture decodes.
              backgroundColor: ARENAS[picture.id]?.skyColor ?? THEME.tile,
            },
          ]}
          accessibilityIgnoresInvertColors
        />
      );
    case 'tier': {
      const tier = TIERS.find((t) => t.id === picture.id);
      if (tier) return <TierIcon tier={tier} size={size} />;
      return <Centre size={size}><TrophyIcon size={size * 0.85} /></Centre>;
    }
    case 'coins':
      return <Centre size={size}><GoldCoin size={size * 0.85} /></Centre>;
    case 'trophy':
      return <Centre size={size}><TrophyIcon size={size * 0.9} /></Centre>;
  }
}

function Centre({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  art: {
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
});
