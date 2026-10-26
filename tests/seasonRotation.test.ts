import './storageMock';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  addMonths,
  easternParts,
  monthsBetween,
  monthStamp,
  monthStartUtc,
  nextMonth,
} from '../src/game/easternTime';
import {
  addXp,
  claimGold,
  LEVELS,
  passInfo,
  passTag,
  seasonAt,
  seasonCoversMonth,
  seasonDaysLeft,
  seasonEndMonth,
  seasonEndsAt,
  SEASONS,
} from '../src/game/seasonPass';
import { actionLabel, previewAction } from '../src/game/itemPreview';
import { hasGoldPass, resetPurchasesForTest } from '../src/game/purchases';
import { DICE_SKINS } from '../src/game/diceSkins';
import { THEMED_ARENA_META, ThemedArenaId } from '../src/arena/themeData';
import { SEASON_1_PASS } from '../src/game/products';

/*
  David, 21 Oct 2026: "I want the gold pass to rotate on the first of
  every month according to EST", and each month brings "2 new dice and
  2 new arenas ... with a theme like how this one is fire and ice".

  And on 26 Oct 2026: "Change the November season to be for June and
  make the Fire and Ice season go through November." So a season can run
  more than one month, Season 1 runs October and November, and Sun &
  Moon is Season 8, in June 2027, with six seasons to be built between.
*/
const at = (iso: string) => Date.parse(iso);
const OCT = at('2026-10-15T12:00:00Z');
const NOV = at('2026-11-15T12:00:00Z');
const DEC = at('2026-12-15T12:00:00Z');

