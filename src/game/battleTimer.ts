import { BATTLE_FINAL_MS, BATTLE_TIME_MS } from './tuning';
import type { ModeId, PrisonerUnit } from './modes';
import type { PrisonerColorId } from './colors';

/**
 * The battle clock, as pure rules.
 *
 * David, 1 Nov 2026: "Add a two minute thirty second timer and if the
 * game doesn't finish by then it is a tie if the score is tied, or a win
 * for whoever is winning at that moment."
 *
 * Kept free of any react-native import so the headless tests can check
 * it without a device, the same split as safeAreaRules.ts / safeArea.ts.
 * The screens (DiceDemoScreen, TwoPlayerScreen) and the clock on the
 * scoreboard (src/demo/BattleClock.tsx) only call into this.
 */

export type BattleOutcome = 'won' | 'lost' | 'tie';

/**
 * Who wins when the clock runs out: whoever is ahead, and a tie when
 * level. That is the whole of David's rule, and it is the same rule a
 * Skirmish already used when its jail empties.
 */
export function timeUpOutcome(mine: number, theirs: number): BattleOutcome {
  if (mine > theirs) return 'won';
  if (mine < theirs) return 'lost';
  return 'tie';
}

/**
 * The two numbers on the scoreboard, worked out from the board.
 *
 * ONE function for both the scoreboard and the time-up decision, so the
 * result can never disagree with the numbers the player was looking at
 * when the clock ran out. Each mode's score is a fair measure of who is
 * ahead, which is why no mode needs a special rule:
 *
 * - Color Rush: prisoners rescued, out of six, against the opponent's
 *   six. Both only go up.
 * - Ultimate: the same count, which can go DOWN when an exchange sends
 *   one back. The score at the moment the clock stops is the standing
 *   at that moment, which is exactly what was asked for.
 * - Skirmish: prisoners grabbed from the one shared jail, yours against
 *   theirs. It already ended this way when the jail emptied.
 * - Color War: how many of your own three colour you have rescued
 *   against how many of theirs. Out of three, so a tie at time-up is
 *   more likely here than anywhere, and that is honest: one each IS
 *   level.
 */
export function battleScores(
  mode: ModeId,
  units: PrisonerUnit[],
  aiFreed: readonly PrisonerColorId[],
  war: { player: { id: PrisonerColorId }; ai: { id: PrisonerColorId } } | null,
): { player: number; ai: number } {
  const inRetreat = (colorId: PrisonerColorId) =>
    units.filter((u) => u.station.kind === 'retreat' && u.colorId === colorId).length;
  if (mode === 'colorwar') {
    return war
      ? { player: inRetreat(war.player.id), ai: inRetreat(war.ai.id) }
      : { player: 0, ai: 0 };
  }
  const player = units.filter((u) => u.station.kind === 'retreat').length;
  const ai =
    mode === 'skirmish'
      ? units.filter((u) => u.station.kind === 'wall').length
      : aiFreed.length;
  return { player, ai };
}

/**
 * Whole seconds left, ROUNDED UP. A countdown that showed 0:00 while
 * there was still most of a second to play would be telling a child the
 * game is over when it is not; rounding up means 0:00 appears at the
 * exact moment time runs out and not before.
 */
export function shownSeconds(msLeft: number): number {
  if (!Number.isFinite(msLeft) || msLeft <= 0) return 0;
  return Math.ceil(msLeft / 1000);
}

/** "2:30", "0:09", "0:00" — minutes, then two-digit seconds. */
export function formatClock(msLeft: number): string {
  const s = shownSeconds(msLeft);
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

/** The same, said out loud for VoiceOver: "2 minutes 30 seconds left". */
export function clockWords(msLeft: number): string {
  const s = shownSeconds(msLeft);
  if (s === 0) return "Time's up";
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  if (seconds > 0) parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
  return `${parts.join(' ')} left`;
}

/** The last ten seconds, when the clock turns red and ticks. */
export function inFinalSeconds(msLeft: number): boolean {
  return msLeft > 0 && msLeft <= BATTLE_FINAL_MS;
}

/**
 * A clock that can be paused.
 *
 * `spentMs` is the time already used up while it was running; `since`
 * is when it last started running, or null while it is stopped. Kept as
 * plain data so a screen can hold it in a ref and the tests can walk it
 * through a pocket and back without waiting for real time to pass.
 */
export interface ClockState {
  limitMs: number;
  spentMs: number;
  since: number | null;
}

export function newClock(limitMs: number = BATTLE_TIME_MS): ClockState {
  return { limitMs, spentMs: 0, since: null };
}

export function runClock(clock: ClockState, now: number): ClockState {
  return clock.since === null ? { ...clock, since: now } : clock;
}

export function pauseClock(clock: ClockState, now: number): ClockState {
  if (clock.since === null) return clock;
  return { ...clock, spentMs: clock.spentMs + Math.max(0, now - clock.since), since: null };
}

export function clockLeft(clock: ClockState, now: number): number {
  const running = clock.since === null ? 0 : Math.max(0, now - clock.since);
  return Math.max(0, clock.limitMs - clock.spentMs - running);
}

/**
 * Set the clock to what the friendly-battle server says is left.
 *
 * The server's word is final in a friendly battle (it is the one that
 * ends it, so both phones agree), but it arrives once a second with a
 * little network delay on it. Taking every answer as gospel would make
 * the seconds stutter back and forth; within `toleranceMs` the phone's
 * own smooth count is kept.
 */
export function syncClock(
  clock: ClockState,
  serverMsLeft: number,
  now: number,
  toleranceMs = 750,
): ClockState {
  if (!Number.isFinite(serverMsLeft)) return clock;
  const target = Math.min(clock.limitMs, Math.max(0, serverMsLeft));
  if (Math.abs(clockLeft(clock, now) - target) <= toleranceMs) return clock;
  const running = clock.since === null ? 0 : Math.max(0, now - clock.since);
  return { ...clock, spentMs: clock.limitMs - target - running };
}

/**
 * What the friendly-battle server writes in `winner` when time ran out
 * level. The column is free text (hq/supabase/schema.sql) and otherwise
 * holds a player_id, which can never be this word: every id this game
 * hands out begins `local-` (playerIdentity.ts). Kept in
 * step with hq/src/lib/battleClock.ts by tests/battleTimer.test.ts.
 */
export const TIE_WINNER = 'tie';

/** A friendly battle's result, from this phone's side of it. */
export function friendlyVerdict(winner: string, me: string): BattleOutcome {
  if (winner === TIE_WINNER) return 'tie';
  return winner === me ? 'won' : 'lost';
}

/**
 * How long a phone whose friendly-battle clock has run out waits for the
 * server's verdict before deciding for itself from the score it can see.
 *
 * The server ends the battle on the first beat after its grace period
 * (hq/src/lib/battleClock.ts, BATTLE_GRACE_MS, 3 s) and each phone beats
 * once a second, so an answer is normally back within about four
 * seconds. Eight leaves room for a slow connection, and only counts
 * while the game is on screen. Without it, a phone that had lost its
 * connection would sit on "Time's up!" for ever.
 */
export const FRIENDLY_VERDICT_WAIT_MS = 8_000;
