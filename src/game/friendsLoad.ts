import type { FriendList } from './friendsApi';
import type { Identity } from './playerIdentity';

/**
 * What happens when the Friends tab opens, as something a test can run.
 *
 * David, 17 Sep 2026: "also have the list of your friends load faster."
 *
 * WHAT WAS SLOW. Opening the tab did three things in a row and only the
 * last of them put anything on screen:
 *
 *   1. ask Game Center for the player's name — a system call that on a
 *      cold start can still be showing its own sign-in sheet;
 *   2. publish this player's profile — a write, a full round trip;
 *   3. read the friends list — the round trip the player is waiting for.
 *
 * Steps 1 and 2 have nothing to do with what the screen draws. They were
 * in front of it because they were written in that order and it read
 * sensibly. The read now goes out at the same moment as the other two,
 * so the wait is one round trip rather than two plus Apple.
 *
 * WHY THIS IS ITS OWN FILE. The interesting property — that the list is
 * handed over BEFORE the publish has finished — is an ordering, and an
 * ordering inside a React component is something a test in node can only
 * grep for. Greps have been wrong in both directions in this project
 * more than once. Pulled out here with its four steps injected, the
 * suite can hold the publish open and prove the list still arrives.
 */

type Read = { ok: true; list: FriendList } | { ok: false; error: string };
type Write = { ok: true } | { ok: false; error: string };

export interface FriendsLoadSteps {
  /** Read the list. Never throws — see friendsApi. */
  read: (me: Identity) => Promise<Read>;
  /** Ask Apple for the player's name again. */
  name: () => Promise<Identity>;
  /** Publish this player's profile so others can see it. */
  publish: (me: Identity) => Promise<Write>;
  /** Draw a fresh friend code, for the one collision that has a cure. */
  reissueCode: () => Promise<Identity>;
  /** Is this the error a reissued code would fix? */
  codeTaken: (error: string) => boolean;
}

export interface FriendsLoadResult {
  /** The identity to show, after any name refresh or code reissue. */
  who: Identity;
  /** What to tell the player, or null if nothing went wrong. */
  problem: string | null;
}

/**
 * Read the list and publish the profile, at the same time.
 *
 * `onList` is called the moment a list is known — possibly well before
 * this promise settles. A caller that only awaits the return value gets
 * the old, slow behaviour back without noticing, which is why the tests
 * assert on when `onList` fires and not only on what comes back.
 */
export async function loadFriends(
  me: Identity,
  steps: FriendsLoadSteps,
  onList: (list: FriendList) => void,
): Promise<FriendsLoadResult> {
  /*
    THE READ GOES OUT FIRST AND ALONE.

    Starting it with the identity the caller already holds, rather than
    waiting for the republished one, is safe — and it is worth saying why
    rather than trusting it. The read is authenticated by the player id
    and the device secret. Neither of the two things below can change
    either: `name` changes the name and `signedIn`, `reissueCode` changes
    the friend code. The id is fixed for the life of the install and the
    secret with it (see playerIdentity). So the early read asks exactly
    the question the late one would have asked.
  */
  const reading = steps.read(me);

  const writing = (async () => {
    let mine = await steps.name();
    let push = await steps.publish(mine);
    /*
      "friend code taken" on a first publish means another row already
      holds this code and this phone cannot prove it owns it. A new code
      turns a player with no profile at all into a player with a profile
      and a different code, which is the better of the two.
    */
    if (!push.ok && steps.codeTaken(push.error)) {
      mine = await steps.reissueCode();
      push = await steps.publish(mine);
    }
    return { mine, push };
  })();

  const read = await reading;
  if (read.ok) onList(read.list);

  const { mine, push } = await writing;

  /*
    A FAILED PUBLISH IS THE ERROR, and the push's wording WINS over the
    read's.

    That ordering mattered before and matters more now. The commonest
    real failure is "wrong secret" after a reinstall, and BOTH calls fail
    with it — they send the same secret. The read's version names the
    symptom; the push's is the one the screen's `explain` turns into a
    sentence a person can do something about.
  */
  if (!push.ok) return { who: mine, problem: push.error };

  /*
    The one question the early read cannot answer: a player whose profile
    did not exist yet when it went out. The friends endpoint only knows
    players it has seen, so a first-ever visit is answered "no such
    player" no matter how fast it is asked.

    That costs one extra round trip, once per install — exactly the one
    this whole arrangement saves on every visit after it.
  */
  if (!read.ok) {
    const retry = await steps.read(mine);
    if (!retry.ok) return { who: mine, problem: retry.error };
    onList(retry.list);
  }

  return { who: mine, problem: null };
}
