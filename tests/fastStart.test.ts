import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import { DICE_SKINS, STORE_SKINS, skinById } from '../src/game/diceSkins';
import {
  giveUpWaiting,
  launchProgress,
  launchReady,
  launchSettled,
  LAUNCH_STEPS,
  LOADING_CAP_MS,
  LOADING_MIN_MS,
  reportStep,
  resetLaunchForTests,
  shouldReveal,
} from '../src/game/launchReady';
import { createDieFaceTextures, dieFaceJobs, PatternId } from '../src/dice/patterns';
import { clearShelfPicturesForTests, shelfPictureJob, shellPreviewUri } from '../src/dice/preview';
import { clearTextureCacheForTests, hasCachedTexture } from '../src/arena/textureCache';
import { runSliced } from '../src/dice/slicedPaint';
import { equippedDieJobs, resetWarmForTest, warmAllDieFaces } from '../src/dice/warmPreviews';
import { runLaunchWarm } from '../src/dice/launchWarm';
import { clearBespokeFloorCacheForTests, courtyardFloorPixels } from '../src/arena/bespokeFloors';
import { store } from './storageMock';
import {
  loadShelfPictures,
  resetShelfStoreForTests,
  saveShelfPictures,
} from '../src/dice/shelfStore';
import { GAME_VERSION } from '../src/game/version';
import {
  fromBase64,
  loadKeptTextures,
  resetKeptTexturesForTests,
  saveKeptTextures,
  toBase64,
} from '../src/dice/keptTextures';
import { equippedDieKeys } from '../src/dice/warmPreviews';
import { cachedTextureCount, peekCachedTexture } from '../src/arena/textureCache';

/**
 * Opening the game fast.
 *
 * David's family, 3 Nov 2026: "The game runs very slow when you open it,
 * especially if I have everything unlocked. It cannot be slow, it all has
 * to be lightning fast." And then: "i want the speed fixes now. like make
 * sure the game is fully loaded before showing the home screen".
 *
 * Measured before anything changed, the slow part was painting: the
 * saved game, the shop lists and the season pass take under a
 * millisecond each, while the dice and the floors are painted pixel by
 * pixel in JavaScript (React Native has no canvas) — a whole die per
 * tick in the warm-up, up to 1.4 seconds on a desktop, on the thread
 * that answers taps, and the equipped die and floor in one block at the
 * board's first mount. With everything unlocked the hidden Store and
 * Inventory also redrew a hundred-odd cards on every state change.
 *
 * WHAT THESE CAN AND CANNOT PROVE. Node is not a phone: a desktop's V8
 * is several times faster than Hermes on these loops. So the budgets
 * here are mostly COUNTS and RATIOS — a slice against the whole job it
 * came from, measured in the same process — which a loaded machine
 * slows alike, rather than wall-clock limits that flake.
 */

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
const now = () => performance.now();

/** Run a sliced job list on a synchronous queue; every slice's length. */
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

