import './storageMock';
import { assert, assertEqual, suite, test } from './harness';
import { ARENA_PRICES, ARENA_UNLOCKS, isArenaUnlocked, PAID_ARENAS, STORE_ARENAS } from '../src/game/loadout';
import { paidSkinWhere, productById, sellable } from '../src/game/products';
import { resetPurchasesForTest } from '../src/game/purchases';
import { resetProgressForTests, setUnlockAll } from '../src/game/progress';
import { ARENA_JAILS } from '../src/arena/jailKinds';
import { ARENA_THEMES } from '../src/arena/themeData';

/*
  David, 20 Oct 2026: "give me a cool arena worth 3 dollars", then of
  Dino Valley, "Yes, do those things. Also make the dinosaurs move
  around the surroundings." Those things: its own jail, its own picture,
  and a $2.99 product.
*/

suite('dino valley · $2.99 on the money shelf', () => {
  test('the product is on sale at $2.99 and grants the battlefield', () => {
    const product = productById('dino_valley');
    assert(product !== undefined, 'there is no dino_valley product');
    assertEqual(product!.usd, 2.99, 'Dino Valley is not $2.99');
    assertEqual(product!.kind, 'once', 'Dino Valley is not a one-off purchase');
    assert((product!.grants ?? []).includes('dino'), 'buying it does not grant the battlefield');
    assert(sellable(null, Date.now()).some((p) => p.id === 'dino_valley'), 'the shelf does not list it');
  });

  test('money is the only way in: no tier, no coin price, not on the coin shelf', () => {
    assert(PAID_ARENAS.includes('dino'), 'Dino Valley is not listed as money-only');
    assertEqual(ARENA_UNLOCKS.dino, undefined, 'trophies unlock Dino Valley');
    assertEqual(ARENA_PRICES.dino, undefined, 'Dino Valley can be bought with coins');
    assert(!STORE_ARENAS.includes('dino'), 'Dino Valley is on the coin shelf');
    assertEqual(paidSkinWhere('dino'), '$2.99', 'its locked card shows the wrong tag');
  });

  test('locked until bought, and open in family tester mode', () => {
    resetProgressForTests();
    resetPurchasesForTest();
    assertEqual(isArenaUnlocked('dino', 100000), false, 'trophies open Dino Valley');
    setUnlockAll(true);
    assertEqual(isArenaUnlocked('dino', 0), true, 'family tester mode does not open Dino Valley');
    setUnlockAll(false);
    resetPurchasesForTest({ owned: ['dino'] });
    assertEqual(isArenaUnlocked('dino', 0), true, 'buying Dino Valley does not open it');
    resetPurchasesForTest();
    resetProgressForTests();
  });

  test('it has its own jail, bump and pit', () => {
    assertEqual(ARENA_JAILS.dino, 'boneCage', 'Dino Valley borrows another board\'s jail');
    assertEqual(ARENA_THEMES.dino.look.mound.kind, 'eggNest', 'Dino Valley lost its egg nest');
    assertEqual(ARENA_THEMES.dino.look.pit.kind, 'tarPit', 'Dino Valley lost its tar pit');
  });
});
