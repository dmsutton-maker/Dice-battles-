import type { BattleHandle } from './battlesApi';
import type { ModeId } from './modes';
import { FRIENDLY_MODES } from './friendlyBattle';

/**
 * Who you are paired against, and how long the game looks before giving
 * up and using a bot.
 *
 * David asked on 9 Sep 2026 for two things: every game below 100
 * trophies against a bot, and above that a search of about fifteen
 * seconds looking for a real player, dropping to a bot if it finds
 * nobody. Marc, 4 Nov 2026, made it real: "it should search for a player
 * for 15 seconds and it should say 'searching for opponent' or
 * something, and if it can't find a real person to verse after 15
 * seconds then it loads you against one of the bots".
 *
 * The search asks the HQ site's queue (`onlineMatch.ts`, /api/match),
 * and the battle it finds is played over the same live route as a
 * friend battle. Only Color Rush and Ultimate can be played that way
 * (friendlyBattle.ts, FRIENDLY_MODES), so the other modes never search.
 *
 * THE HONEST PART. A player only waits when the server is really
 * looking. A site that answers "off" settles the bot at once, with no
 * fifteen-second act in front of it — the game behaves exactly as it did
 * before matchmaking existed — and is not asked again for
 * `SERVICE_OFF_REMEMBER_MS`. A request that simply fails is asked again
 * until the deadline, because an unanswered question is not an answer.
 * The order of a search is written as a pure state machine in
 * `matchFlow.ts`.
 */

/**
 * Below this many trophies, no search happens at all: it is a bot, every
 * time, and the battle counts exactly like any other (stakes.ts).
 *
 * The point is the first hour. A beginner put in front of a stranger
 * loses, and losing your first few games to someone who already owns the
 * ladder is how somebody stops playing. 100 is also where the first
 * trophy reward already sits, so "you are ready for other people" lands
 * on a moment the game already treats as an arrival.
 *
 * David set it on 9 Sep 2026. Marc's "the online battle should be the
 * dominant way to play" (4 Nov 2026) removed it for a moment; Marc the
 * same day: "no, until 100 trophies should always be against bots". So
 * online is the dominant way to play FROM 100 trophies, and practice
 * against a bot is in Settings for anybody, counting for nothing.
 */
export const BOT_ONLY_BELOW_TROPHIES = 100;

/** How long to look before settling for a bot. David: "roughly 15 seconds". */
export const SEARCH_DEADLINE_MS = 15_000;

/** How often the search asks again while it waits. */
export const SEARCH_POLL_MS = 900;

/**
 * How long an `off` from the server is remembered, so the next start in
 * that time goes to a rival without asking. A minute, not the session.
 *
 * Marc, 5 Nov 2026: "When I have admin on and I try to load into a game
 * it first says it's matching me against a bot, but it shouldn't." The
 * switch used to latch off for the rest of the session on the first
 * `off`, and a network blip, a wrong secret or a server error were all
 * read as `off` (battlesApi.ts): one of them, and nobody was searched
 * for again until the app restarted. Only the server's own `off` counts
 * now, and only for this long, which is enough to spare a site without
 * the migration a question on every start without silencing the search
 * for good.
 */
export const SERVICE_OFF_REMEMBER_MS = 60_000;

/**
 * How long a matched opponent has to arrive in the room. Somebody the
 * server paired us with whose phone never shows up means a bot, not a
 * long wait for a stranger.
 */
export const MATCH_JOIN_WAIT_MS = 10_000;

export type Pairing =
  /** Too few trophies to be matched with a person at all. */
  | { kind: 'bot'; reason: 'below-threshold' }
  /**
   * A mode that cannot be played live (Skirmish, Color War): a bot at
   * once, because there is no way to play it against a person yet.
   */
  | { kind: 'bot'; reason: 'not-live' }
  /** Practice from Settings: a bot on purpose, counting for nothing. */
  | { kind: 'bot'; reason: 'practice' }
  /** Looked, found nobody in time (or the server never answered). */
  | { kind: 'bot'; reason: 'nobody-found' }
  /** The server said the matchmaking service is off, so there was nothing to look at. */
  | { kind: 'bot'; reason: 'no-service' }
  /** Somebody was found, but their phone never arrived in the room. */
  | { kind: 'bot'; reason: 'no-show' }
  /** The server paired us: a real person, in a live battle. */
  | { kind: 'player'; playerId: string; name: string; battle: BattleHandle };

/**
 * Does this battle search for a person? Not below the trophy floor, and
 * not in Skirmish or Color War, which cannot be played live today
 * (friendlyBattle.ts, MODE_NOT_READY: one shared jail, one shared board).
 * Color Rush and Ultimate from 100 trophies always do.
 */
export function searchesForPlayers(trophies: number, mode: ModeId): boolean {
  return trophies >= BOT_ONLY_BELOW_TROPHIES && FRIENDLY_MODES.includes(mode);
}

/** Why a battle that does not search goes to a bot — the floor first. */
export function whyNoSearch(trophies: number, mode: ModeId): 'below-threshold' | 'not-live' | null {
  if (trophies < BOT_ONLY_BELOW_TROPHIES) return 'below-threshold';
  if (!FRIENDLY_MODES.includes(mode)) return 'not-live';
  return null;
}

/**
 * Why this round is against a rival, as one small line for FAMILY TESTER
 * MODE ONLY — so Marc can read off the overlay which road led to the
 * bot (5 Nov 2026: "it first says it's matching me against a bot, but it
 * shouldn't"). The reason code first, then what it means where that is
 * not obvious. Never shown to an ordinary player.
 */
export function rivalReasonText(reason: Extract<Pairing, { kind: 'bot' }>['reason'], trophies: number): string {
  if (reason === 'no-service') return 'rival: no-service — server said off';
  if (reason === 'below-threshold') return `rival: below-threshold ${trophies} of ${BOT_ONLY_BELOW_TROPHIES}`;
  if (reason === 'not-live') return 'rival: not-live — this mode cannot be played live';
  return `rival: ${reason}`;
}

/**
 * The seconds a player sees while waiting: 0 at the start, counting up,
 * and never past the deadline even if a slow frame overshoots it.
 */
export function secondsShown(elapsedMs: number): number {
  const capped = Math.min(Math.max(0, elapsedMs), SEARCH_DEADLINE_MS);
  return Math.floor(capped / 1000);
}

/**
 * The countdown a player sees while searching: 15 at the start, down to
 * 0 at the deadline, and never below it.
 */
export function secondsLeft(elapsedMs: number): number {
  const capped = Math.min(Math.max(0, elapsedMs), SEARCH_DEADLINE_MS);
  return Math.ceil((SEARCH_DEADLINE_MS - capped) / 1000);
}

/** Has the search run out of time? */
export function isSearchOver(elapsedMs: number): boolean {
  return elapsedMs >= SEARCH_DEADLINE_MS;
}

/**
 * How far round the ring the wait has got, 0 to 1. Used for the timer
 * rather than a bare number, because a bar that visibly fills is a much
 * calmer thing to watch than a count that might not end.
 */
export function searchProgress(elapsedMs: number): number {
  return Math.min(1, Math.max(0, elapsedMs) / SEARCH_DEADLINE_MS);
}
