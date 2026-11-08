import './storageMock';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  belongsInInventory,
  inventoryArenas,
  inventoryDice,
  isFutureSeasonItem,
  ladderPreview,
  obtainableArenaCount,
  obtainableDiceCount,
  onlyStarters,
  STARTING_ARENAS,
  STARTING_DICE,
} from '../src/game/inventoryRules';
import { ARENA_ORDER, INVENTORY_SKIN_ORDER, STORE_ARENAS, arenaKey, isArenaUnlocked, isSkinUnlocked } from '../src/game/loadout';
import { DICE_SKINS, RETIRED_SKINS, STORE_SKINS } from '../src/game/diceSkins';
import { resetWalletForTests } from '../src/game/currency';
import { resetPurchasesForTest } from '../src/game/purchases';
import { resetProgressForTests, setUnlockAll, TIERS } from '../src/game/progress';
import { SEASONS } from '../src/game/seasonPass';
import { tierItem } from '../src/game/tierItem';
import { actionLabel, isActionPressable, previewAction } from '../src/game/itemPreview';

/*
  David, 1 Nov 2026: "Take the future season stuff and anything not
  owned by a player out of their inventory so they can only view it in
  the store or gold pass, wherever they're from."

  The Inventory is the cupboard: what the player owns, and nothing else.
  Everything unowned is seen where it comes from — the Store's shelves,
  the Gold Pass and cup cards in Cups, the ladder in Records — and a
  season still to come is seen nowhere at all.
*/

const at = (iso: string) => Date.parse(iso);
/** Fire & Ice is running (October and November 2026). */
const NOV = at('2026-11-10T12:00:00Z');
/** After Fire & Ice: a stand-in month, nothing new built for it yet. */
const DEC = at('2026-12-10T12:00:00Z');
/** Sun & Moon's month, June 2027. */
const JUNE = at('2027-06-10T12:00:00Z');

const SUN_MOON = SEASONS.find((s) => s.name === 'Sun & Moon')!;
const FIRE_ICE = SEASONS.find((s) => s.name === 'Fire & Ice')!;
const idsOf = (season: typeof SUN_MOON, kind: 'dice' | 'arena') =>
  season.items.filter((s) => s.item.kind === kind).map((s) => s.item.id);

/** A brand-new player: no trophies, nothing in the wallet, nothing bought, tester mode off. */
function fresh(owned: string[] = [], bought: string[] = []): void {
  resetProgressForTests();
  resetWalletForTests({ coins: 0, owned });
  resetPurchasesForTest({ owned: bought });
}

