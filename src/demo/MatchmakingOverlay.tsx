import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AI_ROSTER, AiOpponent } from '../game/ai';
import {
  MATCH_TOTAL_MS,
  SCAN_TICK_MS,
  dotsAt,
  isComplete,
  scanIndexAt,
  stageAt,
} from '../game/matchmaking';

const textShadow = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 6,
};

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
    backgroundColor: 'rgba(20,12,40,0.82)',
    paddingHorizontal: 28,
  },
  kicker: {
    color: '#ffe521',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 20,
    ...textShadow,
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 230,
    paddingVertical: 26,
    paddingHorizontal: 30,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  cardFound: {
    backgroundColor: 'rgba(255,229,33,0.16)',
    borderColor: '#ffe521',
  },
  emoji: {
    fontSize: 54,
  },
  name: {
    color: '#ffffff',
    fontSize: 27,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'center',
    ...textShadow,
  },
  nameFound: {
    color: '#ffe521',
    fontSize: 31,
  },
  footer: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 20,
    minHeight: 22,
    ...textShadow,
  },
  track: {
    marginTop: 22,
    width: 190,
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#ffe521',
  },
});
