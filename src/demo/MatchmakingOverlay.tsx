import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SHAPE, THEME } from '../ui/theme';
import { AI_ROSTER, AiOpponent } from '../game/ai';
import {
  MATCH_TOTAL_MS,
  SCAN_TICK_MS,
  dotsAt,
  isComplete,
  scanIndexAt,
  stageAt,
} from '../game/matchmaking';


/**
 * Shown for a couple of seconds at the top of every round: names shuffle
 * past, then the rival you actually face is revealed.
 *
 * `onDone` fires exactly once. The timer is cleared on unmount, so leaving
 * the round mid-search cannot start a countdown for a battle nobody is in.
 */
export function MatchmakingOverlay({
  opponent,
  onDone,
}: {
  opponent: AiOpponent;
  onDone: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());
  const finished = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const id = setInterval(() => {
      const next = Date.now() - startedAt.current;
      setElapsed(next);
      if (isComplete(next) && !finished.current) {
        finished.current = true;
        clearInterval(id);
        done.current();
      }
    }, SCAN_TICK_MS / 2);
    return () => clearInterval(id);
  }, []);

  const stage = stageAt(elapsed);
  const scanning = stage === 'scanning';
  const shown = scanning
    ? AI_ROSTER[scanIndexAt(elapsed, AI_ROSTER.length)]
    : opponent;

  return (
    <View style={styles.overlay}>
      <Text style={styles.kicker}>
        {scanning ? `FINDING YOUR OPPONENT${dotsAt(elapsed)}` : 'YOUR OPPONENT'}
      </Text>

      <View style={[styles.card, !scanning && styles.cardFound]}>
        <Text style={styles.emoji}>{shown.emoji}</Text>
        <Text style={[styles.name, !scanning && styles.nameFound]}>
          {shown.name}
        </Text>
      </View>

      <Text style={styles.footer}>
        {scanning ? ' ' : 'Get ready to battle!'}
      </Text>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.min(100, (elapsed / MATCH_TOTAL_MS) * 100)}%` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    // Ink over the board — solid enough that nothing under it competes
    // with the reveal, so the card needs no text shadows.
    backgroundColor: 'rgba(29,26,46,0.85)',
    paddingHorizontal: 28,
  },
  kicker: {
    color: THEME.onInk,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 20,
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 230,
    paddingVertical: 26,
    paddingHorizontal: 30,
    borderRadius: SHAPE.radiusLg,
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  cardFound: {
    backgroundColor: THEME.gold,
  },
  emoji: {
    fontSize: 54,
  },
  name: {
    color: THEME.ink,
    fontSize: 27,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'center',
  },
  nameFound: {
    fontSize: 31,
  },
  footer: {
    color: THEME.onInk,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 20,
    minHeight: 22,
  },
  track: {
    marginTop: 22,
    width: 190,
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(253,246,236,0.30)',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: THEME.gold,
  },
});