suite('inventory · only what the player owns', () => {
  test('a new player sees exactly the free dice and the free battlefield', () => {
    fresh();
    assertEqual(inventoryDice(0, NOV).map((s) => s.id).join(','), STARTING_DICE.join(','), 'the new cupboard');
    assertEqual(inventoryArenas(0, NOV).join(','), STARTING_ARENAS.join(','), 'the new cupboard');
    // Today's free items, by name, so a change to them is a decision.
    assertEqual(STARTING_DICE.join(','), 'ivory', 'the free dice');
    assertEqual(STARTING_ARENAS.join(','), 'castle', 'the free battlefield');
    assert(onlyStarters(inventoryDice(0, NOV).map((s) => s.id), STARTING_DICE), 'the "where to get more" line would not show');
  });

  test('owned shows and unowned hides — every die and battlefield, at every rung', () => {
    const shopDie = STORE_SKINS[0].id;
    const shopArena = STORE_ARENAS[0];
    fresh([shopDie, arenaKey(shopArena)], ['neon']);
    for (const trophies of [0, 40, 300, 1150, 4000, 10000]) {
      const dice = new Set(inventoryDice(trophies, NOV).map((s) => s.id));
      const arenas = new Set(inventoryArenas(trophies, NOV));
      for (const skin of DICE_SKINS) {
        const owned = isSkinUnlocked(skin.id, trophies) && !isFutureSeasonItem('dice', skin.id, NOV);
        assertEqual(dice.has(skin.id), owned, `${skin.name} at ${trophies} trophies`);
      }
      for (const id of ARENA_ORDER) {
        const owned = isArenaUnlocked(id, trophies) && !isFutureSeasonItem('arena', id, NOV);
        assertEqual(arenas.has(id), owned, `${id} at ${trophies} trophies`);
      }
    }
    // The ones handed over above are really there, and the ones not are not.
    const at300 = inventoryDice(300, NOV).map((s) => s.id);
    assert(at300.includes(shopDie), 'a bought die is missing from the cupboard');
    assert(at300.includes('neon'), 'a die bought with real money is missing');
    assert(at300.includes('gold'), 'a die earned on the ladder is missing');
    assert(!at300.includes('bubblegum'), 'a ladder die not yet reached is showing');
    assert(!at300.includes(STORE_SKINS[1].id), 'a Store die nobody bought is showing');
    assert(!at300.includes('amethyst'), 'a cup prize nobody won is showing');
    assert(!at300.includes('fire'), 'a pass die nobody earned is showing');
    assert(!at300.includes('supporter'), 'the Starter pack die is showing unbought');
    assert(inventoryArenas(300, NOV).includes(shopArena), 'a bought battlefield is missing');
    assert(!inventoryArenas(300, NOV).includes('dino'), 'Dino Valley is showing unbought');
    note(`at 300 trophies with one of each bought: ${at300.length} dice, ${inventoryArenas(300, NOV).length} battlefields`);
    fresh();
  });

  test('the cupboard keeps its order: dice and battlefields as the full lists run', () => {
    fresh(DICE_SKINS.map((s) => s.id).concat(ARENA_ORDER.map(arenaKey)));
    const dice = inventoryDice(10000, NOV).map((s) => s.id);
    const full = INVENTORY_SKIN_ORDER.map((s) => s.id).filter((id) => dice.includes(id));
    assertEqual(dice.join(','), full.join(','), 'the dice are out of order');
    const arenas = inventoryArenas(10000, NOV);
    assertEqual(arenas.join(','), ARENA_ORDER.filter((id) => arenas.includes(id)).join(','), 'the battlefields are out of order');
    fresh();
  });

  test('the free items always show', () => {
    for (const tester of [false, true]) {
      for (const now of [NOV, DEC, JUNE]) {
        fresh();
        setUnlockAll(tester);
        const dice = inventoryDice(0, now).map((s) => s.id);
        const arenas = inventoryArenas(0, now);
        for (const id of STARTING_DICE) assert(dice.includes(id), `${id} is missing (tester ${tester})`);
        for (const id of STARTING_ARENAS) assert(arenas.includes(id), `${id} is missing (tester ${tester})`);
      }
    }
    fresh();
  });
});

