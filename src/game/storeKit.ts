/**
 * THE IN-APP PURCHASE SWITCH. This file is the whole thing.
 *
 * It is `adSdk.ts` again, for the same reason and with the same rules —
 * and the reason is worth restating rather than cross-referencing,
 * because getting it wrong took the game down once already.
 *
 *   - Metro bundles a `require()` with a literal string by INCLUDING
 *     that module. While the line below is live, the StoreKit bridge
 *     ships in every over-the-air update, whether or not it is ever run.
 *   - A native module calls into the native side at module scope, which
 *     throws on any binary built before that module existed.
 *   - A `try`/`catch` around the require does NOT save you. Metro's
 *     loader catches the throw first and escalates it to a fatal. That
 *     is what crashed David's phone on 25 Aug 2026. See AGENTS.md.
 *
 * ── CURRENT STATE: OFF ────────────────────────────────────────────────
 *
 * The require is absent, so `expo-iap` is not in the bundle at all, and
 * this JavaScript is safe to send to every existing install. The whole
 * purchase system above it degrades to one honest state — "not available
 * on this phone yet" — rather than to a crash.
 *
 * Provable rather than argued:
 *
 *     npx expo export --platform ios --output-dir /tmp/export-test
 *     grep -c expo-iap /tmp/export-test/_expo/static/js/ios/*.hbc
 *
 * ── TURNING IT ON ─────────────────────────────────────────────────────
 *
 * All of these, in the SAME change, or not at all:
 *
 *   1. `npx expo install expo-iap` so the native module exists.
 *   2. Restore the require below.
 *   3. RAISE `runtimeVersion` in app.json — it is "2.0.0" as of the
 *      adverts build, so this becomes "3.0.0".
 *   4. Build, immediately.
 *
 * And one thing that is not code: every product id in `products.ts` has
 * to exist in App Store Connect first, or the phone asks StoreKit for
 * them and gets an empty list back. Only David can create those.
 *
 * `tests/purchases.test.ts` fails if the require and the runtime version
 * ever disagree, so this is checked rather than remembered.
 */

/**
 * The purchase library, or null on a build that does not contain it.
 *
 * Deliberately the only function here, and deliberately not clever: no
 * flags, no environment lookup, no conditional require. A switch you can
 * read in one glance is the point.
 */
export function loadStoreKit(): unknown | null {
  // PURCHASES OFF. To turn them on, install expo-iap, uncomment the next
  // line, RAISE runtimeVersion in app.json, and build — one change.
  //
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // return require('expo-iap');
  return null;
}
