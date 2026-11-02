import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, suite, test } from './harness';
import {
  CHALLENGE_POLL_MS,
  HERE_MS,
  JOIN_SAFETY_MS,
  JOIN_WAIT_MS,
  OUTGOING_POLL_MS,
  PRESENCE_TEXT,
  coloursAdded,
  joinLine,
  joinProgress,
  localWaitOver,
  noShowLine,
  presenceOf,
  rivalProgressCallout,
  sameColours,
} from '../src/game/friendlyBattle';
import { sameList } from '../src/game/friendsPoll';
import { forgetFriends, recallFriends, rememberFriends } from '../src/game/friendsCache';
import { EMPTY_LIST, type FriendList } from '../src/game/friendsApi';
import type { PublicProfile } from '../src/game/friends';

/**
 * Friend battles that are actually against each other.
 *
 * David, 1 Nov 2026: "Fix the versus against friends because it doesn't
 * connect and it's not actually against each other." Four faults, each
 * checked here: the friend was swapped for a bot, the two phones started
 * up to eight seconds apart, the friend's progress was silent, and
 * nobody could see who was on.
 */

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const screen = read('src/demo/DiceDemoScreen.tsx');
const between = (from: string, to: string): string => {
  const a = screen.indexOf(from);
  const b = screen.indexOf(to, a + from.length);
  assert(a >= 0 && b > a, `could not find ${from} .. ${to} in DiceDemoScreen`);
  return screen.slice(a, b);
};

suite('friendly battle · what is said when the friend moves', () => {
  const TOTAL = 6;

  test('a colour freed, with nothing special about the score', () => {
    const said = rivalProgressCallout('Marc', [], ['red'], 3, TOTAL);
    assertEqual(said?.text, 'Marc freed Red!', 'the plain rescue');
    assertEqual(said?.kind, 'lookout', 'the plain rescue cue');
  });

  test('a colour freed that puts them one ahead', () => {
    const said = rivalProgressCallout('Marc', ['red'], ['red', 'blue'], 1, TOTAL);
    assertEqual(said?.text, "Marc freed Blue — you're falling behind!", 'falling behind');
  });

  test('a colour freed that levels it', () => {
    const said = rivalProgressCallout('Marc', ['red'], ['red', 'green'], 2, TOTAL);
    assertEqual(said?.text, 'Marc ties it up 2–2!', 'the tie');
    // Level at nothing is not a tie worth shouting about.
    assertEqual(
      rivalProgressCallout('Marc', [], ['red'], 1, TOTAL)?.text,
      'Marc ties it up 1–1!',
      'one each',
    );
  });

  test('one short of finishing is the hurry', () => {
    const said = rivalProgressCallout('Marc', ['red', 'blue', 'green', 'yellow'], ['red', 'blue', 'green', 'yellow', 'purple'], 2, TOTAL);
    assertEqual(said?.text, 'Marc needs only ONE more — hurry!', 'the hurry line');
    assertEqual(said?.kind, 'hurry', 'the hurry cue');
  });

  test('the last colour says nothing: the verdict is on its way', () => {
    const five = ['red', 'blue', 'green', 'yellow', 'purple'];
    assertEqual(rivalProgressCallout('Marc', five, [...five, 'orange'], 2, TOTAL), null, 'spoke over the result');
  });

  test('a colour captured back in Ultimate', () => {
    const said = rivalProgressCallout('Marc', ['red', 'blue'], ['blue'], 1, TOTAL);
    assertEqual(said?.text, "Ha! Marc's Red was captured again!", 'the capture');
    assertEqual(said?.kind, null, 'good news for this player is not a "look out"');
  });

  test('by content, not by count: a capture and a rescue in one beat', () => {
    // Same length before and after, and still something happened.
    const said = rivalProgressCallout('Marc', ['red', 'blue'], ['blue', 'orange'], 0, TOTAL);
    assert(said !== null && said.text.includes('Orange'), `missed the swap: ${said?.text}`);
    assert(!sameColours(['red', 'blue'], ['blue', 'orange']), 'a swap read as the same set');
    assert(sameColours(['red', 'blue'], ['blue', 'red']), 'the same set in another order read as a change');
    assertEqual(coloursAdded(['red'], ['red', 'blue']).join(), 'blue', 'what was added');
  });

  test('nothing changed, nothing said', () => {
    assertEqual(rivalProgressCallout('Marc', ['red'], ['red'], 0, TOTAL), null, 'spoke about nothing');
    assertEqual(rivalProgressCallout('Marc', [], [], 0, TOTAL), null, 'spoke about nothing at all');
  });
});

