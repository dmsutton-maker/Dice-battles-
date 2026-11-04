import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MIN_TAP, SHAPE, THEME, TYPE } from '../ui/theme';
import { SecondaryButton } from '../ui/Card';
import { playClick } from '../audio/sounds';
import { AI_ROSTER, AiOpponent, type AiDifficultyId } from '../game/ai';
import { PRISONER_COLORS, inkOn } from '../game/colors';
import type { ModeId } from '../game/modes';
import type { Identity } from '../game/playerIdentity';
import type { BattleHandle } from '../game/battlesApi';
import {
  MATCH_TOTAL_MS,
  SCAN_TICK_MS,
  dotsAt,
  isComplete,
  scanIndexAt,
  stageAt,
} from '../game/matchmaking';
import { searchProgress, secondsLeft, SEARCH_POLL_MS } from '../game/matchSearch';
import {
  isLooking,
  showsSearch,
  startFlow,
  stepFlow,
  type MatchFlowEvent,
  type MatchFlowState,
} from '../game/matchFlow';
import {
  cancelSearch,
  findWaitingPlayer,
  hasMatchmakingService,
  leaveMatchBattle,
  withdrawFromSearch,
  type ProfileStats,
} from '../game/onlineMatch';

/** The line under a rival who was picked because no person could be. */
function botFooter(state: MatchFlowState): string {
  if (state.kind === 'bot' && state.reason === 'nobody-found') return "Nobody free right now — here's a rival.";
  if (state.kind === 'bot' && state.reason === 'no-show') return "Your opponent didn't make it — here's a rival.";
  return 'Get ready to battle!';
}

/**
 * Shown at the top of every round: a search for a real opponent where
 * there is one to be had, then the rival you face.
 *
 * Marc, 4 Nov 2026: "it should search for a player for 15 seconds and it
 * should say 'searching for opponent' or something, and if it can't find
 * a real person to verse after 15 seconds then it loads you against one
 * of the bots". The order is matchFlow.ts; this draws it and does what
 * each step says.
 *
 * A person found goes to `onPlayer`, and the screen takes it from there
 * into the waiting room — no bot reveal, because there is no bot. A bot
 * is never presented as a person: after a search that found nobody the
 * reveal says so.
 *
 * `onDone` fires exactly once, after a bot's reveal. The timers are
 * cleared on unmount, and leaving mid-search leaves the queue, so going
 * back to the menu cannot leave a stranger waiting for us.
 */
