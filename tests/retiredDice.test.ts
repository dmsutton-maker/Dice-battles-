import './storageMock';
import { assert, assertEqual, suite, test } from './harness';
import { DICE_SKINS, RETIRED_DICE_REFUNDS, RETIRED_SKINS, STORE_SKINS, skinById } from '../src/game/diceSkins';
import { INVENTORY_SKIN_ORDER, isSkinUnlocked, refundRetiredDice } from '../src/game/loadout';
import { inventoryDice, obtainableDiceCount, STARTING_DICE } from '../src/game/inventoryRules';
import { getWallet, owns, resetWalletForTests } from '../src/game/currency';
import { resetProgressForTests, setUnlockAll } from '../src/game/progress';
import { setsOwned } from '../src/game/achievements';

/**
 * Marc, 4 Nov 2026, after four redesigns of the Baseball dice on a design
 * board: "none of them look good, just remove it from being able to be
 * obtained and make it only appear in your inventory with admin mode."
 * Then: "do the same with the soccer ball, basketball, bowling ball,
 * volleyball, and football dice."
 *
 * So a die can now be RETIRED: off the shelf, off the ladder, out of
 * the "of N", and seen only by family tester (admin) mode. Whoever had
 * paid for it gets the coins back the next time the game opens.
 */
const NOV = Date.UTC(2026, 10, 4, 12);

// The six ball dice of v1.158.0, and the Tennis Ball since 5 Nov 2026
// (Marc: "Take tennis ball out the same way you did with the other balls").
const BALLS = ['baseball', 'soccer', 'basketball', 'football', 'bowling', 'volleyball', 'tennis'];

suite('retired dice · the seven ball dice are nobody\'s to get any more', () => {
  test('all seven are retired, and a retired die has no price, rung, prize, pass or product', () => {
    for (const id of BALLS) assert(skinById(id).retired === true, `${id} is not marked retired`);
    assertEqual(RETIRED_SKINS.length, BALLS.length, 'something else is retired too');
    for (const skin of RETIRED_SKINS) {
      assertEqual(skin.price, undefined, `${skin.name} still has a price`);
      assert(skin.unlock === undefined || skin.unlock === null, `${skin.name} is still on the ladder`);
      assert(!skin.prize && !skin.pass && !skin.paid, `${skin.name} still has a route`);
    }
    assert(!STORE_SKINS.some((s) => s.retired), 'a retired die is on the Store shelf');
    assert(!STARTING_DICE.some((id) => skinById(id).retired), 'a retired die counts as a starter');
    assert(RETIRED_SKINS.every((s) => RETIRED_DICE_REFUNDS[s.id] > 0), 'a retired die has no refund');
  });

  test('only admin mode unlocks it; a wallet entry from before does not', () => {
    resetProgressForTests();
    resetWalletForTests({ coins: 0, owned: ['baseball'] });
    assert(!isSkinUnlocked('baseball', 999_999), 'unlocked without admin mode');
    assert(!inventoryDice(999_999, NOV).some((s) => s.id === 'baseball'), 'in the cupboard without admin mode');
    setUnlockAll(true);
    assert(isSkinUnlocked('baseball', 0), 'admin mode does not unlock it');
    assert(inventoryDice(0, NOV).some((s) => s.id === 'baseball'), 'admin mode does not show it');
    setUnlockAll(false);
    resetWalletForTests();
    resetProgressForTests();
  });

  test('whoever had bought them gets the old price back, once', () => {
    resetWalletForTests({ coins: 20, owned: ['baseball', 'cow', 'volleyball'] });
    assertEqual(refundRetiredDice().join(','), 'baseball,volleyball', 'the refund names the dice');
    assertEqual(getWallet().coins, 20 + 480 + 1060, 'coins refunded');
    assert(!owns('baseball') && !owns('volleyball'), 'a die is still owned');
    assert(owns('cow'), 'another die was taken too');
    assertEqual(refundRetiredDice().length, 0, 'refunded twice');
    assertEqual(getWallet().coins, 20 + 480 + 1060, 'coins refunded twice');
    resetWalletForTests();
    assertEqual(refundRetiredDice().length, 0, 'a wallet without it is refunded');
  });

  test('it is not counted: not in "of N", not by the Collector achievement', () => {
    assertEqual(
      obtainableDiceCount(NOV),
      INVENTORY_SKIN_ORDER.filter((s) => !s.retired && s.id !== 'sun' && s.id !== 'moon').length,
      'obtainable count',
    );
    resetProgressForTests();
    resetWalletForTests({ coins: 0, owned: ['baseball'] });
    setUnlockAll(true);
    assert(setsOwned(0) < DICE_SKINS.length, 'the Collector counted a retired die');
    setUnlockAll(false);
    resetWalletForTests();
    resetProgressForTests();
  });
});
