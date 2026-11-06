import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  chooseQuest,
  countQuestBattle,
  offersAt,
  offersForDay,
  questById,
  questDay,
  questDayStamp,
  questDoneWords,
  QUEST_REST_DAYS,
  QUEST_SIZES,
  QUESTS,
  questTarget,
  questToday,
  questXp,
  type QuestBattle,
  type QuestState,
} from '../src/game/quests';
import { addXp, BATTLE_XP, LEVELS, levelFor, QUEST_XP, xpToReach } from '../src/game/seasonPass';
import { MODE_ORDER } from '../src/game/modes';

/*
  David, 1 Nov 2026: "Make it were you can choose out of three quests for
  the pass." Three offered every New York day — quick, medium, longer —
  pick one, finish it before midnight, and it pays season-pass XP.
*/
const root = join(__dirname, '..');
const at = (iso: string) => Date.parse(iso);
const DAY = 86_400_000;
/** Noon in New York on quest day d (17:00 UTC in winter, 16:00 in summer; 17:00 is always that day). */
const noonOf = (d: number) => Date.UTC(2026, 10, 1, 17) + d * DAY;
/** The first day a quest is on offer, and noon that day. */
function dayOffering(id: string): number {
  for (let d = 0; d < 400; d++) if (offersForDay(d).some((q) => q.id === id)) return noonOf(d);
  throw new Error(`${id} is never offered`);
}
const battle = (b: Partial<QuestBattle> = {}): QuestBattle => ({
  outcome: 'won',
  difficulty: 'medium',
  mode: 'classic',
  freed: 6,
  splashed: false,
  ...b,
});
/** Choose `id` on its first day and return that state and instant. */
function chosen(id: string): { state: QuestState; now: number } {
  const now = dayOffering(id);
  const state = chooseQuest(undefined, id, now);
  assert(!!state && state.chosen === id, `${id} could not be chosen on a day it is offered`);
  return { state: state!, now };
}

suite('quests · the pool', () => {
  test('ten to fifteen, each its own, five of each size', () => {
    assert(QUESTS.length >= 10 && QUESTS.length <= 15, `${QUESTS.length} quests`);
    assertEqual(new Set(QUESTS.map((q) => q.id)).size, QUESTS.length, 'ids repeat');
    assertEqual(new Set(QUESTS.map((q) => q.title)).size, QUESTS.length, 'two quests say the same thing');
    for (const size of QUEST_SIZES) {
      const n = QUESTS.filter((q) => q.size === size).length;
      assert(n > QUEST_REST_DAYS, `only ${n} ${size} quests — the rest rule cannot be kept`);
    }
  });

  test('every target is something a battle can reach, in plain short words', () => {
    for (const q of QUESTS) {
      const target = questTarget(q);
      assert(Number.isInteger(target) && target >= 1 && target <= 25, `${q.id} asks for ${target}`);
      assert(q.title.length <= 28, `"${q.title}" is too long for a row on a 375pt phone`);
      assert(!/xp|experience/i.test(q.title), `${q.id}: the title says what to do, not what it pays`);
    }
  });
});

