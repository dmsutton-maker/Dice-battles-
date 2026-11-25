import './storageMock';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, suite, test } from './harness';
import { store } from './storageMock';
import {
  STAKES,
  battleKindOf,
  paysNothing,
  stakesFor,
  PRACTICE_RESULT_LINE,
  type BattleKind,
} from '../src/game/stakes';
import { forfeitIsLoss, forgetMatch, rememberMatch, settleUnfinishedMatch } from '../src/game/pendingMatch';
import { getProgress, resetProgressForTests } from '../src/game/progress';
import { leaveWords, whereLine } from '../src/game/battleMenu';

const root = join(__dirname, '..');
const screen = readFileSync(join(root, 'src/demo/DiceDemoScreen.tsx'), 'utf8');
const between = (from: string, to: string) => screen.slice(screen.indexOf(from), screen.indexOf(to, screen.indexOf(from)));

/**
 * Marc, 4 Nov 2026: "the online battle should be the dominant way to
 * play and should count towards everything. the only way to play a bot
 * should be if no real player is found in 15 seconds, and the rewards
 * should still be for that also. Also there should be a button in
 * settings that lets you play a bot as practice and those battles don't
 * count for anything". And: "if i forfeit an online match, do I lose
 * trophies? If i don't then make sure I do".
 */

suite('stakes · what each battle counts toward', () => {
  test('online and computer battles count for everything', () => {
    for (const kind of ['online', 'computer'] as BattleKind[]) {
      for (const [field, on] of Object.entries(stakesFor(kind))) {
        assertEqual(on, true, `${kind} does not count toward ${field}`);
      }
    }
  });

  test('practice and friendly battles count for nothing', () => {
    for (const kind of ['practice', 'friend'] as BattleKind[]) {
      assert(paysNothing(stakesFor(kind)), `${kind} counts toward something`);
    }
  });

  test('every row is all or nothing, so one early return in finishRound is exact', () => {
    for (const [kind, row] of Object.entries(STAKES)) {
      const values = new Set(Object.values(row));
      assertEqual(values.size, 1, `${kind} is a partial row; finishRound would need wiring field by field`);
    }
  });

  test('the kind comes from the live battle, else practice, else computer', () => {
    assertEqual(battleKindOf('match', false), 'online', 'a match');
    assertEqual(battleKindOf('friend', false), 'friend', 'a friend');
    assertEqual(battleKindOf(null, true), 'practice', 'practice');
    assertEqual(battleKindOf(null, false), 'computer', 'the rival after a search');
  });

  test('finishRound is routed through the table', () => {
    const finish = between('const finishRound = useCallback', 'const startCountdown');
    assert(
      finish.includes('const stakes = stakesFor(battleKindOf(playing?.kind ?? null, practiceRef.current));'),
      'finishRound does not ask stakes.ts',
    );
    const early = finish.indexOf('if (paysNothing(stakes)) {');
    assert(early > 0, 'no early return for a battle that pays nothing');
    for (const paid of ['noteGameFinished()', 'notePlayed(', 'awardCoins(', 'scoreBattle(', 'battleXp(', 'countQuestBattle(', 'applyMatchResult(', 'syncGameCenter()']) {
      const at = finish.indexOf(paid);
      assert(at > early, `${paid} is not behind the stakes check`);
    }
    assert(!/online \? \[\]/.test(finish), 'an online battle still skips the cups');
    assert(!/if \(!online\) noteGameFinished/.test(finish), 'an online battle still skips the ad tally');
  });
});

