import { DICE_SKINS } from '../game/diceSkins';
import { shellPreviewUri } from './preview';
import { createDieFaceTextures, PatternId } from './patterns';
import type { DiceSkin } from '../game/diceSkins';

/**
 * Paint the dice pictures BEFORE anybody asks for them.
 *
 * David, 10 Sep 2026: "the items tab takes about 2-3 seconds at first".
 * Measured rather than guessed — painting all 53 dice previews takes
 * 846ms on a desktop, and a phone is several times slower, so 2-3
 * seconds is exactly right.
 *
 * WHY IT ALL HAPPENS AT ONCE. The Store and the Inventory are plain
 * ScrollViews with `.map()`, so every card mounts the moment the tab
 * opens and every card asks for its picture in the same breath. React
 * Native has no canvas: each picture is painted pixel by pixel in
 * JavaScript (src/dice/patterns.ts), 4,096 pixels a die, on the same
 * thread that is trying to draw the tab appearing. Nothing is wrong with
 * the cache — the second open is free — the cost is simply all of it
 * landing in one frame, the first time.
 *
 * THE FIX IS TO MOVE IT, NOT TO SHRINK IT. The pictures are painted a
 * few at a time in the background once the game is idle, so by the time
 * anybody taps Items the work is already done and the tab opens at the
 * speed of the second open. Nothing about how they look changes, and the
 * same painter still feeds both the shelf and the 3D dice, so the two
 * cannot drift apart.
 *
 * WHY NOT AT LAUNCH. Because launch is when the player wants their first
 * battle, and a second of blocked JavaScript there is worse than a
 * second in a menu they may never open. This waits until the game has
 * settled.
 */

/**
 * How many to paint before handing the thread back.
 *
 * ONE. A single die is ~16ms on a desktop and more on a phone, which is
 * already a whole frame — painting two in a row would drop one. The
 * point is to be invisible, not to be quick.
 */
export const WARM_CHUNK = 1;

/** Every skin that has a picture to paint, in the order they are painted. */
export function skinsNeedingPreview(): string[] {
  return DICE_SKINS.filter((s) => s.pattern !== 'plain').map((s) => s.id);
}

let started = false;

/**
 * Paint the remaining pictures, a few per tick, until they are all done.
 *
 * Safe to call more than once: the second call does nothing. Never
 * throws — a picture that fails to paint is simply painted again, on
 * demand, the way it was before this existed.
 *
 * `schedule` is injected so the headless tests can run it to completion
 * without a timer, and so the caller can decide what "later" means.
 *
 * `onDone` fires once the last picture is cached, and only then. It
 * exists because mounting the Store or the Inventory asks for all 53
 * pictures in a single commit — do that before the queue has drained
 * and you have simply moved the 846ms stall rather than removed it.
 */
export function warmDicePreviews(
  schedule: (run: () => void) => void = (run) => setTimeout(run, 0),
  shouldContinue: () => boolean = () => true,
  onDone: () => void = () => {},
): void {
  if (started) return;
  started = true;

  const queue = DICE_SKINS.filter((s) => s.pattern !== 'plain');
  let i = 0;

  const step = () => {
    if (!shouldContinue()) {
      // Stopped rather than finished — let a later call pick it up.
      started = false;
      return;
    }
    for (let n = 0; n < WARM_CHUNK && i < queue.length; n++, i++) {
      try {
        shellPreviewUri(queue[i]);
      } catch {
        // One bad skin must not stop the other fifty-two.
      }
    }
    if (i < queue.length) {
      schedule(step);
      return;
    }
    // Every picture is cached. Anything that wanted to wait for that —
    // building the Store and the Inventory, which ask for all 53 the
    // moment they mount — can go now without causing the stall this
    // whole file exists to avoid.
    try {
      onDone();
    } catch {
      // A caller that fails must not look like a failed paint.
    }
  };

  schedule(step);
}

let startedFaces = false;

/**
 * Paint the SIX SIDES of every die, one die per tick.
 *
 * David, 10 Sep 2026: "the game is very slow and laggy when you click to
 * open an item to view it." Measured rather than guessed, the same way
 * the shelf was: one die's six sides is **192ms on a desktop** — several
 * times that on a phone — and every one of them is painted in the frame
 * the preview is trying to appear in. That is the lag, and it is the
 * exact cost v1.76.0 added when a die stopped being one picture six
 * times and became six pictures that join up.
 *
 * The equipped die has been warmed since v1.76.0, because it is the one
 * that would otherwise stutter mid-roll. Every OTHER die is one tap away
 * in the Store or the Inventory, and paying 192ms at the moment of the
 * tap is what a player feels.
 *
 * RUN THIS LAST. It is by far the biggest of the warm-up jobs — 4.4s of
 * desktop painting for all fifty-three — so it goes behind the shelf
 * pictures, which are what makes the tabs open at all, and behind
 * building the two heavy pages. Nobody can open a preview before the
 * shelf it is opened from exists.
 *
 * ONE DIE PER TICK, not one face: the six faces of a die share a single
 * cache entry, so there is nothing finer to stop between. It is a bigger
 * bite than the shelf's single face and deliberately still small.
 */
export function warmAllDieFaces(
  schedule: (run: () => void) => void = (run) => setTimeout(run, 0),
  shouldContinue: () => boolean = () => true,
  onDone: () => void = () => {},
): void {
  if (startedFaces) return;
  startedFaces = true;

  const queue = DICE_SKINS.filter((s) => s.pattern !== 'plain');
  let i = 0;

  const step = () => {
    if (!shouldContinue()) {
      // Stopped rather than finished — let a later call pick it up.
      startedFaces = false;
      return;
    }
    if (i < queue.length) warmDieFaces(queue[i++]);
    if (i < queue.length) {
      schedule(step);
      return;
    }
    try {
      onDone();
    } catch {
      // A caller that fails must not look like a failed paint.
    }
  };

  schedule(step);
}

/** Test seam: allow warming to be started again. */
export function resetWarmForTest(): void {
  started = false;
  startedFaces = false;
}

/**
 * Paint the six sides of one die.
 *
 * Since 10 Sep 2026 each side of a die is its own square of one
 * continuous design, which is six times the painting — about 157ms for a
 * whole die on a desktop, more on a phone. It is cached for the life of
 * the app, so it is a one-off, but a one-off in the middle of somebody's
 * first roll is still a stutter. Doing it here means it has already
 * happened.
 *
 * Called first for the EQUIPPED skin, which is the one that would
 * otherwise stutter in the middle of a roll, and later for every other
 * die by warmAllDieFaces — see the note there for why the two are not
 * the same job.
 */
export function warmDieFaces(skin: DiceSkin | undefined): void {
  if (!skin || skin.pattern === 'plain') return;
  try {
    createDieFaceTextures(
      skin.pattern as Exclude<PatternId, 'plain'>,
      skin.body,
      skin.ink ?? skin.body,
    );
  } catch {
    // Painted again on demand, exactly as it was before this existed.
  }
}
