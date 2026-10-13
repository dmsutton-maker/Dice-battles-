import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { playClick } from '../audio/sounds';
import type { PreviewTarget } from '../game/itemPreview';
import { resolveItem } from '../game/prizes';
import {
  goldRewardFor,
  LEVELS,
  progressIn,
  rewardFor,
  SEASON,
  SeasonReward,
  SeasonState,
} from '../game/seasonPass';
import { SecondaryButton } from '../ui/Card';
import { TrophyIcon } from '../ui/Icon';
import { SHAPE, THEME, TYPE } from '../ui/theme';
import { GoldCoin } from './GoldCoin';
import { ItemIcon, pictureOfItem } from './ItemIcon';

/**
 * The season pass, at the top of the Cups tab.
 *
 * David, 30 Sep 2026: "Add a season pass with levels and exp you earn are
 * counted towards the season pass." The rules are in seasonPass.ts; this
 * only draws them.
 *
 * On the Cups tab because that is where the game already keeps the
 * things you work towards. A sixth tab would not fit the bar (see the
 * note at the top of TournamentScreen), and the pass is a challenge
 * that never closes, which is what the Cups tab is for.
 *
 * Every level is shown, reached or not — a child should be able to see
 * the Fire dice sitting at level 20 and count how far away it is. A
 * level with a die or a battlefield on it opens that item's preview, so
 * you can stand on Volcano Rim long before you reach it.
 *
 * TWO ROWS since 13 Oct 2026: the free row on top, the Gold Pass row
 * underneath. The Gold row is drawn for everybody, locked or not, for
 * the same reason every level is — you should be able to see what it
 * holds before deciding whether it is worth asking for.
 */

const TILE = 66;

type Level = { n: number; reward: SeasonReward; item: ReturnType<typeof resolveItem> };

