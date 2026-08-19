import { assert, assertEqual, suite, test } from './harness';
import { PRISONER_COLORS } from '../src/game/colors';
import { makeUnits, ModeId } from '../src/game/modes';
import {
  SplitBoards,
  applySplitMatch,
  scoreOf,
  targetFor,
} from '../src/game/splitRules';

const fresh = (mode: ModeId, a = PRISONER_COLORS[0], b = PRISONER_COLORS[1]): SplitBoards =>
  mode === 'colorwar'
    ? {
        a: makeUnits('colorwar', PRISONER_COLORS, a, b),
        b: makeUnits('colorwar', PRISONER_COLORS, b, a),
      }
    : {
        a: makeUnits(mode, PRISONER_COLORS, null, null),
        b: makeUnits(mode, PRISONER_COLORS, null, null),
      };

suite('splitRules · color rush', () => {
  test('a match frees that prisoner on your own board only', () => {
    const out = applySplitMatch('classic', fresh('classic'), 0, 'red');
    assertEqual(out.effect, 'rescued', 'no rescue');
    assertEqual(scoreOf(out.boards.a), 1, 'your score');
    assertEqual(scoreOf(out.boards.b), 0, 'your opponent should be untouched');
  });

  test('matching a colour you already freed does nothing', () => {
    let boards = fresh('classic');
    boards = applySplitMatch('classic', boards, 0, 'red').boards;
    const again = applySplitMatch('classic', boards, 0, 'red');
    assertEqual(again.effect, 'none', 'freed a prisoner twice');
    assertEqual(scoreOf(again.boards.a), 1, 'score moved');
  });

  test('six rescues wins it', () => {
    let boards = fresh('classic');
    let winner: number | null = null;
    for (const c of PRISONER_COLORS) {
      const out = applySplitMatch('classic', boards, 1, c.id);
      boards = out.boards;
      winner = out.winner;
    }
    assertEqual(winner, 1, 'player two should have won');
  });
});

suite('splitRules · ultimate', () => {
  test('matching a rescued colour sends it back to jail', () => {
    let boards = fresh('ultimate');
    boards = applySplitMatch('ultimate', boards, 0, 'green').boards;
    assertEqual(scoreOf(boards.a), 1, 'not rescued first');

    const back = applySplitMatch('ultimate', boards, 0, 'green');
    assertEqual(back.effect, 'returned', 'should have gone back to jail');
    assertEqual(scoreOf(back.boards.a), 0, 'still counted as rescued');
  });

  test('a returned prisoner goes back to its own cell', () => {
    let boards = fresh('ultimate');
    const home = boards.a.find((u) => u.colorId === 'green')!.jailIndex;
    boards = applySplitMatch('ultimate', boards, 0, 'green').boards;
    boards = applySplitMatch('ultimate', boards, 0, 'green').boards;
    const unit = boards.a.find((u) => u.colorId === 'green')!;
    assertEqual(unit.station.kind, 'jail', 'not in jail');
    assertEqual(unit.station.index, home, 'came back to the wrong cell');
  });

  test('sending one back never touches the other player', () => {
    let boards = fresh('ultimate');
    boards = applySplitMatch('ultimate', boards, 1, 'blue').boards;
    const out = applySplitMatch('ultimate', boards, 1, 'blue');
    assertEqual(scoreOf(out.boards.a), 0, 'player one was affected');
  });
});

