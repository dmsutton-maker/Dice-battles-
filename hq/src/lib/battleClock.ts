/**
 * The friendly-battle clock, as the server keeps it.
 *
 * David, 1 Nov 2026: "Add a two minute thirty second timer and if the
 * game doesn't finish by then it is a tie if the score is tied, or a win
 * for whoever is winning at that moment."
 *
 * THE SERVER IS THE CLOCK in a friendly battle, not either phone. Two
 * phones each deciding for themselves at 0:00 would disagree whenever a
 * roll landed in the last second on one of them, and an app from before
 * the clock existed would never stop at all. So the battle row's own
 * `started_at` is the start of the clock, both phones are told how much
 * is left on every beat, and whichever beat first arrives after the end
 * (plus a little grace) closes the battle by the score stored at that
 * moment. Old apps are ended by the same rule without knowing it.
 *
 * Pure, with no Next.js or Supabase import, so the game's headless tests
 * can check it (tests/battleTimer.test.ts). The game cannot be imported
 * from here, so the two numbers the game also has are copied and the
 * test fails if they drift apart.
 */

/** Two and a half minutes. Must equal BATTLE_TIME_MS in src/game/tuning.ts. */
export const BATTLE_TIME_MS = 150_000;

/**
 * Between the battle row being written and the dice being live.
 *
 * `started_at` is stamped again at the moment BOTH phones have arrived in
 * the waiting room (since 1 Nov 2026 — see JOIN_WAIT_MS below), and the
 * phones then show the opponent reveal (2.2 s, MATCH_TOTAL_MS in
 * src/game/matchmaking.ts) and the "ARM YOUR DICE! / BATTLE!" countdown
 * (1.8 s, beginCountdown in DiceDemoScreen) before anybody can roll.
 * Starting the clock at that moment would quietly take four seconds off
 * every friendly battle.
 */
export const BATTLE_LEAD_MS = 4_000;

/**
 * How long after 0:00 the server waits before closing a battle.
 *
 * A roll that landed at 2:29.9 on a phone is only reported on that
 * phone's next beat, up to a second later, and the beat itself takes a
 * moment to arrive over a phone connection. Three seconds covers a beat
 * and a slow round trip, so a rescue made in time counts, while being
 * short enough that nobody sits on "Time's up!" wondering what happened.
 * A phone that has stopped at 0:00 (every app with the clock) sends no
 * new rescues in this window; an older app may, by up to three seconds.
 */
export const BATTLE_GRACE_MS = 3_000;

/**
 * Written to `winner` when time ran out with the score level. The column
 * is free text and otherwise holds a player_id, all of which begin
 * `local-`, so this cannot be mistaken for a player. Must equal
 * TIE_WINNER in src/game/battleTimer.ts.
 */
export const TIE_WINNER = 'tie';

/** Milliseconds left on the clock the phones show, never below 0. */
export function battleMsLeft(startedAtMs: number, nowMs: number): number {
  if (!Number.isFinite(startedAtMs)) return BATTLE_TIME_MS;
  const left = startedAtMs + BATTLE_LEAD_MS + BATTLE_TIME_MS - nowMs;
  return Math.max(0, Math.min(BATTLE_TIME_MS, left));
}

/** Has the battle run past its clock AND the grace after it? */
export function pastBattleTime(startedAtMs: number, nowMs: number): boolean {
  if (!Number.isFinite(startedAtMs)) return false;
  return nowMs >= startedAtMs + BATTLE_LEAD_MS + BATTLE_TIME_MS + BATTLE_GRACE_MS;
}

/**
 * Who has won a battle whose time is up, or null while it is still on.
 *
 * The score is the number of colours each side has freed — exactly the
 * number on both scoreboards in the two modes a friend can be battled in
 * (Color Rush and Ultimate, see src/game/friendlyBattle.ts). In Ultimate
 * that count can go down; the count stored at the end is the standing at
 * the end, which is the rule as asked.
 */
export function timeoutWinner(battle: {
  startedAtMs: number;
  nowMs: number;
  aId: string;
  bId: string;
  aFreed: unknown;
  bFreed: unknown;
}): string | null {
  if (!pastBattleTime(battle.startedAtMs, battle.nowMs)) return null;
  // Distinct colours: the same colour reported twice is still one rescue.
  const count = (v: unknown) =>
    Array.isArray(v) ? new Set(v.filter((x) => typeof x === 'string')).size : 0;
  const a = count(battle.aFreed);
  const b = count(battle.bFreed);
  if (a > b) return battle.aId;
  if (b > a) return battle.bId;
  return TIE_WINNER;
}

/**
 * How long a battle room waits for the second phone before giving up.
 * Must equal JOIN_WAIT_MS in src/game/friendlyBattle.ts.
 *
 * David, 1 Nov 2026: "Fix the versus against friends because it doesn't
 * connect and it's not actually against each other." A battle row is now
 * born 'waiting' and only turns 'playing' once BOTH phones have said "I
 * am here" (../app/api/battles/live). A friend who never turns up — the
 * phone was put down, the app was closed between Accept and the room —
 * must not leave the other child staring at "Waiting for Marc…" for
 * ever, so after this long the room is closed with no winner.
 */
export const JOIN_WAIT_MS = 30_000;

/**
 * Has this phone arrived in the room? Their `*_seen` strictly later
 * than the row's `started_at`.
 *
 * That is how the waiting room works without a new column. The accept
 * writes `started_at`, `a_seen` and `b_seen` as one and the same instant,
 * and every real beat stamps its own `*_seen` at least a moment later —
 * so "later than the start" means "has beaten at least once", and equal
 * means "has never spoken". Anything unreadable has not arrived.
 */
export function hasArrived(seenMs: number, startedAtMs: number): boolean {
  return Number.isFinite(seenMs) && Number.isFinite(startedAtMs) && seenMs > startedAtMs;
}

/**
 * Has a waiting room been waiting longer than JOIN_WAIT_MS?
 *
 * Unlike the battle clock, a room with no readable start is treated as
 * over: it can never be started either (hasArrived needs the start), so
 * closing it is the only way it stops being handed to the game.
 */
export function joinWindowOver(startedAtMs: number, nowMs: number): boolean {
  if (!Number.isFinite(startedAtMs)) return true;
  return nowMs - startedAtMs > JOIN_WAIT_MS;
}