suite('season pass · one season a month, New York time', () => {
  test('the seasons run on from October 2026, in order, never overlapping', () => {
    assertEqual(SEASONS[0].month, '2026-10', 'the first season');
    assertEqual(SEASONS[0].number, 1, 'the first season is number 1');
    for (let i = 0; i < SEASONS.length; i++) {
      const s = SEASONS[i];
      assertEqual(s.id, `season-${s.number}`, `${s.name}'s id`);
      assert(s.name.length > 0 && s.name.length <= 24, `${s.id} has no name, or a long one`);
      if (i === 0) continue;
      const prev = SEASONS[i - 1];
      const end = seasonEndMonth(prev);
      assert(s.month >= end, `${s.name} starts before ${prev.name} has ended`);
      // A season's number counts the months since the last one, so a
      // month nobody built (a stand-in) and a built season agree on it.
      assertEqual(s.number, prev.number + 1 + monthsBetween(end, s.month), `${s.name}'s number`);
    }
    assertEqual(new Set(SEASONS.map((s) => s.name)).size, SEASONS.length, 'two seasons share a name');
    // Fire & Ice is the long one, and Sun & Moon is June's.
    assertEqual(seasonEndMonth(SEASONS[0]), '2026-12', 'Fire & Ice runs October and November');
    const sunMoon = SEASONS.find((s) => s.name === 'Sun & Moon')!;
    assertEqual(sunMoon.month, '2027-06', 'Sun & Moon is June 2027');
    assertEqual(sunMoon.number, 8, 'Sun & Moon is Season 8');
  });

  test('every season has two new dice and two new battlefields, three on the Gold row', () => {
    const seen = new Set<string>();
    for (const s of SEASONS) {
      assertEqual(s.items.length, 4, `${s.name} does not have four things on it`);
      assertEqual(s.items.filter((i) => i.item.kind === 'dice').length, 2, `${s.name}: dice`);
      assertEqual(s.items.filter((i) => i.item.kind === 'arena').length, 2, `${s.name}: battlefields`);
      assertEqual(s.items.filter((i) => i.track === 'gold').length, 3, `${s.name}: the Gold row`);
      assertEqual(s.items.filter((i) => i.track === 'free').length, 1, `${s.name}: the free row`);
      assertEqual(new Set(s.items.map((i) => i.level)).size, 4, `${s.name}: two items on one level`);
      for (const { item, level } of s.items) {
        assert(level >= 1 && level <= LEVELS, `${item.id} is on a level that does not exist`);
        const key = `${item.kind}:${item.id}`;
        assert(!seen.has(key), `${key} is on two seasons`);
        seen.add(key);
        if (item.kind === 'dice') {
          const skin = DICE_SKINS.find((d) => d.id === item.id);
          assert(skin !== undefined, `${s.name}'s ${item.id} dice do not exist`);
          assert(skin!.pass === true, `${item.id} is on the pass but not marked pass-only`);
        } else {
          const meta = THEMED_ARENA_META[item.id as ThemedArenaId];
          assert(meta !== undefined, `${s.name}'s ${item.id} battlefield does not exist`);
          assert(meta.pass === true, `${item.id} is on the pass but not marked pass-only`);
        }
      }
    }
    // And nothing marked pass-only is left off every season.
    for (const d of DICE_SKINS) if (d.pass) assert(seen.has(`dice:${d.id}`), `${d.name} is pass-only but on no season`);
    for (const id of Object.keys(THEMED_ARENA_META) as ThemedArenaId[]) {
      if (THEMED_ARENA_META[id].pass) assert(seen.has(`arena:${id}`), `${id} is pass-only but on no season`);
    }
  });

  test('the season turns at midnight on the 1st, New York time', () => {
    // 1 Nov 2026 00:00 is still summer time: 04:00 UTC. The clocks go
    // back two hours later. Fire & Ice carries on through November.
    assertEqual(seasonAt(at('2026-11-01T03:59:59Z')).number, 1, 'Halloween night');
    assertEqual(seasonAt(at('2026-11-01T04:00:00Z')).number, 1, 'the first of November is still Fire & Ice');
    assertEqual(monthStartUtc('2026-11'), at('2026-11-01T04:00:00Z'), 'November begins');
    // 1 Dec 2026 00:00 is winter time: 05:00 UTC, and Season 2 starts.
    assertEqual(monthStartUtc('2026-12'), at('2026-12-01T05:00:00Z'), 'December begins');
    assertEqual(seasonAt(at('2026-12-01T04:59:59Z')).number, 1, 'the last second of November');
    assertEqual(seasonAt(at('2026-12-01T05:00:00Z')).number, 2, 'the first of December');
    assertEqual(seasonEndsAt(OCT), at('2026-12-01T05:00:00Z'), 'Season 1 ends on 1 December');
    assertEqual(seasonEndsAt(NOV), at('2026-12-01T05:00:00Z'), 'still 1 December from November');
    assertEqual(monthStamp(at('2026-10-31T23:59:59Z')), '2026-10', 'still October in New York');
    assertEqual(monthStamp(at('2026-11-01T04:00:00Z')), '2026-11', 'November in New York');
    assertEqual(easternParts(at('2026-11-01T03:30:00Z')).day, 31, 'the 31st in New York');
    assertEqual(monthsBetween('2026-10', '2027-01'), 3, 'months between');
    assertEqual(addMonths('2026-10', 8), '2027-06', 'eight months on');
    assertEqual(addMonths('2027-01', -2), '2026-11', 'two months back');
    assertEqual(seasonDaysLeft(OCT), 47, 'days left in mid-October: the rest of October and all of November');
    assertEqual(seasonDaysLeft(at('2026-12-01T02:00:00Z')), 1, 'the last evening of November');
  });

  test('a month with no season built keeps the game going, renumbered', () => {
    // After the last built season: its items, under the month's number.
    const last = SEASONS[SEASONS.length - 1];
    const after = addMonths(seasonEndMonth(last), 2);
    const far = monthStartUtc(after) + 14 * 86_400_000;
    const s = seasonAt(far);
    assertEqual(s.number, last.number + 3, 'the number');
    assertEqual(s.id, `season-${s.number}`, 'the id');
    assertEqual(s.month, after, 'the month');
    assertEqual(s.items, last.items, 'not the latest items');
    assertEqual(seasonEndsAt(far), monthStartUtc(nextMonth(after)), 'a stand-in lasts one month');
    // Between two built seasons, the same: the one before stands in.
    const dec = seasonAt(DEC);
    if (SEASONS.some((x) => x.month === '2026-12')) {
      assertEqual(dec.number, 2, 'December is Season 2');
    } else {
      assertEqual(dec.number, 2, 'December with nothing built is still "Season 2"');
      assertEqual(dec.items, SEASONS[0].items, "Fire & Ice's items stand in");
      assertEqual(dec.name, 'Season 2', 'a stand-in has a plain name');
    }
    // And before the first season, the first.
    assertEqual(seasonAt(at('2026-09-01T00:00:00Z')).id, 'season-1', 'before the start');
  });

  test('progress carries through a two-month season and starts again when it ends', () => {
    const october = addXp(undefined, 5000, OCT).state;
    assertEqual(october.season, 'season-1', 'October');
    const november = addXp(october, 100, NOV);
    assertEqual(november.state.season, 'season-1', 'November is still Season 1');
    assertEqual(november.state.xp, 5100, "October's experience was lost on 1 November");
    const december = addXp(november.state, 100, DEC);
    assertEqual(december.state.season, 'season-2', 'December');
    assertEqual(december.state.xp, 100, "Season 1's experience carried into Season 2");
    assertEqual(claimGold(october, DEC).state.season, 'season-2', 'Gold claimed against the old season');
  });

  test('the next season is built before the running one is nearly over', () => {
    const now = Date.now();
    const running = seasonAt(now);
    const coming = seasonEndMonth(running);
    const built = SEASONS.some((s) => s.month === coming);
    const left = seasonDaysLeft(now);
    note(`${running.name} has ${left} days left; ${coming} is ${built ? 'built' : 'NOT built'}`);
    if (left <= 11) assert(built, `${coming}'s season is not built, and ${running.name} ends in ${left} days`);
  });
});

