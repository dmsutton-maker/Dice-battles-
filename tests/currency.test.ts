import { averageOf } from '../src/game/rewards';
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
import { TIERS, UnlockId } from '../src/game/progress';

const priceInTrophies = (id: UnlockId): number =>
  TIERS.find((t) => t.id === id)?.at ?? 0;
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
        COIN_REWARDS[d].win.min > COIN_REWARDS[d].loss.max,
        `${d} can pay as much for losing as winning`,
      );
    }
    assert(
      averageOf(COIN_REWARDS.easy.win) < averageOf(COIN_REWARDS.medium.win) &&
        averageOf(COIN_REWARDS.medium.win) < averageOf(COIN_REWARDS.hard.win),
      'harder battles should pay more',
    );
  });

  test('the payout actually varies, and stays inside its band', () => {
    // David asked for a range rather than a fixed number: an Easy win is
    // 10-20 coins, not 20 every single time.
    const band = COIN_REWARDS.easy.win;
    assert(band.min === 10 && band.max === 20, 'Easy win should be 10-20');
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      resetWalletForTests();
      const paid = awardCoins('won', 'easy');
      assert(
        paid >= band.min && paid <= band.max,
        `paid ${paid}, outside ${band.min}-${band.max}`,
      );
      seen.add(paid);
    }
    assert(seen.size > 1, 'the payout never varied across 400 wins');
  });

  test('both ends of a band are reachable', () => {
    const band = COIN_REWARDS.easy.win;
    resetWalletForTests();
    assertEqual(awardCoins('won', 'easy', () => 0), band.min, 'lowest roll');
    resetWalletForTests();
    assertEqual(
      awardCoins('won', 'easy', () => 0.999999999),
      band.max,
      'highest roll',
    );
  });

  test('losing still pays something', () => {
    // A young player on a losing streak should still be working toward
    // something rather than earning nothing at all.
    for (const d of ['easy', 'medium', 'hard'] as const) {
      assert(COIN_REWARDS[d].loss.min > 0, `${d} can pay nothing for a loss`);
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
    // Ivory sits on the ladder at zero trophies — it is the dice you start
    // with, so being usable at 0 is correct, not a leak. Everything that
    // actually COSTS trophies must stay out of reach of coins.
    const costsTrophies = DICE_SKINS.filter(
      (s) => s.price === undefined && s.unlock && priceInTrophies(s.unlock) > 0,
    );
    assert(costsTrophies.length > 0, 'no trophy-gated dice left to check');
    for (const skin of costsTrophies) {
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
    const winsNeeded = Math.ceil(cheapest / averageOf(COIN_REWARDS.medium.win));
    assert(
      winsNeeded <= 10,
      `the cheapest item needs ${winsNeeded} Medium wins — too far away`,
    );
  });
});

suite('currency · store shelf', () => {
  test('the Store lists items cheapest first', () => {
    const prices = STORE_SKINS.map((s) => s.price!);
    for (let i = 1; i < prices.length; i++) {
      assert(
        prices[i] >= prices[i - 1],
        `${STORE_SKINS[i].name} (${prices[i]}) is listed after a dearer item (${prices[i - 1]})`,
      );
    }
  });

  test('sorting the shelf did not drop or duplicate anything', () => {
    const buyable = DICE_SKINS.filter((s) => s.price !== undefined);
    assertEqual(STORE_SKINS.length, buyable.length, 'an item fell off the shelf');
    assertEqual(
      new Set(STORE_SKINS.map((s) => s.id)).size,
      STORE_SKINS.length,
      'an item is listed twice',
    );
  });
});
