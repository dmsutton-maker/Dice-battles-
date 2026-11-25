import { EMPTY_LIST, type FriendList } from './friendsApi';

/**
 * The friends list, kept between one opening of the Friends tab and the
 * next.
 *
 * David, 17 Sep 2026: "also have the list of your friends load faster."
 *
 * WHY THERE WAS ANYTHING TO FIX. The Friends panel is mounted only while
 * it is open — `{showFriends && me && <FriendsScreen …>}` — so closing
 * it destroys every piece of state it had, including the list. Reopening
 * it ten seconds later therefore started from an empty list and a
 * spinner and asked the server all over again, even though the answer
 * was already known and almost certainly unchanged. That is the same
 * fault the Store and the Inventory had before v1.80.0, arriving by a
 * different route: there the screens were rebuilt, here the data was
 * re-fetched.
 *
 * IN MEMORY, NOT ON DISK, and that is a decision rather than laziness.
 * Writing this to AsyncStorage would make the FIRST open after a launch
 * quicker too — at the price of showing a friends list that might be a
 * week old, including people who are no longer friends and requests that
 * were answered days ago. Wrong for longer is worse than blank for a
 * second. Within one session the cache can only ever be a few minutes
 * stale, and the screen re-reads the moment it opens anyway, so what it
 * buys is the gap before the answer lands and nothing more.
 *
 * KEYED BY PLAYER ID so it can never show one player's friends to
 * another. There is only one player per phone today, but a cache that
 * would be wrong under a second one is a trap left lying about.
 */

let held: { playerId: string; list: FriendList } | null = null;

/** Keep this list, so the next opening of the tab starts with it. */
export function rememberFriends(playerId: string, list: FriendList): void {
  if (!playerId) return;
  /*
    Who is ON is not kept (1 Nov 2026). It is true for half a minute,
    and this cache can be minutes old by the next opening: "On now" for
    somebody who left would be a challenge sent to nobody. The screen
    re-reads the moment it opens, so the marker is back within a second.
  */
  const fresh = list.friends.some((f) => f.online !== undefined)
    ? { ...list, friends: list.friends.map(({ online: _online, ...f }) => f) }
    : list;
  held = { playerId, list: fresh };
}

/**
 * The last list this player saw, or null if there isn't one.
 *
 * Null and "an empty list" are deliberately different answers. Null
 * means nothing is known and the screen should show its spinner; an
 * empty FriendList means this player genuinely has no friends yet and
 * should be told so straight away rather than made to wait for a round
 * trip to say it.
 */
export function recallFriends(playerId: string): FriendList | null {
  if (!held || held.playerId !== playerId) return null;
  return held.list;
}

/** Test seam, and what a sign-out would call if this game had one. */
export function forgetFriends(): void {
  held = null;
}

/** Re-exported so a caller seeding state has one import, not two. */
export { EMPTY_LIST };
