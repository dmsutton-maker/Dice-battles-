import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AiDifficultyId } from '../game/ai';
import { getWallet } from '../game/currency';
import { nextTier, TIERS, tierLabel } from '../game/progress';
import { MODES, MODE_ORDER, ModeId } from '../game/modes';

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

const DIFFICULTY_MEDALS: { id: AiDifficultyId; label: string; medal: string }[] = [
  { id: 'easy', label: 'Easy', medal: '🥉' },
  { id: 'medium', label: 'Medium', medal: '🥈' },
  { id: 'hard', label: 'Hard', medal: '🥇' },
];

export function LeaderboardScreen({
  trophies,
  wins,
  modeWins,
}: LeaderboardScreenProps) {
  const wallet = getWallet();
  const totalWins = DIFFICULTY_MEDALS.reduce((sum, d) => sum + wins[d.id], 0);

  // Your league is the highest rung of the ladder you have reached.
  const reached = TIERS.filter((t) => trophies >= t.at);
  const league = reached[reached.length - 1] ?? TIERS[0];
  const leagueLabel = tierLabel(league, trophies);
  const upNext = nextTier(trophies);
  const toNext = upNext ? upNext.at - trophies : 0;

  return (
    <View style={styles.overlay}>
      <View style={styles.header}>
        <Text style={styles.title}>🏅 LEADERBOARD</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Where you stand right now */}
        <View style={styles.leagueCard}>
          <Text style={styles.leagueEyebrow}>YOUR LEAGUE</Text>
          <Text style={styles.leagueName}>
            {leagueLabel.emoji} {leagueLabel.name}
          </Text>
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
          {DIFFICULTY_MEDALS.map((d) => (
            <View key={d.id} style={styles.statCard}>
              <Text style={styles.statValue}>{wins[d.id]}</Text>
              <Text style={styles.statLabel}>
                {d.medal} {d.label} {wins[d.id] === 1 ? 'win' : 'wins'}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{trophies}</Text>
            <Text style={styles.statLabel}>🏆 Trophies</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalWins}</Text>
            <Text style={styles.statLabel}>⚔️ Battles won</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{wallet.coins}</Text>
            <Text style={styles.statLabel}>🪙 Coins</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{wallet.owned.length}</Text>
            <Text style={styles.statLabel}>🛒 Bought</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>WINS BY MODE</Text>
        <View style={styles.statRow}>
          {MODE_ORDER.map((id) => (
            <View key={id} style={styles.statCard}>
              <Text style={styles.statValue}>{modeWins[id] ?? 0}</Text>
              <Text style={styles.statLabel}>
                {MODES[id].emoji} {MODES[id].name}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>THE LADDER</Text>
        <Text style={styles.sectionNote}>
          Every rung, and where you are on it.
        </Text>
        {[...TIERS].reverse().map((tier) => {
          const label = tierLabel(tier, trophies);
          const reachedThis = trophies >= tier.at;
          const isCurrent = tier.id === league.id;
          return (
            <View
              key={tier.id}
              style={[styles.rung, isCurrent && styles.rungCurrent]}
            >
              <Text style={styles.rungEmoji}>{label.emoji}</Text>
              <Text
                style={[styles.rungName, !reachedThis && styles.rungNameLocked]}
              >
                {label.name}
              </Text>
              <Text style={[styles.rungAt, isCurrent && styles.rungAtCurrent]}>
                {isCurrent ? 'YOU' : `${tier.at} 🏆`}
              </Text>
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>WORLD RANKINGS</Text>
        <View style={styles.pending}>
          <Text style={styles.pendingTitle}>Not live yet</Text>
          <Text style={styles.pendingBody}>
            Ranking players against each other means every score has to meet
            in one place, and right now your trophies live only on this
            phone — which is also why the game needs no login and collects
            nothing about you.
          </Text>
          <Text style={styles.pendingBody}>
            The plan is Game Center, so the phone's own Apple account does
            the work: still no new password, still nothing personal stored
            by this game. It switches on once the app is installed properly
            rather than through Expo Go.
          </Text>
        </View>
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
    ...StyleSheet.absoluteFillObject,
    // Solid, not 96%: the arena used to show faintly through every
    // menu. Only the battle screen shows the board now.
    backgroundColor: '#141028',
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
  title: { color: '#ffffff', fontSize: 22, fontWeight: '900', letterSpacing: 1.5 },
  trophies: { color: '#ffe521', fontSize: 18, fontWeight: '800' },
  scroll: { paddingHorizontal: 16, paddingBottom: 16 },

  leagueCard: {
    backgroundColor: 'rgba(255,229,33,0.14)',
    borderColor: '#ffe521',
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  leagueEyebrow: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  leagueName: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
  leagueNext: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  sectionTitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionNote: {
    color: 'rgba(255,255,255,0.6)',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
  statLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },

  rung: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  rungCurrent: {
    backgroundColor: 'rgba(255,229,33,0.18)',
    borderWidth: 1.5,
    borderColor: '#ffe521',
  },
  rungEmoji: { fontSize: 18 },
  rungName: { color: '#ffffff', fontSize: 14, fontWeight: '700', flex: 1 },
  rungNameLocked: { color: 'rgba(255,255,255,0.5)' },
  rungAt: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '800' },
  rungAtCurrent: { color: '#ffe521' },

  pending: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    padding: 14,
    gap: 8,
  },
  pendingTitle: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  pendingBody: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },

  doneText: { color: '#241c40', fontSize: 16, fontWeight: '900' },
});
