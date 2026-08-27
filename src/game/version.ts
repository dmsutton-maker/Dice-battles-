/**
 * The version of the game, as a player sees it.
 *
 * This lives in the JavaScript bundle on purpose. `app.json`'s `version`
 * is the NATIVE version — it only changes when a whole new build goes to
 * Apple, which is a handful of times a year. Almost every change reaches
 * the family as an over-the-air update, where the native version cannot
 * move. It sat at 1.0.0 while the game was really on v1.11.8, so every
 * bug report arrived stamped with a version that had been wrong for
 * eleven releases.
 *
 * Because this constant ships inside the update, it is right the moment
 * the update lands.
 *
 * Keep it equal to the newest heading in CHANGELOG.md — `npm test`
 * enforces that, so a release that forgets to move it fails before it
 * can go out.
 */
export const GAME_VERSION = 'v1.61.1';
