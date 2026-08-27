import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AiDifficultyId } from '../game/ai';
import { MENU_PAGE_AREA } from './BottomNav';
import { TrophyIcon } from '../ui/Icon';
import { SHAPE, THEME, TYPE } from '../ui/theme';
import { getWallet } from '../game/currency';
import { CoinLabel } from './GoldCoin';
import { nextTier, TIERS, tierLabel } from '../game/progress';
import { MODES, MODE_ORDER, ModeId } from '../game/modes';
import { Tier } from '../game/progress';
import { tierItem } from '../game/tierItem';
import { ARENA_ART } from '../arena/arenaArt';
import { ARENAS } from '../arena/arenas';
import { DiceSwatch } from './DiceSwatch';
import {
  isAvailable as gameCenterAvailable,
  mayPost,
  openAchievements,
  openLeaderboard,
} from '../game/gameCenter';

/**
 * The picture on a rung of the ladder.
 *
 * Marc, 27 Aug 2026: "make the emojis on the ladder section just the
 * icons for each item." The ladder drew a hand-picked emoji for every
 * rung — a cherry for Ruby Dice, a volcano for Volcano Rim — while the
 * Store and the Inventory, two taps away, show the real painted die and
 * the real picture of the battlefield. Same items, same screenfuls of
 * app, and only this one showed a picture of fruit.
 *
 * So a rung shows what it hands over, drawn the way every other screen
 * draws it: DiceSwatch for a dice set, the arena's own art for a
 * battlefield. Courtyard Treasure adds the pile of gold to a courtyard
 * rather than giving a thing of its own, so it keeps its emoji — see
 * tierItem.ts.
 */
const RUNG_ICON = 30;

