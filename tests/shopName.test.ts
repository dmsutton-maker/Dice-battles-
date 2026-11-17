import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { assert, suite, test } from './harness';
import { productById } from '../src/game/products';

/*
  Marc, 4 Nov 2026: "rename store to shop". The player-facing word is Shop;
  the code keeps its names (the 'store' tab id, StoreScreen) and "App Store"
  is Apple's. This reads the words a player can see, not the identifiers.
*/

const root = join(__dirname, '..', 'src');

function words(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')
    .replace(/^\s*import[\s\S]*?;\s*$/gm, '');
}

const files = [
  ...readdirSync(join(root, 'demo'))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => join(root, 'demo', f)),
  ...['tutorial', 'rewardInfo', 'itemPreview', 'products', 'news'].map((f) =>
    join(root, 'game', `${f}.ts`),
  ),
];

suite('shop name · the Store is the Shop', () => {
  test('no word a player sees says Store, other than App Store', () => {
    for (const f of files) {
      const hits = words(f).match(/(?<!App\s+)\bStore\b/g) ?? [];
      assert(hits.length === 0, `${f} still says "Store" ${hits.length} time(s)`);
    }
  });

  test('the bottom tab reads Shop', () => {
    assert(/label: 'Shop'/.test(words(join(root, 'demo', 'BottomNav.tsx'))), 'tab label is not Shop');
  });
});

suite('shop name · the other copy changes', () => {
  test('No more ads says devices, not phones', () => {
    const d = productById('remove_ads')!.details;
    assert(/devices/.test(d) && !/phones/.test(d), `remove_ads details: ${d}`);
  });

  test('the starter pack says 48 hours, on the card and on the shelf', () => {
    assert(/48 hours/.test(productById('starter_pack')!.details), 'starter pack details');
    assert(/First 48 hours only/.test(readFileSync(join(root, 'demo', 'MoneyShelf.tsx'), 'utf8')), 'shelf tag');
  });

  test('the Cups tab has lost its "new cup every week" paragraph', () => {
    const t = readFileSync(join(root, 'demo', 'TournamentScreen.tsx'), 'utf8');
    assert(!/own rivals/.test(t) && !/picked from ten/.test(t), 'the paragraph is back');
    assert(/A cup is a run of wins/.test(t), 'the paragraph above it is gone');
  });
});
