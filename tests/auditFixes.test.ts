import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import './storageMock';
import { assert, assertEqual, suite, test } from './harness';
import { resetAdsForTest, showAdIfDue } from '../src/game/ads';
import { sameChallenges, type ChallengeState } from '../src/game/battlesApi';

const root = join(__dirname, '..');

/** Source with its comments taken out, so a phrase in an explanation cannot pass for code. */
const code = (path: string) =>
  readFileSync(join(root, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

const screen = code('src/demo/DiceDemoScreen.tsx');

/** The text from one marker to the next, so a check reads one function and not the file. */
const between = (from: string, to: string) => {
  const a = screen.indexOf(from);
  const b = screen.indexOf(to, a + from.length);
  assert(a >= 0 && b > a, `could not find ${from} .. ${to} in DiceDemoScreen`);
  return screen.slice(a, b);
};

/*
  Regression tests for the audit of 17 Oct 2026 (G-BUG-1 to 4, G-LEAK-6,
  G-PERF-3 and 4). The screen cannot run in node, so the screen-level fixes
  are checked the way the rest of this suite checks it: by reading the code
  with its comments removed. The logic that can run (which cups score,
  concurrent ad calls, comparing challenge answers) is run for real in
  tournament.test.ts and below.
*/

suite('audit fixes · finishRound scores only the cups the tab shows', () => {
  test('the battle is scored against scorableTournaments, not the raw list', () => {
    const body = between('const finishRound', 'const startCountdown');
    assert(
      /scoreBattle\(\s*scorableTournaments\(cupsRef\.current, todayStamp\(\)\)/.test(body),
      'finishRound scores against every fetched cup, closed and not-yet-open ones included',
    );
    assert(
      !/scoreBattle\(\s*cupsRef\.current/.test(body),
      'finishRound still hands scoreBattle the raw cup list',
    );
  });
});

suite('audit fixes · leaving a friendly battle ends it', () => {
  const body = () => between('const quitToMenu', 'const finishRound');

  test('quitToMenu tells the server and clears the friendly state and ref', () => {
    const quit = body();
    assert(/friendlyRef\.current/.test(quit), 'quitToMenu never looks at the friendly battle');
    assert(
      /pulseBattle\([^;]*\{ leave: true \}\)/.test(quit),
      'the server is not told the player left',
    );
    assert(/void pulseBattle/.test(quit), 'the leave call is awaited, so the menu waits on the network');
    assert(/setFriendly\(null\)/.test(quit), 'friendly state is left set after quitting');
    assert(/friendlyRef\.current = null/.test(quit), 'the friendly ref is left set after quitting');
  });

  test('the leave call is read before the board is emptied', () => {
    const quit = body();
    assert(
      quit.indexOf('retreatColorIds()') < quit.indexOf('resetRace()'),
      'the freed colours are read after resetRace has emptied the board',
    );
  });

  test('the live sync is keyed on the friendly state, so clearing it stops the timer', () => {
    // The beat effect returns a cleanup that clears its timeout and runs
    // whenever `friendly` changes, so setFriendly(null) is the stop.
    const sync = between('const beat = async', 'const previewView');
    assert(/\[friendly, me, appActive/.test(sync), 'the live sync no longer depends on friendly');
    assert(/clearTimeout\(timer\)/.test(sync), 'the live sync does not clear its timer');
  });
});

suite('audit fixes · one battle start at a time, and no ad before a friendly one', () => {
  const body = () => between('const startCountdown', 'const beginCountdown');

  test('a second tap while a start is pending is ignored', () => {
    const start = body();
    assert(/startPendingRef\.current\) \{?\s*return/.test(start), 'startCountdown has no re-entrancy guard');
    assert(/startPendingRef\.current = true/.test(start), 'the pending flag is never raised');
    assert(/startPendingRef\.current = false/.test(start), 'the pending flag is never lowered');
  });

  test('a start whose player quit, or whose screen changed, does not begin a battle', () => {
    const start = body();
    assert(/startEpochRef\.current !== epoch\) return/.test(start), 'a quit does not cancel a pending start');
    assert(/phaseRef\.current !== startedFrom\) return/.test(start), 'a changed phase does not cancel a pending start');
    assert(
      start.indexOf('startEpochRef.current !== epoch') < start.indexOf("setPhaseBoth('matching')"),
      'the checks come after the battle has already started',
    );
    const quit = between('const quitToMenu', 'const finishRound');
    assert(/startEpochRef\.current \+= 1/.test(quit), 'quitToMenu does not invalidate a pending start');
    assert(/startPendingRef\.current = false/.test(quit), 'quitToMenu leaves the pending flag raised');
  });

  test('a live friendly battle never waits for, or shows, an ad', () => {
    const start = body();
    assert(
      /origin === 'friendly'\s*\?\s*Promise\.resolve\(\)\s*:\s*showAdIfDue\(\{ wait: true \}\)/.test(start),
      'a friendly start still goes through showAdIfDue',
    );
  });
});

suite('audit fixes · concurrent showAdIfDue callers share one answer', () => {
  test('two calls in the same tick get the same promise, not an instant false', async () => {
    resetAdsForTest();
    const first = showAdIfDue({ wait: true });
    const second = showAdIfDue({ wait: true });
    assert(first === second, 'the second caller was given its own answer while the first was pending');
    await first;
    const third = showAdIfDue({ wait: false });
    assert(third !== first, 'a finished call is still being handed out');
    await third;
  });

  test('it never rejects', async () => {
    resetAdsForTest();
    const answer = await showAdIfDue({ wait: true });
    assertEqual(answer, false, 'with nothing due and no SDK the answer is false');
  });
});

suite('audit fixes · callout timers end with the battle', () => {
  test('quitToMenu and startCountdown clear and empty flashTimers', () => {
    for (const [name, from, to] of [
      ['quitToMenu', 'const quitToMenu', 'const finishRound'],
      ['startCountdown', 'const startCountdown', 'const beginCountdown'],
    ] as const) {
      const text = between(from, to);
      assert(/flashTimers\.current\.forEach\(clearTimeout\)/.test(text), `${name} leaves callout timers running`);
      assert(/flashTimers\.current = \[\]/.test(text), `${name} lets the timer list grow`);
    }
  });
});

suite('audit fixes · die faces are painted only on the menu', () => {
  test('the warm-up stops unless the player is on the menu with nothing open', () => {
    const rule = between('const shouldWarmFaces', 'useEffect(');
    assert(/activeRef\.current/.test(rule), 'the warm-up ignores the app being in a pocket');
    assert(/phaseRef\.current === 'pick'/.test(rule), 'the warm-up carries on through a battle');
    assert(/previewRef\.current === null/.test(rule), 'the warm-up carries on under an open preview');
  });

  test('the first run uses that rule, and returning to the menu starts it again', () => {
    assert(
      /warmAllDieFaces\(\s*\(run\) => setTimeout\(run, 0\),\s*shouldWarmFaces,?\s*(warmArenas,?\s*)?\)/.test(screen),
      'warmAllDieFaces is not given the menu-only rule',
    );
    const resume = between('if (!facesWarmableRef.current) return;', '}, [appActive, phase, preview]');
    assert(/phase !== 'pick'/.test(resume), 'the warm-up is restarted outside the menu');
    assert(/warmAllDieFaces\(/.test(resume), 'nothing restarts the warm-up on the way back to the menu');
  });

  test('the battlefields are painted after the dice, under the same rule', () => {
    assert(
      /const warmArenas = \(\) => warmAllArenaTextures\(\(run\) => setTimeout\(run, 0\), shouldWarmFaces\)/.test(screen),
      'the battlefield warm-up is not given the menu-only rule',
    );
    const resume = between('if (!facesWarmableRef.current) return;', '}, [appActive, phase, preview]');
    assert(/warmArenas/.test(resume), 'coming back to the menu does not resume the battlefields');
  });
});

suite('audit fixes · the challenge poll does not re-render for nothing', () => {
  const challenge = (id: string, expiresAt = 1000): ChallengeState['incoming'][number] => ({
    id,
    mode: 'classic',
    difficulty: 'easy',
    expiresAt,
    who: { playerId: 'p1', name: 'Sam', trophies: 10 },
  });
  const state = (over: Partial<ChallengeState> = {}): ChallengeState => ({
    incoming: [challenge('a')],
    outgoing: null,
    battle: null,
    ...over,
  });

  test('an identical answer in a new object compares as the same', () => {
    assert(sameChallenges(state(), state()), 'an unchanged answer would re-render the screen');
    assert(
      sameChallenges({ incoming: [], outgoing: null, battle: null }, { incoming: [], outgoing: null, battle: null }),
      'two empty answers compare as different',
    );
  });

  test('anything the player can see or act on changing compares as different', () => {
    assert(!sameChallenges(state(), state({ incoming: [] })), 'a vanished challenge was missed');
    assert(!sameChallenges(state(), state({ incoming: [challenge('b')] })), 'a different challenge was missed');
    assert(!sameChallenges(state(), state({ incoming: [challenge('a', 2000)] })), 'a new expiry was missed');
    assert(
      !sameChallenges(state(), state({ battle: { id: 'x', mode: 'classic', difficulty: 'easy' } })),
      'a battle appearing was missed',
    );
    assert(
      !sameChallenges(state(), state({ outgoing: { ...challenge('o'), who: null } })),
      'an outgoing challenge appearing was missed',
    );
  });

  test('the poll only sets state when something moved', () => {
    assert(
      /setChallenges\(\(current\) => \(sameChallenges\(current, state\) \? current : state\)\)/.test(screen),
      'the poll replaces challenge state on every answer',
    );
  });
});

suite('audit · a slow ad SDK cannot freeze Play', () => {
  test('starting the SDK on the waiting path is bounded like the load wait', () => {
    /*
      Found by the regression pass after the start guard went in: the
      battle start waits behind showAdIfDue, and initAds (consent form,
      SDK start-up) had no limit, so on a bad connection Play did nothing
      for as long as the SDK took.
    */
    const ads = code('src/game/ads.ts');
    const once = ads.slice(ads.indexOf('async function showAdIfDueOnce'));
    assert(
      /await Promise\.race\(\[\s*initAds\(\),\s*new Promise<void>\(\(resolve\) => setTimeout\(resolve, AD_LOAD_WAIT_MS\)\)/.test(once),
      'initAds is awaited without a time limit on the path a battle start waits for',
    );
  });
});
