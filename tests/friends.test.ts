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
import { ANONYMOUS_NAME, isLocalId, loadIdentity, resetIdentityForTest } from '../src/game/playerIdentity';

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
    assertEqual(me.portable, false, 'a local identity claimed to be portable');
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
      /if \(action !== 'block'\)/.test(server),
      'the server writes both sides on a block, so a block is no longer quiet',
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
