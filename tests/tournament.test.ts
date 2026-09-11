import './storageMock';
import { readFileSync } from 'node:fs';
import { assert, assertEqual, suite, test } from './harness';
import { getProgress, resetProgressForTests, setRun } from '../src/game/progress';
import {
  TOURNAMENTS,
  advanceRun,
  canEnter,
  playersLeft,
  roundName,
  roundsToWin,
  startRun,
  tournamentById,
} from '../src/game/tournament';
import { averageOf } from '../src/game/rewards';

suite('tournament · brackets', () => {
  test('every cup is a real knockout bracket', () => {
    for (const cup of TOURNAMENTS) {
      assert(cup.size === 4 || cup.size === 8, `${cup.id} has an odd bracket`);
      assertEqual(
        roundsToWin(cup.size),
        Math.log2(cup.size),
        `${cup.id} rounds`,
      );
      assert(cup.prize.min > 0, `${cup.id} pays nothing`);
      assert(cup.entry >= 0, `${cup.id} has a negative entry fee`);
    }
  });

  test('there is always a cup you can enter with nothing', () => {
    assert(
      TOURNAMENTS.some((c) => c.entry === 0),
      'every cup costs money — a new player could never start one',
    );
  });

  test('a cup pays more than it costs to enter', () => {
    for (const cup of TOURNAMENTS) {
      assert(
        averageOf(cup.prize) > cup.entry,
        `${cup.id} costs ${cup.entry} and pays about ${averageOf(cup.prize)}`,
      );
    }
  });

  test('harder cups cost more and pay more', () => {
    for (let i = 1; i < TOURNAMENTS.length; i++) {
      assert(
        TOURNAMENTS[i].entry >= TOURNAMENTS[i - 1].entry,
        `${TOURNAMENTS[i].id} is cheaper than the one before it`,
      );
      assert(
        averageOf(TOURNAMENTS[i].prize) > averageOf(TOURNAMENTS[i - 1].prize),
        `${TOURNAMENTS[i].id} pays less than the one before it`,
      );
    }
  });
});

suite('tournament · a run', () => {
  const cup = TOURNAMENTS[0];

  test('winning every round makes you champion, and only then', () => {
    let run = startRun(cup);
    for (let i = 0; i < roundsToWin(cup.size) - 1; i++) {
      run = advanceRun(run, cup, true);
      assertEqual(run.finished, null, `finished early after ${i + 1} wins`);
    }
    run = advanceRun(run, cup, true);
    assertEqual(run.finished, 'champion', 'never crowned');
  });

  test('one loss ends the run, however far in', () => {
    let run = advanceRun(startRun(cup), cup, true);
    run = advanceRun(run, cup, false);
    assertEqual(run.finished, 'knocked-out', 'survived a loss');
  });

  test('a finished run cannot be played on', () => {
    const out = advanceRun(startRun(cup), cup, false);
    const again = advanceRun(out, cup, true);
    assertEqual(again.finished, 'knocked-out', 'a knocked-out run continued');
    assertEqual(again.wins, out.wins, 'a finished run gained a win');
  });

  test('the round is named for how many are left, not how many played', () => {
    const big = TOURNAMENTS.find((c) => c.size === 8)!;
    assertEqual(roundName(big.size, 0), 'Quarter-final', 'first round of 8');
    assertEqual(roundName(big.size, 1), 'Semi-final', 'second round of 8');
    assertEqual(roundName(big.size, 2), 'Final', 'last round of 8');
    assertEqual(roundName(big.size, 3), 'Champion', 'after winning it');
    assertEqual(roundName(4, 0), 'Semi-final', 'first round of 4');
    assertEqual(roundName(4, 1), 'Final', 'last round of 4');
  });

  test('the field halves each round and never reaches zero', () => {
    for (const cup of TOURNAMENTS) {
      let previous = Infinity;
      for (let w = 0; w <= roundsToWin(cup.size); w++) {
        const left = playersLeft(cup.size, w);
        assert(left >= 1, `${cup.id} had ${left} players left`);
        assert(left < previous, `${cup.id} field did not shrink`);
        previous = left;
      }
    }
  });

  test('you cannot enter a cup you cannot pay for', () => {
    const paid = TOURNAMENTS.find((c) => c.entry > 0)!;
    assert(!canEnter(paid, paid.entry - 1), 'entered while short');
    assert(canEnter(paid, paid.entry), 'refused with the exact fee');
  });

  test('a run points at a cup that exists', () => {
    for (const cup of TOURNAMENTS) {
      const run = startRun(cup);
      assert(
        tournamentById(run.tournamentId) !== undefined,
        `${cup.id} produced a run pointing at nothing`,
      );
    }
    assertEqual(tournamentById('no-such-cup'), undefined, 'invented a cup');
  });
});

suite('cups · a run survives the app being killed', () => {
  test('entering, winning a round and giving up all reach the save', () => {
    /*
      A run used to live only in React state. Force-quitting mid-run lost
      the run AND the 50 or 150 coins paid to enter it, with nothing on
      screen to say so — the one thing a player owns that did not
      survive being killed was the thing they had actually paid for.
    */
    const screen = readFileSync('src/demo/DiceDemoScreen.tsx', 'utf8');
    assert(
      screen.includes('setRun as saveRun'),
      'the screen no longer writes the run to the save',
    );
    assert(
      /const setRun = useCallback\(\(next: RunState \| null\) => \{[\s\S]*?saveRun\(/.test(screen),
      'changing the run no longer writes it to the save',
    );
    assert(
      screen.includes('if (progress.run && tournamentById(progress.run.tournamentId))'),
      'a saved run is never picked back up on launch',
    );
  });

  test('the save keeps a run going and forgets a finished one', () => {
    resetProgressForTests();
    assertEqual(getProgress().run ?? null, null, 'a fresh save has no run');

    setRun({ tournamentId: 'grand', wins: 2 });
    assertEqual(getProgress().run?.tournamentId, 'grand', 'the cup is remembered');
    assertEqual(getProgress().run?.wins, 2, 'the rounds won are remembered');

    setRun(null);
    assertEqual(getProgress().run ?? null, null, 'a finished run is forgotten');
  });

  test('a saved run always names a cup that still exists', () => {
    // A save written before a cup was renamed or removed must not strand
    // the Cups tab on a run nobody can play.
    for (const t of TOURNAMENTS) {
      assert(tournamentById(t.id) !== undefined, `${t.id} cannot be looked up`);
    }
    assertEqual(tournamentById('a-cup-that-never-was'), undefined, 'unknown ids resolve');
  });
});
