import {
  awardCoins,
  buyWithCoins,
  canAfford,
  COIN_REWARDS,
  getWallet,
  owns,
  resetWalletForTests,
} from '../src/game/currency';
import { DICE_SKINS, STORE_SKINS } from '../src/game/diceSkins';
import { isSkinUnlocked } from '../src/game/loadout';
import { assert, assertEqual, suite, test } from './harness';

/**
 * Coins are the only thing in the game a player can lose by spending, so
 * the rules around them have to be exact — a wallet that can go negative
 * or an item that can be bought twice is money taken for nothing.
 */
suite('currency · earning', () => {
  test('winning pays more than losing, and harder pays more', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      assert(
        COIN_REWARDS[d].win > COIN_REWARDS[d].loss,
        `${d} pays as much for losing as winning`,
      );
    }
    assert(
      COIN_REWARDS.easy.win < COIN_REWARDS.medium.win &&
        COIN_REWARDS.medium.win < COIN_REWARDS.hard.win,
      'harder battles should pay more',
    );
  });

  test('losing still pays something', () => {
    // A young player on a losing streak should still be working toward
    // something rather than earning nothing at all.
    for (const d of ['easy', 'medium', 'hard'] as const) {
      assert(COIN_REWARDS[d].loss > 0, `${d} pays nothing for a loss`);
    }
  });

  test('coins only ever go up from playing', () => {
    resetWalletForTests();
    let expected = 0;
    for (const outcome of ['won', 'lost', 'tie', 'lost', 'won'] as const) {
      const before = getWallet().coins;
      const paid = awardCoins(outcome, 'medium');
      assert(paid > 0, `${outcome} paid nothing`);
      assert(getWallet().coins > before, `${outcome} reduced the balance`);
      expected += paid;
    }
    assertEqual(getWallet().coins, expected, 'wallet total');
  });
});

suite('currency · spending', () => {
  test('a purchase costs exactly its price and is kept', () => {
    resetWalletForTests({ coins: 1000, owned: [] });
    const skin = STORE_SKINS[0];
    const result = buyWithCoins(skin.id, skin.price!);
    assert(result.ok, 'purchase was refused despite enough coins');
    assertEqual(getWallet().coins, 1000 - skin.price!, 'coins after purchase');
    assert(owns(skin.id), 'the item was not kept');
  });

  test('you cannot buy what you cannot afford, and the wallet never goes negative', () => {
    resetWalletForTests({ coins: 10, owned: [] });
    const skin = STORE_SKINS[0];
    const result = buyWithCoins(skin.id, skin.price!);
    assert(!result.ok, 'an unaffordable item was sold');
    assertEqual(getWallet().coins, 10, 'coins were taken for a refused purchase');
    assert(!owns(skin.id), 'a refused purchase was still granted');
  });

  test('paying twice for the same item is refused', () => {
    resetWalletForTests({ coins: 5000, owned: [] });
    const skin = STORE_SKINS[0];
    buyWithCoins(skin.id, skin.price!);
    const after = getWallet().coins;
    const second = buyWithCoins(skin.id, skin.price!);
    assert(!second.ok, 'the same item was sold twice');
    assertEqual(getWallet().coins, after, 'coins were taken for a duplicate');
  });

  test('a bought skin becomes usable, and is not usable before', () => {
    resetWalletForTests({ coins: 5000, owned: [] });
    const skin = STORE_SKINS[0];
    assert(
      !isSkinUnlocked(skin.id, 99999),
      'a Store skin was usable without buying it — even a full trophy count must not grant it',
    );
    buyWithCoins(skin.id, skin.price!);
    assert(isSkinUnlocked(skin.id, 0), 'a bought skin is still not usable');
  });

  test('trophies and coins never unlock each other', () => {
    // The two currencies must stay separate: coins buy Store skins only,
    // trophies unlock ladder skins only.
    resetWalletForTests({ coins: 99999, owned: [] });
    for (const skin of DICE_SKINS.filter((s) => s.price === undefined && s.unlock)) {
      assert(
        !isSkinUnlocked(skin.id, 0),
        `${skin.name} is a ladder reward but coins alone made it usable`,
      );
    }
  });

  test('prices are ordered so cheaper items are reachable first', () => {
    const prices = STORE_SKINS.map((s) => s.price!);
    assert(prices.every((p) => p > 0), 'a Store item is free');
    // A first purchase should be within reach of a modest run of wins,
    // not a grind that makes coins feel pointless.
    const cheapest = Math.min(...prices);
    const winsNeeded = Math.ceil(cheapest / COIN_REWARDS.medium.win);
    assert(
      winsNeeded <= 10,
      `the cheapest item needs ${winsNeeded} Medium wins — too far away`,
    );
  });
});
