import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import { DICE_SKINS } from '../src/game/diceSkins';
import { shellPreviewUri } from '../src/dice/preview';
import {
  WARM_CHUNK,
  resetWarmForTest,
  skinsNeedingPreview,
  warmDicePreviews,
} from '../src/dice/warmPreviews';

const root = join(__dirname, '..');
const src = (p: string) => readFileSync(join(root, p), 'utf8');

/**
 * Why the Items tab took two to three seconds to open.
 *
 * David, 10 Sep 2026. Measured rather than guessed: painting all the
 * dice pictures takes ~850ms on a desktop and a phone is several times
 * slower. React Native has no canvas, so every picture is drawn pixel by
 * pixel in JavaScript, and the Store and the Inventory are plain
 * ScrollViews — so all seventy-odd cards mount at once and ask for their
 * picture in the same frame the tab is trying to appear in.
 *
 * Nothing was wrong with the cache; the second open was already free.
 * The cost was simply all of it landing at once, the first time. So it
 * is moved rather than shrunk: painted a few at a time in the background
 * once the game is idle, and the tab then opens at the speed it always
 * had on the second try.
 */

suite('speed · the dice pictures are painted before anybody asks', () => {
  test('warming really does fill the cache', () => {
    resetWarmForTest();
    const queue: (() => void)[] = [];
    warmDicePreviews((run) => queue.push(run), () => true);
    let ticks = 0;
    while (queue.length) {
      queue.shift()!();
      ticks++;
    }
    assert(ticks > 0, 'the warmer never ran');

    // The real check: after warming, opening the tab paints nothing.
    const before = Date.now();
    for (const skin of DICE_SKINS) shellPreviewUri(skin);
    const openMs = Date.now() - before;
    assert(
      openMs < 40,
      `opening the tab after warming still took ${openMs}ms, so the cache ` +
        'was not filled and the player still waits',
    );
    note(`${ticks} background ticks; opening the tab afterwards took ${openMs}ms`);
  });

  test('it paints one at a time, because one is already a whole frame', () => {
    /*
      A single die is ~16ms on a desktop and more on a phone — already a
      frame. Painting two per tick to "get it over with" would drop one
      and the warming would become visible, which defeats the point.
    */
    assertEqual(WARM_CHUNK, 1, 'the chunk size');
  });

  test('it yields between every chunk rather than looping', () => {
    // A plain loop would block exactly as long as the tab used to.
    const warm = src('src/dice/warmPreviews.ts');
    assert(
      /if \(i < queue\.length\) schedule\(step\)/.test(warm),
      'the warmer does not hand the thread back between chunks',
    );
  });

  test('it stops while the game is in a pocket', () => {
    /*
      Nothing to be warm for, and it is the same JavaScript thread the
      battery work just quietened. Stopping must also allow a later start
      — otherwise backgrounding the app once would leave the pictures
      half-painted for the rest of the session.
    */
    resetWarmForTest();
    const queue: (() => void)[] = [];
    let awake = false;
    warmDicePreviews((run) => queue.push(run), () => awake);
    queue.shift()!();
    assertEqual(queue.length, 0, 'it kept queueing work while backgrounded');

    awake = true;
    warmDicePreviews((run) => queue.push(run), () => awake);
    assert(queue.length > 0, 'it never restarted after coming back');
  });

  test('one bad skin cannot stop the rest', () => {
    const warm = src('src/dice/warmPreviews.ts');
    assert(/} catch \{/.test(warm), 'a failing painter would end the warming');
  });

  test('every painted skin is one the shelves actually show', () => {
    const needing = skinsNeedingPreview();
    const plain = DICE_SKINS.filter((s) => s.pattern === 'plain');
    assertEqual(
      needing.length + plain.length,
      DICE_SKINS.length,
      'the warm list and the plain skins do not add up to every skin',
    );
    note(`${needing.length} skins painted, ${plain.length} plain and free`);
  });
});

suite('speed · the heavy tabs are built once', () => {
  test('the Store and the Inventory are hidden, not thrown away', () => {
    /*
      The remaining second: about seventy cards each, rebuilt from
      scratch every time the tab opened. `display: 'none'` takes them out
      of layout as well as out of sight, so a hidden screen costs nothing
      to lay out.
    */
    for (const file of ['src/demo/InventoryScreen.tsx', 'src/demo/StoreScreen.tsx']) {
      const body = src(file);
      assert(/hidden\?: boolean/.test(body), `${file} cannot be hidden`);
      assert(
        /hidden: \{ display: 'none' \}/.test(body),
        `${file} hides itself in a way that still costs a layout`,
      );
    }
  });

  test('they are only built once somebody opens them', () => {
    // Building both at launch would move the cost onto the thing the
    // player actually wants, which is the first battle.
    const screen = src('src/demo/DiceDemoScreen.tsx');
    assert(
      /setBuiltHeavyTabs/.test(screen),
      'nothing records which heavy tabs have been opened',
    );
    assert(
      /if \(menuTab !== 'store' && menuTab !== 'inventory'\) return;/.test(screen),
      'the heavy tabs are built before anybody asks for them',
    );
  });
});
