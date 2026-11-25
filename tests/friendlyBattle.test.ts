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
import {
  BACK_TO_MENU,
  REMATCH_ACCEPT,
  REMATCH_MISSES,
  REMATCH_NOT_NOW,
  REMATCH_WINDOW_MS,
  goneLine,
  inviteClockLabel,
  isRematchOf,
  rematchAskLine,
  rematchButtonLabel,
  rematchWindowOpen,
  whyRematchGone,
} from '../src/game/rematch';
import { sameChallenges, type ChallengeState } from '../src/game/battlesApi';
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
      /\}, \[me, appActive, friendly, phase, rematch\]\);/.test(poll),
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

/**
 * PLAYING AGAIN, WITH THE SAME PERSON (src/game/rematch.ts).
 *
 * Marc, 5 Nov 2026: "After a game against your friend, if one of you
 * chooses to play again, it should have to wait for the other player too
 * in order to be able to play again, because right now it plays again
 * against your friend but they're not playing really."
 */
suite('friendly battle · playing again, with the same person', () => {
  const ended = 5_000_000;
  const outgoing = (id: string, online?: boolean) => ({
    id,
    who: { playerId: 'local-marc', name: 'Marc', trophies: 10, online },
  });

  test('the window is ten minutes from the end', () => {
    assertEqual(REMATCH_WINDOW_MS, 10 * 60_000, 'ten minutes');
    assert(rematchWindowOpen(ended, ended), 'closed at once');
    assert(rematchWindowOpen(ended, ended + REMATCH_WINDOW_MS - 1), 'closed a moment early');
    assert(!rematchWindowOpen(ended, ended + REMATCH_WINDOW_MS), 'open past ten minutes');
    assert(!rematchWindowOpen(Number.NaN, ended), 'a battle with no end can be played again');
  });

  test('the words', () => {
    assertEqual(rematchButtonLabel('Marc'), 'Play again with Marc', 'the button');
    assertEqual(rematchAskLine('Marc'), 'Marc wants a rematch!', 'the ask');
    assertEqual(goneLine('Marc'), 'Marc has gone', 'the no-show');
    assertEqual(REMATCH_ACCEPT, 'Accept', 'accept');
    assertEqual(REMATCH_NOT_NOW, 'Not now', 'not now');
    assertEqual(BACK_TO_MENU, 'Back to menu', 'the way back');
    assert(isRematchOf({ rematchOf: 'b1' }, 'b1'), 'the rematch of this battle');
    assert(!isRematchOf({ rematchOf: 'b2' }, 'b1'), 'the rematch of another battle');
    assert(!isRematchOf({ rematchOf: null }, 'b1'), 'an ordinary challenge');
    assert(!isRematchOf({}, 'b1'), 'an older server');
  });

  test('why the wait is over, and when it is not', () => {
    const now = ended + 30_000;
    assertEqual(whyRematchGone(outgoing('i1', true), 'i1', ended, now), null, 'they are there, thinking');
    assertEqual(whyRematchGone(outgoing('i1'), 'i1', ended, now), null, 'an older server says nothing about who is on');
    assertEqual(whyRematchGone(outgoing('i1', false), 'i1', ended, now), 'offline', 'their app is closed');
    assertEqual(whyRematchGone(null, 'i1', ended, now), 'missing', 'the invite is gone');
    assertEqual(whyRematchGone(outgoing('other', true), 'i1', ended, now), 'missing', 'some other invite of mine');
    assertEqual(whyRematchGone(outgoing('i1', true), 'i1', ended, ended + REMATCH_WINDOW_MS), 'window', 'ten minutes');
    // One failed poll looks like "missing"; the screen waits for two.
    assertEqual(REMATCH_MISSES, 2, 'polls in a row');
  });

  test('the clock on a rematch invite reads as minutes', () => {
    assertEqual(inviteClockLabel(45), '45', 'a challenge');
    assertEqual(inviteClockLabel(59), '59', 'just under a minute');
    assertEqual(inviteClockLabel(60), '1:00', 'a minute');
    assertEqual(inviteClockLabel(599), '9:59', 'the whole window');
    assertEqual(inviteClockLabel(-3), '0', 'never negative');
    assertEqual(inviteClockLabel(Number.NaN), '0', 'unreadable');
  });

  test('a rematch invite, and who is on, are changes the poll re-draws', () => {
    const base = (): ChallengeState => ({
      incoming: [{ id: 'i1', mode: 'classic', difficulty: 'easy', expiresAt: 1, who: null }],
      outgoing: null,
      battle: null,
    });
    const a = base();
    const b = base();
    b.incoming[0].rematchOf = 'b1';
    assert(!sameChallenges(a, b), 'a challenge turning into a rematch ask is not a change');
    const c = base();
    c.incoming[0].who = { playerId: 'p', name: 'Marc', trophies: 1, online: true };
    const d = base();
    d.incoming[0].who = { playerId: 'p', name: 'Marc', trophies: 1, online: false };
    assert(!sameChallenges(c, d), 'their phone going quiet is not a change');
    const e = base();
    e.battle = { id: 'b', mode: 'classic', difficulty: 'easy', kind: 'friend' };
    const f = base();
    f.battle = { id: 'b', mode: 'classic', difficulty: 'easy', kind: 'match' };
    assert(!sameChallenges(e, f), 'the kind of battle is not a change');
    assert(sameChallenges(base(), base()), 'the same answer twice is a change');
  });

  test('"Play again" after a live battle asks, and never starts a bot', () => {
    const buttons = between('const roundOverButtons = (', 'if (!hydrated) {');
    assert(buttons.includes('rematchButtonLabel(rematch.opponentName)'), 'the button is not by their name');
    assert(/rematch \? \(\s*<Pressable[^>]*onPress=\{\(\) => void askForRematch\(\)\}/.test(buttons), 'the button does not ask');
    assert(buttons.includes("startCountdown('again')"), 'the plain "Play again" is gone');
    const ask = between('const askForRematch = useCallback', 'const leaveRematchWait = useCallback');
    assert(!ask.includes('startCountdown('), 'the ask starts a battle by itself');
    assert(!ask.includes('pickOpponent('), 'the ask draws a bot');
    assert(ask.indexOf('setRematchWait(opened)') < ask.indexOf('await askRematch('), 'the room opens after the ask, not before');
    assert(/if \(result\.battle\) \{\s*startFriendly\(result\.battle, again\.opponentName, result\.battle\.kind \?\? again\.kind\)/.test(ask), 'their earlier ask is not joined');
    assert(ask.includes('showCallout(result.error'), 'a refused ask is silent');
  });

  test('finishRound keeps the battle so it can be asked again', () => {
    const finish = between('const finishRound = useCallback', 'const startCountdown');
    assert(/const again = \{[\s\S]*?battleId: playing\.battleId,[\s\S]*?kind: playing\.kind,[\s\S]*?endedAt: Date\.now\(\),[\s\S]*?\};\s*setRematch\(again\)/.test(finish), 'the finished battle is not kept');
    // Only a battle against a person: inside the `if (playing)`.
    assert(finish.indexOf('setRematch(again)') < finish.indexOf('const stakes = stakesFor('), 'kept outside the live-battle branch');
  });

  test('the poll runs on the result screen of a live battle and reads the answer', () => {
    const poll = between('ASKING WHETHER ANYBODY WANTS A BATTLE', 'The countdown on the banner');
    assert(/const resultOfLive = rematch !== null && \(phase === 'won' \|\| phase === 'lost' \|\| phase === 'tie'\)/.test(poll), 'the poll is off on the result screen');
    assert(/if \(phase !== 'pick' && !resultOfLive\) return;/.test(poll), 'the poll runs on every result screen');
    assert(poll.includes("state.battle.kind ?? 'friend'"), 'a rematch of a match would be played as a friend battle');
    assert(poll.includes('whyRematchGone(state.outgoing, wait.inviteId, again.endedAt'), 'the room never learns they have gone');
    assert(/why !== 'missing' \|\| rematchMissesRef\.current >= REMATCH_MISSES/.test(poll), 'one failed poll says they have gone');
    assert(poll.includes('rematchWaitRef.current !== null'), 'the poll is slow while a rematch ask is out');
  });

  test('"has gone" goes back to the menu, not to a bot', () => {
    const leave = between('const leaveRematchWait = useCallback', '/*\n    THE LIVE BATTLE, one beat a second.');
    assert(/if \(wait\?\.gone\) \{\s*quitToMenu\(\);\s*return;\s*\}/.test(leave), 'the way back is not the menu');
    assert(leave.includes("answerChallenge(who, wait.inviteId, 'cancel')"), 'Cancel does not take the ask back');
    assert(!leave.includes('startCountdown('), 'leaving the room starts a battle');
    const overlay = read('src/demo/FriendlyWaitOverlay.tsx');
    assert(overlay.includes('goneLine(opponent.name)') && overlay.includes('BACK_TO_MENU'), 'the room cannot say they have gone');
    assert(/gone=\{rematchWait\.gone\}[\s\S]*?waitMs=\{rematchWait\.waitMs\}[\s\S]*?onCancel=\{leaveRematchWait\}/.test(screen), 'the room is not drawn for the rematch');
    assert(/\{rematchWait && rematch && !friendly && \(\s*<FriendlyWaitOverlay/.test(screen), 'the rematch room is drawn over the friend\'s own room');
  });

  test('leaving the result screen takes my ask back and declines theirs', () => {
    const quit = between('const quitToMenu = useCallback', 'THE FRIEND NEVER CAME');
    assert(quit.includes("answerChallenge(who, wait.inviteId, 'cancel')"), 'my ask is left standing');
    assert(/isRematchOf\(c, again\.battleId\)[\s\S]*?answerChallenge\(who, asked\.id, 'decline'\)/.test(quit), 'their ask is left waiting ten minutes');
    assert(quit.includes('clearRematch()'), 'the finished battle is kept on the menu');
    const start = between('const startFriendly = useCallback', 'startFriendlyRef.current = startFriendly');
    assert(start.includes('clearRematch()'), 'a rematch that started is still offered');
  });

  test('the other player is asked with the challenge banner, in rematch words', () => {
    const banner = read('src/demo/ChallengeBanner.tsx');
    assert(banner.includes('rematchAskLine(who)'), 'the banner does not say rematch');
    assert(banner.includes('REMATCH_ACCEPT') && banner.includes('REMATCH_NOT_NOW'), 'the buttons are not Accept and Not now');
    assert(banner.includes('inviteClockLabel(secondsLeft)'), 'nine minutes would read as 540');
    assert(/const bannerStays =\s*banner !== null &&\s*rematch !== null &&/.test(screen), 'the ask slides away after six seconds');
    assert(/const gone = bannerStays \? null : setTimeout\(\(\) => setBanner\(null\), POPUP_MS\)/.test(screen), 'bannerStays is not read');
    const answer = between('const answerBattle = useCallback', 'const askForRematch = useCallback');
    assert(answer.includes("result.battle.kind ?? 'friend'"), 'accepting a match rematch plays it as a friend battle');
  });
});
