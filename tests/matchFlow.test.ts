import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  MATCH_JOIN_WAIT_MS,
  SEARCH_DEADLINE_MS,
  secondsLeft,
  type Pairing,
} from '../src/game/matchSearch';
import {
  joinWaitOver,
  showsSearch,
  startFlow,
  stepFlow,
  type MatchFlowEffect,
  type MatchFlowState,
} from '../src/game/matchFlow';
import {
  cancelSearch,
  findWaitingPlayer,
  resetMatchmakingForTest,
  withdrawFromSearch,
} from '../src/game/onlineMatch';

const root = join(__dirname, '..');
const src = (p: string) => readFileSync(join(root, p), 'utf8');

/**
 * The order of an online search (src/game/matchFlow.ts). Marc, 4 Nov
 * 2026: "it should search for a player for 15 seconds ... and if it
 * can't find a real person to verse after 15 seconds then it loads you
 * against one of the bots".
 */

const BATTLE = { id: 'battle-1', mode: 'classic' as const, difficulty: 'medium' as const, opponentId: 'p-b' };
const PLAYER: Pairing = { kind: 'player', playerId: 'p-b', name: 'Sam', battle: BATTLE };

/** Run a list of events from a state, collecting every effect. */
function run(
  from: MatchFlowState,
  events: Parameters<typeof stepFlow>[1][],
): { state: MatchFlowState; effects: MatchFlowEffect[] } {
  let state = from;
  const effects: MatchFlowEffect[] = [];
  for (const event of events) {
    const step = stepFlow(state, event);
    state = step.state;
    effects.push(...step.effects);
  }
  return { state, effects };
}

const asking = (): MatchFlowState => startFlow(500, 'classic', true);

suite('match flow · the states', () => {
  test('a search starts by asking, and is on screen from the first frame', () => {
    assertEqual(asking().kind, 'asking', 'a Color Rush start does not ask');
    // Marc, 5 Nov 2026: never the computer rivals before the real search.
    assert(showsSearch(asking()), 'the first frame of a search shows a rival instead of the search');
    const { state } = run(asking(), [{ type: 'answer', pairing: null }]);
    assertEqual(state.kind, 'searching', '"still looking" did not start the search');
  });

  test('a match at 3 s means matched', () => {
    const { state, effects } = run(asking(), [
      { type: 'answer', pairing: null },
      { type: 'tick', elapsedMs: 1_000 },
      { type: 'answer', pairing: null },
      { type: 'tick', elapsedMs: 3_000 },
      { type: 'answer', pairing: PLAYER },
    ]);
    assertEqual(state.kind, 'matched', 'a person found is not joined');
    assertEqual(state.kind === 'matched' ? state.pairing.battle.id : '', 'battle-1', 'the wrong room');
    assertEqual(effects.length, 0, 'a match should not leave anything');
  });

  test('nothing by 15 s withdraws; the leave answer decides', () => {
    const waited = run(asking(), [
      { type: 'answer', pairing: null },
      { type: 'tick', elapsedMs: 14_999 },
    ]);
    assertEqual(waited.state.kind, 'searching', 'gave up early');
    const over = run(waited.state, [{ type: 'tick', elapsedMs: SEARCH_DEADLINE_MS }]);
    assertEqual(over.state.kind, 'withdrawing', 'did not withdraw at the deadline');
    assertEqual(over.effects.map((e) => e.type).join(), 'leave-queue', 'the queue is not told');

    // Paired in the last moment: that person is in a room, so join it.
    const late = run(over.state, [{ type: 'leaveAnswer', pairing: PLAYER }]);
    assertEqual(late.state.kind, 'matched', 'a pairing at 14.9 s left somebody alone in a room');

    const nobody = run(over.state, [{ type: 'leaveAnswer', pairing: { kind: 'bot', reason: 'nobody-found' } }]);
    assertEqual(nobody.state.kind, 'bot', 'nobody found is not a bot');
    assertEqual(nobody.state.kind === 'bot' ? nobody.state.reason : '', 'nobody-found', 'reason');
  });

  test('cancel at 5 s means cancelled, and the queue is left', () => {
    const { state, effects } = run(asking(), [
      { type: 'answer', pairing: null },
      { type: 'tick', elapsedMs: 5_000 },
      { type: 'cancel' },
    ]);
    assertEqual(state.kind, 'cancelled', 'cancel did not cancel');
    assertEqual(effects.map((e) => e.type).join(), 'leave-queue', 'the queue is not told');
  });

  test('cancel once matched leaves the room too', () => {
    const { state, effects } = run(asking(), [{ type: 'answer', pairing: PLAYER }, { type: 'cancel' }]);
    assertEqual(state.kind, 'cancelled', 'cancel did not cancel');
    assertEqual(effects.map((e) => e.type).join(), 'leave-queue,leave-battle', 'the person is left waiting');
  });

  test('a late match after cancelling walks out of that room', () => {
    const { effects } = run(asking(), [{ type: 'cancel' }, { type: 'answer', pairing: PLAYER }]);
    assert(
      effects.some((e) => e.type === 'leave-battle' && e.battleId === 'battle-1'),
      'a room made for us after Cancel is left with somebody waiting in it',
    );
  });

  test('an off answer means an immediate bot', () => {
    const { state } = run(asking(), [{ type: 'answer', pairing: { kind: 'bot', reason: 'no-service' } }]);
    assertEqual(state.kind, 'bot', 'off did not settle a bot');
    assertEqual(state.kind === 'bot' ? state.reason : '', 'no-service', 'reason');
    // And with the switch already off, before the first frame.
    assertEqual(startFlow(500, 'classic', false).kind, 'bot', 'a known-off service still asks');
  });

  test('Skirmish and Color War mean an immediate bot; any trophies search', () => {
    assertEqual(startFlow(500, 'skirmish', true).kind, 'bot', 'Skirmish searched');
    assertEqual(startFlow(500, 'colorwar', true).kind, 'bot', 'Color War searched');
    assertEqual(startFlow(500, 'ultimate', true).kind, 'asking', 'Ultimate does not search');
  });

  test('a settled state does not move again', () => {
    const bot = startFlow(500, 'skirmish', true);
    for (const event of [
      { type: 'tick', elapsedMs: 99_000 },
      { type: 'answer', pairing: null },
      { type: 'leaveAnswer', pairing: PLAYER },
    ] as const) {
      assertEqual(stepFlow(bot, event).state, bot, `a bot was moved by ${event.type}`);
    }
  });
});

