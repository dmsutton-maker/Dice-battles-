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
 * ── CURRENT STATE: OFF ────────────────────────────────────────────────
 *
 * The require is absent, so the ad SDK is not in the bundle at all. This
 * is provable rather than argued: build the bundle and grep it.
 *
 *     npx expo export --platform ios --output-dir /tmp/export-test
 *     grep -c RNGoogleMobileAds /tmp/export-test/_expo/static/js/ios/*.hbc
 *
 * That is why over-the-air updates can go out to build 6, which has no ad
 * SDK compiled into it, and why `runtimeVersion` is back on the sdkVersion
 * policy. The family gets fixes now; ads wait for a binary.
 *
 * ── TURNING IT ON ─────────────────────────────────────────────────────
 *
 * Both halves, in the SAME change, or not at all:
 *
 *   1. Restore the require (the commented line in `loadAdSdk` below).
 *   2. Set `runtimeVersion` in app.json to an explicit "1.1.0".
 *
 * Then BUILD. Until that binary exists and is installed, every old
 * install correctly stays on the last update matching its runtime.
 *
 * Doing (1) without (2) ships the crash again. `tests/ads.test.ts` fails
 * if the two ever disagree, so this is checked rather than remembered.
 */

/**
 * The ad SDK, or null on a build that does not contain it.
 *
 * Deliberately the only function here, and deliberately not clever: no
 * flags, no environment lookup, no conditional require. A switch you can
 * read in one glance is the point.
 */
export function loadAdSdk(): unknown | null {
  // ADS OFF. To turn them on, uncomment the next line AND set
  // runtimeVersion to "1.1.0" in app.json, in the same change.
  //
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // return require('react-native-google-mobile-ads');
  return null;
}
