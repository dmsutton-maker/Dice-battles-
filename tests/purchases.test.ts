import './storageMock';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  PRODUCTS,
  REMOVE_ADS,
  STARTER_WINDOW_MS,
  productById,
  sellable,
  withinStarterWindow,
} from '../src/game/products';
import { adsRemoved, hasEntitlement, resetPurchasesForTest, storeState } from '../src/game/purchases';
import { DICE_SKINS } from '../src/game/diceSkins';

const root = join(__dirname, '..');
const source = (path: string) => readFileSync(join(root, path), 'utf8');

/**
 * What the game sells, and the promises around it.
 *
 * These are worth testing harder than most things here, because they are
 * not opinions about feel. Two of them are rules the FAMILY wrote for
 * themselves when they chose the products on 31 Aug 2026 — no mystery
 * boxes, and nothing that buys a better chance of winning — and the rest
 * are Apple's, on an app a five-year-old uses.
 */

suite('purchases · the two rules the family wrote', () => {
  test('nothing sold changes how the dice land', () => {
    /*
      "Nothing for sale will ever change how the dice land. The moment
      money buys wins, the game stops being fair, and fair is the whole
      point." Their words, and the reason this is a test and not a note.

      A product may grant coins, or a cosmetic id, or REMOVE_ADS. There
      is deliberately no fourth kind of thing it can hand over, so a
      product that granted an advantage could not be expressed without
      changing this file and tripping this test.
    */
    const cosmetics = new Set(DICE_SKINS.map((s) => s.id));
    const arenaIds = new Set(
      Object.keys(JSON.parse('{}')).concat(
        [...source('src/arena/themeData.ts').matchAll(/^  ([a-z]+): \{$/gm)].map((m) => m[1]),
      ),
    );

    /*
      Checked against what can actually be BOUGHT. A parked product is
      allowed to name content that does not exist yet — that is usually
      the very reason it is parked — and the test below proves a parked
      product cannot reach a player. Widening this to every product in
      the file would force the catalogue to describe only things already
      built, which is the opposite of what the list is for.
    */
    const onSale = PRODUCTS.filter((p) => p.available);
    for (const product of onSale) {
      for (const granted of product.grants ?? []) {
        const known =
          granted === REMOVE_ADS || cosmetics.has(granted) || arenaIds.has(granted);
        assert(
          known,
          `${product.id} is ON SALE and grants "${granted}", which is not a ` +
            'dice set, a battlefield, or removing adverts. If it is ' +
            'something new, check it cannot affect a roll before selling it.',
        );
      }
    }
    for (const product of PRODUCTS) {
      assert(
        (product.coins ?? 0) >= 0,
        `${product.id} grants a negative number of coins`,
      );
    }
    note(`${onSale.length} products on sale, none granting anything that touches a roll`);
  });

  test('no mystery boxes, ever', () => {
    // "Pay money, get a random prize — that's a slot machine with extra
    // steps, and it's the wrong thing to put in front of five-year-olds."
    const catalogue = source('src/game/products.ts').toLowerCase();
    const purchase = source('src/game/purchases.ts').toLowerCase();
    for (const word of ['loot', 'mystery box', 'gacha', 'random prize']) {
      assert(
        !PRODUCTS.some((p) => `${p.name} ${p.blurb}`.toLowerCase().includes(word)),
        `a product mentions "${word}" — the family ruled these out`,
      );
    }
    // And nothing in the purchase path may reach for randomness at all.
    for (const [file, code] of [
      ['products.ts', catalogue],
      ['purchases.ts', purchase],
    ] as const) {
      assert(
        !/math\.random/.test(code),
        `${file} uses Math.random — a purchase must never have a random outcome`,
      );
    }
  });
});

suite('purchases · what is on sale, and what is not', () => {
  test('a parked product can never reach a player', () => {
    /*
      What makes it safe for the check above to look only at products on
      sale. `sellable` is the one function the Store screen draws from,
      and `buy` refuses anything not available even if something else
      ever called it with an id.
    */
    const parked = PRODUCTS.filter((p) => !p.available).map((p) => p.id);
    assert(parked.length > 0, 'nothing is parked — this test has nothing to prove');
    const offered = sellable(Date.now(), Date.now()).map((p) => p.id);
    for (const id of parked) {
      assert(!offered.includes(id), `${id} is parked and still offered for sale`);
    }
    const code = source('src/game/purchases.ts');
    const buyBody = code.slice(code.indexOf('export async function buy'));
    assert(
      /!product\.available/.test(buyBody),
      'buy() does not refuse a product that is not available',
    );
  });

  test('every product that is not for sale says why', () => {
    for (const product of PRODUCTS) {
      if (product.available) continue;
      assert(
        (product.blockedBy ?? '').length > 30,
        `${product.id} is switched off with no real reason given — a ` +
          'parked product with no note reads as a decision nobody made',
      );
    }
    const off = PRODUCTS.filter((p) => !p.available).map((p) => p.id);
    note(`on sale: ${PRODUCTS.filter((p) => p.available).length}; parked: ${off.join(', ')}`);
  });

  test('every id is unique, and none of them is empty', () => {
    // A product id is created once in App Store Connect and can never be
    // reused or renamed, even after the product is withdrawn.
    const ids = PRODUCTS.map((p) => p.id);
    assertEqual(new Set(ids).size, ids.length, `two products share an id: ${ids.join(', ')}`);
    for (const id of ids) {
      assert(/^[a-z][a-z0-9_]{2,}$/.test(id), `"${id}" is not a safe product id`);
    }
  });

  test('every price is one Apple actually offers', () => {
    // Apple's tiers are fixed points. A catalogue claiming $5.00 would
    // disagree with the phone the moment somebody opened the sheet.
    for (const product of PRODUCTS) {
      const cents = Math.round(product.usd * 100);
      assert(
        cents % 100 === 99,
        `${product.id} is priced at $${product.usd}, which is not an Apple tier`,
      );
    }
  });

  test('the coin packs get better value as they get bigger', () => {
    /*
      The ordinary, honest shape. A bigger pack that was WORSE value
      would be a trap, and this game is played by children.
    */
    const packs = PRODUCTS.filter((p) => p.kind === 'consumable' && p.coins)
      .sort((a, b) => a.usd - b.usd);
    assert(packs.length >= 2, 'there are not enough coin packs to compare');
    let previous = 0;
    for (const pack of packs) {
      const perDollar = pack.coins! / pack.usd;
      assert(
        perDollar > previous,
        `${pack.id} gives ${perDollar.toFixed(0)} coins per dollar, no better ` +
          'than the smaller pack below it',
      );
      previous = perDollar;
      note(`${pack.id}: ${pack.coins} coins for $${pack.usd}`);
    }
  });

  test('the biggest pack does not buy the whole game', () => {
    /*
      Playing has to stay the way you get things. The whole shop is
      46,695 coins; if one purchase covered it, the ladder every reward
      hangs off would be decoration.
    */
    const everything =
      DICE_SKINS.reduce((sum, s) => sum + (s.price ?? 0), 0) +
      [...source('src/arena/themeData.ts').matchAll(/price: (\d+)/g)]
        .reduce((sum, m) => sum + Number(m[1]), 0);
    const biggest = Math.max(...PRODUCTS.map((p) => p.coins ?? 0));
    assert(everything > 0, 'could not read the coin cost of the shop');
    assert(
      biggest < everything / 3,
      `the biggest pack is ${biggest} coins against a shop costing ${everything} — ` +
        'one purchase should not come close to buying everything',
    );
    note(`biggest pack ${biggest} coins; the whole shop is ${everything}`);
  });
});

suite('purchases · the starter offer closes', () => {
  const NOW = 1_757_000_000_000;

  test('it is open for two days and then it is not', () => {
    assertEqual(STARTER_WINDOW_MS, 48 * 60 * 60 * 1000, 'the window is not two days');
    assert(withinStarterWindow(NOW, NOW), 'closed on the first launch');
    assert(withinStarterWindow(NOW - STARTER_WINDOW_MS + 1000, NOW), 'closed too early');
    assert(!withinStarterWindow(NOW - STARTER_WINDOW_MS - 1000, NOW), 'still open after two days');
  });

  test('an unknown install time means the offer is CLOSED', () => {
    /*
      The direction of this default is the whole point. Treating unknown
      as "open" would show a two-day-only offer to somebody who has had
      the game for a year — which is not a rejection, it is the kind of
      thing that gets an app pulled.
    */
    assert(!withinStarterWindow(null, NOW), 'an unknown install time opened the offer');
    assert(!withinStarterWindow(NaN, NOW), 'a broken install time opened the offer');
  });

  test('a clock set backwards does not reopen it', () => {
    // Phones travel, and children change the date to see what happens.
    assert(
      !withinStarterWindow(NOW + 60_000, NOW),
      'an install time in the future opened the offer',
    );
  });

  test('a starter product is never offered outside the window', () => {
    const starters = PRODUCTS.filter((p) => p.starterOnly);
    assert(starters.length > 0, 'no starter product to check');
    const old = sellable(NOW - STARTER_WINDOW_MS - 1, NOW).map((p) => p.id);
    for (const starter of starters) {
      assert(
        !old.includes(starter.id),
        `${starter.id} is still on sale after the window closed`,
      );
    }
  });
});

suite('purchases · nothing is granted that was not paid for', () => {
  test('a fresh phone owns nothing and sees no adverts removed', () => {
    resetPurchasesForTest();
    assert(!adsRemoved(), 'adverts are removed on a phone that bought nothing');
    assert(!hasEntitlement(REMOVE_ADS), 'an entitlement appeared from nowhere');
  });

  test('buying the advert removal is what stops adverts', () => {
    resetPurchasesForTest({ owned: [REMOVE_ADS] });
    assert(adsRemoved(), 'the purchase did not stop adverts');
    const product = productById('remove_ads');
    assert(product !== undefined, 'the remove-adverts product is gone');
    assert(
      (product!.grants ?? []).includes(REMOVE_ADS),
      'the remove-adverts product no longer grants it',
    );
  });

  test('adverts check the purchase before doing anything at all', () => {
    // Three places, and all three matter: not showing one, not fetching
    // one, and not starting the SDK or the consent form in the first
    // place for somebody who has paid.
    const ads = source('src/game/ads.ts');
    assertEqual(
      (ads.match(/adsRemoved\(\)/g) ?? []).length >= 3,
      true,
      'ads.ts does not check adsRemoved() in all three places',
    );
    const init = ads.slice(ads.indexOf('export async function initAds'));
    assert(
      init.indexOf('adsRemoved()') < init.indexOf('try {'),
      'initAds starts the SDK before checking whether adverts were bought away',
    );
  });

  test('nothing is handed over on a path StoreKit did not confirm', () => {
    /*
      The failure mode of an "assume it worked" path is a player charged
      for something they did not get, or given something nobody paid
      for. `grant` is deliberately the only function that gives anything,
      and it is only reachable after a confirmed purchase or a restore.
    */
    const code = source('src/game/purchases.ts');
    const grants = (code.match(/grantCoins\(|owned\.add\(/g) ?? []).length;
    const inGrant = (
      code.slice(code.indexOf('async function grant('), code.indexOf('export type BuyResult'))
        .match(/grantCoins\(|owned\.add\(/g) ?? []
    ).length;
    const inRestore = (
      code.slice(code.indexOf('export async function restore')).match(/owned\.add\(/g) ?? []
    ).length;
    assertEqual(
      grants,
      inGrant + inRestore,
      'something outside grant() and restore() hands out coins or entitlements',
    );
  });

  test('coins are never restored — they were already spent', () => {
    // Apple's rule, and the right one: a consumable is consumed.
    const code = source('src/game/purchases.ts');
    const restoreBody = code.slice(code.indexOf('export async function restore'));
    assert(
      /kind === 'consumable'/.test(restoreBody),
      'restore does not skip consumables, so coin packs could be claimed twice',
    );
  });
});

suite('purchases · the switch and the runtime version agree', () => {
  /*
    Exactly the pairing tests/ads.test.ts enforces for AdMob, for exactly
    the same reason: `expo-iap` is native code, and a build without it
    dies at module scope on JavaScript that names it. Metro escalates a
    throwing module factory to a fatal before any try/catch can see it.
  */
  const storeKitOn = () => {
    const code = source('src/game/storeKit.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    return /require\('expo-iap'\)/.test(code);
  };

  test('naming the library forces an explicit runtimeVersion', () => {
    const app = JSON.parse(source('app.json')).expo;
    const runtime = app.runtimeVersion;
    const on = storeKitOn();
    note(`purchases ${on ? 'ON' : 'OFF'}, runtimeVersion ${JSON.stringify(runtime)}`);

    if (on) {
      assert(
        typeof runtime === 'string' && /^\d+\.\d+\.\d+$/.test(runtime),
        `expo-iap is in the bundle but runtimeVersion is ${JSON.stringify(runtime)} — ` +
          'a policy cannot know that native code changed, and every install ' +
          'without the module would red-screen on this JavaScript',
      );
      const deps = JSON.parse(source('package.json')).dependencies ?? {};
      assert(
        'expo-iap' in deps,
        'the require is live but expo-iap is not a dependency — the build would not contain it',
      );
    }
  });

  test('while purchases are off, the library is in no file Metro will follow', () => {
    if (storeKitOn()) return;
    const { execSync } = require('node:child_process') as typeof import('node:child_process');
    const files = execSync("find src -name '*.ts' -o -name '*.tsx'", { encoding: 'utf8' })
      .split('\n')
      .filter((f) => f.trim().length > 0);
    const named = files.filter((file) => {
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
      return code.includes('expo-iap');
    });
    assertEqual(
      named.join(', '),
      '',
      'expo-iap is named in live code while purchases are meant to be off — ' +
        'that ships it to every build that does not contain it',
    );
  });

  test('the Store screen says so rather than showing dead buttons', () => {
    resetPurchasesForTest({ ready: false });
    assert(!storeState().available, 'the shop claims to work with no module');
    const shelf = source('src/demo/MoneyShelf.tsx');
    assert(
      shelf.includes('Not on this phone yet'),
      'there is no honest state for a build that cannot buy anything',
    );
  });
});

suite('purchases · Apple’s own requirements', () => {
  test('there is a way to put back what an account already bought', () => {
    // Apple rejects an app selling non-consumables with no restore.
    const shelf = source('src/demo/MoneyShelf.tsx');
    assert(/restore\(/.test(shelf), 'the Store never calls restore');
    assert(
      /put it back/i.test(shelf),
      'there is no visible control to restore purchases',
    );
    assert(
      PRODUCTS.some((p) => p.kind === 'once'),
      'no non-consumables — if that is deliberate, restore is optional',
    );
  });

  test('every purchase asks in our own words before Apple asks', () => {
    const shelf = source('src/demo/MoneyShelf.tsx');
    assert(
      /<Confirm/.test(shelf),
      'a purchase starts without the game asking first — one stray tap ' +
        'would take a five-year-old straight to Apple’s payment sheet',
    );
  });

  test('the fairness promise is on the screen, not just in the code', () => {
    const shelf = source('src/demo/MoneyShelf.tsx');
    assert(
      /changes how the dice land/i.test(shelf),
      'the promise that nothing bought affects a roll is not shown to anybody',
    );
  });
});
