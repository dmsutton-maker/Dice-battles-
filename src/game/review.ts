/**
 * Where "Rate Dice Battles" in Settings sends a player.
 *
 * David, 2 Nov 2026: "build in the in game rate us."
 *
 * A ROW, NOT A POP-UP, and that is Apple's rule rather than a taste:
 * App Store Review Guideline 5.6.1 says apps must use Apple's own review
 * API to ask for a rating and that custom review prompts are not allowed.
 * A home-made "Enjoying the game? Rate us!" popup is exactly what it bans.
 * A row a player chooses to tap, which opens the App Store's own
 * write-a-review page, is the ordinary allowed thing.
 *
 * Apple's in-game prompt (SKStoreReviewController, the small star sheet
 * after a win) is native code: it needs `expo-store-review`, a raised
 * `runtimeVersion` and a new build, all in one change (see AGENTS.md on
 * native code). It is planned for the first build after launch and does
 * not ride an over-the-air update.
 *
 * Plain React Native `Linking` opens this, so it ships over the air to
 * builds 16 and 17 with no native change. Before the app is live the
 * App Store shows "not available" for it, which only TestFlight testers
 * can ever see.
 */
export const APP_STORE_ID = '6802287913';

export const REVIEW_URL = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
