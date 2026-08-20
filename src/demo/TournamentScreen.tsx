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
import { BOTTOM_NAV_HEIGHT } from './BottomNav';
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
        <Text style={styles.title}>🏆 CUPS</Text>
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

            <Pressable
              style={styles.playButton}
              onPress={() => {
                playClick();
                onPlayRound();
              }}
            >
              <Text style={styles.playText}>
                ▶ PLAY THE {roundName(active.size, run.wins).toUpperCase()}
              </Text>
            </Pressable>
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
    ...StyleSheet.absoluteFillObject,
    // Solid, not 96%: the arena used to show faintly through every
    // menu. Only the battle screen shows the board now.
    backgroundColor: '#141028',
    zIndex: 20,
    paddingTop: 100,
  },
  header: { paddingHorizontal: 22, marginBottom: 10 },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  scroll: {
    paddingHorizontal: 22,
    paddingBottom: BOTTOM_NAV_HEIGHT + 24,
  },
  note: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: 16,
    lineHeight: 19,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  cardLocked: { opacity: 0.45 },
  cardEmoji: { fontSize: 34 },
  cardText: { flex: 1 },
  cardTitle: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  cardMeta: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  cardPrize: {
    color: '#ffd54a',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 5,
  },
  entry: { alignItems: 'flex-end' },
  prizeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  entryLabel: { color: '#ffe521', fontSize: 15, fontWeight: '900' },
  entryShort: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  runCard: {
    backgroundColor: 'rgba(255,229,33,0.10)',
    borderWidth: 2.5,
    borderColor: '#ffe521',
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
  },
  runEyebrow: {
    color: '#ffe521',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  runName: {
    color: '#ffffff',
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
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipWon: { backgroundColor: '#33cc6b', borderColor: '#33cc6b' },
  pipText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  runRound: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 14,
  },
  runNote: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
  },
  playButton: {
    alignSelf: 'stretch',
    backgroundColor: '#ffe521',
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  playText: {
    color: '#241a44',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  quietButton: { paddingVertical: 12, marginTop: 4 },
  quietText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '700',
  },
});
