/**
 * WHEN an ad may be shown. No React, no native module, no side effects —
 * just the rule, so it can be tested without a phone.
 *
 * David asked (24 Aug 2026) for an ad "every three games". That sentence
 * hides three decisions, and they are all here rather than scattered
 * through the screen that shows the ad:
 *
 *   1. It counts FINISHED games, not started ones. Quitting to the menu
 *      mid-round must not earn a step toward an ad, or the fastest way
 *      to an advert is to keep abandoning battles.
 *   2. The count survives closing the app, so the third game is the
 *      third game whether or not the phone was put down in between.
 *   3. The FIRST game a player ever plays is never interrupted. Somebody
 *      deciding whether they like this game should see the game.
 */

/** How many finished games between ads. */
export const GAMES_PER_AD = 3;

/**
 * Games that must be finished before the first ad is ever shown.
 *
 * Set to GAMES_PER_AD so a brand-new player gets three clean games. The
 * store listing promises a family game, and an advert in the first
 * minute is how a five-year-old's first impression becomes an advert.
 */
export const GAMES_BEFORE_FIRST_AD = GAMES_PER_AD;

/**
 * Should an ad be shown now that `gamesFinished` games are complete?
 *
 * `gamesFinished` is the running total for this device, already including
 * the game that has just ended.
 */
export function shouldShowAd(gamesFinished: number): boolean {
  if (!Number.isFinite(gamesFinished)) return false;
  if (gamesFinished < GAMES_BEFORE_FIRST_AD) return false;
  return gamesFinished % GAMES_PER_AD === 0;
}

/**
 * How many more finished games until the next ad. Only used to decide
 * when to start LOADING one — an interstitial takes a moment to fetch,
 * and an ad that is not ready when its turn comes is simply skipped.
 */
export function gamesUntilAd(gamesFinished: number): number {
  if (!Number.isFinite(gamesFinished) || gamesFinished < 0) return GAMES_PER_AD;
  const next = Math.max(
    GAMES_BEFORE_FIRST_AD,
    (Math.floor(gamesFinished / GAMES_PER_AD) + 1) * GAMES_PER_AD,
  );
  return next - gamesFinished;
}
