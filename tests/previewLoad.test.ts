import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import { DICE_SKINS, skinById, STORE_SKINS } from '../src/game/diceSkins';
import { createDieFaceTextures, PatternId } from '../src/dice/patterns';
import { clearShelfPicturesForTests, onShelfPicture } from '../src/dice/preview';
import { cachedTextureCount, clearTextureCacheForTests } from '../src/arena/textureCache';
import { clearBespokeFloorCacheForTests } from '../src/arena/bespokeFloors';
import { arenaLaunchJobs } from '../src/arena/warmArenas';
import {
  backgroundSliceMs,
  fromList,
  LOAD_SLICE_MS,
  MENU_SLICE_MS,
  runSliced,
  SHELF_SLICE_MS,
} from '../src/dice/slicedPaint';
import { previewJobs, previewPainted, previewScene } from '../src/dice/previewLoad';
import {
  equippedDieJobs,
  prioritiseShelfPictures,
  resetWarmForTest,
  shelfPaintOrder,
  shelfQueueForTests,
  wantShelfPicture,
  warmDicePreviews,
} from '../src/dice/warmPreviews';

/**
 * Shelf pictures and item previews: no blank cards, no frozen second.
 *
 * Marc, 5 Nov 2026: "When I load the game and go to shop and inventory
 * many dice icons are not showing at first. When I click on a dice or
 * arena to view it, there is about a second where the screen is the page
 * it was on, no words at the top, and just a color on the bottom inch of
 * the screen. Make it load better, or give a very brief loading thing
 * while it loads in."
 *
 * Node is not a phone (see fastStart.test.ts): what is asserted here is
 * ORDER, CACHE HITS and RATIOS; the milliseconds are noted for the record.
 */

const root = join(__dirname, '..');
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
const now = () => performance.now();

/** Run a sliced job on a synchronous queue; every slice's length. */
function drain(start: (schedule: (run: () => void) => void) => void): number[] {
  const queue: (() => void)[] = [];
  const slices: number[] = [];
  start((run) => queue.push(run));
  while (queue.length) {
    const t0 = now();
    queue.shift()!();
    slices.push(now() - t0);
  }
  return slices;
}

const die = (id: string) => ({ kind: 'die' as const, id });
const arena = (id: string) => ({ kind: 'arena' as const, id });

