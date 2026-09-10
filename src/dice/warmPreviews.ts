import { DICE_SKINS } from '../game/diceSkins';
import { shellPreviewUri } from './preview';

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
 */
export function warmDicePreviews(
  schedule: (run: () => void) => void = (run) => setTimeout(run, 0),
  shouldContinue: () => boolean = () => true,
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
    if (i < queue.length) schedule(step);
  };

  schedule(step);
}

/** Test seam: allow warming to be started again. */
export function resetWarmForTest(): void {
  started = false;
}
