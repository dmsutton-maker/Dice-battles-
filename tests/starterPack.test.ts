import './storageMock';
import { assert, assertEqual, suite, test } from './harness';
import { DICE_SKINS, LADDER_SKINS, PAID_SKINS, STORE_SKINS, skinById } from '../src/game/diceSkins';
import { isSkinUnlocked } from '../src/game/loadout';
import { PRODUCTS, STARTER_WINDOW_MS, productById, sellable } from '../src/game/products';
import { hasEntitlement, resetPurchasesForTest } from '../src/game/purchases';
import { resetProgressForTests } from '../src/game/progress';
import { actionLabel, previewAction } from '../src/game/itemPreview';

/*
  David, 18 Oct 2026: "Move the starter pack out of the coming later and
  into the full store." It was parked because the Supporter die it
  promises did not exist; these pin the die, the pack and the window.
*/

suite('starter pack · on sale, with a real Supporter die', () => {
  test('the pack is on sale and promises what it grants', () => {
    const pack = productById('starter_pack');
    assert(pack !== undefined, 'the starter pack is gone from the catalogue');
    assertEqual(pack!.available, true, 'the starter pack is still parked');
    assertEqual(pack!.kind, 'once', 'the starter pack is no longer a one-off');
    assertEqual(pack!.coins, 1500, 'the pack no longer pays 1,500 coins');
    assert((pack!.grants ?? []).includes('supporter'), 'the pack no longer grants the Supporter die');
    assert(/Supporter die/.test(pack!.details), 'the description does not mention the Supporter die');
  });

  test('the Supporter die exists, is money-only, and is not on any other shelf', () => {
    const die = DICE_SKINS.find((s) => s.id === 'supporter');
    assert(die !== undefined, 'the Supporter die does not exist');
    assertEqual(die!.paid, true, 'the Supporter die is not marked money-only');
    assertEqual(die!.price, undefined, 'the Supporter die can be bought with coins');
    assert(!LADDER_SKINS.includes(die!), 'the Supporter die is on the trophy ladder');
    assert(!STORE_SKINS.includes(die!), 'the Supporter die is on the coin shelf');
    assert(PAID_SKINS.includes(die!), 'the Supporter die is not listed as money-only');
    assertEqual(die!.pattern, 'paperShips', 'the Supporter die lost its paper ships');
  });

  test('it is locked until bought, and the purchase record unlocks it', () => {
    resetProgressForTests();
    resetPurchasesForTest();
    assertEqual(isSkinUnlocked('supporter', 100000), false, 'trophies unlock a money-only die');
    resetPurchasesForTest({ owned: ['supporter'] });
    assertEqual(hasEntitlement('supporter'), true, 'the purchase record does not hold the die');
    assertEqual(isSkinUnlocked('supporter', 0), true, 'buying the Starter pack does not unlock the die');
    resetPurchasesForTest();
  });

  test('a locked Supporter die points to the Starter pack, not to coins or trophies', () => {
    const skin = skinById('supporter');
    const action = previewAction({
      unlocked: false,
      equipped: false,
      owned: false,
      trophies: 0,
      coins: 99999,
      price: skin.price,
      needTrophies: 0,
      paid: skin.paid,
      canBuy: true,
    } as Parameters<typeof previewAction>[0]);
    assertEqual(action.kind, 'paid', 'the preview offers the wrong way to get it');
    assertEqual(actionLabel(action), 'In the Starter pack', 'the preview button says the wrong thing');
  });

  test('players see it only in their first two days; the family always does', () => {
    const installed = 1_000_000;
    const inside = sellable(installed, installed + STARTER_WINDOW_MS - 1).map((p) => p.id);
    const after = sellable(installed, installed + STARTER_WINDOW_MS + 1).map((p) => p.id);
    const family = sellable(installed, installed + STARTER_WINDOW_MS * 100, true).map((p) => p.id);
    assert(inside.includes('starter_pack'), 'a new player is not offered the starter pack');
    assert(!after.includes('starter_pack'), 'the starter pack is still offered after two days');
    assert(family.includes('starter_pack'), 'family tester mode cannot see the starter pack');
    // Unknown install time is still NO for players (see withinStarterWindow).
    assert(!sellable(null, installed).some((p) => p.id === 'starter_pack'), 'an unknown install time shows the offer');
  });

  test('every product on sale has its own App Store id and a description', () => {
    for (const p of PRODUCTS.filter((x) => x.available)) {
      assert(/^[a-z0-9_]+$/.test(p.id), `${p.id} is not a valid App Store product id`);
      assert(p.details.length > 20, `${p.id} has no full description`);
    }
  });
});