export function MatchmakingOverlay({
  opponent,
  trophies,
  me,
  mode,
  difficulty,
  stats,
  skipSearch,
  onDone,
  onPlayer,
  onCancel,
}: {
  opponent: AiOpponent;
  /** Decides whether a search for a real player happens at all. */
  trophies: number;
  me: Identity | null;
  mode: ModeId;
  difficulty: AiDifficultyId;
  /** Published once if the server does not know this phone yet. */
  stats: ProfileStats;
  /** The opponent we were matched with never came: straight to a rival. */
  skipSearch: boolean;
  onDone: () => void;
  onPlayer: (battle: BattleHandle, name: string) => void;
  onCancel: () => void;
}) {
  /*
    Below the trophy floor, in a mode that cannot be played live, or with
    the service known to be off, the bot is settled before the first
    frame (startFlow). Otherwise the first ask goes out, and the search is
    only SHOWN once the server says it is looking — an `off` answer goes
    straight to the reveal, as it always did.
  */
  const [flow, setFlow] = useState<MatchFlowState>(() =>
    skipSearch ? { kind: 'bot', reason: 'no-show' } : startFlow(trophies, mode, hasMatchmakingService()),
  );
  const flowRef = useRef(flow);
  const mounted = useRef(true);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());
  const finished = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;
  const toPlayer = useRef(onPlayer);
  toPlayer.current = onPlayer;
  const meRef = useRef(me);
  meRef.current = me;
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const request = useRef({ mode, difficulty, trophies });

  const dispatch = useCallback((event: MatchFlowEvent) => {
    const step = stepFlow(flowRef.current, event);
    flowRef.current = step.state;
    if (mounted.current) setFlow(step.state);
    for (const effect of step.effects) {
      if (effect.type === 'leave-battle') {
        void leaveMatchBattle(meRef.current, effect.battleId);
      } else if (step.state.kind === 'withdrawing') {
        // The deadline: the server's answer to leaving decides.
        void withdrawFromSearch(meRef.current).then((pairing) =>
          dispatch({ type: 'leaveAnswer', pairing }),
        );
      } else {
        void cancelSearch(meRef.current);
      }
    }
  }, []);

  /*
    Leaving the overlay by any road while still looking leaves the queue.
    Not once matched: the screen has taken that battle into the waiting
    room, and leaving it here would walk out on the person in it.
  */
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (isLooking(flowRef.current) || flowRef.current.kind === 'withdrawing') {
        dispatch({ type: 'cancel' });
      }
    };
  }, [dispatch]);

  const looking = isLooking(flow);
  useEffect(() => {
    if (!looking) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // One question at a time, so a slow answer never stacks up behind another.
    const ask = async () => {
      const found = await findWaitingPlayer(meRef.current, request.current, statsRef.current);
      // Dispatched even when stale: a late "matched" has to leave its room.
      dispatch({ type: 'answer', pairing: found });
      if (live && isLooking(flowRef.current)) timer = setTimeout(() => void ask(), SEARCH_POLL_MS);
    };
    void ask();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [looking, dispatch]);

  // A real person: the screen takes them into the waiting room.
  useEffect(() => {
    if (flow.kind !== 'matched') return;
    toPlayer.current(flow.pairing.battle, flow.pairing.name);
  }, [flow]);

  const isBot = flow.kind === 'bot';
  const botRef = useRef(isBot);
  botRef.current = isBot;

  /*
    When the bot settles, the reveal starts from THERE rather than from
    when the search began — otherwise a search that took fifteen seconds
    would skip straight past the reveal into the countdown, and nobody
    would see who they were playing.
  */
  const settledAt = useRef<number | null>(null);
  if (isBot && settledAt.current === null) settledAt.current = Date.now() - startedAt.current;

  useEffect(() => {
    const id = setInterval(() => {
      const next = Date.now() - startedAt.current;
      setElapsed(next);
      if (!botRef.current) {
        // Out of time: withdraw, and let the server's answer decide.
        dispatch({ type: 'tick', elapsedMs: next });
        return;
      }
      if (isComplete(next - (settledAt.current ?? next)) && !finished.current) {
        finished.current = true;
        clearInterval(id);
        done.current();
      }
    }, SCAN_TICK_MS / 2);
    return () => clearInterval(id);
  }, [dispatch]);

  const searching = showsSearch(flow) || flow.kind === 'matched' || flow.kind === 'cancelled';

  if (searching) {
    return (
      <View style={styles.overlay}>
        <Text style={styles.kicker}>{`SEARCHING FOR AN OPPONENT${dotsAt(elapsed)}`}</Text>

        <View style={styles.card}>
          <Text style={styles.count} accessibilityLiveRegion="polite">
            {secondsLeft(elapsed)}
          </Text>
        </View>

        <Text style={styles.footer}>{"If nobody is free, you'll play a rival instead."}</Text>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${searchProgress(elapsed) * 100}%` }]} />
        </View>

        <SecondaryButton
          style={styles.cancel}
          onPress={() => {
            playClick();
            dispatch({ type: 'cancel' });
            onCancel();
          }}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </SecondaryButton>
      </View>
    );
  }

  // The reveal's own clock starts when the bot settles.
  const revealElapsed = isBot ? elapsed - (settledAt.current ?? 0) : 0;
  const stage = stageAt(revealElapsed);
  const scanning = !isBot || stage === 'scanning';
  const shown = scanning
    ? AI_ROSTER[scanIndexAt(elapsed, AI_ROSTER.length)]
    : opponent;

  return (
    <View style={styles.overlay}>
      <Text style={styles.kicker}>
        {scanning ? `FINDING YOUR OPPONENT${dotsAt(elapsed)}` : 'YOUR OPPONENT'}
      </Text>

      <View style={[styles.card, !scanning && styles.cardFound]}>
        <RivalBadge name={shown.name} />
        <Text style={[styles.name, !scanning && styles.nameFound]}>
          {shown.name}
        </Text>
      </View>

      <Text style={styles.footer}>{scanning ? ' ' : botFooter(flow)}</Text>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.min(100, (revealElapsed / MATCH_TOTAL_MS) * 100)}%` },
          ]}
        />
      </View>
    </View>
  );
}

/**
 * A rival's badge: their initial on a disc in one of the game's colours.
 *
 * It was an emoji per rival — a crown, a clover, a shield — until David
 * asked on 30 Sep 2026 for every emoji to go. An initial is what a name
 * badge is, it cannot render differently on another phone, and the
 * colour comes from the name so a rival always wears the same one.
 */
export function RivalBadge({ name }: { name: string }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hex = PRISONER_COLORS[hash % PRISONER_COLORS.length].hex;
  return (
    <View style={[styles.badge, { backgroundColor: hex }]}>
      <Text style={[styles.badgeLetter, { color: inkOn(hex) }]}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
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
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLetter: {
    fontSize: 30,
    fontWeight: '900',
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
  count: {
    color: THEME.ink,
    fontSize: 56,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    minWidth: 90,
    textAlign: 'center',
  },
  cancel: { marginTop: 26, minWidth: 160, minHeight: MIN_TAP, paddingVertical: 12 },
  cancelText: { ...TYPE.body, color: THEME.ink, fontWeight: '800' },
});

/**
 * Shared with FriendlyWaitOverlay, the friend-battle waiting room, so the
 * two reveals look like one game rather than two.
 */
export { styles as matchOverlayStyles };
