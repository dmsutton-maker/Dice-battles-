import type { BattleHandle } from './battlesApi';
import type { ModeId } from './modes';
import { FRIENDLY_MODES } from './friendlyBattle';

/**
 * Who you are paired against, and how long the game looks before giving
 * up and using a bot.
 *
 * David asked on 9 Sep 2026 for a search of about fifteen seconds
 * looking for a real player, dropping to a bot if it finds nobody. Marc, 4 Nov 2026, made it real: "it should search for a player
 * for 15 seconds and it should say 'searching for opponent' or
 * something, and if it can't find a real person to verse after 15
 * seconds then it loads you against one of the bots".
 *
 * The search asks the HQ site's queue (`onlineMatch.ts`, /api/match),
 * and the battle it finds is played over the same live route as a
 * friend battle. Only Color Rush and Ultimate can be played that way
 * (friendlyBattle.ts, FRIENDLY_MODES), so the other modes never search.
 * There is no trophy floor any more (see below).
 *
 * THE HONEST PART. A player only waits when the server is really
 * looking. A site that answers "off", or cannot be reached, settles the
 * bot at once, with no fifteen-second act in front of it — the game
 * behaves exactly as it did before matchmaking existed. The order of a
 * search is written as a pure state machine in `matchFlow.ts`.
 */

/*
  NO TROPHY FLOOR, since 4 Nov 2026. David asked on 9 Sep 2026 for every
  game below 100 trophies to be against a bot (BOT_ONLY_BELOW_TROPHIES),
  so a beginner was never put in front of a stranger. Marc's instruction
  of 4 Nov 2026 supersedes it: "the online battle should be the dominant
  way to play ... the only way to play a bot should be if no real player
  is found in 15 seconds". Everybody searches. Practice against a bot is
  in Settings instead, and counts for nothing (stakes.ts).
*/

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
  /**
   * A mode that cannot be played live (Skirmish, Color War): a bot at
   * once, because there is no way to play it against a person yet.
   */
  | { kind: 'bot'; reason: 'not-live' }
  /** Practice from Settings: a bot on purpose, counting for nothing. */
  | { kind: 'bot'; reason: 'practice' }
  /** Looked, found nobody in time. */
  | { kind: 'bot'; reason: 'nobody-found' }
  /** The matchmaking service is off or out of reach, so there was nothing to look at. */
  | { kind: 'bot'; reason: 'no-service' }
  /** Somebody was found, but their phone never arrived in the room. */
  | { kind: 'bot'; reason: 'no-show' }
  /** The server paired us: a real person, in a live battle. */
  | { kind: 'player'; playerId: string; name: string; battle: BattleHandle };

/**
 * Does a battle in this mode search for a person? Color Rush and
 * Ultimate always do, whatever the trophies. Skirmish and Color War
 * cannot be played live today (friendlyBattle.ts, MODE_NOT_READY: one
 * shared jail, one shared board), so they go to a bot at once.
 */
export function searchesForPlayers(mode: ModeId): boolean {
  return FRIENDLY_MODES.includes(mode);
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