/** The 95th-percentile slice: one GC pause on a busy machine is not a regression. */
function p95(slices: number[]): number {
  const sorted = [...slices].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

suite('fast start · the title card is a loading screen', () => {
  test('it lifts only when every step is in, after the minimum, before the cap', () => {
    resetLaunchForTests();
    assert(!launchReady(), 'ready before anything was reported');
    assertEqual(launchProgress(), 0, 'progress before anything happened');
    for (const step of LAUNCH_STEPS.slice(0, -1)) reportStep(step.id);
    assert(!launchReady(), 'ready with a step still missing');
    assert(launchProgress() > 0 && launchProgress() < 1, 'the bar does not move with the steps');
    reportStep(LAUNCH_STEPS[LAUNCH_STEPS.length - 1].id);
    assert(launchReady(), 'not ready with every step in');
    assertEqual(launchProgress(), 1, 'a full bar');

    assert(!shouldReveal(LOADING_MIN_MS - 1, true), 'the card flashes: lifted before its minimum');
    assert(shouldReveal(LOADING_MIN_MS, true), 'ready and past the minimum, but still up');
    assert(!shouldReveal(LOADING_CAP_MS - 1, false), 'lifted with work still going, before the cap');
    assert(shouldReveal(LOADING_CAP_MS, false), 'the cap does not lift the card');
    assert(LOADING_MIN_MS <= 1000 && LOADING_CAP_MS <= 12000, 'the minimum or the cap drifted up');
    resetLaunchForTests();
  });

  test('a step never goes backwards, and giving up settles the launch', () => {
    resetLaunchForTests();
    reportStep('pictures', 0.5);
    const half = launchProgress();
    reportStep('pictures', 0.2);
    assertEqual(launchProgress(), half, 'the bar went backwards');
    assert(!launchSettled(), 'settled with work outstanding');
    giveUpWaiting();
    assert(launchSettled(), 'the cap did not let the board stop waiting');
    resetLaunchForTests();
  });

  test('App lifts the card on readiness, not a fixed hold', () => {
    const app = code('App.tsx');
    assert(/shouldReveal\(/.test(app), 'App does not ask whether the launch is ready');
    assert(/giveUpWaiting\(\)/.test(app), 'nothing gives up at the cap');
    assert(/LOADING_CAP_MS/.test(app) && /LOADING_MIN_MS/.test(app), 'no minimum or no cap');
    const splash = code('src/demo/BootSplash.tsx');
    assert(!/BOOT_SPLASH_MS/.test(splash), 'the fixed 1.9 s hold is back');
    assert(/accessibilityRole="progressbar"/.test(splash), 'the card has no progress bar');
    assert(/useNativeDriver: true/.test(splash), 'the bar is animated from the busy JavaScript thread');
    // The startup sound is still the card's, once (screen.test.ts checks the order).
    assertEqual((splash.match(/playStartup\(\)/g) ?? []).length, 1, 'the startup sound plays a different number of times');
  });

  test('the game reports every step, and holds the board for its pictures', () => {
    const screen = code('src/demo/DiceDemoScreen.tsx');
    for (const step of ['saved', 'sounds', 'pages', 'scene']) {
      assert(new RegExp(`reportStep\\('${step}'\\)`).test(screen), `the screen never reports '${step}'`);
    }
    const warm = code('src/dice/launchWarm.ts');
    for (const step of ['die', 'arena', 'pictures']) {
      assert(warm.includes(`'${step}'`), `the launch painting never reports '${step}'`);
    }
    assert(/\{boardMayMount && \(\s*<Canvas/.test(screen), 'the board mounts before its die and floor are painted');
    assert(/sceneWarming \|\|/.test(screen), 'the board never draws its first frame under the card');
    // The faces of every die wait for the card to lift.
    const rule = screen.slice(screen.indexOf('const shouldWarmFaces'), screen.indexOf('const warmArenas'));
    assert(/launchedRef\.current/.test(rule), 'the die faces are painted under the loading screen');
  });
});

suite('fast start · painting in slices paints the same pictures', () => {
  test('a die painted by jobs is the very texture the board asks for', () => {
    clearTextureCacheForTests();
    for (const id of ['pizza', 'zebra', 'fish', 'ivory']) {
      const skin = skinById(id);
      if (skin.pattern === 'plain') continue;
      const pattern = skin.pattern as Exclude<PatternId, 'plain'>;
      const ink = skin.ink ?? skin.body;
      for (const job of dieFaceJobs(pattern, skin.body, ink)) while (!job.step());
      assertEqual(dieFaceJobs(pattern, skin.body, ink).length, 0, `${id}: the jobs left sides unpainted`);
      const faces = createDieFaceTextures(pattern, skin.body, ink);
      const again = createDieFaceTextures(pattern, skin.body, ink);
      faces.forEach((f, i) => assert(f === again[i], `${id}: side ${i} was painted twice`));
    }
  });

  test('a shelf picture painted by its job is byte for byte the one painted at once', () => {
    for (const id of ['pizza', 'fire', 'neon', 'zebra']) {
      const skin = skinById(id);
      clearShelfPicturesForTests();
      const job = shelfPictureJob(skin)!;
      let steps = 0;
      while (!job.step()) steps++;
      const sliced = shellPreviewUri(skin);
      clearShelfPicturesForTests();
      const whole = shellPreviewUri(skin);
      assert(sliced === whole, `${id}: the sliced picture differs from the one painted at once`);
      assert(steps > 100, `${id}: only ${steps} steps — the picture is not really sliced`);
    }
  });
});

suite('fast start · no slice holds the thread', () => {
  test('one step of the slowest die is a sliver of painting it whole', () => {
    // Pizza: nine samples a texel, the slowest painter in the game.
    clearTextureCacheForTests();
    const pizza = skinById('pizza');
    const jobs = equippedDieJobs(pizza);
    let longest = 0;
    let total = 0;
    for (const job of jobs) {
      for (;;) {
        const t0 = now();
        const done = job.step();
        const dt = now() - t0;
        total += dt;
        longest = Math.max(longest, dt);
        if (done) break;
      }
    }
    note(`the Pizza die: ${total.toFixed(0)}ms of painting, longest step ${longest.toFixed(1)}ms`);
    assert(longest * 20 < total, `one step is ${longest.toFixed(1)}ms of a ${total.toFixed(0)}ms die — not sliced`);
  });

  test('the background die faces never take a whole die at once', () => {
    clearTextureCacheForTests();
    resetWarmForTest();
    // The first few hundred slices are enough to show the shape, and keep
    // the suite quick.
    let left = 400;
    const slices = drain((schedule) => warmAllDieFaces(schedule, () => left-- > 0, () => {}));
    resetWarmForTest();
    clearTextureCacheForTests();
    // The whole Pizza die in one go, as one tick used to paint it.
    const t0 = now();
    const pizza = skinById('pizza');
    createDieFaceTextures(pizza.pattern as Exclude<PatternId, 'plain'>, pizza.body, pizza.ink ?? pizza.body);
    const wholeDie = now() - t0;
    note(`${slices.length} slices, 95th percentile ${p95(slices).toFixed(1)}ms; one whole Pizza die ${wholeDie.toFixed(0)}ms`);
    assert(p95(slices) * 8 < wholeDie, 'the warm-up still paints dice in blocks a die long');
  });

  test('the background battlefields never take a floor at once', () => {
    const { warmAllArenaTextures, resetArenaWarmForTests } = require('../src/arena/warmArenas');
    clearTextureCacheForTests();
    clearBespokeFloorCacheForTests();
    // The bespoke boards come first, and they were the blocks.
    let left = 300;
    const slices = drain((schedule) => warmAllArenaTextures(schedule, () => left-- > 0));
    clearBespokeFloorCacheForTests();
    const t0 = now();
    courtyardFloorPixels();
    const wholeFloor = now() - t0;
    // Leave the caches cold again, as the later suites expect to find them.
    resetArenaWarmForTests();
    clearTextureCacheForTests();
    clearBespokeFloorCacheForTests();
    note(`${slices.length} slices, 95th percentile ${p95(slices).toFixed(1)}ms; the castle floor whole ${wholeFloor.toFixed(0)}ms`);
    assert(p95(slices) * 4 < wholeFloor, 'the battlefield warm-up still paints a floor in one block');
  });

  test('the loading screen paints the die, the floor and the first shelf, sliced, with everything unlocked', () => {
    // The heaviest launch there is: the slowest die, a bespoke floor, and
    // a full cupboard's first screenful.
    clearTextureCacheForTests();
    clearBespokeFloorCacheForTests();
    clearShelfPicturesForTests();
    resetWarmForTest();
    const shelfIds = [
      ...STORE_SKINS.slice(0, 9),
      ...DICE_SKINS.filter((s) => s.pattern !== 'plain').slice(-9),
    ].map((s) => s.id);
    const reached: string[] = [];
    let board = false;
    let pictures = false;
    const slices = drain((schedule) =>
      runLaunchWarm({
        skin: skinById('pizza'),
        arenaId: 'jungle',
        shelfIds,
        schedule,
        budget: () => 32,
        report: (step, fraction) => {
          if (fraction >= 1 && !reached.includes(step)) reached.push(step);
        },
        onBoard: () => {
          board = true;
        },
        onPictures: () => {
          pictures = true;
        },
        // Only the first screenful, as the loading screen waits for.
        shelfMayContinue: () => !pictures,
        onShelfDone: () => {},
      }),
    );
    assertEqual(reached.join(','), 'die,arena,pictures', 'the steps came in the wrong order, or not at all');
    assert(board && pictures, 'the board or the pages were never told');
    for (const key of ['jungle-tray-floor']) assert(hasCachedTexture(key), `${key} was not painted`);
    const total = slices.reduce((a, b) => a + b, 0);
    note(`${slices.length} slices, ${total.toFixed(0)}ms in all, 95th percentile ${p95(slices).toFixed(1)}ms`);
    assert(slices.length >= 20, 'the loading work ran in a handful of long blocks');
    assert(p95(slices) * 10 < total, 'one slice is a tenth of the whole launch — not sliced');
    resetWarmForTest();
    clearTextureCacheForTests();
    clearBespokeFloorCacheForTests();
  });

  test('a run that is told to stop stops, and hands nothing on', () => {
    let steps = 0;
    let stopped = 0;
    let finished = 0;
    const slices = drain((schedule) =>
      runSliced(
        () => ({
          step: () => {
            steps++;
            return true;
          },
        }),
        {
          schedule,
          budget: () => 0,
          shouldContinue: () => steps < 5,
          onStop: () => stopped++,
          onDone: () => finished++,
        },
      ),
    );
    assertEqual(stopped, 1, 'the run did not report stopping');
    assertEqual(finished, 0, 'a stopped run claimed to have finished');
    assert(slices.length >= 5, 'the run did not hand the thread back between steps');
  });
});

suite('fast start · the hidden pages do not redraw for nothing', () => {
  test('the Store and Inventory cards are memoised, with openers that never change', () => {
    /*
      Both pages stay mounted, hidden, once built, and the game screen
      redraws them on every change of its state — every coin, every roll
      of a battle. Measured through react-native-web on 3 Nov 2026 with
      everything unlocked: 15ms (Store) + 8ms (Inventory) a redraw on a
      desktop before, under a millisecond each after.
    */
    const store = code('src/demo/StoreScreen.tsx');
    assert(/const StoreDieCard = memo\(/.test(store), 'the Store dice cards are not memoised');
    assert(/const StoreArenaCard = memo\(/.test(store), 'the Store battlefield cards are not memoised');
    assert(/const QuietShelf = memo\(MoneyShelf\)/.test(store), 'the money shelf redraws with the screen');
    assert(/const openDie = useCallback\([\s\S]*?\}, \[\]\);/.test(store), 'the Store opener changes every draw');
    const inv = code('src/demo/InventoryScreen.tsx');
    assert(/const DieCard = memo\(/.test(inv) && /const ArenaCard = memo\(/.test(inv), 'the Inventory cards are not memoised');
    assert(/const open = useCallback\([\s\S]*?\}, \[\]\);/.test(inv), 'the Inventory opener changes every draw');
  });

  test('a shelf card never paints in the frame it is drawn', () => {
    const swatch = code('src/demo/DiceSwatch.tsx');
    const render = swatch.slice(swatch.indexOf('export function DiceSwatch'), swatch.indexOf('function useShelfPicture'));
    assert(!/shellPreviewUri\(/.test(render), 'DiceSwatch paints its picture while rendering');
    assert(/useShelfPicture\(skin\)/.test(render), 'DiceSwatch does not wait for its picture');
  });
});

suite('fast start · the shelf pictures are painted once per version', () => {
  test('kept pictures come back byte for byte, and only for this version', async () => {
    /*
      Painting the sixty shelf pictures is ~2.5 s of desktop work, ten or
      more on a phone, and it was paid on every launch. Kept between
      launches since 3 Nov 2026 (shelfStore.ts), keyed on GAME_VERSION —
      every update carries a new one — and on each skin's colours.
    */
    const key = 'dice-battles/shelf-pictures';
    clearShelfPicturesForTests();
    resetShelfStoreForTests();
    store.delete(key);
    const painted: Record<string, string> = {};
    for (const skin of DICE_SKINS) {
      const uri = shellPreviewUri(skin);
      if (uri) painted[skin.id] = uri;
    }
    await saveShelfPictures();
    assert(store.has(key), 'nothing was kept');
    note(`kept ${Object.keys(painted).length} pictures in ${(store.get(key)!.length / 1024).toFixed(0)} KB`);

    clearShelfPicturesForTests();
    const taken = await loadShelfPictures();
    assertEqual(taken, Object.keys(painted).length, 'pictures kept but not taken back');
    for (const skin of DICE_SKINS) {
      if (!painted[skin.id]) continue;
      // Read without painting: a hit here is the kept picture.
      const job = shelfPictureJob(skin);
      assert(job === null, `${skin.id} came back unpainted`);
      assert(shellPreviewUri(skin) === painted[skin.id], `${skin.id} came back different`);
    }

    // Another version's pictures are never shown.
    const kept = JSON.parse(store.get(key)!);
    store.set(key, JSON.stringify({ ...kept, version: GAME_VERSION + '-older' }));
    clearShelfPicturesForTests();
    assertEqual(await loadShelfPictures(), 0, 'an older version\'s pictures were taken');

    // Nor a picture of a skin whose colours have changed since.
    const first = Object.keys(painted)[0];
    kept.pictures[first].sig = 'plain|#000000||';
    store.set(key, JSON.stringify(kept));
    clearShelfPicturesForTests();
    assertEqual(await loadShelfPictures(), Object.keys(painted).length - 1, 'a recoloured skin kept its old picture');

    // Rubbish in storage is just a cold start.
    store.set(key, '{not json');
    clearShelfPicturesForTests();
    assertEqual(await loadShelfPictures(), 0, 'a broken store was not ignored');
    store.delete(key);
    clearShelfPicturesForTests();
    resetShelfStoreForTests();
  });
});

suite('fast start · the die in hand is painted once per version', () => {
  test('the keys kept are exactly what the die paints', () => {
    for (const id of ['ivory', 'pizza', 'fish', 'circuit', 'neon', 'ocean']) {
      clearTextureCacheForTests();
      const skin = skinById(id);
      for (const job of equippedDieJobs(skin)) while (!job.step());
      const keys = equippedDieKeys(skin);
      assertEqual(cachedTextureCount(), keys.length, `${id}: the kept keys and the painted pictures differ in number`);
      for (const key of keys) assert(hasCachedTexture(key), `${id}: ${key} is kept but never painted`);
    }
  });

  test('kept textures come back byte for byte, settings and all, and only for this version', async () => {
    const key = 'dice-battles/kept-textures';
    const bytes = new Uint8Array(1000).map((_, i) => (i * 37) % 256);
    for (const n of [0, 1, 2, 3, 998, 999, 1000]) {
      const part = bytes.slice(0, n);
      assert(fromBase64(toBase64(part)).join(',') === part.join(','), `base64 round trip failed at ${n} bytes`);
    }
    clearTextureCacheForTests();
    resetKeptTexturesForTests();
    store.delete(key);
    const skin = skinById('pizza');
    for (const job of equippedDieJobs(skin)) while (!job.step());
    const keys = equippedDieKeys(skin);
    const before = keys.map((k) => peekCachedTexture(k)!);
    await saveKeptTextures(keys);
    assert(store.has(key), 'nothing was kept');
    note(`the Pizza die kept in ${(store.get(key)!.length / 1024).toFixed(0)} KB`);

    clearTextureCacheForTests();
    assertEqual(await loadKeptTextures(), keys.length, 'not every kept picture came back');
    keys.forEach((k, i) => {
      const a = before[i] as import('three').DataTexture;
      const b = peekCachedTexture(k) as import('three').DataTexture;
      assert(
        Buffer.from(a.image.data as Uint8Array).equals(Buffer.from(b.image.data as Uint8Array)),
        `${k} came back with different pixels`,
      );
      for (const field of ['colorSpace', 'wrapS', 'wrapT', 'magFilter', 'minFilter', 'generateMipmaps', 'flipY'] as const) {
        assertEqual(String(b[field]), String(a[field]), `${k}: ${field}`);
      }
    });
    assertEqual(equippedDieJobs(skin).length, 0, 'a kept die is painted again');

    const kept = JSON.parse(store.get(key)!);
    store.set(key, JSON.stringify({ ...kept, version: GAME_VERSION + '-older' }));
    clearTextureCacheForTests();
    assertEqual(await loadKeptTextures(), 0, "an older version's pictures were taken");
    store.set(key, 'not json');
    assertEqual(await loadKeptTextures(), 0, 'a broken store was not ignored');
    store.delete(key);
    clearTextureCacheForTests();
    resetKeptTexturesForTests();
  });
});
