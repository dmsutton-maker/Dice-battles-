import { cachedTexture } from './textureCache';
import { ARENA_THEMES, ThemedArenaId } from './themeData';
import { paintThemedSurfaces } from './ThemedArena';
import {
  createCourtyardFloorTexture,
  createDeckGlowTexture,
  createDeckTexture,
  createDuskGroundTexture,
  createFieldTexture,
  createHullPlateTexture,
  createJungleTrayTexture,
  createSunsetFloorTexture,
} from './bespokeFloors';

/**
 * Paint every battlefield's floor and ground in the background, so a
 * preview opens from the cache.
 *
 * David, 18 Oct 2026: "right now when you click on something to preview
 * it it takes a second to load the item ... make the items load faster
 * when previewing them." Painting a battlefield's floor and ground is the
 * slow part of opening one — tens to hundreds of milliseconds each on a
 * desktop, several times that on a phone — and it used to happen on the
 * tap. The dice faces were already warmed this way (warmPreviews.ts);
 * this does the same for the battlefields.
 *
 * IN SLICES, since 21 Oct 2026 (David: "I want the arenas to load much
 * faster when you click on them to view them"). A themed board's floor
 * is painted a few rows per slice (textureCache.ts, paintInBackground)
 * rather than in one go, so this runs alongside the dice warm-up from
 * the start instead of after it — a floor used to be one 360ms block,
 * which would have made the menu stutter beside the dice — and every
 * board is warm within the first minute rather than after every die.
 * A board opened before its turn gets a quick stand-in floor meanwhile
 * (ThemedArena.tsx, useProgressiveSurface).
 *
 * Same keys as the boards use, so what is painted here is exactly what
 * the board asks for. Bounded: one entry per picture, painted once per
 * launch.
 */
let started = false;

export function warmAllArenaTextures(
  schedule: (run: () => void) => void,
  shouldContinue: () => boolean,
): void {
  if (started) return;
  started = true;
  const jobs: ((done: () => void) => void)[] = [];
  /*
    The bespoke boards FIRST. Their pictures are plain painters under
    fixed keys (CastleArena.tsx, JungleArena.tsx, SpaceArena.tsx,
    spaceParts.tsx, ruinParts.tsx), painted in one go each, so they are
    the only boards that still paint on the tap when cold — a quarter of
    a second each on a desktop. Done in the first moments on the menu,
    before the themed boards, which can show a stand-in meanwhile. The
    castle's own are painted at launch, since it is the board the game
    opens on.
  */
  const whole: [string, () => import('three').Texture][] = [
    ['castle-floor', createCourtyardFloorTexture],
    ['castle-sunset-floor', createSunsetFloorTexture],
    ['sunset-ground', createDuskGroundTexture],
    ['jungle-tray-floor', createJungleTrayTexture],
    ['space-floor', createDeckTexture],
    ['space-floor-glow', createDeckGlowTexture],
    ['space-field', createFieldTexture],
    ['space-hull-plate', createHullPlateTexture],
  ];
  for (const [key, make] of whole) {
    jobs.push((done) => {
      cachedTexture(key, make);
      done();
    });
  }
  for (const id of Object.keys(ARENA_THEMES) as ThemedArenaId[]) {
    jobs.push((done) => paintThemedSurfaces(id, ARENA_THEMES[id], schedule, done));
  }

  let i = 0;
  const step = () => {
    if (!shouldContinue()) {
      // Paused (a battle started, a preview opened): the next call picks
      // up where this left off, since painted pictures stay cached.
      started = false;
      return;
    }
    if (i >= jobs.length) return;
    const job = jobs[i];
    i += 1;
    try {
      job(() => schedule(step));
    } catch {
      // A picture that fails here simply paints on the tap, as before.
      schedule(step);
    }
  };
  schedule(step);
}