suite('match flow · the countdown and the room', () => {
  test('the countdown runs 15 down to 0 and never below', () => {
    assertEqual(secondsLeft(0), 15, 'starts at 15');
    assertEqual(secondsLeft(999), 15, 'whole seconds, rounded up');
    assertEqual(secondsLeft(14_001), 1, 'one second left');
    assertEqual(secondsLeft(15_000), 0, 'zero at the deadline');
    assertEqual(secondsLeft(40_000), 0, 'went negative');
    assertEqual(secondsLeft(-500), 15, 'a negative clock');
  });

  test('a matched opponent who never arrives means a bot', () => {
    assertEqual(MATCH_JOIN_WAIT_MS, 10_000, 'the wait for a stranger');
    const since = 1_000_000;
    assert(!joinWaitOver(since, since + MATCH_JOIN_WAIT_MS - 1), 'gave up early');
    assert(joinWaitOver(since, since + MATCH_JOIN_WAIT_MS), 'waits on for somebody not coming');
    assert(!joinWaitOver(0, since), 'a wait that never started is over');
    const screen = src('src/demo/DiceDemoScreen.tsx');
    assert(
      /friendly\.kind === 'match' && joinWaitOver\(friendWaitSinceRef\.current, Date\.now\(\)\)\) friendNoShow\(\)/.test(screen),
      'the screen does not give up on a stranger who never arrived',
    );
    const noShow = screen.slice(screen.indexOf('const matchNoShow = useCallback'), screen.indexOf('matchNoShowRef.current = matchNoShow'));
    assert(noShow.includes('skipSearchRef.current = true'), 'a no-show searches again');
    assert(noShow.includes("startCountdown('casual')"), 'a no-show does not start a rival');
    assert(noShow.includes('{ leave: true }'), 'a no-show leaves the room open');
  });
});

