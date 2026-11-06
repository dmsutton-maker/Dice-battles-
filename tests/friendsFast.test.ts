import { assert, assertEqual, note, suite, test } from './harness';
import { EMPTY_LIST, type FriendList } from '../src/game/friendsApi';
import { loadFriends, type FriendsLoadSteps } from '../src/game/friendsLoad';
import { forgetFriends, recallFriends, rememberFriends } from '../src/game/friendsCache';
import type { Identity } from '../src/game/playerIdentity';

/**
 * How long the Friends tab takes to show anything.
 *
 * David, 17 Sep 2026: "also have the list of your friends load faster."
 *
 * Opening the tab did three things in a row, and only the last of them
 * put anything on screen: ask Game Center for the name, publish this
 * player's profile, then read the list. Two round trips and a system
 * call stood in front of the one request the player was waiting for.
 *
 * WHAT THESE TESTS ARE FOR. The fix is an ORDERING, and an ordering is
 * the thing a grep is worst at: source that reads as though two calls
 * are concurrent is source that would look identical if they were not.
 * So the steps are injected and held open deliberately here, and the
 * test asserts that the list arrives while the other two are still
 * unfinished. Nothing below matches a single character of the
 * implementation.
 */

const MINE: Identity = {
  playerId: 'local-abc',
  name: 'Tester',
  friendCode: 'K7M29XPQ',
  signedIn: true,
  recovered: false,
  secret: 'a-very-secret-string',
};

const LIST: FriendList = {
  friends: [],
  requests: [],
  blocked: [],
};