suite('season pass · an item knows which season it was on', () => {
  test('on its season: the row and the level; after it: the season it was on', () => {
    const fire = passInfo('dice', 'fire', OCT)!;
    assertEqual(fire.current, true, 'Fire is not current in October');
    assertEqual(passTag('dice', 'fire', OCT), 'Gold Pass level 12', 'October tag');
    assertEqual(passTag('dice', 'ice', OCT), 'Pass level 20', 'the free row');
    assertEqual(passInfo('dice', 'fire', NOV)!.current, true, 'Fire is not current in November');
    assertEqual(passTag('dice', 'fire', NOV), 'Gold Pass level 12', 'November tag');
    assertEqual(passInfo('dice', 'fire', DEC)!.current, false, 'Fire is still current in December');
    assertEqual(passTag('dice', 'fire', DEC), 'Season 1 pass', 'December tag');
    assertEqual(passTag('dice', 'sun', OCT), 'Season 8 pass', 'a season still to come');
    assertEqual(passTag('dice', 'ivory', OCT), null, 'a die that was never on a pass');
  });

  test('the preview says so too, and never "0 more trophies"', () => {
    const base = { trophies: 0, coins: 0, owned: false, unlocked: false, equipped: false, canBuy: false };
    const over = previewAction({ ...base, passLevel: 12, passGold: true, passCurrent: false, passSeason: 'Season 1' });
    assertEqual(actionLabel(over), 'Was on the Season 1 pass', 'a finished season');
    const now = previewAction({ ...base, passLevel: 12, passGold: true, passCurrent: true, passSeason: 'Season 1' });
    assertEqual(actionLabel(now), 'Gold Pass level 12', 'a running season');
  });
});

suite('season pass · the Gold Pass is for the season it was bought in', () => {
  test('bought in either month of Fire & Ice, it is good for both, and not for December', () => {
    resetPurchasesForTest({ passMonths: ['2026-11'] });
    assert(hasGoldPass(NOV), 'a pass bought in November does not work in November');
    assert(hasGoldPass(OCT), 'a pass bought in November does not work in October, the same season');
    assert(!hasGoldPass(DEC), 'a pass bought in November works in December');
    // The last minute of November, New York time, is still Season 1.
    assert(hasGoldPass(at('2026-12-01T04:59:59Z')), 'the pass stopped before the season did');
    assert(!hasGoldPass(at('2026-12-01T05:00:00Z')), 'the pass ran into December');
    resetPurchasesForTest({ passMonths: ['2026-10'] });
    assert(hasGoldPass(NOV), 'a pass bought in October stops at the end of October');
    assert(!hasGoldPass(DEC), 'a pass bought in October works in December');
    assert(seasonCoversMonth(SEASONS[0], '2026-11'), 'November is not in Season 1');
    assert(!seasonCoversMonth(SEASONS[0], '2026-12'), 'December is in Season 1');
  });

  test("Season 1's own product still counts, for the whole of Season 1", () => {
    resetPurchasesForTest({ owned: [SEASON_1_PASS.id] });
    assert(hasGoldPass(OCT), "season_pass_1 does not unlock October's Gold row");
    assert(hasGoldPass(NOV), "season_pass_1 does not unlock November's Gold row");
    assert(!hasGoldPass(DEC), 'season_pass_1 unlocks December');
    resetPurchasesForTest({});
    assert(!hasGoldPass(OCT), 'a pass is owned from nothing');
  });
});
