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
 * looking. A site that answers "off", or cannot be reached, settles the
 * bot at once, with no fifteen-second act in front of it — the game
 * behaves exactly as it did before matchmaking existed. The order of a
 * search is written as a pure state machine in `matchFlow.ts`.
 */

/**
 * Below this many trophies, no search happens at all: it is a bot, every
 * time.
 *
 * The point is the first hour. A beginner put in front of a stranger
 * loses, and losing your first few games to someone who already owns the
 * ladder is how somebody stops playing. 100 is also where the first
 * trophy reward already sits, so "you are ready for other people" lands
 * on a moment the game already treats as an arrival.
 */
export const BOT_ONLY_BELOW_TROPHIES = 100;

/** How long to look before settling for a bot. David: "roughly 15 seconds". */
export const SEARCH_DEADLINE_MS = 15_000;

/** How often the search asks again while it waits. */
export const SEARCH_POLL_MS = 900;

/**
 * How long a matched opponent has to arrive in the room. Somebody the
 * server paired us with whose phone never shows up means a bot, not a
 * long wait for a stranger.
 */
export const MATCH_JOIN_WAIT_MS = 10_000;

export type Pairing =
  /** Too few trophies to be matched with a person at all. */
  | { kind: 'bot'; reason: 'below-threshold' }
  /** Looked, found nobody in time. */
  | { kind: 'bot'; reason: 'nobody-found' }
  /** The matchmaking service is off or out of reach, so there was nothing to look at. */
  | { kind: 'bot'; reason: 'no-service' }
  /** Somebody was found, but their phone never arrived in the room. */
  | { kind: 'bot'; reason: 'no-show' }
  /** The server paired us: a real person, in a live battle. */
  | { kind: 'player'; playerId: string; name: string; battle: BattleHandle };

/**
 * Does this player get a search at all? Not below the floor, and not in
 * a mode that cannot be played against a person over a connection.
 */
export function searchesForPlayers(trophies: number, mode?: ModeId): boolean {
  if (mode !== undefined && !FRIENDLY_MODES.includes(mode)) return false;
  return trophies >= BOT_ONLY_BELOW_TROPHIES;
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
