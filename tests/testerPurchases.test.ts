import { store } from './storageMock';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, suite, test } from './harness';
import {
  adsRemoved,
  buy,
  goldPassUnlocked,
  hasEntitlement,
  hasGoldPass,
  hasPurchaseAccess,
  isSoldForMoney,
  resetPurchasesForTest,
  storeState,
  testerUnlocksPurchases,
} from '../src/game/purchases';
import { GOLD_PASS_ID, PRODUCTS, REMOVE_ADS } from '../src/game/products';
import { getWallet, resetWalletForTests } from '../src/game/currency';
import { hasCheated, resetProgressForTests, setUnlockAll } from '../src/game/progress';
import { monthStamp } from '../src/game/easternTime';
import { isArenaUnlocked, isSkinUnlocked } from '../src/game/loadout';
import { setsOwned } from '../src/game/achievements';

/**
 * David, 1 Nov 2026: "All the things that cost real money like the gold
 * pass are for free with the admin code."
 *
 * Tester (admin) mode lends everything sold in products.ts, as an
 * OVERRIDE: no purchase record is written, so the lock code puts every
 * answer back exactly as it was.
 */

const root = join(__dirname, '..');
const source = (path: string) => readFileSync(join(root, path), 'utf8');

/** Run a body with tester mode in a known state, always leaving it off. */
function fresh(body: () => void | Promise<void>): () => Promise<void> {
  return async () => {
    resetProgressForTests();
    resetWalletForTests();
    resetPurchasesForTest();
    store.clear();
    try {
      await body();
    } finally {
      setUnlockAll(false);
      resetProgressForTests();
      resetWalletForTests();
      resetPurchasesForTest();
    }
  };
}

const forSale = PRODUCTS.filter((p) => p.available);
const grantedIds = forSale.flatMap((p) => p.grants ?? []);

suite('tester mode · everything that costs money is lent', () => {
  test('without the code, nothing is lent', fresh(() => {
    assert(!testerUnlocksPurchases(), 'tester mode starts off');
    assert(!goldPassUnlocked(), 'Gold Pass');
    assert(!adsRemoved(), 'ads');
    for (const id of [...forSale.map((p) => p.id), ...grantedIds]) {
      assert(!hasPurchaseAccess(id), `${id} was free without the code`);
    }
    assertEqual(isSkinUnlocked('neon', 0), false, 'Neon dice');
    assertEqual(isArenaUnlocked('dino', 0), false, 'Dino Valley');
  }));

  test('with the code: the Gold Pass, no ads, and every paid product and what it grants', fresh(() => {
    setUnlockAll(true);
    assert(goldPassUnlocked(), 'the Gold row should pay');
    assert(hasPurchaseAccess(GOLD_PASS_ID), 'Gold Pass shows as unlocked');
    assert(adsRemoved(), 'Remove Ads');
    assert(hasPurchaseAccess(REMOVE_ADS), 'the Remove Ads entitlement');
    for (const product of forSale.filter((p) => p.kind !== 'consumable')) {
      assert(hasPurchaseAccess(product.id), `${product.name} is not unlocked`);
    }
    // Neon, Dino Valley and the Starter pack's Supporter die.
    for (const id of ['neon', 'dino', 'supporter']) {
      assert(grantedIds.includes(id), `${id} is on sale`);
      assert(hasPurchaseAccess(id), `${id} is not unlocked`);
    }
    assertEqual(isSkinUnlocked('neon', 0), true, 'Neon dice usable');
    assertEqual(isSkinUnlocked('supporter', 0), true, 'Supporter die usable');
    assertEqual(isArenaUnlocked('dino', 0), true, 'Dino Valley usable');
  }));

  test('only what is for sale is lent — a cup prize is not', fresh(() => {
    setUnlockAll(true);
    assert(!isSoldForMoney('amethyst'), 'Amethyst is a cup prize');
    assert(!hasPurchaseAccess('amethyst'), 'tester mode must not invent ownership');
    assert(!isSoldForMoney('premium_dice_pack'), 'the parked packs are not on sale');
  }));

  test('the shelf is drawn even on a phone with no store', fresh(() => {
    assertEqual(storeState().available, false, 'no store, no tester: the quiet line');
    setUnlockAll(true);
    assertEqual(storeState().available, true, 'tester mode shows the shelf');
  }));
});

