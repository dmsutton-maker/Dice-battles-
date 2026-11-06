import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  cupIndexForWeek,
  easternOffsetMs,
  MAX_IDLE_WEEKS,
  REST_WEEKS,
  ROTATION_CUPS,
  rotationCup,
  weekIndex,
  weekStart,
  withRotation,
  WEEK,
} from '../src/game/cupRotation';
import { isTournamentDef, liveTournaments, scorableTournaments, todayStamp, TOURNAMENTS } from '../src/game/tournament';
import { resolveItem } from '../src/game/prizes';

/*
  David, 21 Oct 2026: "make 10 different unique cups of varying
  difficulty but never too easy ... automatically change the cup every
  week at 12 AM EST ... Whenever a cup is used, it can't be used again
  for at least another 6 weeks after. I don't want the same rotation
  every time though, so give some variation."
*/
const root = join(__dirname, '..');
const at = (iso: string) => Date.parse(iso);

suite('weekly cup · the ten', () => {
  test('ten of them, each its own', () => {
    assertEqual(ROTATION_CUPS.length, 10, 'how many');
    assertEqual(new Set(ROTATION_CUPS.map((c) => c.id)).size, 10, 'ids repeat');
    assertEqual(new Set(ROTATION_CUPS.map((c) => c.name)).size, 10, 'names repeat');
    assertEqual(
      new Set(ROTATION_CUPS.map((c) => `${c.mode}/${c.difficulty}/${c.target}`)).size,
      10,
      'two cups ask for the same run',
    );
    for (const c of ROTATION_CUPS) assert(isTournamentDef({ ...c, closes: '2026-10-25' }), `${c.id} is not a cup the game can run`);
  });

  test('none is easy, and they climb', () => {
    for (const c of ROTATION_CUPS) {
      assert(c.difficulty !== 'easy', `${c.name} is on Easy`);
      assert(c.target >= 5, `${c.name} asks for only ${c.target} in a row`);
    }
    const targets = ROTATION_CUPS.map((c) => c.target);
    assert(Math.max(...targets) >= 8 && Math.min(...targets) <= 5, 'the cups are all the same difficulty');
    assert(ROTATION_CUPS.some((c) => c.difficulty === 'medium') && ROTATION_CUPS.some((c) => c.difficulty === 'hard'), 'only one difficulty');
    // A harder cup pays more.
    const effort = (c: (typeof ROTATION_CUPS)[number]) => (c.difficulty === 'hard' ? 10 : 0) + c.target;
    const sorted = [...ROTATION_CUPS].sort((a, b) => effort(a) - effort(b));
    for (let i = 1; i < sorted.length; i++) {
      assert(sorted[i].prize.trophies >= sorted[i - 1].prize.trophies, `${sorted[i].name} pays fewer trophies than the easier ${sorted[i - 1].name}`);
      assert(sorted[i].prize.coins.max >= sorted[i - 1].prize.coins.max, `${sorted[i].name} pays fewer coins than the easier ${sorted[i - 1].name}`);
    }
  });

  test('the only item prize is the Amethyst die, on the hardest cup', () => {
    const withItem = ROTATION_CUPS.filter((c) => c.prize.item);
    assertEqual(withItem.length, 1, 'cups with an item');
    assertEqual(withItem[0].prize.item!.id, 'amethyst', 'the item');
    assert(resolveItem(withItem[0].prize.item!) !== null, 'the Amethyst die cannot be handed over');
    const hardest = Math.max(...ROTATION_CUPS.filter((c) => c.difficulty === 'hard').map((c) => c.target));
    assert(withItem[0].difficulty === 'hard' && withItem[0].target === hardest, 'the die is not on the hardest cup');
  });

  test('none of them is in the always-on list', () => {
    assertEqual(TOURNAMENTS.length, 0, 'the game ships an always-on cup');
  });
});

suite('weekly cup · the clock turns at midnight Monday, New York time', () => {
  test('summer and winter', () => {
    assertEqual(easternOffsetMs(at('2026-07-01T12:00:00Z')), -4 * 3_600_000, 'July');
    assertEqual(easternOffsetMs(at('2026-12-01T12:00:00Z')), -5 * 3_600_000, 'December');
    // The clocks change at 2 AM on the first Sunday of November 2026 (the 1st).
    assertEqual(easternOffsetMs(at('2026-11-01T05:59:59Z')), -4 * 3_600_000, 'just before');
    assertEqual(easternOffsetMs(at('2026-11-01T06:00:00Z')), -5 * 3_600_000, 'just after');
    // And at 2 AM on the second Sunday of March 2027 (the 14th).
    assertEqual(easternOffsetMs(at('2027-03-14T06:59:59Z')), -5 * 3_600_000, 'before spring');
    assertEqual(easternOffsetMs(at('2027-03-14T07:00:00Z')), -4 * 3_600_000, 'after spring');
  });

  test('a week turns at 12 AM Eastern, in summer and in winter', () => {
    // Monday 26 Oct 2026, 00:00 EDT is 04:00 UTC.
    assertEqual(weekIndex(at('2026-10-26T03:59:59Z')), 0, 'Sunday night, summer time');
    assertEqual(weekIndex(at('2026-10-26T04:00:00Z')), 1, 'Monday, summer time');
    // Monday 2 Nov 2026, 00:00 EST is 05:00 UTC.
    assertEqual(weekIndex(at('2026-11-02T04:59:59Z')), 1, 'Sunday night, winter time');
    assertEqual(weekIndex(at('2026-11-02T05:00:00Z')), 2, 'Monday, winter time');
    assertEqual(weekStart(1), at('2026-10-26T04:00:00Z'), 'week 1 starts');
    assertEqual(weekStart(2), at('2026-11-02T05:00:00Z'), 'week 2 starts');
    // Every week starts on a Monday at New York midnight, for years.
    for (let w = 0; w < 520; w++) {
      const start = weekStart(w);
      const local = new Date(start + easternOffsetMs(start));
      assertEqual(local.getUTCDay(), 1, `week ${w} does not start on a Monday`);
      assertEqual(local.getUTCHours() + local.getUTCMinutes(), 0, `week ${w} does not start at midnight`);
      assert(weekIndex(start) === w && weekIndex(start - 1) === w - 1 || w === 0, `week ${w} is not its own`);
    }
  });

  test('a phone with its clock before the start still gets week 0', () => {
    assertEqual(weekIndex(at('2020-01-01T00:00:00Z')), 0, 'before the epoch');
  });
});

