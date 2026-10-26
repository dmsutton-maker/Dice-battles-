import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, suite, test } from './harness';
import { PRODUCTS, priceLabel } from '../src/game/products';

/*
  David, 18 Oct 2026: "Add the prices to all the money shop items." The
  buy buttons said "—" until the phone's store answered, and for ever
  when it would not. Every button now carries a price.
*/
const shelf = readFileSync(join(__dirname, '..', 'src', 'demo', 'MoneyShelf.tsx'), 'utf8');

suite('money shop · every item shows a price', () => {
  test("the phone's own price wins when it has one", () => {
    assertEqual(priceLabel({ usd: 4.99 }, '4,99 €'), '4,99 €', 'the localised price was overridden');
  });

  test('every product has a price before the store answers', () => {
    for (const p of PRODUCTS) {
      const label = priceLabel(p, null);
      assert(/^\$\d+\.\d\d$/.test(label), `${p.id} shows "${label}" with no store price`);
    }
  });

  test('the buy button and the question both use it, and no dash is left', () => {
    assert(!/\?\? '—'/.test(shelf), 'a buy button can still show a dash');
    assert(
      /const price = priceLabel\(product, state\.priceOf\(product\.id\)\)/.test(shelf),
      'the buy button does not use the fallback price',
    );
    assert(
      /It costs \$\{priceLabel\(asking, state\.priceOf\(asking\.id\)\)\}/.test(shelf),
      'the "are you sure" question can still leave the price out',
    );
  });
});
