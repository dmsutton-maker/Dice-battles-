import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, suite, test } from './harness';
import {
  DOT_TICK_MS,
  MATCH_TOTAL_MS,
  REVEAL_MS,
  SCAN_MS,
  SCAN_TICK_MS,
  dotsAt,
  isComplete,
  scanIndexAt,
  stageAt,
} from '../src/game/matchmaking';
import { BOT_ONLY_BELOW_TROPHIES, SERVICE_OFF_REMEMBER_MS, rivalReasonText } from '../src/game/matchSearch';
import {
  findWaitingPlayer,
  hasMatchmakingService,
  resetMatchmakingForTest,
  withdrawFromSearch,
} from '../src/game/onlineMatch';
import { startFlow } from '../src/game/matchFlow';

const root = join(__dirname, '..');
const src = (p: string) => readFileSync(join(root, p), 'utf8');

test('the whole beat is a couple of seconds', () => {
  assert(
    MATCH_TOTAL_MS === SCAN_MS + REVEAL_MS,
    `total ${MATCH_TOTAL_MS} should be scan + reveal`,
  );
  assert(
    MATCH_TOTAL_MS >= 1500 && MATCH_TOTAL_MS <= 3000,
    `a "couple of seconds" should be 1.5-3s, got ${MATCH_TOTAL_MS}ms`,
  );
});

test('scanning gives way to the reveal, and the reveal is held', () => {
  assert(stageAt(0) === 'scanning', 'starts scanning');
  assert(stageAt(SCAN_MS - 1) === 'scanning', 'still scanning just before');
  assert(stageAt(SCAN_MS) === 'found', 'revealed exactly on time');
  assert(stageAt(MATCH_TOTAL_MS) === 'found', 'still revealed at the end');
  assert(
    REVEAL_MS >= 500,
    `the rival must be readable, got ${REVEAL_MS}ms on screen`,
  );
});

test('the reveal is on screen before the round can start', () => {
  assert(!isComplete(0), 'not complete at the start');
  assert(!isComplete(SCAN_MS), 'not complete the instant the name lands');
  assert(!isComplete(MATCH_TOTAL_MS - 1), 'not complete just before the end');
  assert(isComplete(MATCH_TOTAL_MS), 'complete at the end');
  assert(isComplete(MATCH_TOTAL_MS + 5000), 'stays complete if a frame is late');
});

test('names shuffle, and wrap around a short roster', () => {
  assert(scanIndexAt(0, 8) === 0, 'first name at t=0');
  assert(scanIndexAt(SCAN_TICK_MS, 8) === 1, 'second name one tick in');
  assert(scanIndexAt(SCAN_TICK_MS * 8, 8) === 0, 'wraps after a full pass');
  assert(scanIndexAt(SCAN_TICK_MS * 9, 8) === 1, 'keeps cycling past the wrap');
});

test('the scan actually moves — several names before the reveal', () => {
  const seen = new Set<number>();
  for (let t = 0; t < SCAN_MS; t += 10) seen.add(scanIndexAt(t, 8));
  assert(seen.size >= 4, `expected a visible shuffle, saw ${seen.size} names`);
});

test('an empty roster cannot index out of bounds', () => {
  assert(scanIndexAt(500, 0) === 0, 'empty roster returns 0');
  assert(scanIndexAt(-500, 8) === 0, 'a negative clock returns 0');
});

test('the dots cycle one to three and never grow', () => {
  assert(dotsAt(0) === '.', 'one dot at the start');
  assert(dotsAt(DOT_TICK_MS) === '..', 'two dots');
  assert(dotsAt(DOT_TICK_MS * 2) === '...', 'three dots');
  assert(dotsAt(DOT_TICK_MS * 3) === '.', 'back to one');
  for (let t = 0; t < 10000; t += 37) {
    const n = dotsAt(t).length;
    assert(n >= 1 && n <= 3, `dots ran to ${n} at t=${t}`);
  }
});