suite('tester mode · an override, never a purchase record', () => {
  test('the real record is untouched while it is on', fresh(() => {
    setUnlockAll(true);
    assertEqual(hasEntitlement('neon'), false, 'hasEntitlement stays truthful');
    assertEqual(hasEntitlement(GOLD_PASS_ID), false, 'no Gold Pass on record');
    assertEqual(hasGoldPass(), false, 'hasGoldPass stays truthful');
    assert(
      !store.has('dice-battles:entitlements') && !store.has('dice-battles:gold-pass-months'),
      'nothing was written to the purchase keys',
    );
  }));

  test('turning it off puts everything exactly back', fresh(() => {
    setUnlockAll(true);
    assert(goldPassUnlocked() && adsRemoved() && hasPurchaseAccess('neon'), 'on');
    setUnlockAll(false);
    assert(!goldPassUnlocked(), 'Gold Pass is gone');
    assert(!adsRemoved(), 'ads are back');
    assert(!hasPurchaseAccess('neon'), 'Neon is locked again');
    assert(!hasPurchaseAccess('dino'), 'Dino Valley is locked again');
    assert(!hasPurchaseAccess('supporter'), 'the Supporter die is locked again');
  }));

  test('what was really bought stays bought when it goes off', fresh(() => {
    const thisMonth = monthStamp(Date.now());
    resetPurchasesForTest({ owned: ['remove-ads', 'neon', 'neon_dice'], passMonths: [thisMonth] });
    setUnlockAll(true);
    setUnlockAll(false);
    assert(adsRemoved(), 'the real Remove Ads survives');
    assert(hasEntitlement('neon'), 'the real Neon survives');
    assert(hasGoldPass(), 'the real Gold Pass survives');
    assert(goldPassUnlocked(), 'and so does the shelf answer');
  }));

  test('the Collector count never counts borrowed dice', fresh(() => {
    // achievements.ts asks hasEntitlement, not hasPurchaseAccess.
    const before = setsOwned(0);
    setUnlockAll(true);
    assertEqual(setsOwned(0), before, 'tester mode handed over the collection');
  }));
});

suite('tester mode · coin packs add their coins without the App Store', () => {
  const pack = forSale.find((p) => p.kind === 'consumable' && p.coins === 500)!;

  test('tapping a pack adds its coins and says nothing was charged', fresh(async () => {
    setUnlockAll(true);
    resetWalletForTests({ coins: 10, owned: [] });
    const result = await buy(pack.id);
    assert(result.ok, 'the tester purchase went through');
    assert(result.ok && result.tester === true, 'and says it was a tester one');
    assertEqual(getWallet().coins, 510, 'the coins arrived');
  }));

  test('every pack pays its own amount, as often as it is tapped', fresh(async () => {
    setUnlockAll(true);
    resetWalletForTests({ coins: 0, owned: [] });
    let expected = 0;
    for (const p of forSale.filter((x) => x.kind === 'consumable')) {
      await buy(p.id);
      await buy(p.id);
      expected += (p.coins ?? 0) * 2;
    }
    assertEqual(getWallet().coins, expected, 'two taps each');
  }));

  test('free coins take the save off the shared board, like the coin codes', fresh(async () => {
    setUnlockAll(true);
    assert(!hasCheated(), 'clean to begin with');
    await buy(pack.id);
    assert(hasCheated(), 'typed-in coins buy real dice');
  }));

  test('a one-off product grants nothing extra and writes no record', fresh(async () => {
    setUnlockAll(true);
    const neon = forSale.find((p) => p.id === 'neon_dice')!;
    const result = await buy(neon.id);
    assert(result.ok, 'ok');
    assertEqual(getWallet().coins, 0, 'no coins');
    assertEqual(hasEntitlement('neon'), false, 'no purchase record');
  }));
});

suite('tester mode · the shelf says so, and ads only ever go off', () => {
  const shelf = source('src/demo/MoneyShelf.tsx');
  const ads = source('src/game/ads.ts');
  const purchases = source('src/game/purchases.ts');

  test('the shelf says "unlocked by tester mode" instead of a price', () => {
    assert(/Unlocked by tester mode/.test(shelf), 'the card note');
    assert(/Free in tester mode/.test(shelf), 'the coin pack note');
    assert(/tester \? 'FREE' : priceLabel/.test(shelf), 'no price in tester mode');
    assert(/hasPurchaseAccess/.test(shelf), 'the shelf asks the override-aware question');
  });

  test('tester mode skips the "it costs" confirmation', () => {
    assert(/askOrTake/.test(shelf), 'a tester is not asked to pay');
  });

  test('the Gold row pays from the override-aware answer', () => {
    const screen = source('src/demo/DiceDemoScreen.tsx');
    assert(/const owned = goldPassUnlocked\(\)/.test(screen), 'claimGoldLevels');
  });

  test('ads.ts only learns "removed"; the child-directed flags are untouched', () => {
    assert(!/testerUnlocksPurchases/.test(ads), 'ads.ts has no tester branch of its own');
    assert(/tagForChildDirectedTreatment: true/.test(ads), 'child-directed flag');
    assert(/requestNonPersonalizedAdsOnly: true/.test(ads), 'non-personalised flag');
    assert(/maxAdContentRating: mod\.MaxAdContentRating\.G/.test(ads), 'G rating');
    assert(
      /return owned\.has\(REMOVE_ADS\) \|\| testerUnlocksPurchases\(\);/.test(purchases),
      'tester mode can only make adsRemoved() true',
    );
  });

  test('tester mode is never written as a purchase', () => {
    // The override functions must not touch the stores of real purchases.
    const body = purchases.slice(
      purchases.indexOf('export function testerUnlocksPurchases'),
      purchases.indexOf('export function hasEntitlement'),
    );
    assert(!/owned\.add|passMonths\.add|persist\(/.test(body), 'override writes a record');
  });
});