suite('quests · the day, in New York', () => {
  test('a day turns at midnight New York time, winter and summer', () => {
    // 1 Nov 2026 is the day the clocks go back: midnight on the 2nd is 05:00 UTC.
    assertEqual(questDayStamp(at('2026-11-02T04:59:59Z')), '2026-11-01', 'turned before midnight (EST)');
    assertEqual(questDayStamp(at('2026-11-02T05:00:00Z')), '2026-11-02', 'did not turn at midnight (EST)');
    // Clocks go forward 14 Mar 2027: midnight on the 15th is 04:00 UTC.
    assertEqual(questDayStamp(at('2027-03-15T03:59:59Z')), '2027-03-14', 'turned before midnight (EDT)');
    assertEqual(questDayStamp(at('2027-03-15T04:00:00Z')), '2027-03-15', 'did not turn at midnight (EDT)');
    // And the day the clocks went back is still one day, 25 hours long.
    assertEqual(questDay(at('2026-11-01T04:00:00Z')), 0, 'midnight 1 Nov (EDT)');
    assertEqual(questDay(at('2026-11-02T04:59:59Z')), 0, 'the 25-hour day was cut short');
  });

  test('the same three on every phone, all day, and new ones at midnight', () => {
    const ids = (t: number) => offersAt(t).map((q) => q.id).join(',');
    const morning = ids(at('2026-11-10T05:00:01Z'));
    for (const t of ['2026-11-10T12:00:00Z', '2026-11-10T23:00:00Z', '2026-11-11T04:59:59Z']) {
      assertEqual(ids(at(t)), morning, `the offers changed during the day (${t})`);
    }
    assert(ids(at('2026-11-11T05:00:00Z')) !== morning, 'the offers did not change at midnight');
    // Whatever time zone the phone itself is set to.
    const was = process.env.TZ;
    const seen = new Set<string>();
    for (const tz of ['America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo', 'Pacific/Auckland']) {
      process.env.TZ = tz;
      seen.add(`${ids(at('2026-11-10T20:00:00Z'))}|${questDayStamp(at('2026-11-10T20:00:00Z'))}`);
    }
    if (was === undefined) delete process.env.TZ;
    else process.env.TZ = was;
    assertEqual(seen.size, 1, 'two phones in different time zones disagree');
    const source = readFileSync(join(root, 'src/game/quests.ts'), 'utf8');
    assert(!/\.get(Hours|Date|Day|Month|FullYear|TimezoneOffset)\(/.test(source), 'quests.ts reads the phone\'s own clock face');
    assert(!/fetch\(|AsyncStorage/.test(source), 'the offers need a server or storage');
  });

  test('one of each size, quick first, and nothing offered two days running', () => {
    let lastSeen: Record<string, number> = {};
    for (let d = 0; d < 2000; d++) {
      const today = offersForDay(d);
      assertEqual(today.map((q) => q.size).join(','), QUEST_SIZES.join(','), `day ${d} sizes`);
      for (const q of today) {
        if (q.id in lastSeen) assert(d - lastSeen[q.id] >= QUEST_REST_DAYS, `${q.id} back on day ${d} after ${d - lastSeen[q.id]}`);
        lastSeen[q.id] = d;
      }
      const tomorrow = new Set(offersForDay(d + 1).map((q) => q.id));
      assert(!today.some((q) => tomorrow.has(q.id)), `day ${d} and day ${d + 1} share a quest`);
    }
    // Every quest turns up, and no fixed loop: the first fortnight is not a repeat of the next.
    const shown = new Set<string>();
    for (let d = 0; d < 60; d++) for (const q of offersForDay(d)) shown.add(q.id);
    assertEqual(shown.size, QUESTS.length, 'some quest never comes up in two months');
    const block = (from: number) => Array.from({ length: 14 }, (_, i) => offersForDay(from + i).map((q) => q.id).join()).join('|');
    assert(block(0) !== block(14), 'the offers run in a fixed fortnightly loop');
    lastSeen = {};
  });

  test('before 1 Nov 2026 is day 0, not an error', () => {
    assertEqual(questDay(at('2020-01-01T00:00:00Z')), 0, 'a clock set in the past');
    assertEqual(offersAt(at('2020-01-01T00:00:00Z')).length, 3, 'no offers on a clock set in the past');
  });
});

suite('quests · rewards against the pass', () => {
  test('three sizes, rising rewards', () => {
    assert(QUEST_XP.quick < QUEST_XP.medium && QUEST_XP.medium < QUEST_XP.long, 'a bigger quest does not pay more');
    for (const q of QUESTS) assertEqual(questXp(q), QUEST_XP[q.size], `${q.id} pays off the table`);
  });

  test('each is worth five to ten Medium wins, and quests alone never finish the pass', () => {
    const win = BATTLE_XP.medium.won;
    for (const size of QUEST_SIZES) {
      const battles = QUEST_XP[size] / win;
      assert(battles >= 5 && battles <= 10, `a ${size} quest is worth ${battles} Medium wins`);
    }
    assert(QUEST_XP.quick * 31 < xpToReach(LEVELS), 'a month of quick quests finishes the pass without a battle');
    note(`a quest pays ${QUEST_XP.quick}/${QUEST_XP.medium}/${QUEST_XP.long} XP; the pass is ${xpToReach(LEVELS)}`);
  });

  test('the experience goes through the pass\'s own addXp, levels and all', () => {
    const { state, now } = chosen(QUESTS.find((q) => q.size === 'long' && q.rule.kind === 'win' && !('atLeast' in q.rule && q.rule.atLeast))!.id);
    let s: QuestState | undefined = state;
    let xp = 0;
    for (let i = 0; i < 20 && xp === 0; i++) {
      const r = countQuestBattle(s, battle(), now);
      s = r.state;
      xp = r.xp;
    }
    assertEqual(xp, QUEST_XP.long, 'the long quest paid the wrong amount');
    const climbed = addXp(undefined, xp, now);
    assert(climbed.reached.length >= 3, `a long quest from level 0 reached only ${climbed.reached.length} levels`);
    assertEqual(levelFor(climbed.state.xp), climbed.reached.length, 'levels reached and levels paid disagree');
    const screen = readFileSync(join(root, 'src/demo/DiceDemoScreen.tsx'), 'utf8');
    assert(/addXp\(getProgress\(\)\.season, xp \+ quested\.xp\)/.test(screen), 'the quest pays some other way than the pass\'s addXp');
  });
});

suite('quests · choosing and counting', () => {
  test('nothing counts until one is chosen, then it counts from that moment', () => {
    const id = QUESTS.find((q) => q.id === 'win-2')!.id;
    const now = dayOffering(id);
    const before = countQuestBattle(undefined, battle(), now);
    assertEqual(before.state, undefined, 'a battle before choosing made a quest');
    assertEqual(before.xp, 0, 'a battle before choosing paid');
    const picked = chooseQuest(undefined, id, now)!;
    assertEqual(picked.progress, 0, 'a fresh quest starts above nought');
    const one = countQuestBattle(picked, battle(), now);
    assertEqual(one.state!.progress, 1, 'a win after choosing did not count');
  });

  test('one choice a day: the other two cannot be picked once one is', () => {
    const now = noonOf(5);
    const [a, b] = offersForDay(5);
    const picked = chooseQuest(undefined, a.id, now)!;
    assertEqual(chooseQuest(picked, b.id, now), picked, 'a second quest was chosen on the same day');
    const notToday = QUESTS.find((q) => !offersForDay(5).includes(q))!;
    assertEqual(chooseQuest(undefined, notToday.id, now), undefined, 'a quest not on offer was chosen');
  });

  test('finishing pays exactly once', () => {
    const { state, now } = chosen('win-2');
    const first = countQuestBattle(state, battle(), now);
    assertEqual(first.xp, 0, 'paid half way');
    const second = countQuestBattle(first.state, battle(), now);
    assertEqual(second.xp, QUEST_XP[questById('win-2')!.size], 'finishing did not pay');
    assertEqual(second.finished?.id, 'win-2', 'the popup does not know which quest');
    assert(!!second.state!.done, 'not marked done');
    const third = countQuestBattle(second.state, battle(), now);
    assertEqual(third.xp, 0, 'a finished quest paid again');
    assertEqual(third.state, second.state, 'a finished quest kept moving');
    // A save loaded again and counted again still cannot pay.
    const reloaded = JSON.parse(JSON.stringify(second.state)) as QuestState;
    assertEqual(countQuestBattle(reloaded, battle(), now).xp, 0, 'a reloaded finished quest paid again');
    assert(/Quest done/.test(questDoneWords(questById('win-2')!).name), 'the popup does not say so');
  });

  test('a new day starts clean, and an unfinished quest simply ends', () => {
    const { state, now } = chosen('win-2');
    const halfway = countQuestBattle(state, battle(), now).state!;
    const tomorrow = now + DAY;
    assertEqual(questToday(halfway, tomorrow), undefined, "yesterday's quest is still running");
    const late = countQuestBattle(halfway, battle(), tomorrow);
    assertEqual(late.xp, 0, "yesterday's quest finished today");
    assertEqual(late.state, halfway, "yesterday's quest moved today");
    const fresh = offersAt(tomorrow)[0];
    const next = chooseQuest(halfway, fresh.id, tomorrow)!;
    assertEqual(next.chosen, fresh.id, "a new quest could not be chosen the next day");
    assertEqual(next.progress, 0, "yesterday's progress carried over");
    assertEqual(next.day, questDayStamp(tomorrow), 'stamped with the wrong day');
  });

  test('a save that makes no sense is read as nothing chosen', () => {
    const now = noonOf(3);
    const day = questDayStamp(now);
    const offered = offersForDay(3)[0].id;
    const notOffered = QUESTS.find((q) => !offersForDay(3).some((o) => o.id === q.id))!.id;
    for (const bad of [
      { day, chosen: 'no-such-quest', progress: 0 },
      { day, chosen: notOffered, progress: 0 },
      { day, chosen: offered, progress: Number.NaN },
      { day, chosen: offered, progress: -2 },
      { day: 'garbage', chosen: offered, progress: 1 },
    ]) {
      assertEqual(questToday(bad as QuestState, now), undefined, `kept ${JSON.stringify(bad)}`);
      assert(!!chooseQuest(bad as QuestState, offered, now), `a broken save blocks choosing (${JSON.stringify(bad)})`);
    }
  });

  test('friendly battles never count', () => {
    const { state, now } = chosen('win-2');
    const r = countQuestBattle(state, battle({ friendly: true }), now);
    assertEqual(r.state, state, 'a friendly battle moved the quest');
    assertEqual(r.xp, 0, 'a friendly battle paid');
    // And on the screen the call sits below the friendly battle's early return.
    const screen = readFileSync(join(root, 'src/demo/DiceDemoScreen.tsx'), 'utf8');
    const friendlyReturn = screen.indexOf('setLastXp(0);\n        return;');
    const counted = screen.indexOf('countQuestBattle(getProgress().quest');
    assert(friendlyReturn > 0 && counted > 0, 'the quest count has moved');
    assert(counted > friendlyReturn, 'a friendly battle reaches the quest count');
    const tie = screen.indexOf("if (outcome === 'tie') {\n        showCallout");
    assert(tie > counted, 'a draw never reaches the quest count');
  });
});

suite('quests · what each one counts', () => {
  const run = (id: string, battles: Partial<QuestBattle>[]) => {
    const { state, now } = chosen(id);
    let s: QuestState | undefined = state;
    let paid = 0;
    for (const b of battles) {
      const r = countQuestBattle(s, battle(b), now);
      s = r.state;
      paid += r.xp;
    }
    return { progress: s!.progress, done: !!s!.done, paid };
  };

  test('play counts every finish; a mode quest only its mode', () => {
    assertEqual(run('play-3', [{ outcome: 'lost' }, { outcome: 'tie' }]).progress, 2, 'a loss or a draw is not a game played');
    assertEqual(run('rush-2', [{ mode: 'ultimate' }, { mode: 'classic', outcome: 'lost' }]).progress, 1, 'the wrong mode counted');
    assertEqual(run('colorwar-1', [{ mode: 'colorwar', outcome: 'lost' }]).progress, 0, 'a lost Color War counted');
    assert(run('colorwar-1', [{ mode: 'colorwar' }]).done, 'a Color War win did not finish it');
  });

  test('difficulty and the water', () => {
    assertEqual(run('brave-3', [{ difficulty: 'easy' }, { difficulty: 'medium' }, { difficulty: 'hard' }]).progress, 2, 'Medium or Hard is wrong');
    assertEqual(run('hard-2', [{ difficulty: 'medium' }, { difficulty: 'hard' }]).progress, 1, 'a Medium win counted as Hard');
    assertEqual(run('dry-hard', [{ difficulty: 'hard', splashed: true }]).progress, 0, 'a splashed win counted');
    assert(run('dry-hard', [{ difficulty: 'hard', splashed: false }]).done, 'a dry Hard win did not count');
  });

  test('prisoners add up, and a streak breaks on a loss but not a draw', () => {
    assertEqual(run('free-10', [{ freed: 4, outcome: 'lost' }, { freed: 3 }]).progress, 7, 'prisoners did not add up');
    const capped = run('free-10', [{ freed: 6 }, { freed: 6 }]);
    assertEqual(capped.progress, 10, 'progress ran past the target');
    assert(capped.done, '12 freed did not finish "free 10"');
    assertEqual(run('streak-3', [{}, { outcome: 'tie' }, {}]).progress, 2, 'a draw broke the run');
    assertEqual(run('streak-3', [{}, {}, { outcome: 'lost' }, {}]).progress, 1, 'a loss did not start it again');
    assert(run('streak-3', [{}, {}, {}]).done, 'three in a row did not finish it');
  });

  test('all four modes, each once', () => {
    const twice = run('every-mode', [{ mode: 'classic' }, { mode: 'classic' }, { mode: 'ultimate', outcome: 'lost' }]);
    assertEqual(twice.progress, 1, 'the same mode counted twice, or a loss counted');
    const all = run('every-mode', MODE_ORDER.map((mode) => ({ mode })));
    assert(all.done, 'a win in every mode did not finish it');
    assertEqual(all.paid, QUEST_XP.long, 'paid the wrong amount');
  });
});

suite('quests · the Cups tab', () => {
  test('the three are drawn on the season pass card, with taps big enough', () => {
    const card = readFileSync(join(root, 'src/demo/SeasonPassCard.tsx'), 'utf8');
    const quests = readFileSync(join(root, 'src/demo/DailyQuests.tsx'), 'utf8');
    const cups = readFileSync(join(root, 'src/demo/TournamentScreen.tsx'), 'utf8');
    assert(/<DailyQuests quest=\{quest\}/.test(card), 'the quests are not on the pass card');
    assert(/quest=\{quest\}/.test(cups), 'the Cups tab is not told the quest');
    assert(/minHeight: MIN_TAP/.test(quests), 'a quest row can be smaller than a finger');
    assert(/TODAY&rsquo;S QUESTS/.test(quests), 'the section is not called Today\'s quests');
    assert(/from '\.\.\/ui\/Icon'/.test(quests), 'the quests are not drawn with the game\'s icons');
  });
});
