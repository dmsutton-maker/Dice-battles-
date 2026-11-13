/**
 * The game's App Store listing, in one place.
 *
 * LAUNCH DAY: flip `APP_STORE_LIVE` to true and deploy. That turns on two
 * things together: the "Download on the App Store" button on the game's
 * page, and Apple's Smart App Banner (the `apple-itunes-app` meta tag), which
 * offers the app to iPhone visitors across the site.
 *
 * It stays false until Apple has approved the app and it is actually for
 * sale. Before then the link opens a "not available" page, and a banner
 * offering an app nobody can get is worse than no banner.
 *
 * The button is plain text in the site's own style, not Apple's badge
 * artwork. Apple's marketing guidelines allow the words "Download on the
 * App Store" as a text link; the official badge can replace it later.
 */
export const APP_STORE_ID = '6802287913';

export const APP_STORE_LIVE = false;

export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;

/**
 * Vector Faces, our Apple Watch app, has its own listing and its own switch.
 *
 * LAUNCH DAY: flip `VECTOR_FACES_LIVE` to true and deploy. That turns the
 * "Coming soon to the App Store" line on /apps/vector-faces into the same
 * "Download on the App Store" text link the Dice Battles page has.
 *
 * It stays false until Apple has approved the app and it is actually for
 * sale, for the same reason as above. It does not touch the Smart App
 * Banner below, which belongs to Dice Battles.
 */
export const VECTOR_FACES_APP_STORE_ID = '6832990414';

export const VECTOR_FACES_LIVE = true;

export const VECTOR_FACES_APP_STORE_URL = `https://apps.apple.com/app/id${VECTOR_FACES_APP_STORE_ID}`;

/** The meta tag Safari reads to show the Smart App Banner, or nothing before launch. */
export const smartAppBanner: Record<string, string> = APP_STORE_LIVE
  ? { 'apple-itunes-app': `app-id=${APP_STORE_ID}` }
  : {};