/*
  A PRETEND SERVER, speaking the /api/match contract (PLAN J7) through a
  stubbed fetch, so two phones can be run against each other in node.
  It is not the server; it is the shape the client was written to.
*/
function fakeServer() {
  type Row = { state: 'searching' | 'matched' | 'withdrawn'; mode: string; difficulty: string; battle?: string; other?: string };
  const queue = new Map<string, Row>();
  const names: Record<string, string> = { 'p-a': 'Ava', 'p-b': '' };
  const left: string[] = [];
  let made = 0;
  const reply = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
  const matched = (me: string, row: Row) =>
    reply({
      state: 'matched',
      battle: { id: row.battle, mode: row.mode, difficulty: row.difficulty, opponentId: row.other, opponentName: names[row.other!] },
    });
  const fetch = async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}'));
    if (url.endsWith('/battles/live')) {
      if (body.leave) left.push(`${body.playerId}:${body.battleId}`);
      return reply({ over: true });
    }
    if (!url.endsWith('/match')) return reply({ ok: true });
    const me: string = body.playerId;
    const mine = queue.get(me);
    if (body.action === 'leave') {
      if (mine?.state === 'matched') return matched(me, mine);
      if (mine) mine.state = 'withdrawn';
      return reply({ state: 'left' });
    }
    if (mine?.state === 'matched') return matched(me, mine);
    queue.set(me, { state: 'searching', mode: body.mode, difficulty: body.difficulty });
    const partner = [...queue.entries()].find(
      ([id, r]) => id !== me && r.state === 'searching' && r.mode === body.mode && r.difficulty === body.difficulty,
    );
    if (!partner) return reply({ state: 'searching' });
    const battle = `battle-${++made}`;
    queue.set(partner[0], { ...partner[1], state: 'matched', battle, other: me });
    const row: Row = { state: 'matched', mode: body.mode, difficulty: body.difficulty, battle, other: partner[0] };
    queue.set(me, row);
    return matched(me, row);
  };
  return { fetch, queue, left };
}

async function withServer<T>(server: ReturnType<typeof fakeServer>, body: () => Promise<T>): Promise<T> {
  const real = (globalThis as { fetch?: unknown }).fetch;
  (globalThis as { fetch?: unknown }).fetch = server.fetch;
  resetMatchmakingForTest();
  try {
    return await body();
  } finally {
    (globalThis as { fetch?: unknown }).fetch = real;
    resetMatchmakingForTest();
  }
}

const phone = (playerId: string) => ({ playerId, secret: `s-${playerId}`, name: playerId, friendCode: 'ABCD2345' }) as never;
const REQ = { mode: 'classic' as const, difficulty: 'medium' as const, trophies: 400 };
const STATS = {} as never;

