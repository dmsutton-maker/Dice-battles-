import './storageMock';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  CODE_LENGTH,
  formatFriendCode,
  makeFriendCode,
  normaliseFriendCode,
} from '../src/game/friendCodes';
import {
  applyFriendAction,
  atFriendLimit,
  canDo,
  FriendAction,
  FriendState,
  MAX_FRIENDS,
  mayViewProfile,
  peek,
  PublicProfile,
  visibleProfile,
} from '../src/game/friends';
import {
  ANONYMOUS_NAME,
  isLocalId,
  loadIdentity,
  refreshName,
  replaceFriendCode,
  resetIdentityForTest,
} from '../src/game/playerIdentity';
import { setNativeForTests } from '../src/game/gameCenter';
import { typedFriendCode } from '../src/game/friendCodes';

/**
 * Friends, and the promises this game makes about children's data.
 *
 * Worth testing harder than most of the game. The rules here are not
 * opinions about feel — they are the reason a 4+ game can have friends
 * at all without a sign-up, a parental consent flow, or a change to the
 * App Privacy answers already filed with Apple.
 */

suite('friends · a code a child can read out loud', () => {
  test('the alphabet has no character that looks like another', () => {
    // Crockford base32. The whole point is a code read off a screen and
    // typed by somebody else, out loud, possibly by a five-year-old.
    const code = makeFriendCode(() => 0.999999);
    for (const banned of ['I', 'L', 'O', 'U']) {
      assert(
        !code.includes(banned),
        `${banned} is in the alphabet, and is mistaken for 1, 1, 0 and V`,
      );
    }
  });

  test('every code is the same length', () => {
    for (let i = 0; i < 200; i++) {
      assertEqual(makeFriendCode().length, CODE_LENGTH, 'code length');
    }
  });

  test('a random() at the very edges still gives a real character', () => {
    // Math.random() is [0,1), but an injected one — or a rounding edge —
    // must not be able to index past the end of the alphabet.
    for (const r of [0, 0.9999999999, 1]) {
      const code = makeFriendCode(() => r);
      assertEqual(code.length, CODE_LENGTH, `random() = ${r}`);
      assert(!code.includes('undefined'), `random() = ${r} fell off the alphabet`);
    }
  });

  test('the four letters people type by mistake are accepted', () => {
    // Somebody reading "K7M20VPQ" will type O for 0, and I or L for 1.
    // Blaming them for the font's shapes would be unkind.
    assertEqual(normaliseFriendCode('K7M2OVPQ'), 'K7M20VPQ', 'O became 0');
    assertEqual(normaliseFriendCode('K7M2IVPQ'), 'K7M21VPQ', 'I became 1');
    assertEqual(normaliseFriendCode('K7M2LVPQ'), 'K7M21VPQ', 'L became 1');
    assertEqual(normaliseFriendCode('K7M2UVPQ'), 'K7M2VVPQ', 'U became V');
  });

  test('spaces, dashes and lower case are all fine', () => {
    for (const typed of ['k7m2-9xpq', 'K7M2 9XPQ', ' k7m2-9XPQ ', 'K7M29XPQ']) {
      assertEqual(normaliseFriendCode(typed), 'K7M29XPQ', typed);
    }
  });

  test('a code of the wrong length is rejected, not guessed at', () => {
    /*
      The dangerous case is a code one character short. Padding it or
      matching a prefix would either fail confusingly or, far worse,
      find somebody who is not the person the child meant.
    */
    for (const bad of ['K7M29XP', 'K7M29XPQ1', '', 'K7M2-9XP']) {
      assertEqual(normaliseFriendCode(bad), null, `"${bad}" should not parse`);
    }
  });

  test('it is shown in two groups of four', () => {
    assertEqual(formatFriendCode('K7M29XPQ'), 'K7M2-9XPQ', 'display form');
    // And formatting something already formatted does not double up.
    assertEqual(formatFriendCode('K7M2-9XPQ'), 'K7M2-9XPQ', 'idempotent');
  });

  test('codes do not collide in any believable number of players', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20000; i++) seen.add(makeFriendCode());
    note(`${seen.size} distinct codes from 20000 draws`);
    assert(seen.size > 19990, `${20000 - seen.size} collisions in 20000 codes`);
  });
});