function RungIcon({ tier, size = RUNG_ICON }: { tier: Tier; size?: number }) {
  const item = tierItem(tier);
  if (item.kind === 'die') return <DiceSwatch skin={item.skin} size={size} />;
  if (item.kind === 'arena') {
    return (
      <Image
        source={ARENA_ART[item.arena]}
        // The sky underneath, so the rung is never a white hole for the
        // frame it takes the picture to decode.
        style={[
          styles.rungArt,
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
  return (
    <Text style={[styles.rungEmoji, { width: size, fontSize: size * 0.6 }]}>
      {tier.emoji}
    </Text>
  );
}

/**
 * The Leaderboard.
 *
 * Everything shown here is REAL: it comes from this device's own record of
 * battles played. There is deliberately no invented list of world players
 * — a made-up ranking is a lie told to a child, and it would be obvious
 * the first time two kids compared phones.
 *
 * A genuine world ranking needs every player's score in one place. The
 * cheapest honest way to do that on iPhone is Game Center: the player
 * already has an Apple account, so there are no new logins, no passwords,
 * and no personal data for this game to hold. It needs the app installed
 * from TestFlight or the App Store, so it is described here rather than
 * faked.
 */
interface LeaderboardScreenProps {
  trophies: number;
  wins: Record<AiDifficultyId, number>;
  modeWins: Record<ModeId, number>;
}

const DIFFICULTIES: { id: AiDifficultyId; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

export function LeaderboardScreen({
  trophies,
  wins,
  modeWins,
}: LeaderboardScreenProps) {
  const wallet = getWallet();
  const totalWins = DIFFICULTIES.reduce((sum, d) => sum + wins[d.id], 0);
  const gameCenterReady = gameCenterAvailable();
  const posting = mayPost();

  // Your league is the highest rung of the ladder you have reached.
  const reached = TIERS.filter((t) => trophies >= t.at);
  const league = reached[reached.length - 1] ?? TIERS[0];
  const leagueLabel = tierLabel(league, trophies);
  const upNext = nextTier(trophies);
  const toNext = upNext ? upNext.at - trophies : 0;

  return (
    <View style={styles.overlay}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Where you stand right now */}
        <View style={styles.leagueCard}>
          <Text style={styles.leagueEyebrow}>YOUR LEAGUE</Text>
          {/*
            The banner shows the same picture the rung does. It used to be
            the tier's emoji, and once the ladder underneath it stopped
            standing things in with emoji this was the only one left on
            the screen doing it.
          */}
          <View style={styles.leagueRow}>
            <RungIcon tier={league} size={26} />
            <Text style={styles.leagueName}>{leagueLabel.name}</Text>
          </View>
          {upNext ? (
            <Text style={styles.leagueNext}>
              {toNext} more {toNext === 1 ? 'trophy' : 'trophies'} to reach{' '}
              {tierLabel(upNext, trophies).name}
            </Text>
          ) : (
            <Text style={styles.leagueNext}>
              Top league reached — every reward is yours.
            </Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>YOUR RECORD</Text>
        <View style={styles.statRow}>
          {DIFFICULTIES.map((d) => (
            <View key={d.id} style={styles.statCard}>
              <Text style={styles.statValue}>{wins[d.id]}</Text>
              <Text style={styles.statLabel}>
                {d.label} {wins[d.id] === 1 ? 'win' : 'wins'}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{trophies}</Text>
            {/* The golden trophy beside the word, the way Coins wears its
                coin two cards over. */}
            <View style={styles.statLabelRow}>
              <TrophyIcon size={12} />
              <Text style={styles.statLabel}>Trophies</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalWins}</Text>
            <Text style={styles.statLabel}>Battles won</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{wallet.coins}</Text>
            <CoinLabel size={12} style={styles.statLabel}>
              Coins
            </CoinLabel>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{wallet.owned.length}</Text>
            <Text style={styles.statLabel}>Bought</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>WINS BY MODE</Text>
        <View style={styles.statRow}>
          {MODE_ORDER.map((id) => (
            <View key={id} style={styles.statCard}>
              <Text style={styles.statValue}>{modeWins[id] ?? 0}</Text>
              <Text style={styles.statLabel}>{MODES[id].name}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>THE LADDER</Text>
        <Text style={styles.sectionNote}>
          Every rung, and where you are on it. It starts where you started
          and climbs as you read down.
        </Text>
        {/*
          Read DOWN, cheapest first. Marc, 27 Aug 2026: "flip the ladder
          around to go in ascending order down." It was reversed so the
          summit sat at the top, which is how a leaderboard reads — but
          this is not a leaderboard, it is a road, and a road is read from
          where you are standing towards where you are going.
        */}
        {TIERS.map((tier) => {
          const label = tierLabel(tier, trophies);
          const reachedThis = trophies >= tier.at;
          const isCurrent = tier.id === league.id;
          return (
            <View
              key={tier.id}
              style={[styles.rung, isCurrent && styles.rungCurrent]}
            >
              <RungIcon tier={tier} />
              <Text
                style={[styles.rungName, !reachedThis && styles.rungNameLocked]}
              >
                {label.name}
              </Text>
              {isCurrent ? (
                <Text style={[styles.rungAt, styles.rungAtCurrent]}>YOU</Text>
              ) : (
                <View style={styles.rungPrice}>
                  <TrophyIcon size={11} color={THEME.inkFaint} />
                  <Text style={styles.rungAt}>{tier.at}</Text>
                </View>
              )}
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>WORLD RANKINGS</Text>
        {gameCenterReady ? (
          <View style={styles.pending}>
            <Text style={styles.pendingBody}>
              Your trophies and battles won go up against everyone else's,
              through the phone's own Apple account — no new password, and
              nothing personal stored by this game.
            </Text>
            {posting ? null : (
              <Text style={styles.pendingWarn}>
                A trophy or coin code was used on this save, so it stays off
                the shared board. Everything you have unlocked is still
                yours — this only affects the world ranking.
              </Text>
            )}
            <View style={styles.gcButtons}>
              <Pressable style={styles.gcButton} onPress={openLeaderboard}>
                <Text style={styles.gcButtonText}>World ranking</Text>
              </Pressable>
              <Pressable style={styles.gcButton} onPress={openAchievements}>
                <Text style={styles.gcButtonText}>Achievements</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.pending}>
            <Text style={styles.pendingTitle}>Not on this device</Text>
            <Text style={styles.pendingBody}>
              World rankings run on Game Center, which is part of iPhone and
              iPad. Everything above is your own record and works
              everywhere.
            </Text>
          </View>
        )}
      </ScrollView>

      {/*
        No Done button. It used to sit here and it never worked: the tab
        bar is drawn on top of this screen with an opaque background and a
        higher zIndex, so the button was both invisible and untappable —
        a tap in that spot hit whichever tab was over it. The bar IS the
        way out of these pages, the way it already is on Settings and
        Cups.
      */}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...MENU_PAGE_AREA,
    // Solid, not 96%: the arena used to show faintly through every
    // menu. Only the battle screen shows the board now.
    backgroundColor: THEME.ground,
    // Above the Home screen's settings gear (zIndex 5), which used to
    // float on top of these screens and sit over their headers.
    zIndex: 20,
    paddingTop: 100,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginBottom: 12,
  },
  title: { color: THEME.ink, ...TYPE.title },
  scroll: { paddingHorizontal: 16, paddingBottom: 16 },

  // The hero card: your league, on a gold wash under the same ink line.
  leagueCard: {
    backgroundColor: 'rgba(255,210,31,0.30)',
    borderColor: THEME.ink,
    borderWidth: SHAPE.line,
    borderRadius: SHAPE.radius,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  leagueEyebrow: {
    color: THEME.inkSoft,
    ...TYPE.label,
    letterSpacing: 2,
  },
  leagueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leagueName: { color: THEME.ink, fontSize: 22, fontWeight: '900' },
  leagueNext: {
    color: THEME.inkSoft,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  sectionTitle: {
    color: THEME.inkFaint,
    ...TYPE.label,
    letterSpacing: 2,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  gcButtons: { flexDirection: 'row', gap: 8, marginTop: 10 },
  gcButton: {
    flexGrow: 1,
    flexBasis: 0,
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  gcButtonText: { color: THEME.ink, fontSize: 13.5, fontWeight: '900' },
  // Amber, not red: nothing is broken and nothing was taken away. Dark
  // enough to read on white — bright amber was a dark-theme colour.
  pendingWarn: {
    color: '#7a5200',
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 8,
  },
  sectionNote: {
    color: THEME.inkSoft,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    marginLeft: 4,
    marginTop: -4,
  },

  // Four cards per row now (trophies, wins, coins, bought), so they wrap
  // rather than squeezing to unreadable widths on a small phone.
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: 72,
    minWidth: 72,
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { color: THEME.ink, fontSize: 22, fontWeight: '900' },
  statLabel: {
    color: THEME.inkFaint,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  rung: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: SHAPE.radiusSm,
    marginBottom: 6,
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    // Quiet rows: the ladder is a list, not thirteen shouting cards. The
    // ink border is saved for the rung you are actually on.
    borderColor: 'rgba(29,26,46,0.25)',
  },
  rungCurrent: {
    backgroundColor: 'rgba(255,210,31,0.30)',
    borderColor: THEME.ink,
  },
  rungEmoji: { fontSize: 18, width: RUNG_ICON, textAlign: 'center' },
  rungArt: {
    width: RUNG_ICON,
    height: RUNG_ICON,
    borderRadius: RUNG_ICON * 0.24,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  rungName: { color: THEME.ink, fontSize: 14, fontWeight: '700', flex: 1 },
  rungNameLocked: { color: THEME.inkFaint },
  rungPrice: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rungAt: { color: THEME.inkFaint, fontSize: 12, fontWeight: '800' },
  rungAtCurrent: { color: THEME.ink },

  pending: {
    backgroundColor: THEME.tile,
    borderRadius: SHAPE.radius,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    padding: 14,
    gap: 8,
  },
  pendingTitle: { color: THEME.ink, fontSize: 14, fontWeight: '800' },
  pendingBody: {
    color: THEME.inkSoft,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
});