suite('weekly cup · which one runs', () => {
  const N = 2000;
  const seq = Array.from({ length: N }, (_, w) => cupIndexForWeek(w));

  test('the first ten weeks use every cup once', () => {
    assertEqual(new Set(seq.slice(0, 10)).size, 10, 'a cup repeats in the first ten weeks');
  });

  test('a cup rests at least six weeks, and is never forgotten', () => {
    const last: number[] = [];
    let minGap = Infinity;
    let maxGap = 0;
    for (let w = 0; w < N; w++) {
      const c = seq[w];
      if (last[c] !== undefined) {
        minGap = Math.min(minGap, w - last[c]);
        maxGap = Math.max(maxGap, w - last[c]);
      }
      last[c] = w;
    }
    assert(minGap >= REST_WEEKS, `a cup came back after ${minGap} weeks`);
    assert(maxGap <= MAX_IDLE_WEEKS, `a cup was left out for ${maxGap} weeks`);
    note(`over ${N} weeks a cup comes back after ${minGap} to ${maxGap} weeks`);
  });

  test('the order varies rather than looping', () => {
    const blocks = new Set<string>();
    for (let b = 0; b < 20; b++) blocks.add(seq.slice(b * 10, b * 10 + 10).join(','));
    assert(blocks.size >= 15, `only ${blocks.size} different orders in 200 weeks`);
    let same = 0;
    for (let w = 10; w < N; w++) if (seq[w] === seq[w - 10]) same++;
    assert(same < N * 0.5, 'the schedule mostly repeats every ten weeks');
  });

  test('every cup gets its fair share', () => {
    const count = new Array(ROTATION_CUPS.length).fill(0);
    for (const c of seq) count[c]++;
    for (let i = 0; i < count.length; i++) {
      assert(count[i] > N * 0.07 && count[i] < N * 0.13, `${ROTATION_CUPS[i].name} ran ${count[i]} of ${N} weeks`);
    }
  });

  test('the answer is the same however it is asked', () => {
    assertEqual(cupIndexForWeek(500), seq[500], 'asking out of order');
    assertEqual(cupIndexForWeek(7), seq[7], 'asking again');
  });
});

suite('weekly cup · on the tab', () => {
  test('the week’s cup has that week’s dates, in the phone’s own calendar', () => {
    const now = at('2026-10-21T15:00:00Z');
    const cup = rotationCup(now);
    assert(cup.id.endsWith('-w0'), `week 0's id is ${cup.id}`);
    assertEqual(cup.opens, todayStamp(new Date(weekStart(0))), 'opens');
    assertEqual(cup.closes, todayStamp(new Date(weekStart(1) - 1)), 'closes');
    assert(isTournamentDef(cup), 'not a cup the game can run');
    // The next week is a different cup, under a different id.
    const next = rotationCup(now + WEEK);
    assert(next.id.endsWith('-w1') && next.name !== cup.name, 'the next week shows the same cup');
  });

  test('it is shown, first, and scored, with a board cup beside it', () => {
    const now = at('2026-10-21T15:00:00Z');
    const today = todayStamp(new Date(now));
    const board = [
      { id: 'board-a', name: 'Board A', blurb: '', mode: 'classic' as const, difficulty: 'easy' as const, target: 3, prize: { coins: { min: 1, max: 2 }, trophies: 1 }, opens: '2026-10-01', closes: '2026-12-31' },
      { id: 'board-b', name: 'Board B', blurb: '', mode: 'classic' as const, difficulty: 'easy' as const, target: 3, prize: { coins: { min: 1, max: 2 }, trophies: 1 }, opens: '2026-10-01', closes: '2026-12-31' },
    ];
    const all = withRotation(board, now);
    const shown = liveTournaments(all, today);
    assertEqual(shown.length, 2, 'how many on the tab');
    assert(shown.some((t) => t.id === rotationCup(now).id), 'the week’s cup is not on the tab');
    assert(shown.some((t) => t.id === 'board-a'), 'the first board cup is not on the tab');
    const scored = scorableTournaments(all, today);
    assert(scored.some((t) => t.id === rotationCup(now).id), 'the week’s cup is not scored');
    // With nothing on the board it still runs on its own.
    assertEqual(liveTournaments(withRotation([], now), today).length, 1, 'alone');
  });

  test('the screens use it', () => {
    const screen = readFileSync(join(root, 'src/demo/DiceDemoScreen.tsx'), 'utf8');
    assert(/tournaments=\{withRotation\(cups, Date\.now\(\)\)\}/.test(screen), 'the Cups tab is not shown the week’s cup');
    assert(/scorableTournaments\(withRotation\(cupsRef\.current, Date\.now\(\)\), todayStamp\(\)\)/.test(screen), 'a battle is not scored against the week’s cup');
  });
});