export function SeasonPassCard({
  state,
  gold,
  onGetGold,
  onPreview,
}: {
  state: SeasonState | undefined;
  /** Does this phone own the Gold Pass? */
  gold: boolean;
  /** Take the player to the Store, where the Gold Pass is sold. */
  onGetGold: () => void;
  onPreview: (target: PreviewTarget) => void;
}) {
  const xp = state && state.season === SEASON.id ? state.xp : 0;
  const { level, into, need } = progressIn(xp);
  const done = level >= LEVELS;
  const fill = done ? 1 : need > 0 ? into / need : 0;

  const rows = useMemo(() => {
    const row = (pay: (n: number) => SeasonReward): Level[] =>
      Array.from({ length: LEVELS }, (_, i) => {
        const n = i + 1;
        const reward = pay(n);
        return { n, reward, item: reward.item ? resolveItem(reward.item) : null };
      });
    return { free: row(rewardFor), gold: row(goldRewardFor) };
  }, []);

  const tile = (l: Level, track: 'free' | 'gold') => {
    const locked = track === 'gold' && !gold;
    const reached = l.n <= level && !locked;
    const next = l.n === level + 1;
    const body = (
      <View
        style={[
          styles.tile,
          track === 'gold' && styles.tileGold,
          l.item && styles.tileItem,
          next && styles.tileNext,
          reached && styles.tileReached,
          locked && styles.tileLocked,
        ]}
      >
        <Text style={styles.tileLevel}>{l.n}</Text>
        <View style={styles.tileIcon}>
          {l.item ? (
            <ItemIcon picture={pictureOfItem(l.item)} size={28} />
          ) : l.reward.coins > 0 ? (
            <GoldCoin size={20} />
          ) : (
            <TrophyIcon size={20} color={THEME.ink} />
          )}
        </View>
        <Text style={styles.tileAmount} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {l.item
            ? l.item.name.replace(/ Dice$/, '')
            : l.reward.coins > 0
              ? l.reward.coins
              : l.reward.trophies}
        </Text>
        {reached && <Text style={styles.tick}>✓</Text>}
      </View>
    );
    if (!l.item || !l.reward.item) return body;
    const target: PreviewTarget =
      l.reward.item.kind === 'dice'
        ? { kind: 'die', id: l.reward.item.id, from: 'inventory' }
        : { kind: 'arena', id: l.reward.item.id as never, from: 'inventory' };
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${track === 'gold' ? 'Gold Pass level' : 'Level'} ${l.n}: ${l.item.name}. Tap to see it.`}
        onPress={() => {
          playClick();
          onPreview(target);
        }}
      >
        {body}
      </Pressable>
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>
        SEASON {SEASON.number} · {SEASON.name.toUpperCase()}
      </Text>
      <View style={styles.headRow}>
        <Text style={styles.level}>Level {level}</Text>
        <Text style={styles.ofLevels}>of {LEVELS}</Text>
      </View>

      <View
        style={styles.rail}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={
          done
            ? 'Season pass complete'
            : `${into} of ${need} experience to level ${level + 1}`
        }
      >
        <View style={[styles.railFill, { width: `${Math.round(fill * 100)}%` }]} />
      </View>
      <Text style={styles.railText}>
        {done
          ? 'Every level reached — the whole pass is yours.'
          : `${into} / ${need} XP to level ${level + 1}`}
      </Text>
      <Text style={styles.how}>
        Every battle earns XP — a win more than a loss, Hard most of all.
      </Text>

      {gold ? (
        <Text style={styles.goldOwned}>
          You have the Gold Pass — both rows are yours.
        </Text>
      ) : (
        <View style={styles.goldAsk}>
          <Text style={styles.goldWhy}>
            The bottom row is the Gold Pass: Snowy Hollow, the Fire Dice,
            Volcano Rim and coins at every level. Levels you have already
            reached pay out straight away.
          </Text>
          <SecondaryButton onPress={onGetGold} style={styles.goldButton}>
            <Text style={styles.goldButtonText}>Get the Gold Pass</Text>
          </SecondaryButton>
        </View>
      )}

      <Text style={styles.key}>Top row: free for everyone · Bottom row: Gold Pass</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
        // Open on the level you are working towards, not on level 1.
        contentOffset={{ x: Math.max(0, (level - 1) * (TILE + 8)), y: 0 }}
      >
        {rows.free.map((free, i) => (
          <View key={free.n} style={styles.column}>
            {tile(free, 'free')}
            {tile(rows.gold[i], 'gold')}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    borderRadius: SHAPE.radius,
    padding: 16,
    marginBottom: 18,
  },
  kicker: { color: THEME.accent, ...TYPE.label, letterSpacing: 0.8 },
  headRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  level: { color: THEME.ink, ...TYPE.heading },
  ofLevels: { color: THEME.inkSoft, ...TYPE.small },
  rail: {
    height: 14,
    borderRadius: 7,
    backgroundColor: THEME.sunk,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    overflow: 'hidden',
    marginTop: 10,
  },
  railFill: { height: '100%', backgroundColor: THEME.gold },
  railText: { color: THEME.ink, ...TYPE.small, marginTop: 6 },
  how: { color: THEME.inkFaint, fontSize: 12, fontWeight: '600', lineHeight: 17, marginTop: 4 },
  track: { gap: 8, paddingTop: 8, paddingRight: 4 },
  key: { color: THEME.inkFaint, fontSize: 12, fontWeight: '700', marginTop: 14 },
  goldOwned: { color: THEME.ink, ...TYPE.small, fontWeight: '800', marginTop: 10 },
  goldAsk: { marginTop: 12, gap: 10 },
  goldWhy: { color: THEME.inkSoft, ...TYPE.small },
  goldButton: { alignSelf: 'stretch', paddingVertical: 12, backgroundColor: THEME.gold },
  goldButtonText: { color: THEME.ink, ...TYPE.body, fontWeight: '900' },
  tile: {
    width: TILE,
    minHeight: 88,
    borderRadius: 12,
    borderWidth: SHAPE.line,
    borderColor: 'rgba(29,26,46,0.25)',
    backgroundColor: THEME.tile,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  // A die or a battlefield: the ones worth looking for along the track.
  tileItem: { borderColor: THEME.ink, backgroundColor: 'rgba(255,210,31,0.30)' },
  // The one you are working towards.
  tileNext: { borderColor: THEME.accent, borderWidth: 2.5 },
  tileReached: { opacity: 0.55 },
  // The Gold row: tinted so the two rows read apart at a glance.
  tileGold: { backgroundColor: 'rgba(255,210,31,0.16)', borderColor: 'rgba(160,120,0,0.45)' },
  // Not yours yet: still readable, so you can see what it holds.
  tileLocked: { opacity: 0.5 },
  column: { gap: 6 },
  tileLevel: { color: THEME.inkSoft, ...TYPE.label },
  tileIcon: { height: 30, alignItems: 'center', justifyContent: 'center' },
  tileAmount: { color: THEME.ink, ...TYPE.small, textAlign: 'center' },
  tick: {
    position: 'absolute',
    top: 2,
    right: 5,
    color: THEME.ink,
    fontSize: 13,
    fontWeight: '900',
  },
});
