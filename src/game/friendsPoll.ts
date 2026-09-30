import type { FriendList } from './friendsApi';

/**
 * How often the Friends screen looks again, while it is open.
 *
 * David, 10 Sep 2026: "when I send a friend request, it should update on
 * my phone in the friends tab immediately when the other person accepts
 * it and so I don't have to close the friends tab and reopen it."
 *
 * WHY POLLING AND NOT A PUSH. A push needs a connection the server can
 * keep open, and the friends API is a handful of serverless functions on
 * Vercel — there is nothing to hold a socket. Real push notifications
 * would need a native module, an Apple push certificate, a permission
 * prompt a 4+ game does not currently ask for, and a new build. Asking
 * again every few seconds while somebody is actually looking at the
 * screen is the honest version of the same thing.
 *
 * IT ONLY RUNS WHILE SOMEBODY IS LOOKING. The screen polls while it is
 * open AND the app is in the foreground, and stops on both counts —
 * which is the rule the battery work in v1.69.0 set for every repeating
 * timer in this game. A friends list that keeps asking from inside a
 * pocket is exactly what that release was about.
 */

/** The ordinary gap between looks. Fast enough to feel immediate. */
export const POLL_MS = 4000;

/** The longest gap after repeated failures. */
export const POLL_MAX_MS = 60_000;

/**
 * Back off when the server is not answering.
 *
 * A phone on a dead train connection would otherwise ask every four
 * seconds for as long as the screen is open, which costs battery and
 * achieves nothing. Doubling to a minute keeps a working phone snappy
 * and a broken one quiet, and one success puts it straight back.
 */
export function nextPollDelay(failures: number): number {
  if (failures <= 0) return POLL_MS;
  return Math.min(POLL_MAX_MS, POLL_MS * 2 ** Math.min(failures, 10));
}

/**
 * Is this the same list we are already showing?
 *
 * The point is NOT saving a comparison — it is that replacing the state
 * object re-renders every row and every dice swatch on the screen. Doing
 * that every four seconds for a list that has not changed is a visible
 * flicker on a long list and a pointless cost on a short one.
 *
 * Compared by the things a player can see change: who is in each group,
 * which way a request points, and the trophy counts that are drawn
 * beside them.
 */
export function sameList(a: FriendList, b: FriendList): boolean {
  const key = (list: FriendList) =>
    JSON.stringify([
      list.friends.map((f) => [f.playerId, f.name, f.trophies]),
      list.requests.map((r) => [r.playerId, r.name, r.trophies, r.incoming]),
      list.blocked.map((p) => [p.playerId, p.name]),
    ]);
  return key(a) === key(b);
}