suite('preview loading · what the board is given', () => {
  test('painted: shown at once, no loading state; not painted: loading, board unchanged', () => {
    const a = die('pizza');
    const b = die('zebra');
    assertEqual(previewScene(null, true, null).loading, false, 'loading with nothing open');
    assertEqual(previewScene(null, false, a).show, null, 'a closed preview left an item on the board');
    const now1 = previewScene(a, true, null);
    assert(now1.show === a && !now1.loading, 'a painted item did not open at once');
    const wait = previewScene(a, false, null);
    assert(wait.show === null && wait.loading, 'an unpainted item went on the board, or opened without loading');
    // One preview to the next: the last item stays until the next is painted.
    const next = previewScene(b, false, a);
    assert(next.show === a && next.loading, 'switching previews put an unpainted item on the board');
    assert(previewScene(b, true, a).show === b, 'switching to a painted item did not show it');
  });

  test('a cold die is painted in slices, then the board paints nothing at all', () => {
    for (const id of ['pizza', 'zebra', 'fish', 'neon', 'ocean']) {
      clearTextureCacheForTests();
      // A running game has the shade and stickers already.
      for (const job of equippedDieJobs(undefined)) while (!job.step());
      assert(!previewPainted(die(id)), `${id}: a cold die claims to be painted`);
      const slices = drain((schedule) =>
        runSliced(fromList(previewJobs(die(id))), { schedule, budget: () => LOAD_SLICE_MS }),
      );
      assert(previewPainted(die(id)), `${id}: still not painted after its jobs ran`);
      assertEqual(previewJobs(die(id)).length, 0, `${id}: jobs left after painting`);
      const skin = skinById(id);
      if (skin.pattern === 'fish' || skin.pattern === 'ocean' || skin.pattern === 'neon' || skin.pattern === 'circuit') {
        continue; // their materials read the maps checked above (equippedDieKeys)
      }
      const before = cachedTextureCount();
      const t0 = now();
      createDieFaceTextures(skin.pattern as Exclude<PatternId, 'plain'>, skin.body, skin.ink ?? skin.body);
      const mount = now() - t0;
      assertEqual(cachedTextureCount(), before, `${id}: the board painted a side the preview had not`);
      note(`${id}: ${slices.length} slices, longest ${Math.max(...slices).toFixed(1)}ms; the board's own paint after: ${mount.toFixed(2)}ms`);
    }
    clearTextureCacheForTests();
  });

  test('the slowest die: the longest block on opening is a slice, not the die', () => {
    clearTextureCacheForTests();
    for (const job of equippedDieJobs(undefined)) while (!job.step());
    const pizza = skinById('pizza');
    const t0 = now();
    createDieFaceTextures(pizza.pattern as Exclude<PatternId, 'plain'>, pizza.body, pizza.ink ?? pizza.body);
    const whole = now() - t0;
    clearTextureCacheForTests();
    for (const job of equippedDieJobs(undefined)) while (!job.step());
    const slices = drain((schedule) =>
      runSliced(fromList(previewJobs(die('pizza'))), { schedule, budget: () => LOAD_SLICE_MS }),
    );
    const longest = Math.max(...slices);
    note(`Pizza: ${whole.toFixed(0)}ms in one block on the tap before; longest slice now ${longest.toFixed(1)}ms of ${slices.length}`);
    assert(slices.length >= 5, 'the Pizza die was painted in a handful of blocks');
    assert(longest * 3 < whole, 'one slice is a third of the whole die — not sliced');
    clearTextureCacheForTests();
  });

  test('a cold battlefield is painted the same way, under the keys its board reads', () => {
    for (const id of ['jungle', 'castle', 'castleSunset', 'volcano']) {
      clearTextureCacheForTests();
      clearBespokeFloorCacheForTests();
      assert(!previewPainted(arena(id)), `${id}: a cold battlefield claims to be painted`);
      const slices = drain((schedule) =>
        runSliced(fromList(previewJobs(arena(id))), { schedule, budget: () => LOAD_SLICE_MS }),
      );
      // Nothing left, bespoke pictures included.
      assertEqual(arenaLaunchJobs(id).length, 0, `${id}: a cached picture still counts as work`);
      note(`${id}: ${slices.length} slices, longest ${Math.max(...slices).toFixed(1)}ms`);
    }
    clearTextureCacheForTests();
    clearBespokeFloorCacheForTests();
  });

  test('the screen gives the board only painted items, painted in slices', () => {
    const screen = code('src/demo/DiceDemoScreen.tsx');
    const scene = screen.match(/const sceneArenaId[\s\S]*?const dieBodyColor = sceneSkin\.body;/);
    assert(scene !== null, 'the scene resolution has moved — this guard is blind');
    // The board's die and battlefield come from what previewScene allowed,
    // never from the tapped item directly: a DieMesh mounted for an
    // unpainted skin paints its six sides in the middle of drawing.
    assert(!/\bpreview\??\./.test(scene![0]), 'the board reads the tapped item before it is painted');
    assert(/opening\.show/.test(scene![0]), 'the board does not read what previewScene allowed');
    assert(
      /const opening = previewScene\(preview, painted, onBoardRef\.current\);/.test(screen),
      'nothing decides between showing the item and loading it',
    );
    assert(/previewPainted\(preview\)/.test(screen), 'the cache is never asked whether the item is painted');
    assert(
      /runSliced\(fromList\(previewJobs\(preview\)\), \{\s*budget: \(\) => LOAD_SLICE_MS,/.test(screen),
      'the preview is not painted in slices at the loading budget',
    );
    // Nothing paints a die's sides on the board's own render path but the
    // cache-backed createDieFaceTextures, which the jobs fill first.
    const mesh = code('src/dice/DieMesh.tsx');
    assertEqual((mesh.match(/createDieFaceTextures\(/g) ?? []).length, 1, 'DieMesh paints die sides somewhere new');
    // The loading state: the preview's name and button over a spinner.
    assert(/<PreviewLoading/.test(screen), 'no loading state while the item is painted');
    assert(/\(preview !== null && !previewLoading\)/.test(screen), 'the board keeps drawing under the loading state');
    const loading = code('src/demo/PreviewLoading.tsx');
    assert(/<ActivityIndicator/.test(loading), 'the loading state has no spinner');
    assert(/pointerEvents="none"/.test(loading), 'the loading state can swallow the ✕');
    assert(/useNativeDriver: true/.test(loading), 'the spinner fades from the busy JavaScript thread');
  });
});

suite('preview loading · the shelf paints what is on screen first', () => {
  test('cards join the back of the queue in order; an opening tab goes in front', () => {
    resetWarmForTest();
    // Both pages mount hidden at once, card by card.
    const store = STORE_SKINS.map((s) => s.id);
    for (const id of store) wantShelfPicture(id);
    const inv = ['zebra', 'pizza', 'ivory'];
    for (const id of inv) wantShelfPicture(id);
    const queued = shelfQueueForTests();
    assertEqual(queued[0], store[0], 'the first card mounted is not the first painted');
    assert(queued.indexOf(store[1]) < queued.indexOf(store[store.length - 1]), 'the shelf is painted bottom first');
    // The Inventory opens: its cards, after the die in hand and the next die.
    const order = shelfPaintOrder(['ivory', 'golden', null, 'ivory'], inv);
    assertEqual(order.join(','), 'ivory,golden,zebra,pizza', 'the tab order is wrong or repeats a die');
    prioritiseShelfPictures(order);
    assertEqual(shelfQueueForTests().slice(0, 4).join(','), order.join(','), 'the open tab did not jump the queue');
    resetWarmForTest();
  });

  test('a shelf tab gets the bigger slice, the board the menu slice, the card the loading one', () => {
    assertEqual(backgroundSliceMs({ launched: false, shelfOnly: true }), LOAD_SLICE_MS, 'under the card');
    assertEqual(backgroundSliceMs({ launched: true, shelfOnly: false }), MENU_SLICE_MS, 'with the board visible');
    assertEqual(backgroundSliceMs({ launched: true, shelfOnly: true }), SHELF_SLICE_MS, 'on a shelf tab');
    assertEqual(MENU_SLICE_MS, 6, 'the menu slice moved: the board animates beside it');
    assert(SHELF_SLICE_MS > MENU_SLICE_MS && SHELF_SLICE_MS < 1000 / 60, 'the shelf slice is not inside a frame');
    const screen = code('src/demo/DiceDemoScreen.tsx');
    const rule = screen.slice(screen.indexOf('function shelfBudget'), screen.indexOf('function homeDiceIds'));
    for (const needed of ["phaseRef.current === 'pick'", 'previewRef.current === null', "tabRef.current === 'store'", "tabRef.current === 'inventory'"]) {
      assert(rule.includes(needed), `the shelf slice no longer requires ${needed}`);
    }
    assert(/warmDicePreviews\([^;]*shelfBudget\)/.test(screen), 'the shelf warm-up does not follow the open tab');
    assert(
      /prioritiseShelfPictures\(shelfPaintOrder\(homeDiceIds\(trophiesNow\), shelf\.map/.test(screen),
      'opening a shelf tab does not put its cards first',
    );
  });

  test('at the shelf budget, every picture is in sooner than at the menu budget (one slice a frame)', () => {
    // A timer on the phone fires at most once a frame; model that on a
    // clock that jumps to the next 1/60 s after every slice. The first
    // twelve pictures, to keep the suite quick.
    const FRAME = 1000 / 60;
    const timeTo = (budget: number, count: number) => {
      clearShelfPicturesForTests();
      resetWarmForTest();
      let painted = 0;
      const stop = onShelfPicture(() => painted++);
      let clock = 0;
      drain((schedule) =>
        warmDicePreviews(
          (run) =>
            schedule(() => {
              const t0 = now();
              run();
              clock = Math.ceil((clock + now() - t0) / FRAME + 1e-9) * FRAME;
            }),
          () => painted < count,
          () => {},
          () => budget,
        ),
      );
      stop();
      resetWarmForTest();
      return clock;
    };
    const count = Math.min(12, DICE_SKINS.length);
    timeTo(MENU_SLICE_MS, 2); // warm the JIT
    const menu = timeTo(MENU_SLICE_MS, count);
    const shelf = timeTo(SHELF_SLICE_MS, count);
    note(`${count} pictures, one slice a frame: ${menu.toFixed(0)}ms at ${MENU_SLICE_MS}ms, ${shelf.toFixed(0)}ms at ${SHELF_SLICE_MS}ms`);
    assert(shelf * 1.2 < menu, 'the shelf slice does not bring the pictures in sooner');
    clearShelfPicturesForTests();
  });

  test('a card waiting for its picture shows it is loading, from the native side', () => {
    const swatch = code('src/demo/DiceSwatch.tsx');
    assert(/const loading = uri === null && skin\.pattern !== 'plain';/.test(swatch), 'no loading state for a card without its picture');
    assert(/\{loading && <LoadingSweep/.test(swatch), 'the loading sweep is not drawn on a waiting card');
    assert(/useNativeDriver: true/.test(swatch), 'the sweep is animated from the busy JavaScript thread');
    assert(!/prioritiseShelfPictures/.test(swatch), 'a card pushes itself to the front of the queue again');
    assert(/wantShelfPicture\(skin\.id\)/.test(swatch), 'a waiting card no longer asks for its picture');
  });
});