suite('friends · the state machine says no to everything it should', () => {
  const ALL: FriendState[] = ['none', 'requested', 'pending', 'friends', 'blocked'];
  const ACTIONS: FriendAction[] = [
    'request', 'accept', 'decline', 'cancel', 'remove', 'block', 'unblock',
  ];

  test('you cannot accept a request nobody sent you', () => {
    for (const state of ALL) {
      if (state === 'pending') continue;
      assert(!canDo(state, 'accept'), `accept was allowed from "${state}"`);
    }
    assert(canDo('pending', 'accept'), 'a real request cannot be accepted');
  });

  test('a blocked player can do nothing but be unblocked', () => {
    /*
      The point of a block is that it is quiet and it holds. Anything
      else reachable from here would turn a quiet exit into a
      confrontation, which is the opposite of what it is for.
    */
    for (const action of ACTIONS) {
      if (action === 'unblock') continue;
      assert(!canDo('blocked', action), `"${action}" was allowed while blocked`);
    }
    assertEqual(applyFriendAction('blocked', 'unblock'), 'none', 'unblocking');
  });

  test('unblocking returns you to strangers, not to friends', () => {
    // A block should not remember the friendship it ended.
    const after = applyFriendAction(applyFriendAction('friends', 'block'), 'unblock');
    assertEqual(after, 'none', 'unblocking restored the old friendship');
  });

  test('a move that is not allowed changes nothing at all', () => {
    for (const state of ALL) {
      for (const action of ACTIONS) {
        if (canDo(state, action)) continue;
        assertEqual(
          applyFriendAction(state, action),
          state,
          `"${action}" from "${state}" should be a no-op`,
        );
      }
    }
  });

  test('the ordinary path works end to end', () => {
    let mine: FriendState = 'none';
    let theirs: FriendState = 'none';
    mine = applyFriendAction(mine, 'request');
    theirs = 'pending';
    assertEqual(mine, 'requested', 'after asking');
    theirs = applyFriendAction(theirs, 'accept');
    assertEqual(theirs, 'friends', 'after accepting');
    assertEqual(applyFriendAction('friends', 'remove'), 'none', 'after removing');
  });
});

suite('friends · a stranger sees a name and nothing else', () => {
  const profile: PublicProfile = {
    playerId: 'G:123456',
    name: 'Marc',
    friendCode: 'K7M29XPQ',
    trophies: 3300,
    wins: { easy: 20, medium: 14, hard: 8 },
    modeWins: { classic: 18, ultimate: 9, skirmish: 8, colorwar: 7 },
    diceOwned: 22,
    arenasOwned: 9,
    favouriteDie: 'galaxy',
    favouriteArena: 'cavern',
    lastPlayed: 1_756_000_000_000,
  };

  test('only a friend sees the whole profile', () => {
    for (const state of ['none', 'requested', 'pending', 'blocked'] as FriendState[]) {
      assert(!mayViewProfile(state), `"${state}" could see a full profile`);
    }
    assert(mayViewProfile('friends'), 'a friend cannot see the profile');
  });

  test('the peek carries nothing a stranger should not have', () => {
    const shown = peek(profile);
    const keys = Object.keys(shown).sort().join(',');
    assertEqual(keys, 'name,playerId,trophies', 'what a stranger is shown');
    // The friend code especially: handing it out would let anyone who
    // searched you add you back without ever being told the code.
    assert(!('friendCode' in shown), 'a stranger was handed the friend code');
  });

  test('visibleProfile is the only gate a screen needs', () => {
    /*
      A screen that renders whatever it is handed cannot leak, because
      the thing it is handed is already trimmed. That is deliberate: a
      check a caller has to remember is a check that eventually nobody
      remembers.
    */
    const asStranger = visibleProfile(profile, 'none');
    assert(!('diceOwned' in asStranger), 'a stranger was handed the collection');
    const asFriend = visibleProfile(profile, 'friends');
    assert('diceOwned' in asFriend, 'a friend was not handed the collection');
  });

  test('nothing on a profile is free text', () => {
    /*
      The one rule that keeps this game out of moderation: no bio, no
      status, no message. The name comes from Game Center, where Apple
      moderates it. If a field is ever added here that a player can type
      into, this test is the thing that should stop it.
    */
    const source = readFileSync(join(__dirname, '..', 'src/game/friends.ts'), 'utf8');
    const shape = source.slice(
      source.indexOf('export interface PublicProfile'),
      source.indexOf('}', source.indexOf('export interface PublicProfile')),
    );
    const stringFields = [...shape.matchAll(/^\s*(\w+):\s*string;/gm)].map((m) => m[1]);
    note(`text fields on a profile: ${stringFields.join(', ')}`);
    const allowed = ['playerId', 'name', 'friendCode', 'favouriteDie', 'favouriteArena'];
    for (const field of stringFields) {
      assert(
        allowed.includes(field),
        `"${field}" is a new text field on a profile — if a player can type ` +
          'into it, this game needs moderation it does not have',
      );
    }
  });

  test('the friend list has a ceiling', () => {
    assert(!atFriendLimit(MAX_FRIENDS - 1), 'the limit bites one friend early');
    assert(atFriendLimit(MAX_FRIENDS), 'the limit does not bite');
    note(`friend limit: ${MAX_FRIENDS}`);
  });
});

