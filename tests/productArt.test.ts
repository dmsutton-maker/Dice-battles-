import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, suite, test } from './harness';
import { PRODUCTS, productById } from '../src/game/products';
import { coinsInPile, pictureOfProduct } from '../src/game/productPictures';
import { seasonAt } from '../src/game/seasonPass';

/*
  David, 20 Oct 2026: "Add pictures and icons for the money items in the
  store so you know what you're getting." The picture is worked out from
  what each product grants, so these check it shows exactly that.
*/
const shelf = readFileSync(join(__dirname, '..', 'src', 'demo', 'MoneyShelf.tsx'), 'utf8');

suite('money shop · every item has a picture of what you get', () => {
  test('every product has something to draw', () => {
    for (const p of PRODUCTS) {
      const pic = pictureOfProduct(p);
      const drawn = pic.items.length > 0 || pic.coins > 0 || pic.noAds || pic.placeholder !== undefined;
      assert(drawn, `${p.id} would have an empty picture`);
    }
  });

  test('a die or battlefield sold on its own is pictured as itself', () => {
    assertEqual(JSON.stringify(pictureOfProduct(productById('neon_dice')!).items), JSON.stringify([{ kind: 'die', id: 'neon' }]), 'Neon');
    assertEqual(JSON.stringify(pictureOfProduct(productById('dino_valley')!).items), JSON.stringify([{ kind: 'arena', id: 'dino' }]), 'Dino Valley');
  });

  test('the Starter pack shows its die and its coins', () => {
    const pic = pictureOfProduct(productById('starter_pack')!);
    assertEqual(pic.items.map((i) => i.id).join(), 'supporter', 'Starter pack die');
    assertEqual(pic.coins, 1500, 'Starter pack coins');
  });

  test('the Gold Pass shows the things only it unlocks', () => {
    const pass = PRODUCTS.find((p) => p.kind === 'season')!;
    const shown = pictureOfProduct(pass).items.map((i) => i.id).sort().join();
    const gold = seasonAt().items.filter((s) => s.track === 'gold').map((s) => s.item.id).sort().join();
    assertEqual(shown, gold, 'Gold Pass picture');
  });

  test('No more ads is the only one drawn as no ads', () => {
    const noAds = PRODUCTS.filter((p) => pictureOfProduct(p).noAds).map((p) => p.id);
    assertEqual(noAds.join(), 'remove_ads', 'no-ads picture');
  });

  test('a bigger coin pack is a bigger pile', () => {
    const packs = PRODUCTS.filter((p) => p.kind === 'consumable' && p.coins).sort((a, b) => a.coins! - b.coins!);
    assert(packs.length >= 3, 'expected three coin packs');
    for (let i = 1; i < packs.length; i++) {
      assert(
        coinsInPile(packs[i].coins!) > coinsInPile(packs[i - 1].coins!),
        `${packs[i].id} draws no more coins than ${packs[i - 1].id}`,
      );
    }
  });

  test('the cards and the full story both draw it', () => {
    const uses = shelf.match(/<ProductArt product=\{product\}/g) ?? [];
    assert(uses.length >= 3, `ProductArt drawn ${uses.length} times; expected the shelf, Coming later and the full story`);
  });
});
