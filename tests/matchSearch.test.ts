import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  SEARCH_DEADLINE_MS,
  isSearchOver,
  searchProgress,
  searchesForPlayers,
  secondsShown,
} from '../src/game/matchSearch';
import {
  findWaitingPlayer,
  hasMatchmakingService,
  resetMatchmakingForTest,
} from '../src/game/onlineMatch';
import { startFlow } from '../src/game/matchFlow';

const root = join(__dirname, '..');
const src = (p: string) => readFileSync(join(root, p), 'utf8');

/**
 * Who you get paired against.
 *
 * David, 9 Sep 2026: roughly fifteen seconds looking for a real player
 * before settling for a bot. Marc, 4 Nov 2026, made the looking real,
 * and for everybody, whatever their trophies: "it should
 * search for a player for 15 seconds and it should say 'searching for
 * opponent' or something".
 *
 * These tests pin the rule AND the honesty: nobody is made to wait
 * fifteen seconds for an answer that was never coming. A server that
 * says `off`, or cannot be reached, settles the bot on the first ask.
 * The order of a search is tested in matchFlow.test.ts.
 */

suite('matchmaking · everybody searches', () => {
  test('there is no trophy floor any more', () => {
    /*
      David asked on 9 Sep 2026 for every game below 100 trophies to be
      against a bot. Marc, 4 Nov 2026, superseded it: "the online battle
      should be the dominant way to play ... the only way to play a bot
      should be if no real player is found in 15 seconds".
    */
    for (const mode of ['classic', 'ultimate'] as const) {
      assertEqual(searchesForPlayers(mode), true, `${mode} should search`);
      assertEqual(startFlow(mode, true).kind, 'asking', `${mode} does not ask the server`);
    }
    const source = src('src/game/matchSearch.ts');
    assert(!/export const BOT_ONLY_BELOW_TROPHIES/.test(source), 'the 100-trophy floor is back');
    assert(source.includes('supersedes'), 'matchSearch.ts does not say the floor was superseded');
  });

  test('Skirmish and Color War go to a bot at once', () => {
    // They cannot be played over a connection today (friendlyBattle.ts,
    // MODE_NOT_READY), so there is nobody to search for.
    for (const mode of ['skirmish', 'colorwar'] as const) {
      assertEqual(searchesForPlayers(mode), false, `${mode} searched`);
      const first = startFlow(mode, true);
      assertEqual(first.kind === 'bot' ? first.reason : '', 'not-live', `${mode} reason`);
    }
  });

  test('the overlay settles its first state before the first frame', () => {
    const overlay = src('src/demo/MatchmakingOverlay.tsx');
    assert(
      /useState<MatchFlowState>\(\(\) =>[\s\S]{0,160}startFlow\(mode, hasMatchmakingService\(\)\)/.test(
        overlay,
      ),
      'the overlay does not settle its first state before the first frame',
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

  test('running out of time withdraws, then lets the server decide', () => {
    // The ruling itself is matchFlow.ts (tested there); the overlay has
    // to feed it the clock and act on the withdrawal.
    const overlay = src('src/demo/MatchmakingOverlay.tsx');
    assert(
      /dispatch\(\{ type: 'tick', elapsedMs: next \}\)/.test(overlay),
      'the search can run past its deadline with nobody watching the clock',
    );
    assert(
      /withdrawFromSearch\(meRef\.current\)\.then\(\(pairing\) =>\s*dispatch\(\{ type: 'leaveAnswer', pairing \}\)/.test(
        overlay,
      ),
      'the deadline does not leave the queue and read the answer',
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
      /elapsed - \(settledAt\.current \?\? 0\)/.test(overlay),
      'the reveal is timed from the start of the search, not from the pairing',
    );
  });
});

suite('matchmaking · it does not pretend', () => {
  const ME = { playerId: 'p-test', secret: 's-test', name: 'Tester', friendCode: 'ABCD2345' } as never;
  const REQUEST = { mode: 'classic' as const, difficulty: 'medium' as const, trophies: 500 };
  const STATS = {} as never;

  /** Swap global fetch for one run, counting the calls. */
  async function withFetch<T>(
    impl: (url: string) => Promise<unknown>,
    run: () => Promise<T>,
  ): Promise<{ result: T; calls: string[] }> {
    const calls: string[] = [];
    const real = (globalThis as { fetch?: unknown }).fetch;
    (globalThis as { fetch?: unknown }).fetch = async (url: string) => {
      calls.push(url);
      return impl(url);
    };
    try {
      return { result: await run(), calls };
    } finally {
      (globalThis as { fetch?: unknown }).fetch = real;
    }
  }

  const SERVERS: [string, (url: string) => Promise<unknown>][] = [
    // Today's live site: no /api/match, so Next answers a 404 page, not JSON.
    [
      'a site without /api/match',
      async () => ({
        ok: false,
        status: 404,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      }),
    ],
    // The route deployed, the migration not applied.
    ['a server that says off', async () => ({ ok: true, status: 200, json: async () => ({ state: 'off' }) })],
    // A plane, a tunnel, a dead server.
    [
      'no connection',
      async () => {
        throw new TypeError('Network request failed');
      },
    ],
  ];

  for (const [name, server] of SERVERS) {
    test(`${name}: a bot on the first ask, not a fifteen-second act`, async () => {
      /*
        THE POINT OF THIS WHOLE FILE.

        "Nobody found" and "there is nowhere to ask" are different
        things, and the difference reaches the player. Spending fifteen
        seconds pretending to search a lobby that does not exist would be
        a made-up wait ending in a made-up disappointment. So the first
        answer settles it, and the switch stays off for the session: the
        next start does not even ask, and its bot is settled before the
        first frame — exactly the game before matchmaking existed.
      */
      resetMatchmakingForTest();
      const first = await withFetch(server, () => findWaitingPlayer(ME, REQUEST, STATS));
      assertEqual(first.result?.kind, 'bot', 'the first answer should pair a bot');
      assertEqual(
        first.result && first.result.kind === 'bot' ? first.result.reason : '',
        'no-service',
        'reason',
      );
      assertEqual(first.calls.length, 1, 'asked more than once');
      assert(first.calls[0].endsWith('/api/match'), `asked ${first.calls[0]}`);
      assertEqual(hasMatchmakingService(), false, 'the switch stayed on');

      const next = startFlow(REQUEST.mode, hasMatchmakingService());
      assertEqual(next.kind, 'bot', 'the next start searches again');
      const again = await withFetch(server, () => findWaitingPlayer(ME, REQUEST, STATS));
      assertEqual(again.calls.length, 0, 'the next start asked the server again');
      assertEqual(again.result?.kind, 'bot', 'the next start is not a bot');
      resetMatchmakingForTest();
    });
  }

  test('no identity yet means a bot, not a wait', async () => {
    resetMatchmakingForTest();
    const { result, calls } = await withFetch(
      async () => ({ ok: true, status: 200, json: async () => ({ state: 'searching' }) }),
      () => findWaitingPlayer(null, REQUEST, STATS),
    );
    assertEqual(result?.kind, 'bot', 'waited with nobody to ask as');
    assertEqual(calls.length, 0, 'asked without an identity');
  });

  /** The words the overlay actually RENDERS, not the whole file. */
  function rendered(): string {
    /*
      The first version of this test read every quoted string, and failed
      on the import path '../game/onlineMatch'. A module name is not
      something a player ever sees.
    */
    const overlay = src('src/demo/MatchmakingOverlay.tsx')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/^import[\s\S]*?from '[^']+';$/gm, '');
    const texts = [...overlay.matchAll(/<Text[\s\S]*?<\/Text>/g)].join('\n');
    const footers = overlay.slice(overlay.indexOf('function botFooter'), overlay.indexOf('export function MatchmakingOverlay'));
    return `${texts}\n${footers}`;
  }

  test('the search says what it is doing, in Marc\'s words', () => {
    const shown = rendered();
    assert(shown.includes('SEARCHING FOR AN OPPONENT'), 'the search does not say "Searching for an opponent"');
    assert(/secondsLeft\(elapsed\)/.test(shown), 'no countdown on the search');
    assert(shown.includes("If nobody is free, you'll play a rival instead."), 'the search does not say what happens if nobody comes');
    assert(shown.includes('Cancel'), 'a search nobody can leave');
  });

  test('a bot after a search says nobody was free', () => {
    const shown = rendered();
    assert(shown.includes("Nobody free right now — here's a rival."), 'a rival after a search is not explained');
    assert(shown.includes("Your opponent didn't make it — here's a rival."), 'a no-show is not explained');
  });

  test('nothing on screen claims a bot is a person', () => {
    const shown = rendered();
    assert(shown.length > 0, 'no rendered text found — this test has stopped checking anything');
    for (const lie of ['found a real player', 'real player', 'found a player', 'someone else', 'another player', 'online']) {
      assert(
        !new RegExp(lie, 'i').test(shown),
        `the overlay shows the words "${lie}" to a player`,
      );
    }
    note('rendered wording: "Searching for an opponent", then a rival that is called a rival');
  });

  test('onlineMatch.ts says what the service is made of', () => {
    /*
      The queue (match_queue on the HQ site), the shared round (the
      friend battle's live route) and the computer's rolls (ai.ts) when
      there is nobody. Written down so a later session knows what
      "online" means here without reading the server.
    */
    const online = src('src/game/onlineMatch.ts');
    for (const needed of ['queue', 'shared round', 'live route', 'ai.ts']) {
      assert(
        online.toLowerCase().includes(needed.toLowerCase()),
        `onlineMatch.ts does not say what "${needed}" is`,
      );
    }
  });
});
