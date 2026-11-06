import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import { DICE_SKINS } from '../src/game/diceSkins';
import { clearShelfPicturesForTests, shellPreviewUri } from '../src/dice/preview';
import { pausedForPopup } from '../src/dice/slicedPaint';
import { SQUARE_STEP_TEXELS } from '../src/dice/patterns';
import {
  resetWarmForTest,
  shelfPicturesReady,
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

  test('a picture is painted over several slices, not one per tick', () => {
    /*
      Changed 3 Nov 2026. David's family: "The game runs very slow when
      you open it ... it all has to be lightning fast." This used to pin
      ONE PICTURE PER TICK, on the reasoning that one die was a frame —
      measured that day, one picture was up to 333ms on a desktop (the
      Pizza die), so a tick was up to twenty frames. Every picture is now
      painted a few texels a step (squareJob) under a time budget, so a
      single picture is spread over several slices. Counted rather than
      timed, so a loaded machine cannot fail it.
    */
    assert(SQUARE_STEP_TEXELS <= 64, `a step paints ${SQUARE_STEP_TEXELS} texels — a whole row or more`);
    clearShelfPicturesForTests();
    resetWarmForTest();
    const queue: (() => void)[] = [];
    warmDicePreviews((run) => queue.push(run), () => true, () => {}, () => 1);
    let ticks = 0;
    while (queue.length) {
      queue.shift()!();
      ticks++;
    }
    assert(
      ticks > skinsNeedingPreview().length,
      `${ticks} slices for ${skinsNeedingPreview().length} pictures — whole pictures are still painted in one go`,
    );
    note(`${ticks} slices of ~1ms for ${skinsNeedingPreview().length} pictures`);
  });

  test('it yields between slices rather than looping', () => {
    /*
      A plain loop would block exactly as long as the tab used to. Read
      from behaviour rather than from the shape of the source: never more
      than one continuation waiting at a time.
    */
    clearShelfPicturesForTests();
    resetWarmForTest();
    const queue: (() => void)[] = [];
    warmDicePreviews((run) => queue.push(run), () => true);
    let ticks = 0;
    while (queue.length) {
      assertEqual(queue.length, 1, `${queue.length} continuations queued at once`);
      queue.shift()!();
      ticks++;
    }
    assert(ticks > 1, 'the warmer painted everything without handing the thread back');
    note(`${ticks} slices for ${skinsNeedingPreview().length} pictures at the menu's budget`);
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
    //
    // Since 3 Nov 2026 "the warming" is the loading screen's: both pages
    // are built under the title card, once the first screenful of their
    // pictures is painted (launchWarm.ts), so the first tap only shows
    // them. tests/fastStart.test.ts covers that.
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
    // would ask for the pictures that never got painted. From a cold
    // cache since 3 Nov 2026: a slice now paints as many pictures as fit
    // its budget, so a warm cache finishes in the first one.
    clearShelfPicturesForTests();
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

/**
 * Why a battlefield preview took a second to appear.
 *
 * David, 18 Oct 2026: "when you click on something to preview it it takes
 * a second to load the item." Painting a battlefield's floor and ground
 * happened on the tap. They are painted on the menu now, after the dice,
 * under the very keys the boards ask for — so this checks the keys agree
 * by opening every board afterwards and counting how many pictures it
 * still had to paint. Any is a miss.
 */
suite('speed · the battlefields are painted before they are opened', () => {
  test('a pause paints nothing, and every board opens from the cache afterwards', () => {
    const { warmAllArenaTextures } = require('../src/arena/warmArenas');
    const { themedFloorTexture, themedGroundTexture } = require('../src/arena/ThemedArena');
    const { ARENA_THEMES } = require('../src/arena/themeData');
    const { cachedTextureCount } = require('../src/arena/textureCache');

    const before = cachedTextureCount();
    warmAllArenaTextures((run: () => void) => run(), () => false);
    assertEqual(cachedTextureCount(), before, 'painted while told to stop');

    warmAllArenaTextures((run: () => void) => run(), () => true);
    const warmed = cachedTextureCount();
    assert(warmed > before, 'a stopped warm-up could not be started again');

    for (const id of Object.keys(ARENA_THEMES)) {
      themedFloorTexture(id, ARENA_THEMES[id]);
      themedGroundTexture(id, ARENA_THEMES[id]);
    }
    assertEqual(cachedTextureCount(), warmed, 'a board painted a picture the warm-up missed');
  });
});

/*
  Marc, 5 Nov 2026: "When you load the game for the first time in the
  how to play pop up, when you click next some of the things are very
  slow to load." The tutorial opened over a home screen painting the
  shelf and the die faces in the background, and every tap on Next
  waited behind a slice. While any popup is open the painting pauses
  (slicedPaint.ts, pausedForPopup) and resumes when it closes.
*/
suite('speed · the background painting pauses behind a popup', () => {
  test('the scheduler yields nothing while a popup is open, and picks up when it closes', () => {
    resetWarmForTest();
    clearShelfPicturesForTests();
    const queue: (() => void)[] = [];
    let popupOpen = true;
    const mayRun = () => !pausedForPopup({ launched: true, popupOpen });
    let slices = 0;
    const schedule = (run: () => void) => queue.push(run);
    const t0 = performance.now();
    warmDicePreviews(schedule, mayRun, undefined, () => 6);
    while (queue.length) {
      queue.shift()!();
      slices++;
    }
    const held = performance.now() - t0;
    assertEqual(slices, 1, 'it kept painting behind the popup');
    assert(held < 5, `the one slice behind the popup painted for ${held.toFixed(1)} ms`);
    const painted = DICE_SKINS.filter((s) => s.pattern !== 'plain' && shelfPicturesReady([s.id])).length;
    assertEqual(painted, 0, 'pictures were painted behind the popup');

    popupOpen = false;
    warmDicePreviews(schedule, mayRun, undefined, () => 6);
    assert(queue.length > 0, 'it never restarted after the popup closed');
    let resumed = 0;
    while (queue.length && resumed < 40) {
      queue.shift()!();
      resumed++;
    }
    assert(
      DICE_SKINS.some((s) => s.pattern !== 'plain' && shelfPicturesReady([s.id])),
      'nothing was painted once the popup closed',
    );
    note(`behind a popup: ${slices} slice, ${held.toFixed(2)} ms, 0 pictures; after it: painting resumed`);
  });

  test('under the title card nothing pauses: the card is waiting for these pictures', () => {
    assert(!pausedForPopup({ launched: false, popupOpen: true }), 'the first-launch tutorial held the loading screen');
    assert(pausedForPopup({ launched: true, popupOpen: true }), 'a popup on the home screen does not pause');
    assert(!pausedForPopup({ launched: true, popupOpen: false }), 'paused with nothing open');
  });

  test('every background painter on the screen reads the popup', () => {
    const screen = code(src('src/demo/DiceDemoScreen.tsx'));
    assert(/popupRef\.current = popup;/.test(screen), 'the popup is not mirrored for the painters');
    // The shelf: both the launch warm and the restart share shelfMayContinue.
    assert(
      /function shelfMayContinue\(\): boolean \{\s*return \(\s*activeRef\.current &&\s*!pausedForPopup\(\{ launched: launchSettled\(\), popupOpen: popupRef\.current !== null \}\)/.test(screen),
      'the shelf does not pause for a popup',
    );
    assert(/shelfMayContinue,\s*onShelfDone: shelfDone,/.test(screen), 'the launch warm uses a different rule');
    assert(/warmDicePreviews\(\(run\) => setTimeout\(run, 0\), shelfMayContinue, shelfDone, shelfBudget\)/.test(screen), 'the restart uses a different rule');
    assert(/\|\| popup !== null\) return;\s*warmDicePreviews/.test(screen), 'the shelf restarts while a popup is open');
    assert(/\}, \[hydrated, appActive, boardMayMount, popup\]\)/.test(screen), 'closing a popup does not restart the shelf');
    // The die faces and the battlefields share shouldWarmFaces.
    assert(
      /const shouldWarmFaces = \(\) =>[\s\S]{0,400}!pausedForPopup\(\{ launched: launchedRef\.current, popupOpen: popupRef\.current !== null \}\);/.test(screen),
      'the die faces do not pause for a popup',
    );
    assert(/warmAllArenaTextures\(\(run\) => setTimeout\(run, 0\), shouldWarmFaces\)/.test(screen), 'the battlefields use a different rule');
    assert(/\|\| popup !== null\) return;\s*warmArenas\(\);/.test(screen), 'the faces restart while a popup is open');
    assert(/\}, \[appActive, phase, preview, popup\]\);/.test(screen), 'closing a popup does not restart the faces');
  });

  test('the tutorial pages paint nothing of their own', () => {
    const demo = src('src/demo/ThrowDemo.tsx');
    assert(/useNativeDriver: true/.test(demo) && !/useNativeDriver: false/.test(demo), 'the demo animates on the JS thread');
    assert(/require\('\.\.\/\.\.\/assets\/tutorial\/finger\.png'\)/.test(demo), 'the finger is not a bundled asset');
    const tutorial = code(src('src/demo/TutorialScreen.tsx'));
    for (const heavy of ['Canvas', 'shellPreviewUri', 'createDieFaceTextures', 'cachedTexture', 'warm']) {
      assert(!tutorial.includes(heavy), `the tutorial mounts ${heavy}`);
    }
  });
});
