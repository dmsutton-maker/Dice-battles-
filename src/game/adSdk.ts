/**
 * THE AD SDK SWITCH. This file is the whole thing.
 *
 * It has exactly two states, and the ONLY difference between them is
 * whether the line `require('react-native-google-mobile-ads')` appears
 * below. That matters more than it looks:
 *
 *   - Metro bundles a `require()` with a literal string by INCLUDING that
 *     module in the bundle. So while the line is here, the ad SDK's code
 *     ships in every over-the-air update, whether or not it is ever run.
 *   - The SDK calls `TurboModuleRegistry.getEnforcing` at module scope,
 *     which throws on any binary built before the SDK was added.
 *   - A `try`/`catch` around the require does NOT save you. Metro's loader
 *     catches the throw first and escalates it to a fatal — this is what
 *     crashed David's phone on 25 Aug 2026. See AGENTS.md.
 *
 * ── CURRENT STATE: ON ─────────────────────────────────────────────────
 *
 * The require is present, so the ad SDK ships in every over-the-air
 * update, and `runtimeVersion` in app.json is an explicit string so those
 * updates only reach binaries that have the native side compiled in.
 *
 * This block said OFF until 11 Sep 2026, long after the require was
 * restored. Nobody had read it against the code below it, and a comment
 * that confidently describes the opposite of what the file does is worse
 * than no comment: it is what you check when you are asking "why are
 * there no ads", and it answers wrongly and with certainty.
 *
 * Provable rather than argued, either way — build the bundle and grep it:
 *
 *     npx expo export --platform ios --output-dir /tmp/export-test
 *     grep -c RNGoogleMobileAds /tmp/export-test/_expo/static/js/ios/*.hbc
 *
 * ── TURNING IT OFF AGAIN ──────────────────────────────────────────────
 *
 * Both halves, in the SAME change, or not at all:
 *
 *   1. Comment the require out of `loadAdSdk` below.
 *   2. Return `runtimeVersion` in app.json to the sdkVersion policy.
 *
 * Turning it back ON is the same two in reverse, followed immediately by
 * a BUILD: until that binary exists and is installed, every old install
 * correctly stays on the last update matching its runtime. Restoring the
 * require without pinning the runtime ships the crash again.
 * `tests/ads.test.ts` fails if the two ever disagree, so this is checked
 * rather than remembered.
 */

/**
 * The ad SDK, or null on a build that does not contain it.
 *
 * Deliberately the only function here, and deliberately not clever: no
 * flags, no environment lookup, no conditional require. A switch you can
 * read in one glance is the point.
 */
export function loadAdSdk(): unknown | null {
  // ADS ON. To turn them off, comment the next line out AND return
  // runtimeVersion to the sdkVersion policy, in the same change.
  //
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('react-native-google-mobile-ads');
}