suite('friendly battle · the waiting room', () => {
  test('the words for each wait state', () => {
    assert(/^Waiting for Marc\.{1,3}$/.test(joinLine('Marc', 'waiting', 0)), joinLine('Marc', 'waiting', 0));
    assert(
      joinLine('Marc', 'waiting', 0) !== joinLine('Marc', 'waiting', 400),
      'the dots do not move',
    );
    assertEqual(joinLine('Marc', 'here', 0), 'MARC IS HERE!', 'the arrival');
    assertEqual(noShowLine('Marc'), "Marc didn't make it", 'the no-show');
    assert(HERE_MS >= 500 && HERE_MS <= 1500, 'the arrival is not about a second');
  });

  test('this phone gives up only after the server would have', () => {
    const since = 1_000_000;
    assert(!localWaitOver(since, since), 'gave up at once');
    assert(!localWaitOver(since, since + JOIN_WAIT_MS), 'gave up before the server');
    assert(!localWaitOver(since, since + JOIN_WAIT_MS + JOIN_SAFETY_MS - 1), 'gave up a moment early');
    assert(localWaitOver(since, since + JOIN_WAIT_MS + JOIN_SAFETY_MS), 'never gives up');
    assert(!localWaitOver(0, since), 'a wait that never began ran out');
    assertEqual(joinProgress(JOIN_WAIT_MS / 2), 0.5, 'half way');
    assertEqual(joinProgress(JOIN_WAIT_MS * 3), 1, 'overfilled');
  });

  test('the challenger asks often while their challenge is out', () => {
    assert(OUTGOING_POLL_MS < CHALLENGE_POLL_MS, 'no faster than the home-screen poll');
    const poll = between('ASKING WHETHER ANYBODY WANTS A BATTLE', 'The countdown on the banner');
    assert(poll.includes('OUTGOING_POLL_MS'), 'the poll never uses the faster interval');
    assert(poll.includes('outgoingRef.current'), 'the poll does not read the challenge it sent');
    assert(
      /\}, \[me, appActive, friendly, phase\]\);/.test(poll),
      'the poll restarts on every challenge change instead of reading a ref',
    );
  });
});

