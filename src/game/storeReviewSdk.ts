/**
 * THE STORE REVIEW SWITCH. Built the same way as `adSdk.ts` and
 * `pushSdk.ts`, because it has the same hazard.
 *
 * `expo-store-review` calls `requireNativeModule('ExpoStoreReview')` at
 * module scope, which throws on any binary built before the package was
 * added. A try/catch around the require does NOT save such a binary:
 * Metro's loader turns the throw into a red screen first (AGENTS.md, 25
 * Aug 2026). The only real gate is `runtimeVersion`.
 *
 * ── CURRENT STATE: ON (2 Nov 2026, runtimeVersion 4.0.0, build 18) ───
 *
 * Switched on in the same change that raised runtimeVersion from 3.0.0
 * to 4.0.0 and made build 18, at David's request ("build 18 with SKAN
 * and the star prompt"). Builds 16 and 17 are on runtime 3.0.0, so this
 * JavaScript never reaches them: they stay on the last update made for
 * 3.0.0, which is correct.
 *
 * Turning it OFF again: comment the require out. runtimeVersion stays
 * where it is (it only ever goes up).
 */
export function loadStoreReviewSdk(): unknown | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('expo-store-review');
}