/** A promise somebody else decides when to settle. */
function held<T>(): { promise: Promise<T>; settle: (value: T) => void } {
  let settle!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

/** Let every already-resolved promise in the queue run. */
const drain = () => new Promise((r) => setTimeout(r, 0));

/** Steps that all succeed instantly, for a test to override one of. */
function steps(over: Partial<FriendsLoadSteps> = {}): FriendsLoadSteps {
  return {
    read: async () => ({ ok: true, list: LIST }),
    name: async () => MINE,
    publish: async () => ({ ok: true }),
    reissueCode: async () => MINE,
    codeTaken: () => false,
    ...over,
  };
}

suite('friends · the list does not wait for anything it does not need', () => {
  test('the list is shown while the profile is still being published', async () => {
    /*
      THE TEST THIS WHOLE CHANGE EXISTS FOR.

      The publish is held open and never allowed to finish until after
      the assertion. If the read were still queued behind it — the old
      arrangement — `shown` would still be null here and this would hang
      rather than fail, which is why there is a drain and a direct
      assertion rather than an await on the outer promise.
    */
    const publish = held<{ ok: true }>();
    let shown: FriendList | null = null;

    const done = loadFriends(
      MINE,
      steps({ publish: () => publish.promise }),
      (list) => {
        shown = list;
      },
    );

    await drain();
    assert(
      shown !== null,
      'the friends list waited for the profile publish before being shown',
    );

    publish.settle({ ok: true });
    const out = await done;
    assertEqual(out.problem, null, 'a clean open reported a problem');
    note('the list arrived with the publish still in flight');
  });

  test('the list is shown while Game Center is still thinking', async () => {
    /*
      The other half of the old wait, and the worse one: `refreshName`
      goes through to Apple, and on a cold start Game Center can still
      be showing its own sign-in sheet. The list has nothing to do with
      the player's name.
    */
    const name = held<Identity>();
    let shown: FriendList | null = null;

    const done = loadFriends(MINE, steps({ name: () => name.promise }), (list) => {
      shown = list;
    });

    await drain();
    assert(shown !== null, 'the friends list waited for Game Center to answer');

    name.settle(MINE);
    await done;
  });

  test('the read really does go out before the publish, not just beside it', async () => {
    /*
      Recording the order the steps are ENTERED, not the order they
      finish. Concurrency that starts the read second and merely
      overlaps would pass the two tests above on a fast machine and lose
      the round trip on a slow one.
    */
    const order: string[] = [];
    await loadFriends(
      MINE,
      steps({
        read: async () => {
          order.push('read');
          return { ok: true, list: LIST };
        },
        name: async () => {
          order.push('name');
          return MINE;
        },
        publish: async () => {
          order.push('publish');
          return { ok: true };
        },
      }),
      () => {},
    );
    assertEqual(order[0], 'read', `the read is not started first: ${order.join(' → ')}`);
  });

  test('a clean open reads once and shows the list once', async () => {
    /*
      The retry below is for a profile that does not exist yet. Firing
      it on an ordinary open would undo the saving and flicker the list.
    */
    let reads = 0;
    let shows = 0;
    await loadFriends(
      MINE,
      steps({
        read: async () => {
          reads += 1;
          return { ok: true, list: LIST };
        },
      }),
      () => {
        shows += 1;
      },
    );
    assertEqual(reads, 1, 'the list was read more than once on an ordinary open');
    assertEqual(shows, 1, 'the list was redrawn for no reason');
  });
});

suite('friends · the first time, and the times it goes wrong', () => {
  test('a first-ever visit still gets a list', async () => {
    /*
      The one case the early read cannot answer. The friends endpoint
      only knows players it has seen, so a read that goes out before
      this player's profile exists is answered "no such player" however
      fast it is asked — and the whole feature would be broken on the
      first open if that were taken as the final word.
    */
    let reads = 0;
    let shown: FriendList | null = null;
    const out = await loadFriends(
      MINE,
      steps({
        read: async () => {
          reads += 1;
          // Exists only after the publish, which is what the count says.
          return reads === 1
            ? { ok: false, error: 'no such player' }
            : { ok: true, list: LIST };
        },
      }),
      (list) => {
        shown = list;
      },
    );
    assertEqual(reads, 2, 'a first visit did not read again after publishing');
    assert(shown !== null, 'a first visit showed no list at all');
    assertEqual(out.problem, null, 'a first visit reported a problem to the player');
  });

  test('a publish that fails hides nothing and blames the right step', async () => {
    const out = await loadFriends(
      MINE,
      steps({
        read: async () => ({ ok: false, error: 'no such player' }),
        publish: async () => ({ ok: false, error: 'wrong secret' }),
      }),
      () => assert(false, 'nothing could be read, so nothing should be shown'),
    );
    assertEqual(out.problem, 'wrong secret', 'the read’s error masked the publish’s');
  });

  test('a read that fails after a good publish is reported, not swallowed', async () => {
    const out = await loadFriends(
      MINE,
      steps({ read: async () => ({ ok: false, error: 'no connection' }) }),
      () => assert(false, 'a failed read has no list to show'),
    );
    assertEqual(out.problem, 'no connection', 'a dead connection was reported as success');
  });

  test('a list that arrived is kept even when the publish then fails', async () => {
    /*
      The read succeeded, so the list on screen is true. The publish
      failing means this player's own trophies did not go up for
      everybody else — worth saying, not worth throwing the list away
      before it has been said.
    */
    let shown: FriendList | null = null;
    const out = await loadFriends(
      MINE,
      steps({ publish: async () => ({ ok: false, error: 'no connection' }) }),
      (list) => {
        shown = list;
      },
    );
    assert(shown !== null, 'a list that was successfully read was never handed over');
    assertEqual(out.problem, 'no connection', 'the failed publish went unmentioned');
  });

  test('the identity handed back is the published one, not the one passed in', async () => {
    // Game Center answering late, which is the ordinary case on a cold
    // start. The card has to show the name that actually went up.
    const named: Identity = { ...MINE, name: 'Marc' };
    const out = await loadFriends(MINE, steps({ name: async () => named }), () => {});
    assertEqual(out.who.name, 'Marc', 'the screen would show the name from before sign-in');
  });
});

suite('friends · the list is remembered between openings', () => {
  test('what was put in comes back out', () => {
    forgetFriends();
    assertEqual(recallFriends(MINE.playerId), null, 'something was remembered before anything was');
    rememberFriends(MINE.playerId, LIST);
    assertEqual(recallFriends(MINE.playerId), LIST, 'the list was not remembered');
  });

  test('one player never sees another player’s friends', () => {
    forgetFriends();
    rememberFriends('local-abc', LIST);
    assertEqual(
      recallFriends('local-somebody-else'),
      null,
      'a cached list was handed to the wrong player',
    );
  });

  test('“no friends yet” is an answer, not an absence', () => {
    /*
      The distinction the whole cache turns on. Returning null for an
      empty list would put the spinner back up for every player who has
      no friends yet — which is every player at the moment they are most
      likely to be looking.
    */
    forgetFriends();
    rememberFriends(MINE.playerId, EMPTY_LIST);
    const back = recallFriends(MINE.playerId);
    assert(back !== null, 'an empty list came back as "nothing known"');
    assertEqual(back!.friends.length, 0, 'the empty list was not empty');
  });

  test('a player id that is missing is never remembered under it', () => {
    forgetFriends();
    rememberFriends('', LIST);
    assertEqual(recallFriends(''), null, 'a list was filed under an empty player id');
  });
});