suite('friendly battle · the friend is the opponent', () => {
  test('startFriendly sets the ref the callouts and result read', () => {
    const start = between('const startFriendly = useCallback', 'startFriendlyRef.current = startFriendly');
    assert(start.includes('opponentRef.current = friend'), 'only the state is set, so the ref still names a bot');
    assert(start.includes('setOpponent(friend)'), 'the scoreboard is not told');
  });

  test('startCountdown does not draw a bot for a friendly', () => {
    const start = between('const startCountdown', 'const beginCountdown');
    const pick = start.indexOf('pickOpponent(');
    assert(pick > 0, 'pickOpponent is gone from ordinary battles');
    const guard = start.lastIndexOf("if (origin !== 'friendly')", pick);
    assert(guard > 0 && pick - guard < 200, 'pickOpponent runs for a friendly battle too');
  });

  test('the bot reveal is not used for a friendly', () => {
    assert(
      /phase === 'matching' && friendly && \(\s*<FriendlyWaitOverlay/.test(screen),
      'a friendly does not get the waiting room',
    );
    assert(
      /phase === 'matching' && !friendly && \(\s*<MatchmakingOverlay/.test(screen),
      'MatchmakingOverlay can still be drawn over a friendly',
    );
    const overlay = read('src/demo/FriendlyWaitOverlay.tsx');
    for (const bot of ['AI_ROSTER', 'findWaitingPlayer', 'pickOpponent']) {
      assert(!overlay.includes(bot), `the friend's waiting room uses ${bot}`);
    }
    assert(/onCancel/.test(overlay) && overlay.includes('Cancel'), 'a wait nobody can leave');
  });

  test('the beat starts the countdown on started, and leaves on a closed room', () => {
    const beat = between('THE LIVE BATTLE, one beat a second.', 'The waiting room\'s own safety net');
    assert(/phaseRef\.current === 'matching'/.test(beat), 'the beat ignores the waiting room');
    assert(/pulse\.started\) setFriendReady\(true\)/.test(beat), '"started" never reaches the overlay');
    assert(/if \(pulse\.over\) \{\s*friendNoShow\(\);/.test(beat), 'a closed room leaves the player waiting');
    assert(beat.includes('rivalProgressCallout('), 'the friend is still silent');
    assert(beat.includes('sameColours('), 'the friend is compared by count, not content');
    assert(beat.includes('setAiFlash(true)'), 'no flash for the friend');
  });

  test('a no-show sends no leave and shows no result', () => {
    const body = between('const friendNoShow = useCallback', 'const finishRound = useCallback');
    assert(!body.includes('pulseBattle('), 'a closed room is left a second time');
    assert(!body.includes('finishRound('), 'a battle nobody played gets a result screen');
    assert(body.includes("setPhaseBoth('pick')"), 'does not go back to the menu');
    assert(body.includes('noShowLine('), 'says nothing about why');
  });

  test('the local safety net exists', () => {
    assert(/localWaitOver\(friendWaitSinceRef\.current, Date\.now\(\)\)\) friendNoShow\(\)/.test(screen), 'no safety net');
  });

  test('the clock is set once, before the wait, and the server owns it after', () => {
    const start = between('const startCountdown', 'const beginCountdown');
    assert(start.includes('clockRef.current = newClock()'), 'the clock is not set for a battle');
    const begin = between('const beginCountdown', '// Background music');
    assert(!begin.includes('newClock'), 'the countdown resets the clock the server has already started');
  });
});

suite('friendly battle · the banner and who is on', () => {
  test('the challenge banner is drawn after the Friends popup', () => {
    const friends = screen.indexOf('<FriendsScreen');
    const banner = screen.indexOf('<ChallengeBanner');
    assert(friends > 0 && banner > friends, 'a challenge is drawn underneath the Friends popup');
  });

  test('on, off, and unknown', () => {
    assertEqual(presenceOf(true), 'on', 'on');
    assertEqual(presenceOf(false), 'off', 'off');
    assertEqual(presenceOf(undefined), null, 'an old server is not "off"');
    assertEqual(PRESENCE_TEXT.on, 'On now', 'the on words');
    assertEqual(PRESENCE_TEXT.off, 'Not playing right now', 'the off words');
    const friendsScreen = read('src/demo/FriendsScreen.tsx');
    assert(friendsScreen.includes('<Presence online={friend.online} />'), 'the friend list shows nobody as on');
    // The Battle button must not be tied to presence.
    const row = friendsScreen.slice(friendsScreen.indexOf('<Presence online'), friendsScreen.indexOf('battleButtonText'));
    assert(!/disabled|online/.test(row.slice(row.indexOf('\n'))), 'the Battle button depends on who is on');
  });

  test('a change in who is on re-draws the list, and is never cached', () => {
    // Only the fields the list and the cache look at.
    const friend = (online?: boolean) =>
      ({
        playerId: 'local-a',
        name: 'Marc',
        trophies: 10,
        online,
      }) as PublicProfile;
    const a: FriendList = { ...EMPTY_LIST, friends: [friend(true)] };
    const b: FriendList = { ...EMPTY_LIST, friends: [friend(false)] };
    assert(!sameList(a, b), '"On now" would never turn off');
    forgetFriends();
    rememberFriends('local-me', a);
    const back = recallFriends('local-me');
    assertEqual(back?.friends[0].online, undefined, 'a minutes-old "On now" was kept');
    assertEqual(back?.friends[0].name, 'Marc', 'the friend went with it');
    forgetFriends();
  });
});
