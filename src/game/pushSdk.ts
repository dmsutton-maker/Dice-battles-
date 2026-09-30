/**
 * THE PUSH SWITCH. This file is the whole thing.
 *
 * It has exactly two states, and the ONLY difference between them is
 * whether the line `require('expo-notifications')` appears below. It is
 * built the same way as `adSdk.ts` because it has the same hazard, and
 * that hazard has already crashed this game once (25 Aug 2026, see
 * AGENTS.md):
 *
 *   - Metro bundles a `require()` with a literal string by INCLUDING
 *     that module in the bundle. While the line is here, the module
 *     ships in every over-the-air update, whether or not it ever runs.
 *   - expo-notifications reaches for its native side at module scope,
 *     which throws on any binary built before it was added.
 *   - A `try`/`catch` around the require does NOT save you. Metro's
 *     loader catches the throw first and escalates it to a red screen.
 *
 * ── CURRENT STATE: OFF ────────────────────────────────────────────────
 *
 * The require is commented out and `expo-notifications` is NOT in
 * package.json, so nothing about notifications is in the bundle and
 * `runtimeVersion` correctly stays where it is. Every over-the-air
 * update still reaches every install.
 *
 * WHY IT IS OFF. David asked for this on 25 Sep 2026 and everything
 * around it is finished and deployed: the `push_tokens` table, the
 * register endpoint, the announce endpoint, and `src/game/push.ts`
 * below. The one remaining step needs a NEW BINARY, and a build cannot
 * be made from a session — `eas build --non-interactive` stops at
 * "Distribution Certificate is not validated for non-interactive
 * builds", which needs a person at a terminal.
 *
 * Turning it on without that build would not merely fail to work. It
 * would raise `runtimeVersion`, which is what correctly stops new
 * JavaScript reaching binaries that cannot run it — and with no new
 * binary in existence, that means the family stops receiving updates
 * entirely, silently, until somebody manages a build. Shipping a
 * feature nobody can use AND freezing everything else is worse than
 * waiting.
 *
 * ── TURNING IT ON ─────────────────────────────────────────────────────
 *
 * All five, in the SAME change, or not at all:
 *
 *   1. `npx expo install expo-notifications`
 *   2. Uncomment the require in `loadPushSdk` below.
 *   3. Add the `expo-notifications` plugin to `app.json`.
 *   4. RAISE `runtimeVersion` in app.json — it is an explicit string
 *      already, so 2.0.0 becomes 3.0.0.
 *   5. Build, and submit. Not "soon": until that binary exists and is
 *      installed, every old install correctly stays on the last update
 *      matching runtime 2.0.0.
 *
 * `tests/push.test.ts` fails if any of these disagree with each other,
 * so this is checked rather than remembered.
 */

/**
 * The notifications module, or null on a build that does not contain it.
 *
 * Deliberately the only function here, and deliberately not clever: no
 * flags, no environment lookup, no conditional require. A switch you can
 * read in one glance is the point.
 */
export function loadPushSdk(): unknown | null {
  // PUSH OFF. To turn it on, uncomment the next line AND do the other
  // four steps above, in the same change.
  //
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // return require('expo-notifications');
  return null;
}