suite('inventory · a season still to come is shown nowhere', () => {
  test('Sun & Moon is a future season in November 2026, and Fire & Ice is not', () => {
    for (const id of idsOf(SUN_MOON, 'dice')) assert(isFutureSeasonItem('dice', id, NOV), `${id} is not counted as future`);
    for (const id of idsOf(SUN_MOON, 'arena')) assert(isFutureSeasonItem('arena', id, NOV), `${id} is not counted as future`);
    for (const id of idsOf(FIRE_ICE, 'dice')) assert(!isFutureSeasonItem('dice', id, NOV), `${id} counted as future`);
    assert(!isFutureSeasonItem('dice', 'ivory', NOV), 'a die on no pass counted as future');
    assert(!isFutureSeasonItem('dice', 'sun', JUNE), 'Sun & Moon still future in its own month');
  });

  test('it turns at midnight on the 1st, New York time', () => {
    // 11pm on 31 May in New York is 3am on 1 June in London.
    assert(isFutureSeasonItem('dice', 'sun', at('2027-06-01T03:00:00Z')), 'it arrived early, on UTC');
    assert(!isFutureSeasonItem('dice', 'sun', at('2027-06-01T05:00:00Z')), 'it did not arrive at midnight New York');
  });

  test("a future season's items hide even for somebody who owns the season before", () => {
    // Everything Fire & Ice gives, earned — and Sun & Moon's ids in the
    // wallet too, as if handed over by mistake. Neither makes June show.
    const fireIce = [...idsOf(FIRE_ICE, 'dice'), ...idsOf(FIRE_ICE, 'arena').map((id) => arenaKey(id as never))];
    const sunMoon = [...idsOf(SUN_MOON, 'dice'), ...idsOf(SUN_MOON, 'arena').map((id) => arenaKey(id as never))];
    fresh([...fireIce, ...sunMoon]);
    const dice = inventoryDice(0, NOV).map((s) => s.id);
    const arenas: string[] = inventoryArenas(0, NOV);
    for (const id of idsOf(FIRE_ICE, 'dice')) assert(dice.includes(id), `${id} (earned) is missing`);
    for (const id of idsOf(FIRE_ICE, 'arena')) assert(arenas.includes(id), `${id} (earned) is missing`);
    for (const id of idsOf(SUN_MOON, 'dice')) assert(!dice.includes(id), `${id} shows before its season`);
    for (const id of idsOf(SUN_MOON, 'arena')) assert(!arenas.includes(id), `${id} shows before its season`);
    // Once June comes, an owned one shows like anything else.
    assert(inventoryDice(0, JUNE).some((s) => s.id === 'sun'), 'owned Sun Dice missing in June');
    fresh();
  });

  test("a finished season's items stay with whoever earned them, and nobody else", () => {
    fresh(['fire']);
    assert(inventoryDice(0, DEC).some((s) => s.id === 'fire'), 'earned Fire Dice gone after the season');
    fresh();
    assert(!inventoryDice(0, DEC).some((s) => s.id === 'fire'), 'unearned Fire Dice showing after the season');
  });

  test('tester mode shows everything it unlocks, except a season still to come', () => {
    fresh();
    setUnlockAll(true);
    const dice = inventoryDice(0, NOV);
    const arenas = inventoryArenas(0, NOV);
    for (const skin of dice) assert(isSkinUnlocked(skin.id, 0), `${skin.name} shows but is not unlocked`);
    // Tester mode also shows the retired Baseball dice (Marc, 4 Nov 2026:
    // "only appear in your inventory with admin mode"), which the "of N"
    // count leaves out because nobody can get it.
    assertEqual(dice.length, obtainableDiceCount(NOV) + RETIRED_SKINS.length, 'tester mode is missing a die it unlocks');
    assertEqual(arenas.length, obtainableArenaCount(0, NOV), 'tester mode is missing a battlefield it unlocks');
    // Every season still to come in November: Sugar & Snow (December) and Sun & Moon (June).
    const futureDice = SEASONS.filter((season) => season.month > '2026-11').flatMap((season) => idsOf(season, 'dice'));
    assertEqual(obtainableDiceCount(NOV), DICE_SKINS.length - futureDice.length - RETIRED_SKINS.length, 'the future dice');
    const futureArenas = SEASONS.filter((season) => season.month > '2026-11').flatMap((season) => idsOf(season, 'arena'));
    assertEqual(obtainableArenaCount(0, NOV), ARENA_ORDER.length - futureArenas.length, 'the future battlefields');
    assert(!dice.some((s) => s.id === 'sun' || s.id === 'moon'), 'tester mode shows June in November');
    // In June, tester mode has the lot.
    assertEqual(inventoryDice(0, JUNE).length, DICE_SKINS.length, 'tester mode in June');
    assertEqual(inventoryArenas(0, JUNE).length, ARENA_ORDER.length, 'tester mode in June');
    setUnlockAll(false);
    fresh();
  });

  test('the rule on its own', () => {
    assertEqual(belongsInInventory('dice', 'gold', true, NOV), true, 'owned');
    assertEqual(belongsInInventory('dice', 'gold', false, NOV), false, 'not owned');
    assertEqual(belongsInInventory('dice', 'sun', true, NOV), false, 'owned but its season is to come');
    assertEqual(belongsInInventory('dice', 'sun', true, JUNE), true, 'owned in its season');
  });
});

