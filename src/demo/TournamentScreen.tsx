import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AI_DIFFICULTIES } from '../game/ai';
import { playClick } from '../audio/sounds';
import { rangeLabel } from '../game/rewards';
import {
  RunState,
  TOURNAMENTS,
  TournamentDef,
  canEnter,
  playersLeft,
  roundName,
  roundsToWin,
  tournamentById,
} from '../game/tournament';
import { MENU_PAGE_AREA } from './BottomNav';
import { PrimaryButton } from '../ui/Card';
import { SHAPE, THEME, TYPE } from '../ui/theme';
import { GoldCoin } from './GoldCoin';

/**
 * The Cups tab: pick a bracket, then play it one round at a time.
 *
 * Two states in one screen — the list of cups, and the run in progress —
 * because a run is only ever one bracket deep and a second screen for
 * "you are three rounds in" would be a screen you look at once.
 */
export function TournamentScreen({
  coins,
  run,
  onEnter,
  onPlayRound,
  onAbandon,
}: {
  coins: number;
  run: RunState | null;
  onEnter: (tournament: TournamentDef) => void;
  onPlayRound: () => void;
  onAbandon: () => void;
}) {
  const active = run ? tournamentById(run.tournamentId) : undefined;

  return (
    <View style={styles.overlay}>
      <View style={styles.header}>
        <Text style={styles.title}>Cups</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {run && active ? (
          <View style={styles.runCard}>
            <Text style={styles.runEyebrow}>YOU ARE IN THE</Text>
            <Text style={styles.runName}>
              {active.emoji} {active.name}
            </Text>

            <View style={styles.pipRow}>
              {Array.from({ length: roundsToWin(active.size) }, (_v, i) => (
                <View
                  key={i}
                  style={[styles.pip, i < run.wins && styles.pipWon]}
                >
                  <Text style={styles.pipText}>{i < run.wins ? '✓' : ''}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.runRound}>
              {roundName(active.size, run.wins)} ·{' '}
              {playersLeft(active.size, run.wins)} left in
            </Text>
            <Text style={styles.runNote}>
              Win it and you take {rangeLabel(active.prize)} coins. Lose and
              the run is over — there is no second chance in a cup.
            </Text>

            <PrimaryButton
              style={styles.playButton}
              onPress={() => {
                playClick();
                onPlayRound();
              }}
            >
              <Text style={styles.playText}>
                Play the {roundName(active.size, run.wins)}
              </Text>
            </PrimaryButton>
            <Pressable
              style={styles.quietButton}
              onPress={() => {
                playClick();
                onAbandon();
              }}
            >
              <Text style={styles.quietText}>Give up this run</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.note}>
              A cup is a knockout: beat every opponent in the bracket and the
              prize is yours. Lose once and you are out.
            </Text>

            {TOURNAMENTS.map((t) => {
              const affordable = canEnter(t, coins);
              return (
                <Pressable
                  key={t.id}
                  disabled={!affordable}
                  style={[styles.card, !affordable && styles.cardLocked]}
                  onPress={() => {
                    playClick();
                    onEnter(t);
                  }}
                >
                  <Text style={styles.cardEmoji}>{t.emoji}</Text>
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{t.name}</Text>
                    <Text style={styles.cardMeta}>
                      {t.size} players · {AI_DIFFICULTIES[t.difficulty].label} ·{' '}
                      {roundsToWin(t.size)} rounds to win
                    </Text>
                    <View style={styles.prizeRow}>
                      <GoldCoin size={13} />
                      <Text style={styles.cardPrize}>
                        {rangeLabel(t.prize)} to the champion
                      </Text>
                    </View>
                  </View>
                  <View style={styles.entry}>
                    {t.entry === 0 ? (
                      <Text style={styles.entryLabel}>FREE</Text>
                    ) : (
                      <View style={styles.prizeRow}>
                        <GoldCoin size={13} />
                        <Text style={styles.entryLabel}>{t.entry}</Text>
                      </View>
                    )}
                    {!affordable && (
                      <Text style={styles.entryShort}>
                        {t.entry - coins} short
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...MENU_PAGE_AREA,
    // Solid, not 96%: the arena used to show faintly through every
    // menu. Only the battle screen shows the board now.
    backgroundColor: THEME.ground,
    zIndex: 20,
    paddingTop: 100,
  },
  header: { paddingHorizontal: 22, marginBottom: 10 },
  title: {
    color: THEME.ink,
    ...TYPE.title,
  },
  scroll: {
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  note: {
    color: THEME.inkSoft,
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: 16,
    lineHeight: 19,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    borderRadius: SHAPE.radius,
    padding: 16,
    marginBottom: 12,
  },
  /*
   * Sunk, not faded: opacity dragged every line under the contrast floor,
   * and "40 short" is exactly the line the card exists to say.
   */
  cardLocked: {
    backgroundColor: THEME.sunk,
    borderColor: 'rgba(29,26,46,0.35)',
  },
  cardEmoji: { fontSize: 34 },
  cardText: { flex: 1 },
  cardTitle: { color: THEME.ink, ...TYPE.cardTitle },
  cardMeta: {
    color: THEME.inkSoft,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  cardPrize: {
    color: THEME.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  entry: { alignItems: 'flex-end' },
  prizeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  entryLabel: { color: THEME.ink, fontSize: 15, fontWeight: '900' },
  entryShort: {
    color: THEME.inkFaint,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  // The hero card: the run you are in, on a gold wash under the ink line.
  runCard: {
    backgroundColor: 'rgba(255,210,31,0.30)',
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    borderRadius: SHAPE.radiusLg,
    padding: 20,
    alignItems: 'center',
  },
  runEyebrow: {
    color: THEME.inkSoft,
    ...TYPE.label,
    letterSpacing: 1.4,
  },
  runName: {
    color: THEME.ink,
    fontSize: 23,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'center',
  },
  pipRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  pip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: SHAPE.line,
    borderColor: 'rgba(29,26,46,0.35)',
    backgroundColor: THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipWon: { backgroundColor: THEME.good, borderColor: THEME.ink },
  pipText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  runRound: {
    color: THEME.ink,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 14,
  },
  runNote: {
    color: THEME.inkSoft,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
  },
  playButton: {
    alignSelf: 'stretch',
    marginTop: 18,
  },
  playText: {
    color: THEME.onAccent,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  quietButton: { paddingVertical: 12, marginTop: 4 },
  quietText: {
    color: THEME.inkSoft,
    fontSize: 13,
    fontWeight: '700',
  },
});
