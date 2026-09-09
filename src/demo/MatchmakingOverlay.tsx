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
import {
  isSearchOver,
  searchProgress,
  searchesForPlayers,
  secondsShown,
  SEARCH_POLL_MS,
  type Pairing,
} from '../game/matchSearch';
import { findWaitingPlayer } from '../game/onlineMatch';


/**
 * Shown for a couple of seconds at the top of every round: names shuffle
 * past, then the rival you actually face is revealed.
 *
 * `onDone` fires exactly once. The timer is cleared on unmount, so leaving
 * the round mid-search cannot start a countdown for a battle nobody is in.
 */
export function MatchmakingOverlay({
  opponent,
  trophies,
  onDone,
}: {
  opponent: AiOpponent;
  /** Decides whether a search for a real player happens at all. */
  trophies: number;
  onDone: () => void;
}) {
  /*
    Below the trophy floor there is no search: it is a bot, immediately,
    which is the point of the floor. Above it the game looks for a real
    player — but only where there is somewhere to look. See
    onlineMatch.ts: with no matchmaking service the honest answer is that
    the question cannot be asked, and a fifteen-second wait for an answer
    that was never coming is theatre.
  */
  const [pairing, setPairing] = useState<Pairing | null>(
    searchesForPlayers(trophies) ? null : { kind: 'bot', reason: 'below-threshold' },
  );
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());
  const finished = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (pairing !== null) return;
    let live = true;
    const ask = async () => {
      const found = await findWaitingPlayer();
      if (!live || found === null) return;
      setPairing(found);
    };
    void ask();
    const id = setInterval(() => void ask(), SEARCH_POLL_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [pairing]);

  // Waiting for people is the only thing that takes fifteen seconds. Once
  // the pairing is settled the overlay is the reveal it has always been.
  const waiting = pairing === null;
  const waitingRef = useRef(waiting);
  waitingRef.current = waiting;

  /*
    When the pairing settles, the reveal starts from THERE rather than
    from when the search began — otherwise a search that took ten seconds
    would skip straight past the reveal into the countdown, and nobody
    would see who they were playing.
  */
  const settledAt = useRef(0);
  useEffect(() => {
    if (pairing !== null && settledAt.current === 0) {
      settledAt.current = Date.now() - startedAt.current;
    }
  }, [pairing]);

  useEffect(() => {
    const id = setInterval(() => {
      const next = Date.now() - startedAt.current;
      setElapsed(next);
      if (waitingRef.current) {
        // Out of time: take the bot rather than keep somebody staring.
        if (isSearchOver(next)) setPairing({ kind: 'bot', reason: 'nobody-found' });
        return;
      }
      if (isComplete(next - settledAt.current) && !finished.current) {
        finished.current = true;
        clearInterval(id);
        done.current();
      }
    }, SCAN_TICK_MS / 2);
    return () => clearInterval(id);
  }, []);

  // The reveal's own clock starts when the pairing settles.
  const revealElapsed = waiting ? 0 : elapsed - settledAt.current;
  const stage = stageAt(revealElapsed);
  const scanning = waiting || stage === 'scanning';
  const shown = scanning
    ? AI_ROSTER[scanIndexAt(elapsed, AI_ROSTER.length)]
    : opponent;

  return (
    <View style={styles.overlay}>
      <Text style={styles.kicker}>
        {waiting
          ? `LOOKING FOR A PLAYER${dotsAt(elapsed)}`
          : scanning
            ? `FINDING YOUR OPPONENT${dotsAt(elapsed)}`
            : 'YOUR OPPONENT'}
      </Text>

      <View style={[styles.card, !scanning && styles.cardFound]}>
        <Text style={styles.emoji}>{shown.emoji}</Text>
        <Text style={[styles.name, !scanning && styles.nameFound]}>
          {shown.name}
        </Text>
      </View>

      <Text style={styles.footer}>
        {waiting
          ? `${secondsShown(elapsed)}s — a rival is picked if nobody joins`
          : scanning
            ? ' '
            : 'Get ready to battle!'}
      </Text>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: waiting
                ? `${searchProgress(elapsed) * 100}%`
                : `${Math.min(100, (revealElapsed / MATCH_TOTAL_MS) * 100)}%`,
            },
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