suite('match flow · two phones through a stubbed fetch', () => {
  test('two phones pair into the same battle, each by the other\'s name', async () => {
    const server = fakeServer();
    await withServer(server, async () => {
      let a = startFlow(500, REQ.mode, true);
      let b = startFlow(500, REQ.mode, true);
      a = stepFlow(a, { type: 'answer', pairing: await findWaitingPlayer(phone('p-a'), REQ, STATS) }).state;
      assertEqual(a.kind, 'searching', 'the first phone in found somebody who was not there');
      b = stepFlow(b, { type: 'answer', pairing: await findWaitingPlayer(phone('p-b'), REQ, STATS) }).state;
      a = stepFlow(a, { type: 'answer', pairing: await findWaitingPlayer(phone('p-a'), REQ, STATS) }).state;
      assertEqual(a.kind, 'matched', 'phone A was not matched');
      assertEqual(b.kind, 'matched', 'phone B was not matched');
      if (a.kind !== 'matched' || b.kind !== 'matched') return;
      assertEqual(a.pairing.battle.id, b.pairing.battle.id, 'the two phones are in different rooms');
      assertEqual(b.pairing.name, 'Ava', 'B does not see A by name');
      assertEqual(a.pairing.name, 'Player', 'a blank name is not "Player"');
      // Both go on into the waiting room (onPlayer → startOnline), as the screen does.
      const screen = src('src/demo/DiceDemoScreen.tsx');
      assert(/onPlayer=\{startOnline\}/.test(screen), 'a match does not reach the waiting room');
      assert(/startFriendly\(battle, opponentDisplayName\(name\), 'match'\)/.test(screen), 'a match is not a live battle');
      note(`two phones paired into ${a.pairing.battle.id}`);
    });
  });

  test('one phone alone gets the bot at 15 s', async () => {
    const server = fakeServer();
    await withServer(server, async () => {
      let state = startFlow(500, REQ.mode, true);
      for (let t = 0; t < SEARCH_DEADLINE_MS; t += 900) {
        state = stepFlow(state, { type: 'answer', pairing: await findWaitingPlayer(phone('p-a'), REQ, STATS) }).state;
        state = stepFlow(state, { type: 'tick', elapsedMs: t }).state;
      }
      assertEqual(state.kind, 'searching', 'stopped looking before the deadline');
      const step = stepFlow(state, { type: 'tick', elapsedMs: SEARCH_DEADLINE_MS });
      assertEqual(step.state.kind, 'withdrawing', 'did not withdraw');
      state = stepFlow(step.state, { type: 'leaveAnswer', pairing: await withdrawFromSearch(phone('p-a')) }).state;
      assertEqual(state.kind, 'bot', 'alone, and not given a rival');
      assertEqual(server.queue.get('p-a')?.state, 'withdrawn', 'still in the queue after giving up');
    });
  });

  test('a pairing just before the deadline is joined, not abandoned', async () => {
    const server = fakeServer();
    await withServer(server, async () => {
      let a = startFlow(500, REQ.mode, true);
      a = stepFlow(a, { type: 'answer', pairing: await findWaitingPlayer(phone('p-a'), REQ, STATS) }).state;
      // B arrives at 14.9 s and is paired with A before A hears of it.
      const b = await findWaitingPlayer(phone('p-b'), REQ, STATS);
      a = stepFlow(a, { type: 'tick', elapsedMs: SEARCH_DEADLINE_MS }).state;
      assertEqual(a.kind, 'withdrawing', 'did not withdraw');
      a = stepFlow(a, { type: 'leaveAnswer', pairing: await withdrawFromSearch(phone('p-a')) }).state;
      assertEqual(a.kind, 'matched', 'A abandoned B in the room');
      assertEqual(
        a.kind === 'matched' && b?.kind === 'player' ? a.pairing.battle.id === b.battle.id : false,
        true,
        'A joined a different room',
      );
    });
  });

  test('cancel leaves the queue and returns to the menu', async () => {
    const server = fakeServer();
    await withServer(server, async () => {
      let a = startFlow(500, REQ.mode, true);
      a = stepFlow(a, { type: 'answer', pairing: await findWaitingPlayer(phone('p-a'), REQ, STATS) }).state;
      const step = stepFlow(a, { type: 'cancel' });
      assertEqual(step.state.kind, 'cancelled', 'cancel did not cancel');
      await cancelSearch(phone('p-a'));
      assertEqual(server.queue.get('p-a')?.state, 'withdrawn', 'still in the queue after Cancel');
      const overlay = src('src/demo/MatchmakingOverlay.tsx');
      assert(/dispatch\(\{ type: 'cancel' \}\);\s*onCancel\(\);/.test(overlay), 'Cancel does not leave');
      const screen = src('src/demo/DiceDemoScreen.tsx');
      assert(/onCancel=\{quitToMenu\}\s*\/>/.test(screen), 'Cancel does not go back to the menu');
    });
  });

  test('cancelling after the server paired us walks out of the room', async () => {
    const server = fakeServer();
    await withServer(server, async () => {
      await findWaitingPlayer(phone('p-a'), REQ, STATS);
      await findWaitingPlayer(phone('p-b'), REQ, STATS);
      // A cancels before its next ask has heard about the pairing.
      await cancelSearch(phone('p-a'));
      assertEqual(server.left.join(), 'p-a:battle-1', 'B is left waiting for somebody who cancelled');
    });
  });
});

suite('match flow · no computer rival before the real search', () => {
  test('the overlay draws the search, not a rival, while the first ask is out', () => {
    const overlay = readFileSync(join(__dirname, '..', 'src', 'demo', 'MatchmakingOverlay.tsx'), 'utf8');
    assert(/const searching = showsSearch\(flow\)/.test(overlay), 'the overlay no longer asks showsSearch');
    const flow = readFileSync(join(__dirname, '..', 'src', 'game', 'matchFlow.ts'), 'utf8');
    assert(/return state\.kind === 'asking' \|\| state\.kind === 'searching'/.test(flow), 'asking is not shown as a search');
  });
});