/*
  THE SWITCH, since 5 Nov 2026. Marc: "When I have admin on and I try to
  load into a game it first says it's matching me against a bot, but it
  shouldn't, and when I have admin off it only puts me against bots."

  Admin mode does not touch matchmaking. What sent a start straight to a
  bot was `no-service`: every failed request was read as the server
  saying `off`, and the first `off` switched the search off until the
  app restarted. These pin the repair (src/game/onlineMatch.ts,
  battlesApi.ts): a failure is not an `off`, an `off` is remembered for
  a minute and not a session, and an identity still loading is waited
  for. The admin footer that says why is pinned at the end.
*/
suite('matchmaking · the switch is honest and never latches', () => {
  const ME = { playerId: 'p-test', secret: 's-test', name: 'Tester', friendCode: 'ABCD2345' } as never;
  const REQUEST = { mode: 'classic' as const, difficulty: 'medium' as const, trophies: 500 };
  const STATS = {} as never;

  /** Swap global fetch for one run, counting the calls. */
  async function withFetch<T>(
    impl: (url: string, init?: RequestInit) => Promise<unknown>,
    run: () => Promise<T>,
  ): Promise<{ result: T; calls: string[] }> {
    const calls: string[] = [];
    const real = (globalThis as { fetch?: unknown }).fetch;
    (globalThis as { fetch?: unknown }).fetch = async (url: string, init?: RequestInit) => {
      calls.push(url);
      return impl(url, init);
    };
    try {
      return { result: await run(), calls };
    } finally {
      (globalThis as { fetch?: unknown }).fetch = real;
      resetMatchmakingForTest();
    }
  }

  const reply = (status: number, body: unknown) => async () => ({
    ok: status < 400,
    status,
    json: async () => body,
  });

  test('a failed request does not switch the service off', async () => {
    const failures: [string, (url: string) => Promise<unknown>][] = [
      ['no connection', async () => { throw new TypeError('Network request failed'); }],
      ['a server error', reply(500, { error: 'boom' })],
      ['a page instead of JSON', async () => ({ ok: false, status: 404, json: async () => { throw new SyntaxError('<'); } })],
      ['a state this build does not know', reply(200, { state: 'paused' })],
    ];
    for (const [name, server] of failures) {
      const { result } = await withFetch(server, async () => {
        const first = await findWaitingPlayer(ME, REQUEST, STATS);
        const on = hasMatchmakingService();
        const flow = startFlow(500, REQUEST.mode, hasMatchmakingService());
        return { first, on, flow };
      });
      assertEqual(result.first, null, `${name}: settled a bot instead of asking again`);
      assertEqual(result.on, true, `${name}: switched the service off`);
      assertEqual(result.flow.kind, 'asking', `${name}: the next start does not search`);
    }
  });

  test('a wrong secret is not off either: the profile is pushed and the search goes on', async () => {
    const { result, calls } = await withFetch(
      (url) => (url.endsWith('/match') ? reply(401, { error: 'unknown player' })() : reply(200, { ok: true })()),
      () => findWaitingPlayer(ME, REQUEST, STATS),
    );
    assertEqual(result, null, 'two 401s settled a bot');
    assert(calls.some((u) => !u.endsWith('/match')), 'the profile was never pushed');
    assertEqual(calls.filter((u) => u.endsWith('/match')).length, 2, 'asked other than twice');
  });

  test('off is remembered for a minute, not the session', async () => {
    assertEqual(SERVICE_OFF_REMEMBER_MS, 60_000, 'the window is not a minute');
    const { result } = await withFetch(reply(200, { state: 'off' }), async () => {
      const first = await findWaitingPlayer(ME, REQUEST, STATS);
      return {
        first,
        now: hasMatchmakingService(),
        later: hasMatchmakingService(Date.now() + SERVICE_OFF_REMEMBER_MS - 1),
        expired: hasMatchmakingService(Date.now() + SERVICE_OFF_REMEMBER_MS + 1),
      };
    });
    assertEqual(result.first?.kind, 'bot', 'off did not settle a bot');
    assertEqual(result.first?.kind === 'bot' ? result.first.reason : '', 'no-service', 'reason');
    assertEqual(result.now, false, 'off was not remembered at all');
    assertEqual(result.later, false, 'off was forgotten inside the minute');
    assertEqual(result.expired, true, 'off is still believed after the minute');
    assertEqual(hasMatchmakingService(), true, 'a fresh session starts switched off');
  });

  test('an identity that has not loaded yet is waited for, not decided against', async () => {
    const searching = reply(200, { state: 'searching' });
    const { result, calls } = await withFetch(searching, async () => {
      const without = await findWaitingPlayer(null, REQUEST, STATS);
      const asked = (globalThis as { fetch?: unknown }).fetch;
      const withIt = await findWaitingPlayer(ME, REQUEST, STATS);
      return { without, withIt, asked };
    });
    assertEqual(result.without, null, 'no identity decided a bot');
    assertEqual(result.withIt, null, 'the identity, once there, was not searched with');
    assertEqual(calls.length, 1, 'asked the server with no identity');
    const gaveUp = await withFetch(searching, () => withdrawFromSearch(null));
    assertEqual(gaveUp.result.kind === 'bot' ? gaveUp.result.reason : '', 'nobody-found', 'the deadline with no identity');
  });

  test('the overlay waits for the identity through its prop, not a snapshot', () => {
    const overlay = src('src/demo/MatchmakingOverlay.tsx');
    assert(/meRef\.current = me;/.test(overlay), 'the overlay keeps the identity it mounted with');
    assert(/findWaitingPlayer\(meRef\.current/.test(overlay), 'the ask does not read the latest identity');
  });

  test('family tester mode shows the reason under the rival, and nobody else sees it', () => {
    assertEqual(rivalReasonText('no-service', 500), 'rival: no-service — server said off', 'no-service');
    assertEqual(rivalReasonText('nobody-found', 500), 'rival: nobody-found', 'nobody-found');
    assertEqual(
      rivalReasonText('below-threshold', 30),
      `rival: below-threshold 30 of ${BOT_ONLY_BELOW_TROPHIES}`,
      'below-threshold',
    );
    const overlay = src('src/demo/MatchmakingOverlay.tsx');
    assert(
      /\{showReason && flow\.kind === 'bot' && \(\s*<Text style=\{styles\.reason\}>\{rivalReasonText\(flow\.reason, trophies\)\}<\/Text>/.test(overlay),
      'the reason line is not behind showReason',
    );
    const screen = src('src/demo/DiceDemoScreen.tsx');
    assert(/showReason=\{unlockAll\}/.test(screen), 'the reason is not tied to family tester mode');
  });
});