suite('splitRules · skirmish', () => {
  test('claiming a prisoner takes it out of the other jail too', () => {
    const out = applySplitMatch('skirmish', fresh('skirmish'), 0, 'yellow');
    assertEqual(out.effect, 'stolen', 'not claimed');
    assertEqual(scoreOf(out.boards.a), 1, 'claimer did not get it');

    const onTheirs = out.boards.b.find((u) => u.colorId === 'yellow')!;
    assertEqual(onTheirs.station.kind, 'wall', 'should be gone from their jail');
  });

  test('the same prisoner cannot be claimed twice', () => {
    let boards = fresh('skirmish');
    boards = applySplitMatch('skirmish', boards, 0, 'yellow').boards;
    const second = applySplitMatch('skirmish', boards, 1, 'yellow');
    assertEqual(second.effect, 'none', 'both players got the same prisoner');
    assertEqual(scoreOf(second.boards.b), 0, 'a prisoner was counted twice');
  });

  test('the round ends when the shared jail empties, most rescues wins', () => {
    let boards = fresh('skirmish');
    let winner: number | null = null;
    // Player one takes four, player two takes two.
    const order: [0 | 1, number][] = [
      [0, 0], [1, 1], [0, 2], [0, 3], [1, 4], [0, 5],
    ];
    for (const [zone, i] of order) {
      const out = applySplitMatch('skirmish', boards, zone, PRISONER_COLORS[i].id);
      boards = out.boards;
      winner = out.winner;
    }
    assertEqual(scoreOf(boards.a), 4, 'player one count');
    assertEqual(scoreOf(boards.b), 2, 'player two count');
    assertEqual(winner, 0, 'player one should have taken it');
  });

  test('an even split is a draw, not a win', () => {
    let boards = fresh('skirmish');
    let winner: number | null = null;
    for (let i = 0; i < 6; i++) {
      const out = applySplitMatch(
        'skirmish',
        boards,
        (i % 2) as 0 | 1,
        PRISONER_COLORS[i].id,
      );
      boards = out.boards;
      winner = out.winner;
    }
    assertEqual(winner, null, 'three each should be a draw');
  });
});

suite('splitRules · color war', () => {
  const [mine, theirs] = [PRISONER_COLORS[0], PRISONER_COLORS[1]];

  test('only your own colour counts', () => {
    const boards = fresh('colorwar', mine, theirs);
    const wrong = applySplitMatch('colorwar', boards, 0, theirs.id, [
      mine.id,
      theirs.id,
    ]);
    assertEqual(wrong.effect, 'none', 'rescued the opponent\'s colour');

    const right = applySplitMatch('colorwar', boards, 0, mine.id, [
      mine.id,
      theirs.id,
    ]);
    assertEqual(right.effect, 'rescued', 'own colour did nothing');
  });

  test('three of your own colour wins it', () => {
    assertEqual(targetFor('colorwar'), 3, 'color war target');
    let boards = fresh('colorwar', mine, theirs);
    let winner: number | null = null;
    for (let i = 0; i < 3; i++) {
      const out = applySplitMatch('colorwar', boards, 0, mine.id, [
        mine.id,
        theirs.id,
      ]);
      boards = out.boards;
      winner = out.winner;
    }
    assertEqual(winner, 0, 'three rescues should have won');
  });

  test('winning takes three, not six', () => {
    let boards = fresh('colorwar', mine, theirs);
    let winner: number | null = null;
    for (let i = 0; i < 2; i++) {
      const out = applySplitMatch('colorwar', boards, 1, theirs.id, [
        mine.id,
        theirs.id,
      ]);
      boards = out.boards;
      winner = out.winner;
    }
    assertEqual(winner, null, 'won too early');
  });
});

suite('splitRules · every mode', () => {
  test('a match never changes the number of figures on a board', () => {
    for (const mode of ['classic', 'ultimate', 'skirmish', 'colorwar'] as ModeId[]) {
      const boards = fresh(mode);
      const before = [boards.a.length, boards.b.length];
      const out = applySplitMatch(mode, boards, 0, PRISONER_COLORS[0].id, [
        PRISONER_COLORS[0].id,
        PRISONER_COLORS[1].id,
      ]);
      assert(
        out.boards.a.length === before[0] && out.boards.b.length === before[1],
        `${mode} gained or lost a figure`,
      );
    }
  });

  test('no mode ever declares both players the winner', () => {
    for (const mode of ['classic', 'ultimate', 'skirmish', 'colorwar'] as ModeId[]) {
      let boards = fresh(mode);
      for (let round = 0; round < 12; round++) {
        for (const c of PRISONER_COLORS) {
          const out = applySplitMatch(mode, boards, (round % 2) as 0 | 1, c.id, [
            PRISONER_COLORS[0].id,
            PRISONER_COLORS[1].id,
          ]);
          boards = out.boards;
          assert(
            out.winner === null || out.winner === 0 || out.winner === 1,
            `${mode} reported a nonsense winner`,
          );
        }
      }
    }
  });
});