suite('friends · identity without an account', () => {
  test('a player with no Game Center still gets a working identity', async () => {
    /*
      Android, a simulator, a signed-out player, or a binary older than
      the getLocalPlayer call — all of them land here, and all of them
      must still be able to open the friends screen.
    */
    resetIdentityForTest();
    const me = await loadIdentity();
    assert(me.playerId.length > 0, 'no player id');
    assert(isLocalId(me.playerId), 'a test with no Game Center got a non-local id');
    assertEqual(me.signedIn, false, 'a signed-out identity claimed Game Center answered');
    assertEqual(me.name, ANONYMOUS_NAME, 'default name');
    assertEqual(normaliseFriendCode(me.friendCode), me.friendCode, 'code is valid');
  });

  test('the same device gets the same identity twice', async () => {
    resetIdentityForTest();
    const first = await loadIdentity();
    resetIdentityForTest();
    const second = await loadIdentity();
    assertEqual(second.playerId, first.playerId, 'the id changed on reload');
    assertEqual(second.friendCode, first.friendCode, 'the friend code changed on reload');
  });

  test('nothing personal is stored, and no email is asked for anywhere', () => {
    const source = readFileSync(join(__dirname, '..', 'src/game/playerIdentity.ts'), 'utf8');
    for (const forbidden of ['email', 'password', 'birthday', 'age']) {
      assert(
        !new RegExp(`\\b${forbidden}\\b`, 'i').test(source.replace(/\/\*[\s\S]*?\*\//g, '')),
        `playerIdentity.ts mentions "${forbidden}" outside a comment`,
      );
    }
  });
});

suite('friends · the app and the server agree about the rules', () => {
  /**
   * The rules exist TWICE, on purpose: once in src/game/friends.ts so a
   * screen can grey out a button without a round trip, and once in the
   * server route, which is the copy that actually decides — because the
   * app is on somebody else's phone and can be edited.
   *
   * Two copies drift. This reads both and makes them prove they still
   * say the same thing.
   */
  const server = readFileSync(
    join(__dirname, '..', 'hq/src/app/api/friends/route.ts'),
    'utf8',
  );

  test('every action the app knows, the server knows too', () => {
    const appActions: FriendAction[] = [
      'request', 'accept', 'decline', 'cancel', 'remove', 'block', 'unblock',
    ];
    const serverActions = [...server.matchAll(/^  (\w+):\s*\{ from:/gm)].map((m) => m[1]);
    note(`server actions: ${serverActions.join(', ')}`);
    for (const action of appActions) {
      assert(
        serverActions.includes(action),
        `the app can ask for "${action}" and the server has never heard of it`,
      );
    }
    for (const action of serverActions) {
      assert(
        (appActions as string[]).includes(action),
        `the server allows "${action}" and the app does not know about it`,
      );
    }
  });

  test('each action is allowed from exactly the same states on both sides', () => {
    const ALL: FriendState[] = ['none', 'requested', 'pending', 'friends', 'blocked'];
    const rows = [...server.matchAll(/^  (\w+):\s*\{ from: \[([^\]]*)\]/gm)];
    assert(rows.length > 0, 'could not read the server state table');
    for (const [, action, list] of rows) {
      const serverFrom = [...list.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
      const appFrom = ALL.filter((state) => canDo(state, action as FriendAction)).sort();
      assertEqual(
        serverFrom.join(','),
        appFrom.join(','),
        `"${action}" is allowed from different states in the app and the server`,
      );
    }
  });

  test('a block changes only the blocker\u2019s side', () => {
    /*
      The one asymmetry in the whole design, and the easiest to undo by
      accident while tidying: writing both rows on a block would tell
      the blocked player they had been blocked, by removing them from
      their own friend list.
    */
    assert(
      /if \(action !== 'block' && theirRow\?\.state !== 'blocked'\)/.test(server),
      'the server writes both sides on a block, so a block is no longer quiet',
    );
  });

  test('the blocked side can never overwrite a block', () => {
    /*
      The other half of the same asymmetry, and the one that was missing.

      Every non-block action used to upsert the OTHER party's row
      unconditionally from the MOVES table, so the person who had been
      blocked could wipe the block by doing something perfectly legal.
      B blocks A; A calls `remove`, which is allowed from 'friends'; B's
      row is overwritten to 'none' and the block is gone — A can ask
      again and B gets the request they had shut off. From a pending
      request it is worse: B asked A then blocked, A accepts, and B ends
      up 'friends' with somebody they blocked.

      src/game/friends.ts calls blocked terminal. Two things have to
      hold for that to be true, and this is the second: a row that says
      'blocked' is never written by the other side.
    */
    assert(
      /theirRow\?\.state !== 'blocked'/.test(server),
      'a blocked row can still be overwritten by the person who was blocked',
    );
    // And their row has to be READ for every action, not only requests —
    // reading it inside `if (action === 'request')` is how this was
    // missed in the first place.
    // Comments stripped: this file's own prose describes the old shape,
    // and matching that would make the check pass on the bug it names.
    const code = server.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const readAt = code.indexOf('const { data: theirRow }');
    const requestAt = code.indexOf("if (action === 'request')");
    assert(readAt > 0 && requestAt > 0, 'the server no longer reads their row');
    assert(
      readAt < requestAt,
      'their row is read only for requests, so every other action ignores a block',
    );
  });

  test('a request to somebody who blocked you looks like success', () => {
    // Anything else is a way to detect a block, which is the
    // confrontation a quiet block exists to avoid.
    const guard = server.slice(server.indexOf("if (action === 'request')"));
    assert(
      /state === 'blocked'[\s\S]{0,200}ok: true/.test(guard),
      'a blocked request is answered with an error, which reveals the block',
    );
  });

  test('the server never sends a stranger more than a name and a score', () => {
    const peek = server.slice(server.indexOf('const peek ='), server.indexOf('const friends'));
    for (const leak of ['dice_owned', 'friend_code', 'secret', 'mode_wins']) {
      assert(
        !peek.includes(leak),
        `a stranger is sent ${leak}`,
      );
    }
  });

  test('the device secret is never stored in the clear', () => {
    const players = readFileSync(
      join(__dirname, '..', 'hq/src/app/api/players/route.ts'),
      'utf8',
    );
    assert(
      /secret_hash: hash\(/.test(players),
      'the secret is written to the database unhashed',
    );
    assert(
      !/secret_hash: auth\.secret/.test(players),
      'the raw secret is stored as the hash',
    );
    // And it must never come back out of either endpoint.
    for (const [name, source] of [['players', players], ['friends', server]] as const) {
      assert(
        !/select\([^)]*\bsecret\b(?!_hash)/.test(source),
        `the ${name} endpoint selects the secret itself`,
      );
    }
  });
});

/**
 * The network client, with the network replaced.
 *
 * src/game/friendsApi.ts shipped in v1.64.0 with no tests at all. Its
 * own header sets the rule it has to keep — "nothing here may throw or
 * reject", because a player on a plane or a bad train connection must
 * see a friends screen that says so rather than a crash or a spinner
 * that never stops. Every one of those branches was unexercised.
 */
suite('friends · the client survives a bad network', () => {
  const { pushProfile, findByCode, fetchFriends, actOnFriend } =
    require('../src/game/friendsApi') as typeof import('../src/game/friendsApi');

  const ME = {
    playerId: 'G:123',
    secret: 'a-very-secret-string',
    friendCode: 'K7M29XPQ',
    name: 'Tester',
    signedIn: true,
  };
  const STATS = {
    trophies: 42,
    wins: { easy: 3, medium: 2, hard: 1 },
    modeWins: { classic: 4, ultimate: 1, skirmish: 1, colorwar: 0 },
    diceOwned: 7,
    arenasOwned: 3,
    favouriteDie: 'ivory',
    favouriteArena: 'castle',
  } as never;

  /** Swap global fetch for the run of one call, and record what it saw. */
  async function withFetch<T>(
    impl: (url: string, init?: RequestInit) => Promise<unknown>,
    run: () => Promise<T>,
  ): Promise<{ result: T; calls: { url: string; init?: RequestInit }[] }> {
    const calls: { url: string; init?: RequestInit }[] = [];
    const real = (globalThis as { fetch?: unknown }).fetch;
    (globalThis as { fetch?: unknown }).fetch = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return impl(url, init);
    };
    try {
      return { result: await run(), calls };
    } finally {
      (globalThis as { fetch?: unknown }).fetch = real;
    }
  }

  const respond = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

  test('a server error becomes the server’s own words, not a crash', async () => {
    const { result } = await withFetch(
      async () => respond(409, { error: 'friend code taken' }),
      () => findByCode('K7M29XPQ'),
    );
    assert(!result.ok, 'a 409 was treated as success');
    assertEqual(
      (result as { error: string }).error,
      'friend code taken',
      'the server’s explanation was thrown away',
    );
  });

  test('a server error with no explanation still says something', async () => {
    const { result } = await withFetch(
      async () => respond(500, {}),
      () => findByCode('K7M29XPQ'),
    );
    assert(!result.ok, 'a 500 was treated as success');
    assert(
      (result as { error: string }).error.length > 0,
      'a failure with no message left the screen with nothing to show',
    );
  });

  test('being offline reads as being offline', async () => {
    // fetch REJECTING is the plane, the tunnel and the dead server, and
    // it must not propagate: this is called straight from a screen.
    const { result } = await withFetch(
      async () => {
        throw new TypeError('Network request failed');
      },
      () => fetchFriends(ME as never),
    );
    assert(!result.ok, 'a dead network was treated as success');
    assertEqual((result as { error: string }).error, 'No connection', 'wrong wording offline');
  });

  test('an answer that is not JSON is a failure, not an exception', async () => {
    // A captive-portal wifi answers 200 with a login page. Parsing that
    // throws inside the client, and the screen must never see the throw.
    const { result } = await withFetch(
      async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      }),
      () => fetchFriends(ME as never),
    );
    assert(!result.ok, 'an HTML login page was read as a friend list');
    assertEqual((result as { error: string }).error, 'No connection', 'wrong wording');
  });

  test('the device secret never appears in a URL', async () => {
    /*
      It used to ride in the query string on the friends fetch, where it
      lands in Vercel's request log and every proxy in between — a
      long-lived credential that never rotates, written down on every
      single open of the Friends screen.
    */
    const { calls } = await withFetch(
      async () => respond(200, { friends: [], requests: [], blocked: [] }),
      () => fetchFriends(ME as never),
    );
    assertEqual(calls.length, 1, 'the friends fetch made the wrong number of calls');
    assert(
      !calls[0].url.includes(ME.secret),
      `the secret is in the URL: ${calls[0].url}`,
    );
    const headers = (calls[0].init?.headers ?? {}) as Record<string, string>;
    assertEqual(headers['x-player-secret'], ME.secret, 'the secret is not in the header');

    // The POSTs are allowed to carry it — in the body, never the URL.
    const posts: [string, () => Promise<unknown>][] = [
      ['pushProfile', () => pushProfile(ME as never, STATS)],
      ['actOnFriend', () => actOnFriend(ME as never, 'G:456', 'request')],
    ];
    for (const [what, run] of posts) {
      const { calls: posted } = await withFetch(
        async () => respond(200, { ok: true }),
        run,
      );
      assert(!posted[0].url.includes(ME.secret), `${what} put the secret in the URL`);
      assert(
        String(posted[0].init?.body ?? '').includes(ME.secret),
        `${what} never sent the secret at all`,
      );
    }
  });

  test('a missing list comes back empty rather than undefined', async () => {
    // The server answers {} for a player with no friendships at all, and
    // the screen maps over all three arrays without checking.
    const { result } = await withFetch(
      async () => respond(200, {}),
      () => fetchFriends(ME as never),
    );
    assert(result.ok, 'an empty answer was treated as a failure');
    const { list } = result as { list: { friends: unknown[]; requests: unknown[]; blocked: unknown[] } };
    assertEqual(list.friends.length, 0, 'friends is not an empty array');
    assertEqual(list.requests.length, 0, 'requests is not an empty array');
    assertEqual(list.blocked.length, 0, 'blocked is not an empty array');
  });

  test('nobody with that code is not the same as an error', async () => {
    const { result } = await withFetch(
      async () => respond(200, { found: false }),
      () => findByCode('AAAAAAAA'),
    );
    assert(result.ok, 'a valid "nobody has that code" was reported as a failure');
    assertEqual((result as { profile: unknown }).profile, null, 'a phantom profile came back');
  });

  test('every call gives up rather than hanging for ever', async () => {
    // A captive portal accepts the connection and then says nothing. With
    // no timeout the promise never settles and the screen spins until the
    // app is killed, which is worse than an error.
    const source = readFileSync(join(__dirname, '..', 'src/game/friendsApi.ts'), 'utf8');
    assert(/TIMEOUT_MS\s*=\s*\d+/.test(source), 'the client has no timeout at all');
    assert(
      source.includes('controller?.abort()') && source.includes('signal: controller?.signal'),
      'the timeout is declared but never wired to the fetch',
    );
  });
});

suite('friends · the dash types itself', () => {
  /*
    David, 10 Sep 2026: put the dash in after the first four. The code is
    printed WITH a dash everywhere else in the game, so a box without one
    looks like the wrong box — and remembering a separator is a lot to
    ask of a child copying a code off a bit of paper.
  */
  test('four characters, then the dash appears on the fifth', () => {
    assertEqual(typedFriendCode('K'), 'K', 'one');
    assertEqual(typedFriendCode('K7M2'), 'K7M2', 'four, no dash yet');
    assertEqual(typedFriendCode('K7M29'), 'K7M2-9', 'the fifth brings the dash');
    assertEqual(typedFriendCode('K7M29XPQ'), 'K7M2-9XPQ', 'all eight');
  });

  test('BACKSPACE STILL WORKS, which is why the dash waits for the fifth', () => {
    /*
      THE WHOLE REASON FOR THE OFF-BY-ONE.

      Put a trailing dash in the moment the fourth character lands and
      the delete key stops working: the field reads "K7M2-", the delete
      removes the dash, and the formatter puts it straight back. The
      caret sticks and the only way out is to clear the whole box.

      A delete gives this function the text with one character already
      gone, so these are what the field is handed mid-backspace.
    */
    assertEqual(typedFriendCode('K7M2-'), 'K7M2', 'deleting the dash re-added it');
    assertEqual(typedFriendCode('K7M2-9'), 'K7M2-9', 'stable while there is a fifth');
    assertEqual(typedFriendCode('K7M'), 'K7M', 'deleting back past four');
    assertEqual(typedFriendCode(''), '', 'cleared');
  });

  test('it never lets somebody type more than a code', () => {
    assertEqual(typedFriendCode('K7M29XPQZZZZ'), 'K7M2-9XPQ', 'capped at eight');
  });

  test('a pasted code with its own dash is not doubled', () => {
    assertEqual(typedFriendCode('K7M2-9XPQ'), 'K7M2-9XPQ', 'paste with dash');
    assertEqual(typedFriendCode('k7m2 9xpq'), 'K7M2-9XPQ', 'paste with a space, lower case');
  });

  test('confusable letters are fixed under the finger, not silently later', () => {
    /*
      The alphabet has no I, L, O or U. normaliseFriendCode already
      accepts them and swaps them when the code is looked up — so
      correcting only at that point would show one thing on screen and
      search for another. Correcting as it is typed is at least honest,
      and it stops somebody entering a letter that could never match.
    */
    const typed = typedFriendCode('OI7M29XP');
    assertEqual(typed, normaliseFriendCode(typed) ? typed : 'INVALID', 'still a valid code');
    assert(!/[ILOU]/.test(typed), `a confusable letter survived: ${typed}`);
  });

  test('whatever the box shows is what gets looked up', () => {
    // The end of the chain: anything this produces at full length must
    // be something normaliseFriendCode accepts, or the search fails on
    // text the player can see is right.
    for (const raw of ['K7M29XPQ', 'k7m2-9xpq', 'OI7M29XP', '0123456789']) {
      const typed = typedFriendCode(raw);
      if (typed.replace('-', '').length !== 8) continue;
      assert(
        normaliseFriendCode(typed) !== null,
        `the box would show "${typed}" and the lookup would reject it`,
      );
    }
  });
});

suite('friends · it is a popup, like Settings and News', () => {
  const friends = readFileSync(
    join(__dirname, '..', 'src/demo/FriendsScreen.tsx'),
    'utf8',
  );

  /*
    David, 10 Sep 2026. Settings and News stopped being pages a long time
    ago for a reason worth repeating: as popups they read as things you
    glance at and dismiss, and the game stays visible behind them, so it
    is obvious you have not gone anywhere. Friends is the same kind of
    thing and was still a full page.
  */
  test('it opens in a Popup and no longer builds its own page', () => {
    assert(/<Popup title="Friends"/.test(friends), 'Friends is not a popup');
    assert(
      !/MENU_PAGE_EDGES|useMenuPageArea/.test(friends),
      'it still reserves a full menu page for itself',
    );
  });

  test('it has no back button of its own on the list', () => {
    /*
      The old "‹ Back" existed because the tab bar was drawn over this
      page and would swallow a tap near the bottom, so the exit had to be
      at the top. A popup is drawn ABOVE the bar and dims it, and it
      already guarantees two ways out — the ✕ and a tap on the dim — so a
      third would just be clutter.
    */
    const list = friends.slice(friends.indexOf('<Popup title="Friends"'));
    assert(
      !/‹ Back/.test(list),
      'the list still draws its own back button on top of the popup’s ✕',
    );
  });

  test('the profile keeps ITS back button, because it goes somewhere else', () => {
    // Not a way out of Friends — the way back to the list. The ✕ leaves
    // altogether. Two exits doing two different things.
    assert(/‹ Friends/.test(friends), 'there is no way back from a friend to the list');
    assert(
      /<Popup title=\{showing\.name\}/.test(friends),
      'the profile does not name whose page it is',
    );
  });

  test('THE ASK DIALOGS ARE OUTSIDE THE PANEL', () => {
    /*
      The one that would have shipped broken and that no rendering test
      here could catch.

      Confirm fills its PARENT, not the screen, and Popup's panel clips
      with overflow:hidden. Rendered inside it, "Remove this friend?"
      would have been squeezed into the panel and cut off instead of
      covering the screen. That is the whole reason the popup is built
      inside this component rather than wrapped around it by the caller —
      it lets the overlays be siblings of the panel.

      So: every {overlays} must come AFTER a </Popup>, never between a
      <Popup> and its close.
    */
    const opens = [...friends.matchAll(/<Popup /g)].map((m) => m.index ?? 0);
    const closes = [...friends.matchAll(/<\/Popup>/g)].map((m) => m.index ?? 0);
    const overlays = [...friends.matchAll(/\{overlays\}/g)].map((m) => m.index ?? 0);
    assert(opens.length > 0 && closes.length === opens.length, 'the popups are unbalanced');
    assert(overlays.length > 0, 'the confirm dialogs are not rendered at all');
    for (const at of overlays) {
      const inside = opens.some((o, i) => at > o && at < closes[i]);
      assert(
        !inside,
        'an ask dialog is rendered inside the popup panel, where it would be ' +
          'clipped to the panel instead of covering the screen',
      );
    }
  });

  test('the code box is not left under the keyboard', () => {
    // The same fault the Settings code box had: the input sits partway
    // down the panel and the keyboard covered the thing being typed in.
    assert(
      /<KeyboardAvoidingView/.test(friends),
      'the friend-code box can be covered by the keyboard',
    );
  });
});

/**
 * The friends screen answering "no such player".
 *
 * David, 10 Sep 2026: adding somebody by their code showed their name as
 * "New Player", and "ask to be friends" came back "that did not go
 * through — no such player".
 *
 * Both halves came from the same decision. The player id used to switch
 * to Apple's the moment Game Center answered, while the friend code —
 * which is UNIQUE on the server and belongs to the DEVICE — stayed put.
 * So the first launch where Game Center won the race, publishing the
 * profile tried to insert a SECOND row carrying a code the first row
 * already held, the unique index refused it, and the player was left
 * with no profile under the id they were now using. Every friends call
 * then answers "no such player", truthfully and uselessly.
 *
 * It bought nothing. Keying on the Apple id was meant to make a profile
 * portable between phones, and could not: the server authenticates with
 * a device secret, so a second phone is refused whatever the id says.
 */
suite('friends · the id that must never move', () => {
  /** A phone signed into Game Center as somebody. */
  function appleSignedInAs(alias: string) {
    setNativeForTests({
      isGameCenterAvailable: async () => true,
      authenticateLocalPlayer: async () => true,
      submitScore: async () => true,
      reportAchievement: async () => true,
      presentLeaderboard: async () => {},
      presentAchievements: async () => {},
      getLocalPlayer: async () => ({
        playerID: 'A:_apple_1234567890',
        displayName: alias,
        alias,
      }),
    });
  }

  test('signing into Game Center does NOT change the player id', async () => {
    /*
      The whole bug in one assertion. The id the server knows has to
      survive Apple turning up, because the friend code it is paired
      with cannot change.
    */
    setNativeForTests(null);
    resetIdentityForTest();
    const before = await loadIdentity();
    assert(isLocalId(before.playerId), 'the signed-out id should be a local one');

    appleSignedInAs('Rolling Thunder');
    resetIdentityForTest();
    const after = await loadIdentity();

    assertEqual(after.playerId, before.playerId, 'the id moved when Game Center answered');
    assert(isLocalId(after.playerId), 'the id became Apple’s, which strands the profile');
    assertEqual(after.friendCode, before.friendCode, 'the friend code moved');
    setNativeForTests(null);
    note(`id held at ${after.playerId} across signing in`);
  });

  test('but the NAME does become the Game Center alias', async () => {
    // The half of this that David actually wanted.
    appleSignedInAs('Rolling Thunder');
    resetIdentityForTest();
    const me = await loadIdentity();
    assertEqual(me.name, 'Rolling Thunder', 'the alias did not become the name');
    assertEqual(me.signedIn, true, 'signedIn should say Apple answered');
    setNativeForTests(null);
  });

  test('a name that arrives late still gets picked up', async () => {
    /*
      Why every profile on the board said "New Player". Game Center's
      sign-in is not instant, so a cold start settles on the anonymous
      name — and then PUBLISHES it, where it sits on everyone else's
      friends list until something overwrites it.
    */
    setNativeForTests(null);
    resetIdentityForTest();
    const early = await loadIdentity();
    assertEqual(early.name, ANONYMOUS_NAME, 'nobody signed in yet');

    appleSignedInAs('Late Arrival');
    const later = await refreshName();
    assertEqual(later.name, 'Late Arrival', 'the late alias was not picked up');
    assertEqual(later.playerId, early.playerId, 'refreshing the name changed the id');
    assertEqual(later.friendCode, early.friendCode, 'refreshing the name changed the code');
    assertEqual(later.secret, early.secret, 'refreshing the name changed the secret');
    setNativeForTests(null);
  });

  test('refreshing when nobody is signed in leaves everything alone', async () => {
    setNativeForTests(null);
    resetIdentityForTest();
    const me = await loadIdentity();
    const again = await refreshName();
    assertEqual(again.name, me.name, 'the name changed with nobody signed in');
    assertEqual(again.playerId, me.playerId, 'the id changed with nobody signed in');
  });

  test('a taken friend code can be given up without losing the profile', async () => {
    /*
      The one collision with a cure. "friend code taken" on a first
      publish means another row holds this code and this phone cannot
      prove it owns it — rare, but it left the player with no profile at
      all and nothing to do about it. A new code costs them the one they
      wrote down; no profile costs them the feature.
    */
    setNativeForTests(null);
    resetIdentityForTest();
    const before = await loadIdentity();
    const after = await replaceFriendCode();

    assert(after.friendCode !== before.friendCode, 'the code did not actually change');
    assertEqual(
      normaliseFriendCode(after.friendCode),
      after.friendCode,
      'the replacement is not a valid code',
    );
    assertEqual(after.playerId, before.playerId, 'the player id was thrown away too');
    assertEqual(after.secret, before.secret, 'the secret was thrown away too');

    // And it sticks: the next read agrees.
    resetIdentityForTest();
    const reread = await loadIdentity();
    assertEqual(reread.friendCode, after.friendCode, 'the new code was not kept');
  });
});

suite('friends · a failed publish is never silent', () => {
  const screen = readFileSync(
    join(__dirname, '..', 'src/demo/FriendsScreen.tsx'),
    'utf8',
  );
  const api = readFileSync(join(__dirname, '..', 'src/game/friendsApi.ts'), 'utf8');

  test('pushProfile reports WHY, not just that it failed', () => {
    // It returned a bare boolean, and the caller ignored even that.
    assert(
      /Promise<\{ ok: true \} \| \{ ok: false; error: string \}>/.test(api),
      'pushProfile no longer hands back the reason it failed',
    );
  });

  test('the screen stops at a failed publish instead of asking for a list', () => {
    /*
      The chain that produced David's message. The push failed, its
      result was dropped, and the very next line asked for the friend
      list of a profile that had never been created — so the player was
      shown "no such player", which blames the wrong step entirely.
    */
    assert(
      /if \(!push\.ok\) \{\s*setProblem\(push\.error\);/.test(screen),
      'a failed publish is not shown to the player',
    );
    const stop = screen.indexOf('if (!push.ok) {');
    const fetchAt = screen.indexOf('await fetchFriends(');
    assert(stop > 0 && fetchAt > stop, 'the friend list is fetched before the push is checked');
  });

  test('the screen redraws a taken code rather than reporting a dead end', () => {
    assert(/isCodeTaken\(push\.error\)/.test(screen), 'a taken friend code is not handled');
    assert(/replaceFriendCode\(\)/.test(screen), 'nothing draws a new code');
  });

  test('the code on screen is the one that was published', () => {
    // Redrawing the code means the prop is stale. Showing a code the
    // server has never heard of is worse than the original bug.
    assert(
      /formatFriendCode\(who\.friendCode\)/.test(screen),
      'the friend code card reads a value that redrawing cannot update',
    );
  });
});
