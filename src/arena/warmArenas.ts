import { cachedTexture, PAINT_BUDGET_MS } from './textureCache';
import { ARENA_THEMES, ThemedArenaId } from './themeData';
import { paintThemedSurfaces, themedSurfaceJobs } from './ThemedArena';
import { jungleFloorJob } from './jungleFloorTexture';
import {
  createCourtyardFloorTexture,
  createDeckGlowTexture,
  createDeckTexture,
  createDuskGroundTexture,
  createFieldTexture,
  createHullPlateTexture,
  createJungleTrayTexture,
  createSunsetFloorTexture,
  bespokeFloorJob,
  BespokePainting,
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

/** Test seam: allow the battlefield warm-up to be started again. */
export function resetArenaWarmForTests(): void {
  started = false;
}

type Step = { step(): boolean };

/**
 * The paintings behind each bespoke picture: painted a row per step
 * first (bespokeFloors.ts, bespokeFloorJob), so turning them into the
 * texture afterwards is a copy of bytes rather than 70-200ms of painting
 * in one block. David, 3 Nov 2026: "it all has to be lightning fast."
 */
const PAINTINGS_BEHIND: Record<string, readonly BespokePainting[]> = {
  'castle-floor': ['courtyard'],
  'castle-sunset-floor': ['sunset'],
  'sunset-ground': ['dusk-ground'],
  'jungle-tray-floor': ['jungle-tray'],
  'space-floor': ['deck'],
  'space-floor-glow': ['deck'],
  'space-hull-plate': ['hull-plate'],
};

/**
 * Everything a bespoke board paints when it mounts, by board: its
 * pictures' paintings, then the pictures. Read off the boards
 * (CastleArena.tsx, JungleArena.tsx, SpaceArena.tsx, castleParts.tsx,
 * ruinParts.tsx, spaceParts.tsx). The meadow, the castle's stone and the
 * jungle's ground are left as paintings: their boards set the repeat as
 * they make the texture, so only the painting is shared.
 */
const BESPOKE_LAUNCH: Record<string, () => (Step | null)[]> = {
  castle: () => [
    bespokeFloorJob('courtyard'),
    bespokeFloorJob('meadow'),
    bespokeFloorJob('stone-blocks'),
    textureStep('castle-floor', createCourtyardFloorTexture),
  ],
  castleSunset: () => [
    bespokeFloorJob('sunset'),
    bespokeFloorJob('dusk-ground'),
    bespokeFloorJob('stone-blocks'),
    textureStep('castle-sunset-floor', createSunsetFloorTexture),
    textureStep('sunset-ground', createDuskGroundTexture),
  ],
  jungle: () => [
    bespokeFloorJob('jungle-tray'),
    jungleFloorJob(),
    textureStep('jungle-tray-floor', createJungleTrayTexture),
  ],
  space: () => [
    bespokeFloorJob('deck'),
    bespokeFloorJob('hull-plate'),
    textureStep('space-floor', createDeckTexture),
    textureStep('space-floor-glow', createDeckGlowTexture),
    textureStep('space-field', createFieldTexture),
    textureStep('space-hull-plate', createHullPlateTexture),
  ],
};

function textureStep(key: string, make: () => import('three').Texture): Step {
  return {
    step() {
      cachedTexture(key, make);
      return true;
    },
  };
}

/**
 * The equipped battlefield's floor and ground — what its board paints
 * the moment it mounts — as jobs, for the loading screen.
 *
 * David, 3 Nov 2026: "make sure the game is fully loaded before showing
 * the home screen." The board used to paint these in one block at its
 * first mount (up to 200ms on a desktop for one picture, several times
 * that on a phone); painted here, under the title card and in slices,
 * the board then mounts onto pictures that are already in the cache.
 */
export function arenaLaunchJobs(arenaId: string): Step[] {
  const bespoke = BESPOKE_LAUNCH[arenaId];
  const jobs = bespoke
    ? bespoke()
    : arenaId in ARENA_THEMES
      ? themedSurfaceJobs(arenaId, ARENA_THEMES[arenaId as ThemedArenaId])
      : [];
  return jobs.filter((job): job is Step => job !== null);
}

/** Run `job` a menu slice at a time on `schedule`, then `then`. */
function inSlices(job: Step, schedule: (run: () => void) => void, then: () => void): void {
  const go = () => {
    const t0 = Date.now();
    let finished = false;
    try {
      do finished = job.step();
      while (!finished && Date.now() - t0 < PAINT_BUDGET_MS);
    } catch {
      // Painted on the tap instead, as before any of this existed.
      finished = true;
    }
    if (finished) then();
    else schedule(go);
  };
  go();
}

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
    spaceParts.tsx, ruinParts.tsx) — painted a row per step since 3 Nov
    2026, where each used to be a quarter of a second in one block on a
    desktop — so they are the only boards that still paint on the tap
    when cold. Done in the first moments on the menu, before the themed
    boards, which can show a stand-in meanwhile.
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
    for (const name of PAINTINGS_BEHIND[key] ?? []) {
      jobs.push((done) => {
        const job = bespokeFloorJob(name);
        if (job) inSlices(job, schedule, done);
        else done();
      });
    }
    jobs.push((done) => {
      cachedTexture(key, make);
      done();
    });
  }
  // The paintings whose boards make their own texture from them.
  for (const make of [() => bespokeFloorJob('meadow'), () => bespokeFloorJob('stone-blocks'), jungleFloorJob]) {
    jobs.push((done) => {
      const job = make();
      if (job) inSlices(job, schedule, done);
      else done();
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
