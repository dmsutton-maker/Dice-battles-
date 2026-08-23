import {
  achievementReports,
  currentAchievementState,
  LEADERBOARD_TROPHIES,
  LEADERBOARD_WINS,
  mayPost,
} from './achievements';
import { getProgress } from './progress';

export { mayPost };

/**
 * Game Center, behind one door.
 *
 * Nothing else in the game imports the Game Center package. Every call
 * goes through this file, for two reasons: the package is a small
 * third-party module that still reports scores through `GKScore` (which
 * Apple soft-deprecated in iOS 14), so replacing it should be a one-file
 * job; and every entry point here has to be unable to break a battle.
 *
 * THE RULE: nothing in this file may throw, reject, or block. A player
 * signed out of Game Center, on Android, on a plane, or in a simulator
 * with no Apple account must not be able to tell that any of this exists.
 * Every call is wrapped, every failure is swallowed, and the next battle
 * simply asks again.
 */

/** The package's shape. Declared here so nothing else needs its types. */
interface NativeGameCenter {
  isGameCenterAvailable(): Promise<boolean>;
  authenticateLocalPlayer(): Promise<boolean>;
  submitScore(score: number, leaderboardID: string): Promise<boolean>;
  reportAchievement(achievementID: string, percentComplete: number): Promise<boolean>;
  presentLeaderboard(leaderboardID: string): Promise<void>;
  presentAchievements(): Promise<void>;
}

let native: NativeGameCenter | null | undefined;

/**
 * The native module, or null forever if it is not there.
 *
 * Required lazily rather than imported: on Android, in the node test
 * suite, and in any build without the native code compiled in, resolving
 * it throws at import time — which would take the whole app down on
 * startup rather than quietly doing nothing.
 */
function moduleOrNull(): NativeGameCenter | null {
  if (native !== undefined) return native;
  native = null;
  try {
    // Both required rather than imported. An import of either at module
    // scope pulls react-native into the headless test suite, where it
    // cannot be parsed — see safeAreaRules.ts for the same rule.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require('react-native');
    if (Platform.OS !== 'ios') return native;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-game-center');
    const candidate = (mod?.default ?? mod) as NativeGameCenter | undefined;
    if (candidate && typeof candidate.submitScore === 'function') native = candidate;
  } catch {
    // No native module in this build. Everything below turns into a no-op.
  }
  return native;
}

let signedIn = false;
let signingIn: Promise<boolean> | null = null;

/**
 * Sign in, at most once at a time.
 *
 * Game Center shows a system sign-in sheet the first time. Two battles
 * finishing close together must not queue up two of those, hence the
 * shared promise rather than a plain boolean guard.
 */
export async function signIn(): Promise<boolean> {
  if (signedIn) return true;
  const gc = moduleOrNull();
  if (!gc) return false;
  if (signingIn) return signingIn;
  signingIn = (async () => {
    try {
      if (!(await gc.isGameCenterAvailable())) return false;
      signedIn = await gc.authenticateLocalPlayer();
      return signedIn;
    } catch {
      return false;
    } finally {
      signingIn = null;
    }
  })();
  return signingIn;
}

export function isSignedIn(): boolean {
  return signedIn;
}

/**
 * Last value Apple ACCEPTED, so an unchanged number is not sent again
 * every battle.
 *
 * Recorded on success only. Recording it at the point of sending looks
 * equivalent and quietly destroys the retry: a report lost to a dropped
 * connection would be remembered as sent, and never tried again until the
 * player's score happened to change — which for a finished achievement is
 * never. That is the whole reason this reports state rather than events.
 */
const sent = new Map<string, number>();

function unchanged(key: string, value: number): boolean {
  return sent.get(key) === value;
}

/** Send one value, and remember it only if Apple took it. */
async function post(
  key: string,
  value: number,
  send: () => Promise<boolean>,
): Promise<void> {
  try {
    if (await send()) sent.set(key, value);
  } catch {
    // Left out of `sent`, so the next battle tries again.
  }
}

/**
 * Tell Game Center where this player stands.
 *
 * Called after every battle with the whole picture rather than a diff, so
 * a report lost to a dropped connection is made good by the next battle
 * instead of being gone for ever. Achievements only ever move forward in
 * Game Center — reporting 40% after 100% is ignored by Apple, not a
 * regression — so re-reporting the full set is safe.
 */
export async function sync(): Promise<void> {
  const gc = moduleOrNull();
  if (!gc || !mayPost()) return;
  if (!(await signIn())) return;

  const progress = getProgress();
  const wins = progress.wins.easy + progress.wins.medium + progress.wins.hard;

  const jobs: Promise<void>[] = [];
  if (!unchanged(LEADERBOARD_TROPHIES, progress.trophies)) {
    jobs.push(
      post(LEADERBOARD_TROPHIES, progress.trophies, () =>
        gc.submitScore(progress.trophies, LEADERBOARD_TROPHIES),
      ),
    );
  }
  if (!unchanged(LEADERBOARD_WINS, wins)) {
    jobs.push(post(LEADERBOARD_WINS, wins, () => gc.submitScore(wins, LEADERBOARD_WINS)));
  }
  for (const { id, percent } of achievementReports(currentAchievementState(progress))) {
    // Nothing is gained by telling Apple about an achievement nobody has
    // started, and it is a network call per battle per achievement.
    if (percent <= 0 || unchanged(id, percent)) continue;
    jobs.push(post(id, percent, () => gc.reportAchievement(id, percent)));
  }

  // allSettled, not all: one failed report must not drop the others.
  await Promise.allSettled(jobs);
}

/** Open Apple's own leaderboard UI. Silent if Game Center is not there. */
export async function openLeaderboard(): Promise<void> {
  const gc = moduleOrNull();
  if (!gc) return;
  try {
    await signIn();
    await gc.presentLeaderboard(LEADERBOARD_TROPHIES);
  } catch {
    // The sheet not opening is not worth an error message to a player.
  }
}

export async function openAchievements(): Promise<void> {
  const gc = moduleOrNull();
  if (!gc) return;
  try {
    await signIn();
    await gc.presentAchievements();
  } catch {
    // As above.
  }
}

/** Whether to offer the Game Center buttons at all. */
export function isAvailable(): boolean {
  return moduleOrNull() !== null;
}

/**
 * Test-only: stand a fake Apple in for the native module.
 *
 * The interesting cases here — a refused report, a dropped connection, no
 * native module at all — cannot be produced on a desk any other way, and
 * they are the ones that decide whether a finished achievement is lost.
 * Pass null for "this build has no Game Center".
 */
export function setNativeForTests(fake: NativeGameCenter | null): void {
  native = fake;
  signedIn = false;
  signingIn = null;
  sent.clear();
}
