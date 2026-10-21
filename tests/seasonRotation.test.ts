import './storageMock';
import { assert, assertEqual, note, suite, test } from './harness';
import {
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
  seasonDaysLeft,
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
*/
const at = (iso: string) => Date.parse(iso);
const OCT = at('2026-10-15T12:00:00Z');
const NOV = at('2026-11-15T12:00:00Z');

suite('season pass · one season a month, New York time', () => {
  test('the months run on from October 2026 with no gap', () => {
    assertEqual(SEASONS[0].month, '2026-10', 'the first season');
    for (let i = 0; i < SEASONS.length; i++) {
      const s = SEASONS[i];
      assertEqual(s.number, i + 1, `${s.name} is numbered ${s.number}`);
      assertEqual(s.id, `season-${i + 1}`, `${s.name}'s id`);
      if (i > 0) assertEqual(s.month, nextMonth(SEASONS[i - 1].month), `${s.name} does not follow ${SEASONS[i - 1].name}`);
      assert(s.name.length > 0 && s.name.length <= 24, `${s.id} has no name, or a long one`);
    }
    assertEqual(new Set(SEASONS.map((s) => s.name)).size, SEASONS.length, 'two seasons share a name');
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
    // back two hours later.
    assertEqual(seasonAt(at('2026-11-01T03:59:59Z')).number, 1, 'Halloween night');
    assertEqual(seasonAt(at('2026-11-01T04:00:00Z')).number, 2, 'the first of November');
    assertEqual(monthStartUtc('2026-11'), at('2026-11-01T04:00:00Z'), 'November begins');
    // 1 Dec 2026 00:00 is winter time: 05:00 UTC.
    assertEqual(monthStartUtc('2026-12'), at('2026-12-01T05:00:00Z'), 'December begins');
    assertEqual(seasonEndsAt(OCT), at('2026-11-01T04:00:00Z'), 'October ends');
    assertEqual(monthStamp(at('2026-10-31T23:59:59Z')), '2026-10', 'still October in New York');
    assertEqual(monthStamp(at('2026-11-01T04:00:00Z')), '2026-11', 'November in New York');
    assertEqual(easternParts(at('2026-11-01T03:30:00Z')).day, 31, 'the 31st in New York');
    assertEqual(monthsBetween('2026-10', '2027-01'), 3, 'months between');
    assertEqual(seasonDaysLeft(OCT), 17, 'days left in mid-October');
    assertEqual(seasonDaysLeft(at('2026-11-01T02:00:00Z')), 1, 'the last evening');
  });

  test('a month with no season built keeps the game going, renumbered', () => {
    const far = at('2027-06-15T12:00:00Z');
    const s = seasonAt(far);
    assertEqual(s.number, 1 + monthsBetween(SEASONS[0].month, '2027-06'), 'the number');
    assertEqual(s.id, `season-${s.number}`, 'the id');
    assertEqual(s.month, '2027-06', 'the month');
    assertEqual(s.items, SEASONS[SEASONS.length - 1].items, 'not the latest items');
    // And before the first season, the first.
    assertEqual(seasonAt(at('2026-09-01T00:00:00Z')).id, 'season-1', 'before the start');
  });

  test('progress starts again on the 1st; the old season is simply over', () => {
    const october = addXp(undefined, 5000, OCT).state;
    assertEqual(october.season, 'season-1', 'October');
    const november = addXp(october, 100, NOV);
    assertEqual(november.state.season, 'season-2', 'November');
    assertEqual(november.state.xp, 100, "October's experience carried over");
    assertEqual(claimGold(october, NOV).state.season, 'season-2', 'Gold claimed against the old season');
  });

  test("next month's season is built before the month is nearly over", () => {
    const now = Date.now();
    const coming = nextMonth(monthStamp(now));
    const built = SEASONS.some((s) => s.month === coming);
    const { day } = easternParts(now);
    note(`today is day ${day} of the month; ${coming} is ${built ? 'built' : 'NOT built'}`);
    if (day >= 20) assert(built, `${coming}'s season is not built, and the month turns in ${seasonDaysLeft(now)} days`);
  });
});

suite('season pass · an item knows which season it was on', () => {
  test('on its season: the row and the level; after it: the season it was on', () => {
    const fire = passInfo('dice', 'fire', OCT)!;
    assertEqual(fire.current, true, 'Fire is not current in October');
    assertEqual(passTag('dice', 'fire', OCT), 'Gold Pass level 12', 'October tag');
    assertEqual(passTag('dice', 'ice', OCT), 'Pass level 20', 'the free row');
    assertEqual(passInfo('dice', 'fire', NOV)!.current, false, 'Fire is still current in November');
    assertEqual(passTag('dice', 'fire', NOV), 'Season 1 pass', 'November tag');
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

suite('season pass · the Gold Pass is for the month it was bought in', () => {
  test('this month yes, next month no, and Restore brings the month back', () => {
    resetPurchasesForTest({ passMonths: ['2026-11'] });
    assert(hasGoldPass(NOV), 'a pass bought in November does not work in November');
    assert(!hasGoldPass(OCT), 'a pass bought in November works in October');
    assert(!hasGoldPass(at('2026-12-15T12:00:00Z')), 'a pass bought in November works in December');
    // The last minute of November, New York time, is still November.
    assert(hasGoldPass(at('2026-12-01T04:59:59Z')), 'the pass stopped before the month did');
    assert(!hasGoldPass(at('2026-12-01T05:00:00Z')), 'the pass ran into December');
  });

  test("Season 1's own product still counts, for October only", () => {
    resetPurchasesForTest({ owned: [SEASON_1_PASS.id] });
    assert(hasGoldPass(OCT), "season_pass_1 does not unlock October's Gold row");
    assert(!hasGoldPass(NOV), 'season_pass_1 unlocks November');
    resetPurchasesForTest({});
    assert(!hasGoldPass(OCT), 'a pass is owned from nothing');
  });
});
