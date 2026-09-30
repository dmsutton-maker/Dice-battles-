import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { playClick } from '../audio/sounds';
import type { PreviewTarget } from '../game/itemPreview';
import { resolveItem } from '../game/prizes';
import {
  LEVELS,
  progressIn,
  rewardFor,
  SEASON,
  SeasonState,
} from '../game/seasonPass';
import { TrophyIcon } from '../ui/Icon';
import { SHAPE, THEME, TYPE } from '../ui/theme';
import { GoldCoin } from './GoldCoin';

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
 */

const TILE = 66;

export function SeasonPassCard({
  state,
  onPreview,
}: {
  state: SeasonState | undefined;
  onPreview: (target: PreviewTarget) => void;
}) {
  const xp = state && state.season === SEASON.id ? state.xp : 0;
  const { level, into, need } = progressIn(xp);
  const done = level >= LEVELS;
  const fill = done ? 1 : need > 0 ? into / need : 0;

  const levels = useMemo(
    () =>
      Array.from({ length: LEVELS }, (_, i) => {
        const n = i + 1;
        const reward = rewardFor(n);
        const item = reward.item ? resolveItem(reward.item) : null;
        return { n, reward, item };
      }),
    [],
  );

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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
        // Open on the level you are working towards, not on level 1.
        contentOffset={{ x: Math.max(0, (level - 1) * (TILE + 8)), y: 0 }}
      >
        {levels.map(({ n, reward, item }) => {
          const reached = n <= level;
          const next = n === level + 1;
          const tile = (
            <View
              style={[
                styles.tile,
                item && styles.tileItem,
                next && styles.tileNext,
                reached && styles.tileReached,
              ]}
            >
              <Text style={styles.tileLevel}>{n}</Text>
              <View style={styles.tileIcon}>
                {item ? (
                  <Text style={styles.tileEmoji}>{item.emoji}</Text>
                ) : reward.coins > 0 ? (
                  <GoldCoin size={20} />
                ) : (
                  <TrophyIcon size={20} color={THEME.ink} />
                )}
              </View>
              <Text style={styles.tileAmount} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                {item ? item.name.replace(/ Dice$/, '') : reward.coins > 0 ? reward.coins : reward.trophies}
              </Text>
              {reached && <Text style={styles.tick}>✓</Text>}
            </View>
          );
          if (!item || !reward.item) return <View key={n}>{tile}</View>;
          const target: PreviewTarget =
            reward.item.kind === 'dice'
              ? { kind: 'die', id: reward.item.id, from: 'inventory' }
              : { kind: 'arena', id: reward.item.id as never, from: 'inventory' };
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`Level ${n}: ${item.name}. Tap to see it.`}
              onPress={() => {
                playClick();
                onPreview(target);
              }}
            >
              {tile}
            </Pressable>
          );
        })}
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
  track: { gap: 8, paddingTop: 14, paddingRight: 4 },
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
  tileLevel: { color: THEME.inkSoft, ...TYPE.label },
  tileIcon: { height: 30, alignItems: 'center', justifyContent: 'center' },
  tileEmoji: { fontSize: 24 },
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
