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
 * The same file with its comments taken out.
 *
 * A test that greps source for a phrase will happily match the comment
 * that explains the phrase, and then passes on code where the thing it
 * checks for has been deleted. That happened here on 10 Sep 2026.
 */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

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
    /*
      A plain loop would block exactly as long as the tab used to. Read
      from behaviour rather than from the shape of the source: never more
      than one continuation waiting at a time, and one tick per chunk.
    */
    resetWarmForTest();
    const queue: (() => void)[] = [];
    warmDicePreviews((run) => queue.push(run), () => true);
    let ticks = 0;
    while (queue.length) {
      assertEqual(queue.length, 1, `${queue.length} continuations queued at once`);
      queue.shift()!();
      ticks++;
    }
    assertEqual(
      ticks,
      Math.ceil(skinsNeedingPreview().length / WARM_CHUNK),
      'the warmer did not hand the thread back once per chunk',
    );
    note(`${ticks} ticks for ${skinsNeedingPreview().length} pictures`);
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

  test('they are never built at launch', () => {
    // Building both there would move the cost onto the thing the player
    // actually wants, which is the first battle. They are built when the
    // warming finishes, or on the tap if that comes first.
    const screen = src('src/demo/DiceDemoScreen.tsx');
    assert(
      /setBuiltHeavyTabs/.test(screen),
      'nothing records which heavy tabs have been built',
    );
    assert(
      /if \(menuTab !== 'store' && menuTab !== 'inventory'\) return;/.test(screen),
      'the heavy tabs are kept alive without anybody having opened them',
    );
  });
});

/**
 * The frame of Home screen that showed on the way in.
 *
 * David, 10 Sep 2026: "now when you click on the store and inventory
 * tabs, it shows the Home Screen for a split second before loading in."
 *
 * Caused by the fix above, and worth stating plainly. Keeping the pages
 * mounted meant deciding whether they EXIST from a `useState`, and that
 * state was set in a `useEffect` — which runs after its render has
 * already been painted. So the first tap painted one frame with the tab
 * changed and the page not yet built: the board, showing through the
 * hole where the Store should be.
 *
 * Two independent fixes, because either alone leaves something. Asking
 * during render removes the empty frame. Building both pages when the
 * warming finishes removes the pause that would otherwise replace it,
 * since mounting seventy cards is not free even when every picture is
 * already painted.
 */
suite('speed · the heavy tabs are up in the frame you tap', () => {
  test('a heavy page is drawn if it is the current tab, effect or no effect', () => {
    /*
      The precise regression. `{builtHeavyTabs.store && (` alone cannot
      draw the Store in the frame the tap lands, because nothing has set
      that flag yet — an effect has not run.
    */
    /*
      Read with the comments stripped. The first version of this test
      passed against code that had the fix REMOVED, because the comment
      explaining the fix still contained the words it was grepping for.
    */
    const screen = code(src('src/demo/DiceDemoScreen.tsx'));
    assert(
      /const heavyTabUp = [^;]*menuTab === id/.test(screen),
      'nothing draws a heavy tab on the strength of it being the current tab',
    );
    for (const tab of ['store', 'inventory']) {
      assert(
        new RegExp(`\\{heavyTabUp\\('${tab}'\\) && \\(`).test(screen),
        `${tab} is still drawn only from the remembered flag`,
      );
      assert(
        !new RegExp(`\\{builtHeavyTabs\\.${tab} && \\(`).test(screen),
        `${tab} still renders straight off builtHeavyTabs, which lags a frame`,
      );
    }
  });

  test('the pages are built when the warming finishes, not before', () => {
    /*
      Order matters more than it looks. Mounting either page asks for all
      53 pictures in one commit, so building them BEFORE the queue has
      drained would simply move the 846ms stall from the tap to the
      warm-up instead of removing it.
    */
    resetWarmForTest();
    const queue: (() => void)[] = [];
    let done = 0;
    warmDicePreviews((run) => queue.push(run), () => true, () => { done++; });

    let ticks = 0;
    while (queue.length) {
      assertEqual(done, 0, `finished early, after ${ticks} of ${skinsNeedingPreview().length}`);
      queue.shift()!();
      ticks++;
    }
    assertEqual(done, 1, 'the finish signal did not fire exactly once');
    note(`onDone fired once, after all ${ticks} ticks`);
  });

  test('stopping partway does not claim to have finished', () => {
    // Backgrounding the game stops the warming. Building the pages then
    // would ask for the pictures that never got painted.
    resetWarmForTest();
    const queue: (() => void)[] = [];
    let awake = true;
    let done = 0;
    warmDicePreviews((run) => queue.push(run), () => awake, () => { done++; });
    queue.shift()!();
    awake = false;
    while (queue.length) queue.shift()!();
    assertEqual(done, 0, 'a stopped warm-up reported itself finished');
  });

  test('a caller that throws does not look like a failed paint', () => {
    resetWarmForTest();
    const queue: (() => void)[] = [];
    warmDicePreviews(
      (run) => queue.push(run),
      () => true,
      () => {
        throw new Error('the page failed to build');
      },
    );
    while (queue.length) queue.shift()!();
    // Reaching here at all is the assertion: the throw was contained.
    assert(true, 'unreachable');
    note('a throwing onDone is swallowed, as every other step here is');
  });
});
