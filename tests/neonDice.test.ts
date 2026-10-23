import './storageMock';
import { assert, assertEqual, suite, test } from './harness';
import { PAID_SKINS, STORE_SKINS, skinById } from '../src/game/diceSkins';
import { isSkinUnlocked } from '../src/game/loadout';
import { paidSkinWhere, productById, sellable } from '../src/game/products';
import { resetPurchasesForTest } from '../src/game/purchases';
import { resetProgressForTests, setUnlockAll } from '../src/game/progress';
import { actionLabel, previewAction } from '../src/game/itemPreview';
import * as THREE from 'three';
import { DiceNeon } from '../src/dice/diceNeon';
import { Kind } from '../src/dice/particles';

/*
  David, 20 Oct 2026: "I like the neon. Add it to the game in the store
  and write the $1.99 price tag and make sure it's available with admin
  mode." Admin mode is family tester mode (the FAMILY code).
*/

suite('neon dice · $1.99 on the money shelf', () => {
  test('the product is on sale at $1.99 and grants the die', () => {
    const product = productById('neon_dice');
    assert(product !== undefined, 'there is no neon_dice product');
    assertEqual(product!.usd, 1.99, 'the Neon dice are not $1.99');
    assertEqual(product!.kind, 'once', 'the Neon dice are not a one-off purchase');
    assertEqual(product!.available, true, 'the Neon dice are not on sale');
    assert((product!.grants ?? []).includes('neon'), 'buying it does not grant the die');
    assert(sellable(null, Date.now()).some((p) => p.id === 'neon_dice'), 'the shelf does not list it');
  });

  test('the die is money-only, with its effect, and off the coin shelf', () => {
    const skin = skinById('neon');
    assertEqual(skin.paid, true, 'the Neon die is not marked money-only');
    assertEqual(skin.price, undefined, 'the Neon die can be bought with coins');
    assertEqual(skin.effect, 'neon', 'the Neon die lost its light trail');
    assert(PAID_SKINS.includes(skin), 'the Neon die is not listed as money-only');
    assert(!STORE_SKINS.includes(skin), 'the Neon die is on the coin shelf');
  });

  test('its locked card and preview show the price, not the Starter pack', () => {
    assertEqual(paidSkinWhere('neon'), '$1.99', 'the locked card shows the wrong tag');
    assertEqual(paidSkinWhere('supporter'), 'Starter pack', 'the Supporter die lost its tag');
    const action = previewAction({
      unlocked: false,
      equipped: false,
      owned: false,
      trophies: 0,
      coins: 99999,
      needTrophies: 0,
      paid: true,
      paidWhere: paidSkinWhere('neon'),
      canBuy: true,
    } as Parameters<typeof previewAction>[0]);
    assertEqual(actionLabel(action), '$1.99 in the money shop', 'the preview button says the wrong thing');
  });

  test('locked until bought, and open in family tester mode', () => {
    resetProgressForTests();
    resetPurchasesForTest();
    assertEqual(isSkinUnlocked('neon', 100000), false, 'trophies unlock the Neon die');
    setUnlockAll(true);
    assertEqual(isSkinUnlocked('neon', 0), true, 'family tester mode does not open the Neon die');
    setUnlockAll(false);
    resetPurchasesForTest({ owned: ['neon'] });
    assertEqual(isSkinUnlocked('neon', 0), true, 'buying the Neon dice does not unlock them');
    resetPurchasesForTest();
    resetProgressForTests();
  });

  test('a rolling die lays a trail, a still one lays none, and landing spreads a ring', () => {
    const neon = new DiceNeon(1);
    const q = new THREE.Quaternion();
    const at = (x: number, moving: boolean) => [{ x, y: 0.5, z: 0, vx: 4, vy: 0, vz: 0, quaternion: q, moving }];
    neon.thrown();
    // Rolling 1.4 units in fourteen frames: a dot every 0.07, so about twenty.
    for (let f = 0; f <= 14; f++) neon.update(1 / 60, f / 60, at(f * 0.1, true), 400);
    const trail = neon.pool.alive();
    assert(trail >= 15 && trail <= 25, `a 1.4-unit roll laid ${trail} dots`);
    assert(neon.pool.aliveOf(Kind.NeonPink) > 0 && neon.pool.aliveOf(Kind.NeonCyan) > 0, 'the trail is not pink and cyan');
    // Comes to rest: a ring of light.
    neon.update(1 / 60, 0.3, at(1.4, false), 400);
    assert(neon.pool.alive() >= trail + 30, 'no ring of light where the die came to rest');
    // At rest for two seconds: everything fades and nothing new is laid.
    for (let f = 0; f < 120; f++) neon.update(1 / 60, 0.3 + f / 60, at(1.4, false), 400);
    assertEqual(neon.pool.alive(), 0, 'a die at rest keeps glowing or laying light');
    neon.dispose();
  });
});
