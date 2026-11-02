/**
 * Asking for an App Store rating: the link in Settings, and the rule for
 * Apple's own star prompt after a win.
 *
 * David, 2 Nov 2026: "build in the in game rate us", then "build 18 with
 * SKAN and the star prompt".
 *
 * NEVER A HOME-MADE POP-UP, and that is Apple's rule rather than a taste:
 * App Store Review Guideline 5.6.1 says apps must use Apple's own review
 * API to ask for a rating and that custom review prompts are not allowed.
 * So there are exactly two ways in:
 *
 *   1. "Rate Dice Battles" in Settings: a row the player chooses, which
 *      opens the App Store's own write-a-review page (REVIEW_URL). Plain
 *      React Native Linking, so it works on every build.
 *   2. Apple's star sheet (SKStoreReviewController, via expo-store-review)
 *      a few seconds after a win, decided by `shouldAskForReview` below.
 *      Native code: build 18 onwards, runtimeVersion 4.0.0
 *      (see storeReviewSdk.ts and askForReview.ts).
 *
 * This file is pure, with no React Native and no storage, so the tests
 * can check the rule directly.
 */
export const APP_STORE_ID = '6802287913';

export const REVIEW_URL = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;

/** Not before somebody has won a few games: a first-game prompt is a nag. */
export const WINS_BEFORE_FIRST_ASK = 3;

/**
 * At most one ask every four months. Apple shows the sheet at most three
 * times a year whatever an app asks for, and silently does nothing beyond
 * that; spacing them keeps each one for a real moment rather than burning
 * all three in the first week.
 */
export const DAYS_BETWEEN_ASKS = 120;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether to show Apple's star sheet now. The caller only asks after a
 * WIN, with no new reward pop-ups queued, and never in a friendly battle
 * or mid-round.
 */
export function shouldAskForReview(
  totalWins: number,
  lastAskedAt: number | null,
  now: number,
): boolean {
  if (!Number.isFinite(totalWins) || totalWins < WINS_BEFORE_FIRST_ASK) return false;
  if (lastAskedAt === null || !Number.isFinite(lastAskedAt)) return true;
  // A clock set backwards is not a reason to ask again.
  if (lastAskedAt > now) return false;
  return now - lastAskedAt >= DAYS_BETWEEN_ASKS * DAY_MS;
}