suite('stakes · practice', () => {
  test('a button in Settings starts a practice battle with no search', () => {
    const settings = screen.slice(screen.indexOf("{popup === 'settings' && ("));
    assert(settings.includes('Practice against a bot'), 'no practice button in Settings');
    assert(/setPopup\(null\);\s*setTab\('play'\);\s*startCountdown\('practice'\);/.test(settings), 'the button does not leave Settings and start');
    assert(screen.includes("botOnly={practice ? 'practice'"), 'practice searches for a person');
  });

  test('the battle and the result say it is practice', () => {
    assert(/\{practice && <Text style=\{styles\.practiceTag\}>PRACTICE<\/Text>\}/.test(screen), 'no Practice tag on the battle');
    // paidLines (won and lost) and the tie screen.
    assertEqual((screen.match(/\{PRACTICE_RESULT_LINE\}/g) ?? []).length, 2, 'the result screens do not say practice');
    assertEqual((screen.match(/\{paidLines\(/g) ?? []).length, 2, 'won and lost should both use paidLines');
    assertEqual(PRACTICE_RESULT_LINE, 'Practice — nothing changes', 'the result line');
  });

  test('leaving practice threatens nothing', () => {
    const words = leaveWords({ kind: 'practice' });
    assert(!words.lines.some((l) => /lose|loss/i.test(l)), 'practice threatens a loss');
    assert(!/loss/i.test(words.leaveLabel), 'the leave button says loss');
    assertEqual(whereLine('practice', 'classic', 'easy'), 'Color Rush · practice', 'where line');
    assert(/practice\s*\? \{ kind: 'practice' \}/.test(screen), 'the menu is not told it is practice');
    assert(/const menuKind: BattleMenuKind = friendly \? 'friend' : practice \? 'practice' : 'computer'/.test(screen), 'menu kind');
  });
});

suite('stakes · forfeiting an online battle', () => {
  test('leaving from the menu is the ordinary loss', () => {
    const leave = between('const leaveBattle = useCallback', '}, [quitToMenu, finishRound]);');
    assert(/friendlyRef\.current\.kind === 'friend'\) \{\s*quitToMenu\(\);/.test(leave), 'a match is left without a loss');
    assert(leave.includes("finishRound('lost')"), 'leaving is not a loss');
    // And a loss in a match reaches the trophies (online counts for everything).
    assertEqual(stakesFor(battleKindOf('match', false)).trophies, true, 'an online loss moves no trophies');
  });

  test('the battle is written down at the countdown and crossed off when it settles', () => {
    const begin = between('const beginCountdown = useCallback', '// Background music');
    assert(begin.includes('rememberMatch('), 'an online battle is never written down');
    const finish = between('const finishRound = useCallback', 'const startCountdown');
    assert(/if \(playing\.kind === 'match'\) forgetMatch\(\);/.test(finish), 'a settled match is not crossed off');
    assert(screen.includes('settleUnfinishedMatch(me)'), 'nothing settles a walk-out at launch');
    assert(screen.includes('showCallout(FORFEIT_LINE)'), 'the walk-out is not explained');
  });

  test('only a server verdict of a win or a tie saves the trophies', () => {
    const pulse = (over: boolean, winner: string | null) => ({
      theirs: [], winner, over, theyDropped: false, msLeft: null, started: true,
    });
    assertEqual(forfeitIsLoss(null, 'me'), true, 'no record is not a loss');
    assertEqual(forfeitIsLoss(pulse(true, 'them'), 'me'), true, 'their win is not my loss');
    assertEqual(forfeitIsLoss(pulse(true, null), 'me'), true, 'a swept battle is not a loss');
    assertEqual(forfeitIsLoss(pulse(false, null), 'me'), true, 'a battle still on is not a loss');
    assertEqual(forfeitIsLoss(pulse(true, 'me'), 'me'), false, 'my win is a loss');
    assertEqual(forfeitIsLoss(pulse(true, 'tie'), 'me'), false, 'a tie is a loss');
  });

  const ME = { playerId: 'me', secret: 's', name: 'Me', friendCode: 'ABCD2345' } as never;
  async function launchWith(answer: () => Promise<unknown>): Promise<{ trophies: number; result: unknown; calls: string[] }> {
    const calls: string[] = [];
    const real = (globalThis as { fetch?: unknown }).fetch;
    (globalThis as { fetch?: unknown }).fetch = async (url: string, init?: RequestInit) => {
      calls.push(`${url} ${String(init?.body ?? '')}`);
      return answer();
    };
    try {
      const result = await settleUnfinishedMatch(ME);
      return { trophies: getProgress().trophies, result, calls };
    } finally {
      (globalThis as { fetch?: unknown }).fetch = real;
    }
  }
  const json = (body: unknown, status = 200) => async () => ({ ok: status < 300, status, json: async () => body });

  test('killed mid-battle and the other side won: the loss is applied once', async () => {
    resetProgressForTests({ trophies: 500 });
    rememberMatch({ battleId: 'b-1', mode: 'classic', difficulty: 'medium' });
    await new Promise((r) => setTimeout(r, 0));
    const first = await launchWith(json({ over: true, winner: 'them', theirs: [] }));
    assert(first.trophies < 500, `no trophies were lost (${first.trophies})`);
    assert(first.result !== null, 'the loss was not reported for the callout');
    assert(first.calls.length === 1 && first.calls[0].includes('/battles/live') && first.calls[0].includes('"leave":true'), 'the server was not told');
    const second = await launchWith(json({ over: true, winner: 'them', theirs: [] }));
    assertEqual(second.trophies, first.trophies, 'the loss was applied twice');
    assertEqual(second.calls.length, 0, 'asked again with nothing pending');
  });

  test('no record on the server (swept) is still a loss', async () => {
    resetProgressForTests({ trophies: 500 });
    rememberMatch({ battleId: 'b-2', mode: 'ultimate', difficulty: 'hard' });
    await new Promise((r) => setTimeout(r, 0));
    const after = await launchWith(json({ error: 'no such battle' }, 404));
    assert(after.trophies < 500, 'a swept battle cost nothing');
  });

  test('the server says this player won, or tied: nothing is taken', async () => {
    for (const winner of ['me', 'tie']) {
      resetProgressForTests({ trophies: 500 });
      rememberMatch({ battleId: 'b-3', mode: 'classic', difficulty: 'easy' });
      await new Promise((r) => setTimeout(r, 0));
      const after = await launchWith(json({ over: true, winner, theirs: [] }));
      assertEqual(after.trophies, 500, `${winner}: trophies were taken`);
      assertEqual(after.result, null, `${winner}: reported a loss`);
    }
  });

  test('a battle that settled normally is never charged', async () => {
    resetProgressForTests({ trophies: 500 });
    rememberMatch({ battleId: 'b-4', mode: 'classic', difficulty: 'easy' });
    forgetMatch();
    await new Promise((r) => setTimeout(r, 0));
    const after = await launchWith(json({ over: true, winner: 'them', theirs: [] }));
    assertEqual(after.trophies, 500, 'charged for a battle that finished');
    assertEqual(after.calls.length, 0, 'asked about a battle that finished');
    assert(![...store.keys()].includes('dice-battles:pending-match'), 'the record is still stored');
  });
});
