import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, suite, test } from './harness';
import { PRODUCTS } from '../src/game/products';
import { pictureOfProduct } from '../src/game/productPictures';
import { ARENAS } from '../src/arena/arenas';
import { DICE_SKINS } from '../src/game/diceSkins';

/*
  David, 21 Oct 2026: "When you click on a money purchase to view it and
  if it includes a dice or arena, it should show you the preview of what
  that dice or arena looks like."
*/
const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

suite('money shop · a purchase shows what it includes, on the board', () => {
  test('every die and battlefield a product includes can be opened', () => {
    const shelf = read('src/demo/MoneyShelf.tsx');
    assert(/pictureOfProduct\(product\)\.items\.map/.test(shelf), 'the full story does not list what the product includes');
    assert(/onPreview\?\.\(item\.target\)/.test(shelf), 'tapping an included item does not open it');
    assert(/from: 'store' as const/.test(shelf), 'the preview is not opened from the Store');
    assert(/setViewing\(null\);\s*onPreview\(target\);/.test(shelf), 'the full story stays open over the board');
  });

  test('the Store hands the board to the shelf, and the screen hands it to the Store', () => {
    const store = read('src/demo/StoreScreen.tsx');
    assert(/onPreview=\{onPreviewItem\}/.test(store), 'the Store does not pass the board to the money shelf');
    const screen = read('src/demo/DiceDemoScreen.tsx');
    assert(/onPreviewItem=\{\(target\) => showPreview\(target\)\}/.test(screen), 'the screen does not open money items on the board');
  });

  test('what is listed is real: every included id is a die or a battlefield', () => {
    const skins = new Set(DICE_SKINS.map((s) => s.id));
    let listed = 0;
    for (const p of PRODUCTS) {
      for (const item of pictureOfProduct(p).items) {
        listed++;
        if (item.kind === 'die') assert(skins.has(item.id), `${p.id} includes a die that does not exist: ${item.id}`);
        else assert(item.id in ARENAS, `${p.id} includes a battlefield that does not exist: ${item.id}`);
      }
    }
    assert(listed >= 4, `only ${listed} included items across the shop`);
  });
});
