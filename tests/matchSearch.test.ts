import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  BOT_ONLY_BELOW_TROPHIES,
  SEARCH_DEADLINE_MS,
  isSearchOver,
  searchProgress,
  searchesForPlayers,
  secondsShown,
} from '../src/game/matchSearch';
import { findWaitingPlayer, hasMatchmakingService } from '../src/game/onlineMatch';

const root = join(__dirname, '..');
const src = (p: string) => readFileSync(join(root, p), 'utf8');

/**
 * Who you get paired against.
 *
 * David, 9 Sep 2026: every game below 100 trophies against a bot, and
 * above that a count-up to roughly fifteen seconds looking for a real
 * player before settling for one.
 *
 * The rule is written and tested here in full. The one step it cannot
 * take yet — actually finding a person — is behind the switch in
 * onlineMatch.ts, because this game has no matchmaking server and no
 * shared round. These tests pin the rule AND the honesty: that nobody is
 * made to wait fifteen seconds for an answer that was never coming.
 */

suite('matchmaking · the trophy floor', () => {
  test('every game below 100 trophies is against a bot', () => {
    for (const t of [0, 1, 42, 99]) {
      assertEqual(searchesForPlayers(t), false, `${t} trophies should not search`);
    }
    assertEqual(BOT_ONLY_BELOW_TROPHIES, 100, 'the floor David asked for');
  });

  test('at 100 the search begins', () => {
    for (const t of [100, 101, 5000]) {
      assertEqual(searchesForPlayers(t), true, `${t} trophies should search`);
    }
  });

  test('a beginner is never made to wait', () => {
    /*
      The floor is not only about fairness, it is about the first hour.
      A new player pressing Start should be in a battle, not watching a
      timer — so below the floor the overlay settles the pairing before
      its first frame rather than searching and giving up.
    */
    const overlay = src('src/demo/MatchmakingOverlay.tsx');
    assert(
      /searchesForPlayers\(trophies\)\s*\?\s*null\s*:\s*\{ kind: 'bot', reason: 'below-threshold' \}/.test(
        overlay,
      ),
      'a player under the floor is not paired immediately',
    );
  });
});

suite('matchmaking · the fifteen seconds', () => {
  test('the deadline is roughly fifteen seconds', () => {
    assertEqual(SEARCH_DEADLINE_MS, 15_000, 'the deadline David asked for');
    assert(!isSearchOver(14_999), 'gave up early');
    assert(isSearchOver(15_000), 'did not give up on time');
  });

  test('the number a player sees counts up and stops at the deadline', () => {
    assertEqual(secondsShown(0), 0, 'starts at zero');
    assertEqual(secondsShown(4_600), 4, 'counts whole seconds');
    // A slow frame can arrive after the deadline; the display must not
    // run past what it promised.
    assertEqual(secondsShown(15_800), 15, 'ran past the deadline');
    assertEqual(secondsShown(-50), 0, 'went negative');
  });

  test('the bar fills exactly once over the wait', () => {
    assertEqual(searchProgress(0), 0, 'starts empty');
    assertEqual(searchProgress(SEARCH_DEADLINE_MS / 2), 0.5, 'half way');
    assertEqual(searchProgress(SEARCH_DEADLINE_MS * 2), 1, 'overfilled');
  });

  test('running out of time falls back to a bot rather than waiting on', () => {
    const overlay = src('src/demo/MatchmakingOverlay.tsx');
    assert(
      /isSearchOver\(next\)\)\s*setPairing\(\{ kind: 'bot', reason: 'nobody-found' \}\)/.test(
        overlay,
      ),
      'the search can run past its deadline with nobody watching the clock',
    );
  });

  test('the reveal is not eaten by a long search', () => {
    /*
      The "here is who you are playing" beat has its own clock, started
      when the pairing settles. Measured from the start of the search
      instead, a wait of ten seconds would put the reveal already
      finished and the round would begin without anybody seeing who
      they had been given.
    */
    const overlay = src('src/demo/MatchmakingOverlay.tsx');
    assert(
      /elapsed - settledAt\.current/.test(overlay),
      'the reveal is timed from the start of the search, not from the pairing',
    );
  });
});

suite('matchmaking · it does not pretend', () => {
  test('there is no matchmaking service, and the code says so plainly', () => {
    assertEqual(hasMatchmakingService(), false, 'a service appeared without one being built');
  });

  test('with no service the answer is immediate, not a fifteen-second act', async () => {
    /*
      THE POINT OF THIS WHOLE FILE.

      "Nobody found" and "there is nowhere to ask" are different things,
      and the difference reaches the player. Spending fifteen seconds
      pretending to search a lobby that does not exist would be a made-up
      wait ending in a made-up disappointment, performed for an audience
      that includes five-year-olds. So the lookup answers at once, and
      the overlay settles on that first answer.
    */
    const answer = await findWaitingPlayer();
    assertEqual(answer?.kind, 'bot', 'the no-service answer should pair a bot');
    assertEqual(answer && 'reason' in answer ? answer.reason : '', 'no-service', 'reason');
    note('no matchmaking service: the search resolves on its first ask');
  });

  test('nothing on screen claims to have found a person while none can be', () => {
    // matchmaking.ts has refused the words "searching for players online"
    // since it was written, for exactly this reason. The new wording has
    // to clear the same bar.
    /*
      Checked against the words the overlay actually RENDERS, not the
      whole file: the first version of this test read every quoted
      string, and failed on the import path '../game/onlineMatch'. A
      module name is not something a player ever sees.
    */
    const overlay = src('src/demo/MatchmakingOverlay.tsx')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/^import[\s\S]*?from '[^']+';$/gm, '');
    const shown = [...overlay.matchAll(/<Text[\s\S]*?<\/Text>/g)].join('\n');
    assert(shown.length > 0, 'no rendered text found — this test has stopped checking anything');
    for (const lie of ['online', 'real player', 'someone else', 'another player']) {
      assert(
        !new RegExp(lie, 'i').test(shown),
        `the overlay shows the words "${lie}" to a player, and there is nobody there`,
      );
    }
    note('rendered wording says "looking for a player", never that one was found');
  });

  test('turning it on is written down as a feature, not a flag', () => {
    /*
      The adverts really were one line away. This is not, and saying so
      in the file is what stops a future session flipping the switch and
      shipping a search that finds nobody for ever.
    */
    const online = src('src/game/onlineMatch.ts');
    for (const needed of ['queue', 'shared round', 'ai.ts']) {
      assert(
        online.toLowerCase().includes(needed.toLowerCase()),
        `onlineMatch.ts does not say that "${needed}" is needed first`,
      );
    }
  });
});
