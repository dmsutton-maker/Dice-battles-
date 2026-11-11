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
  xpToReach,
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
  more than one month.

  Then on 8 Nov 2026, a week into November, with Sugar & Snow built for
  December: "I want to swap around season one and season two, so season
  2 is the current season, but obviously call it season 1. And I want it
  to go until the end of December, and for fire and ice to start on
  January first." So Season 1 is Sugar & Snow, October to December 2026;
  Season 2 is Fire & Ice, January 2027; and Sun & Moon is Season 7, in
  June 2027, with four seasons to be built between.
*/
const at = (iso: string) => Date.parse(iso);
const OCT = at('2026-10-15T12:00:00Z');
const NOV = at('2026-11-15T12:00:00Z');
const DEC = at('2026-12-15T12:00:00Z');
const JAN = at('2027-01-15T12:00:00Z');
const FEB = at('2027-02-15T12:00:00Z');

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
    // Sugar & Snow is the long one, Fire & Ice is January's, and Sun & Moon is June's.
    assertEqual(SEASONS[0].name, 'Sugar & Snow', 'the first season is Sugar & Snow (swapped in on 8 Nov 2026)');
    assertEqual(seasonEndMonth(SEASONS[0]), '2027-01', 'Sugar & Snow runs October to December');
    const fireIce = SEASONS.find((s) => s.name === 'Fire & Ice')!;
    assertEqual(`${fireIce.number} ${fireIce.month}`, '2 2027-01', 'Fire & Ice is Season 2, January 2027');
    assertEqual(fireIce.earnedFrom, '2026-10', 'Fire & Ice was earnable from October, as Season 1');
    for (const s of SEASONS) if (s.earnedFrom !== undefined) assert(s.earnedFrom < s.month, `${s.name}'s earnedFrom is not before it`);
    const sunMoon = SEASONS.find((s) => s.name === 'Sun & Moon')!;
    assertEqual(sunMoon.month, '2027-06', 'Sun & Moon is June 2027');
    assertEqual(sunMoon.number, 7, 'Sun & Moon is Season 7 (since the swap of 8 Nov 2026)');
  });

  test('every season has two new dice and two new battlefields, three on the Gold row', () => {
    const seen = new Set<string>();
    for (const s of SEASONS) {
      // (8 Nov 2026: level 20 was empty for a day between the Bauble dice's
      // deletion and the Snow Globe dice taking its place.)
      const gap = 0;
      assertEqual(s.items.length, 4 - gap, `${s.name} does not have four things on it`);
      assertEqual(s.items.filter((i) => i.item.kind === 'dice').length, 2 - gap, `${s.name}: dice`);
      assertEqual(s.items.filter((i) => i.item.kind === 'arena').length, 2, `${s.name}: battlefields`);
      assertEqual(s.items.filter((i) => i.track === 'gold').length, 3, `${s.name}: the Gold row`);
      assertEqual(s.items.filter((i) => i.track === 'free').length, 1 - gap, `${s.name}: the free row`);
      assertEqual(new Set(s.items.map((i) => i.level)).size, 4 - gap, `${s.name}: two items on one level`);
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
    // back two hours later. Season 1 carries on through November.
    assertEqual(seasonAt(at('2026-11-01T03:59:59Z')).number, 1, 'Halloween night');
    assertEqual(seasonAt(at('2026-11-01T04:00:00Z')).number, 1, 'the first of November is still Season 1');
    assertEqual(monthStartUtc('2026-11'), at('2026-11-01T04:00:00Z'), 'November begins');
    // 1 Dec 2026 00:00 is winter time: 05:00 UTC, and Season 1 goes on.
    assertEqual(monthStartUtc('2026-12'), at('2026-12-01T05:00:00Z'), 'December begins');
    assertEqual(seasonAt(at('2026-12-01T04:59:59Z')).number, 1, 'the last second of November');
    assertEqual(seasonAt(at('2026-12-01T05:00:00Z')).number, 1, 'the first of December is still Season 1');
    // 1 Jan 2027 00:00 New York is 05:00 UTC, and Fire & Ice starts.
    assertEqual(seasonAt(at('2027-01-01T04:59:59Z')).number, 1, 'the last second of December');
    assertEqual(seasonAt(at('2027-01-01T05:00:00Z')).number, 2, 'the first of January');
    assertEqual(seasonAt(JAN).name, 'Fire & Ice', 'January');
    assertEqual(seasonEndsAt(OCT), at('2027-01-01T05:00:00Z'), 'Season 1 ends on 1 January');
    assertEqual(seasonEndsAt(NOV), at('2027-01-01T05:00:00Z'), 'still 1 January from November');
    assertEqual(seasonEndsAt(DEC), at('2027-01-01T05:00:00Z'), 'still 1 January from December');
    assertEqual(monthStamp(at('2026-10-31T23:59:59Z')), '2026-10', 'still October in New York');
    assertEqual(monthStamp(at('2026-11-01T04:00:00Z')), '2026-11', 'November in New York');
    assertEqual(easternParts(at('2026-11-01T03:30:00Z')).day, 31, 'the 31st in New York');
    assertEqual(monthsBetween('2026-10', '2027-01'), 3, 'months between');
    assertEqual(addMonths('2026-10', 8), '2027-06', 'eight months on');
    assertEqual(addMonths('2027-01', -2), '2026-11', 'two months back');
    assertEqual(seasonDaysLeft(OCT), 78, 'days left in mid-October: the rest of October, November and December');
    assertEqual(seasonDaysLeft(at('2027-01-01T02:00:00Z')), 1, 'the last evening of December');
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
    const feb = seasonAt(FEB);
    if (SEASONS.some((x) => x.month === '2027-02')) {
      assertEqual(feb.number, 3, 'February is Season 3');
    } else {
      assertEqual(feb.number, 3, 'February with nothing built is still "Season 3"');
      assertEqual(feb.items, SEASONS.find((x) => x.name === 'Fire & Ice')!.items, "Fire & Ice's items stand in");
      assertEqual(feb.name, 'Season 3', 'a stand-in has a plain name');
    }
    // And before the first season, the first.
    assertEqual(seasonAt(at('2026-09-01T00:00:00Z')).id, 'season-1', 'before the start');
  });

  test('progress carries through a three-month season and starts again when it ends', () => {
    const october = addXp(undefined, 5000, OCT).state;
    assertEqual(october.season, 'season-1', 'October');
    const november = addXp(october, 100, NOV);
    assertEqual(november.state.season, 'season-1', 'November is still Season 1');
    assertEqual(november.state.xp, 5100, "October's experience was lost on 1 November");
    const december = addXp(november.state, 100, DEC);
    assertEqual(december.state.season, 'season-1', 'December is still Season 1');
    assertEqual(december.state.xp, 5200, "November's experience was lost on 1 December");
    const january = addXp(december.state, 100, JAN);
    assertEqual(january.state.season, 'season-2', 'January');
    assertEqual(january.state.xp, 100, "Season 1's experience carried into Season 2");
    assertEqual(claimGold(october, JAN).state.season, 'season-2', 'Gold claimed against the old season');
  });

  test('a save paid against the old Season 1 table is paid the new items it has climbed past, once', () => {
    // 8 Nov 2026: a week of Season 1 had been paid under Fire & Ice's
    // table. Somebody at level 21 had been paid Snowy Hollow (6), the
    // Fire dice (12) and the Ice dice (20); under Sugar & Snow's table
    // those levels carry the Gingerbread Village, the Gingerbread dice
    // and the Snow Globe dice, which they are owed. The coins and
    // trophies at the other levels were paid once and are not paid again.
    const old = { season: 'season-1', xp: xpToReach(21), paid: 21, goldPaid: 21 };
    const free = addXp(old, 0, NOV);
    assertEqual(free.reached.join(','), '20', 'the free row owed the Snow Globe dice at 20 and nothing else');
    assertEqual(free.state.paid, 21, 'the free high-water mark moved');
    assertEqual(addXp(free.state, 0, NOV).reached.join(','), '', 'the free row was paid twice');
    const gold = claimGold(old, NOV);
    assertEqual(gold.reached.join(','), '6,12', 'the Gold row owed the Village at 6 and the Gingerbread dice at 12');
    assertEqual(claimGold(gold.state, NOV).reached.join(','), '', 'the Gold row was paid twice');
    // Owed items and new levels in one go, in order.
    const climbing = addXp({ ...old, paid: 19, goldPaid: 19, xp: xpToReach(19) }, xpToReach(21) - xpToReach(19), NOV);
    assertEqual(climbing.reached.join(','), '20,21', 'the levels reached after the swap');
    // Somebody who had not reached an item level yet is owed nothing extra.
    assertEqual(addXp({ season: 'season-1', xp: xpToReach(5), paid: 5 }, 0, NOV).reached.join(','), '', 'owed an item below level 6');
    // A save from another season starts fresh, as ever, with the table noted.
    const fresh = addXp(old, 10, JAN).state;
    assertEqual(fresh.xp, 10, 'January started from the old XP');
    assert(fresh.table !== undefined && fresh.table === fresh.goldTable, 'a fresh season does not note its table');
    assertEqual(claimGold(fresh, JAN).reached.join(','), '', 'a fresh January save was owed Gold items');
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
    const ginger = passInfo('dice', 'gingerbread', OCT)!;
    assertEqual(ginger.current, true, 'Gingerbread is not current in October');
    assertEqual(passTag('dice', 'gingerbread', OCT), 'Gold Pass level 12', 'October tag');
    assertEqual(passTag('dice', 'snowglobe', OCT), 'Pass level 20', 'the free row');
    assertEqual(passInfo('dice', 'gingerbread', DEC)!.current, true, 'Gingerbread is not current in December');
    assertEqual(passTag('dice', 'gingerbread', DEC), 'Gold Pass level 12', 'December tag');
    assertEqual(passInfo('dice', 'gingerbread', JAN)!.current, false, 'Gingerbread is still current in January');
    assertEqual(passTag('dice', 'gingerbread', JAN), 'Season 1 pass', 'January tag');
    assertEqual(passTag('dice', 'fire', NOV), 'Season 2 pass', 'Fire & Ice, waiting for January');
    assertEqual(passTag('dice', 'fire', JAN), 'Gold Pass level 12', 'Fire & Ice in January');
    assertEqual(passTag('dice', 'sun', OCT), 'Season 7 pass', 'a season still to come');
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
  test('bought in any month of Season 1, it is good for all three, and not for January', () => {
    resetPurchasesForTest({ passMonths: ['2026-11'] });
    assert(hasGoldPass(NOV), 'a pass bought in November does not work in November');
    assert(hasGoldPass(OCT), 'a pass bought in November does not work in October, the same season');
    assert(hasGoldPass(DEC), 'a pass bought in November does not work in December, the same season');
    assert(!hasGoldPass(JAN), 'a pass bought in November works in January');
    // The last minute of December, New York time, is still Season 1.
    assert(hasGoldPass(at('2027-01-01T04:59:59Z')), 'the pass stopped before the season did');
    assert(!hasGoldPass(at('2027-01-01T05:00:00Z')), 'the pass ran into January');
    resetPurchasesForTest({ passMonths: ['2026-10'] });
    assert(hasGoldPass(DEC), 'a pass bought in October stops before the end of the season');
    assert(!hasGoldPass(JAN), 'a pass bought in October works in January');
    assert(seasonCoversMonth(SEASONS[0], '2026-12'), 'December is not in Season 1');
    assert(!seasonCoversMonth(SEASONS[0], '2027-01'), 'January is in Season 1');
  });

  test("Season 1's own product still counts, for the whole of Season 1", () => {
    resetPurchasesForTest({ owned: [SEASON_1_PASS.id] });
    assert(hasGoldPass(OCT), "season_pass_1 does not unlock October's Gold row");
    assert(hasGoldPass(NOV), "season_pass_1 does not unlock November's Gold row");
    assert(hasGoldPass(DEC), "season_pass_1 does not unlock December's Gold row");
    assert(!hasGoldPass(JAN), 'season_pass_1 unlocks January');
    resetPurchasesForTest({});
    assert(!hasGoldPass(OCT), 'a pass is owned from nothing');
  });
});
