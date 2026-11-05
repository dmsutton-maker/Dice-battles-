import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { THEME, TYPE } from '../ui/theme';
import { SecondaryButton } from '../ui/Card';
import { playClick } from '../audio/sounds';
import type { AiOpponent } from '../game/ai';
import { DOT_TICK_MS } from '../game/matchmaking';
import { HERE_MS, joinLine, joinProgress } from '../game/friendlyBattle';
import { MATCH_JOIN_WAIT_MS } from '../game/matchSearch';
import { BACK_TO_MENU, goneLine } from '../game/rematch';
import { RivalBadge, matchOverlayStyles as m } from './MatchmakingOverlay';

/**
 * THE FRIEND-BATTLE WAITING ROOM, in place of the bot reveal.
 *
 * David, 1 Nov 2026: "Fix the versus against friends because it doesn't
 * connect and it's not actually against each other." The ordinary reveal
 * (MatchmakingOverlay) scans the bot roster and looks for a stranger,
 * neither of which belongs here: the opponent is already known, and the
 * only question is whether their phone has arrived yet.
 *
 * So this shows the FRIEND, by name, and "Waiting for Marc…" until the
 * screen says `ready` (the server's `started`, from the live beat). Then
 * "MARC IS HERE!" for HERE_MS and `onDone`, which starts the countdown —
 * on both phones within about a second of each other.
 *
 * It never decides that the friend is not coming: the screen does that,
 * from the server's word or its own safety net (friendlyBattle.ts,
 * localWaitOver), so there is one place that goes back to the menu.
 * Cancel is always there, because a wait nobody can leave is a trap.
 *
 * Since 4 Nov 2026 it is also the room for a stranger the matchmaking
 * queue paired us with (`kind: 'match'`): the same wait, by the name
 * they chose, with its shorter MATCH_JOIN_WAIT_MS, and a battle that
 * counts like any other.
 *
 * And since 5 Nov 2026 the room a REMATCH is asked from (rematch.ts;
 * Marc: "it should have to wait for the other player too"). The screen
 * sits here with "Waiting for Marc…" from the moment it asks until the
 * other player answers, over `waitMs` (the rest of the ten-minute
 * window) rather than the join wait. If they decline, close the app or
 * let the ten minutes pass, the screen sets `gone`: the line becomes
 * "Marc has gone", and the one button goes back to the menu — nothing
 * starts against a bot.
 *
 * `onDone` fires exactly once, and not at all once unmounted.
 */
export function FriendlyWaitOverlay({
  opponent,
  kind = 'friend',
  ready,
  gone = false,
  waitMs,
  onDone,
  onCancel,
}: {
  opponent: AiOpponent;
  kind?: 'friend' | 'match';
  ready: boolean;
  /** They are not coming: say so, and offer only the way back. */
  gone?: boolean;
  /** How long the bar takes to fill; the join wait when not given. */
  waitMs?: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const startedAt = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;

  // The dots, and the bar filling over the server's wait.
  useEffect(() => {
    if (ready) return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt.current), DOT_TICK_MS);
    return () => clearInterval(id);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => done.current(), HERE_MS);
    return () => clearTimeout(id);
  }, [ready]);

  const waitProgress =
    waitMs !== undefined
      ? Math.min(1, Math.max(0, elapsed) / Math.max(1, waitMs))
      : kind === 'match'
        ? Math.min(1, Math.max(0, elapsed) / MATCH_JOIN_WAIT_MS)
        : joinProgress(elapsed);

  return (
    <View style={m.overlay}>
      <Text style={m.kicker}>YOUR OPPONENT</Text>

      <View style={[m.card, ready && m.cardFound]}>
        <RivalBadge name={opponent.name} />
        <Text style={[m.name, m.nameFound]} numberOfLines={1} adjustsFontSizeToFit>
          {opponent.name}
        </Text>
        <Text style={styles.tag}>
          {kind === 'match' ? 'Online battle · trophies count' : 'Friendly battle · no trophies'}
        </Text>
      </View>

      <Text style={m.footer} accessibilityLiveRegion="polite">
        {gone ? goneLine(opponent.name) : joinLine(opponent.name, ready ? 'here' : 'waiting', elapsed)}
      </Text>

      <View style={m.track}>
        <View style={[m.fill, { width: `${(gone ? 0 : ready ? 1 : waitProgress) * 100}%` }]} />
      </View>

      {!ready && (
        <SecondaryButton
          style={styles.cancel}
          onPress={() => {
            playClick();
            onCancel();
          }}
        >
          <Text style={styles.cancelText}>{gone ? BACK_TO_MENU : 'Cancel'}</Text>
        </SecondaryButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { ...TYPE.small, color: THEME.inkSoft, marginTop: 6, fontWeight: '700' },
  cancel: { marginTop: 26, minWidth: 160, paddingVertical: 12 },
  cancelText: { ...TYPE.body, color: THEME.ink, fontWeight: '800' },
});