suite('inventory · the Records tab opens every ladder reward', () => {
  test('every rung opens its own die or battlefield, from the ladder', () => {
    for (const tier of TIERS) {
      const target = ladderPreview(tier);
      assert(target !== null, `${tier.name} has nothing to open`);
      const item = tierItem(tier);
      assertEqual(target!.from, 'ladder', `${tier.name} opens as if from somewhere else`);
      if (item.kind === 'die') {
        assertEqual(target!.kind, 'die', `${tier.name} kind`);
        assertEqual(target!.id, item.skin.id, `${tier.name} opens the wrong die`);
      } else if (item.kind === 'arena') {
        assertEqual(target!.kind, 'arena', `${tier.name} kind`);
        assertEqual(target!.id, item.arena, `${tier.name} opens the wrong battlefield`);
      }
    }
    note(`${TIERS.length} rungs, every one opens on the board`);
  });

  test('the button says "trophies to go" until it is earned, then "use"', () => {
    for (const tier of TIERS) {
      const below = previewAction({
        trophies: Math.max(0, tier.at - 1),
        coins: 99999,
        owned: false,
        unlocked: tier.at === 0,
        equipped: false,
        needTrophies: tier.at,
        canBuy: false,
      });
      if (tier.at > 0) {
        assertEqual(below.kind, 'locked', `${tier.name} below its rung`);
        assertEqual(actionLabel(below), '1 more trophies to go', `${tier.name} below its rung`);
        assert(!isActionPressable(below), `${tier.name} can be taken from the ladder`);
      }
      const reached = previewAction({
        trophies: tier.at,
        coins: 0,
        owned: false,
        unlocked: true,
        equipped: false,
        needTrophies: tier.at,
        canBuy: false,
      });
      assertEqual(reached.kind, 'equip', `${tier.name} once earned`);
    }
  });

  test('the ladder is wired to the preview', () => {
    const records = readFileSync(join(__dirname, '..', 'src/demo/LeaderboardScreen.tsx'), 'utf8');
    const ladder = records.slice(records.indexOf('THE LADDER'));
    assert(/ladderPreview\(tier\)/.test(ladder), 'the rungs do not ask what they open');
    assert(/onPreview\(target\)/.test(ladder), 'a rung tap does not open the preview');
    assert(/<Pressable/.test(ladder), 'the rungs cannot be tapped');
    const screen = readFileSync(join(__dirname, '..', 'src/demo/DiceDemoScreen.tsx'), 'utf8');
    const board = screen.slice(screen.indexOf('<LeaderboardScreen'), screen.indexOf('/>', screen.indexOf('<LeaderboardScreen')));
    assert(/onPreview=\{showPreview\}/.test(board), 'the Records tab is not handed the preview');
  });

  test("a cup's prize can be opened from its card", () => {
    const cups = readFileSync(join(__dirname, '..', 'src/demo/TournamentScreen.tsx'), 'utf8');
    const chip = cups.slice(cups.indexOf('{item && ('), cups.indexOf('{coming ?'));
    assert(/<Pressable/.test(chip) && /onPreview\(/.test(chip), 'the prize on a cup card cannot be seen on the board');
  });
});

suite('inventory · the screen draws the rule', () => {
  const source = readFileSync(join(__dirname, '..', 'src/demo/InventoryScreen.tsx'), 'utf8');

  test('it lists the cupboard, not the whole game', () => {
    assert(/inventoryDice\(trophies, now\)/.test(source), 'the dice are not the cupboard');
    assert(/inventoryArenas\(trophies, now\)/.test(source), 'the battlefields are not the cupboard');
    assert(!/INVENTORY_SKIN_ORDER\.map|ARENA_ORDER\.map/.test(source), 'the screen walks every item again');
    assert(!/cardLocked|passTag|paidSkinWhere|Win it in a cup/.test(source), 'a locked card is back');
  });

  test('equipped markers and tap-to-see are kept', () => {
    assert((source.match(/EQUIPPED/g) ?? []).length >= 2, 'an EQUIPPED marker is gone');
    assert((source.match(/Tap to see/g) ?? []).length >= 2, 'a "Tap to see" is gone');
  });

  test('the notes describe a cupboard', () => {
    assert(/Every set you own/.test(source), 'the dice note does not say these are yours');
    assert(/Every battlefield you own/.test(source), 'the battlefield note does not say these are yours');
    assert(/onlyStarters\(/.test(source), 'nothing says where to get more');
  });
});
