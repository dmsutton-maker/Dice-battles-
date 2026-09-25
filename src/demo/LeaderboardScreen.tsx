import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AiDifficultyId } from '../game/ai';
import { MENU_PAGE_EDGES, useMenuPageArea } from './BottomNav';
import { TrophyIcon } from '../ui/Icon';
import { SHAPE, THEME, TYPE } from '../ui/theme';
import { getWallet } from '../game/currency';
import { CoinLabel } from './GoldCoin';
import { nextTier, TIERS, tierLabel } from '../game/progress';
import { ARENA_ORDER, isArenaUnlocked, isSkinUnlocked } from '../game/loadout';
import { DICE_SKINS } from '../game/diceSkins';
import { MODES, MODE_ORDER, ModeId } from '../game/modes';
import { Tier } from '../game/progress';
import { TierIcon } from './TierIcon';
import {
  isAvailable as gameCenterAvailable,
  mayPost,
  openAchievements,
  openLeaderboard,
} from '../game/gameCenter';

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
  /** Battles finished, won or not — see Progress.played. */
  played: Record<AiDifficultyId, number>;
  modePlayed: Record<ModeId, number>;
}

const DIFFICULTIES: { id: AiDifficultyId; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

/**
 * A number with a line under it, and under that the battles it came out
 * of.
 *
 * David, 20 Sep 2026: "add counters in the ranks tab for total games
 * played and games played for each mode and difficulty." Written into
 * the cards that were already there rather than as a second grid of
 * seven more — the interesting number is not "31 played", it is "12 of
 * 31", and putting the pair on one card is what makes that readable
 * without any arithmetic.
 */
function StatCard({
  value,
  label,
  icon,
  outOf,
}: {
  value: number;
  label: string;
  icon?: React.ReactNode;
  outOf?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      {icon ? (
        <View style={styles.statLabelRow}>
          {icon}
          <Text style={styles.statLabel}>{label}</Text>
        </View>
      ) : (
        <Text style={styles.statLabel}>{label}</Text>
      )}
      {outOf ? <Text style={styles.statSub}>{outOf}</Text> : null}
    </View>
  );
}

export function LeaderboardScreen({
  trophies,
  wins,
  modeWins,
  played,
  modePlayed,
}: LeaderboardScreenProps) {
  const wallet = getWallet();
  const totalWins = DIFFICULTIES.reduce((sum, d) => sum + wins[d.id], 0);
  const totalPlayed = DIFFICULTIES.reduce((sum, d) => sum + played[d.id], 0);
  const gameCenterReady = gameCenterAvailable();
  const posting = mayPost();

  /*
    THE CUPBOARD, not the receipt.

    "Bought" used to sit in the corner of this row, counting the length
    of wallet.owned — which is the things PAID FOR with coins and nothing
    else. It therefore read 0 for a player who had climbed six rungs of
    the ladder and owned six battlefields, and it went up when you spent
    money rather than when you played. David asked for it gone on 20 Sep
    2026 and for these two instead: everything you have, however you came
    by it.
  */
  const boards = ARENA_ORDER.filter((id) => isArenaUnlocked(id, trophies)).length;
  const dice = DICE_SKINS.filter((s) => isSkinUnlocked(s.id, trophies)).length;

  // Your league is the highest rung of the ladder you have reached.
  const reached = TIERS.filter((t) => trophies >= t.at);
  const league = reached[reached.length - 1] ?? TIERS[0];
  const leagueLabel = tierLabel(league, trophies);
  const upNext = nextTier(trophies);
  const toNext = upNext ? upNext.at - trophies : 0;

  return (
    <View style={[styles.overlay, useMenuPageArea()]}>
      <View style={styles.header}>
        <Text style={styles.title}>Records</Text>
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
            <TierIcon tier={league} size={26} />
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
          <StatCard
            value={trophies}
            label="Trophies"
            /* The golden trophy beside the word, the way Coins wears its
               coin two cards over. */
            icon={<TrophyIcon size={12} />}
          />
          <StatCard value={totalWins} label="Battles won" />
          <StatCard value={totalPlayed} label="Battles played" />
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{wallet.coins}</Text>
            <CoinLabel size={12} style={styles.statLabel}>
              Coins
            </CoinLabel>
          </View>
        </View>

        <Text style={styles.sectionTitle}>WINS BY DIFFICULTY</Text>
        <View style={styles.statRow}>
          {DIFFICULTIES.map((d) => (
            <StatCard
              key={d.id}
              value={wins[d.id]}
              label={`${d.label} ${wins[d.id] === 1 ? 'win' : 'wins'}`}
              outOf={`of ${played[d.id]} played`}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>WINS BY MODE</Text>
        <View style={styles.statRow}>
          {MODE_ORDER.map((id) => (
            <StatCard
              key={id}
              value={modeWins[id] ?? 0}
              label={MODES[id].name}
              outOf={`of ${modePlayed[id] ?? 0} played`}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>YOUR CUPBOARD</Text>
        <View style={styles.statRow}>
          <StatCard
            value={boards}
            label="Battlefields"
            outOf={`of ${ARENA_ORDER.length}`}
          />
          <StatCard value={dice} label="Dice" outOf={`of ${DICE_SKINS.length}`} />
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
          /*
            Every rung at the threshold you are standing on, not just one.

            Marc, 28 Aug 2026: "have both the castle courtyard and ivory
            dice be highlighted on the ladder at the beginning." The two
            free rungs both sit at 0, and `league` can only ever be one
            tier — the last one you have reached — so a brand-new player
            saw Ivory Dice marked YOU and Castle Courtyard looking like
            something still to earn, when they own both.
          */
          const isCurrent = tier.at === league.at;
          return (
            <View
              key={tier.id}
              style={[styles.rung, isCurrent && styles.rungCurrent]}
            >
              <TierIcon tier={tier} />
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
              {/*
                Friends used to be the first button here. It moved to the
                corner of the home screen on 10 Sep 2026 (David's call),
                taking How to play's slot — it is somewhere people go back
                to repeatedly, and two taps behind a tab was too far. The
                bar is still five cells on purpose, so it did not become a
                sixth tab.
              */}
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
    ...MENU_PAGE_EDGES,
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
  gcButtonWaiting: { backgroundColor: THEME.sunk, opacity: 0.75 },
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
  // The "of 31 played" line. Quieter and smaller than the label above
  // it, so the card still reads as one number at a glance.
  statSub: {
    color: THEME.inkFaint,
    fontSize: 9.5,
    fontWeight: '700',
    textAlign: 'center',
    opacity: 0.75,
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
