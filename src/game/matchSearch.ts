/**
 * Who you are paired against, and how long the game looks before giving
 * up and using a bot.
 *
 * David asked on 9 Sep 2026 for two things: every game below 100
 * trophies against a bot, and above that a search that counts up to
 * about fifteen seconds looking for a real player, dropping to a bot if
 * it finds nobody.
 *
 * THE HONEST STATE OF THIS. There is no online play in this game. There
 * is no matchmaking server, no shared round, no way for two phones to
 * roll against each other — `matchmaking.ts` has said so in its own
 * header since it was written, and deliberately never used the words
 * "searching for players online" because that would be a promise the
 * game cannot keep to people who include five-year-olds.
 *
 * So this file is the whole rule, written properly and tested, with the
 * one step it cannot do yet behind a switch: `onlineMatch.ts` answers
 * "is anybody there?" and currently answers "no service" immediately.
 * That is the same two-state pattern the adverts and the purchases use.
 *
 * While the switch is off, a player never waits fifteen seconds for an
 * answer that was never coming — the search ends the moment the lookup
 * says there is nobody to look for, and the round starts against a bot
 * with the wording it has always had. The countdown, the fallback and
 * the trophy floor all become real the day a server exists, without
 * anything here changing.
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

export type Pairing =
  /** Too few trophies to be matched with a person at all. */
  | { kind: 'bot'; reason: 'below-threshold' }
  /** Looked, found nobody in time. */
  | { kind: 'bot'; reason: 'nobody-found' }
  /** No matchmaking service in this build, so there was nothing to look at. */
  | { kind: 'bot'; reason: 'no-service' }
  | { kind: 'player'; playerId: string; name: string };

/** Does this player get a search at all? */
export function searchesForPlayers(trophies: number): boolean {
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
