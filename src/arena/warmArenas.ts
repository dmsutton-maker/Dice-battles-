import { cachedTexture } from './textureCache';
import { ARENA_THEMES, ThemedArenaId } from './themeData';
import { themedFloorTexture, themedGroundTexture } from './ThemedArena';
import {
  createCourtyardFloorTexture,
  createJungleTrayTexture,
  createSunsetFloorTexture,
} from './bespokeFloors';

/**
 * Paint every battlefield's floor and ground in the background, one
 * picture per idle tick, so a preview opens from the cache.
 *
 * David, 18 Oct 2026: "right now when you click on something to preview
 * it it takes a second to load the item ... make the items load faster
 * when previewing them." Painting a battlefield's floor and ground is the
 * slow part of opening one — tens of milliseconds each on a desktop,
 * several times that on a phone — and it used to happen on the tap. The
 * dice faces were already warmed this way (warmPreviews.ts); this does
 * the same for the battlefields, after the dice have finished.
 *
 * Same keys as the arenas use (themedFloorTexture and friends), so what
 * is painted here is exactly what the board asks for. Bounded: one entry
 * per battlefield, painted once per launch.
 */
let started = false;

export function warmAllArenaTextures(
  schedule: (run: () => void) => void,
  shouldContinue: () => boolean,
): void {
  if (started) return;
  started = true;
  const jobs: (() => void)[] = [];
  for (const id of Object.keys(ARENA_THEMES) as ThemedArenaId[]) {
    const theme = ARENA_THEMES[id];
    jobs.push(() => themedFloorTexture(id, theme));
    jobs.push(() => themedGroundTexture(id, theme));
  }
  // The bespoke boards' floors that are plain painters under a fixed key
  // (CastleArena.tsx, JungleArena.tsx). Their other pictures are cheap.
  jobs.push(() => cachedTexture('castle-floor', createCourtyardFloorTexture));
  jobs.push(() => cachedTexture('castle-sunset-floor', createSunsetFloorTexture));
  jobs.push(() => cachedTexture('jungle-tray-floor', createJungleTrayTexture));

  let i = 0;
  const step = () => {
    if (!shouldContinue()) {
      // Paused (a battle started, a preview opened): the next call picks
      // up where this left off, since painted pictures stay cached.
      started = false;
      return;
    }
    if (i < jobs.length) {
      try {
        jobs[i]();
      } catch {
        // A picture that fails here simply paints on the tap, as before.
      }
      i += 1;
      schedule(step);
      return;
    }
  };
  schedule(step);
}
