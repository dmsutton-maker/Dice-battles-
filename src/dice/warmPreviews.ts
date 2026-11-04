import { DICE_SKINS, skinById } from '../game/diceSkins';
import { DIE_FACE_COLORS } from '../game/colors';
import { cachedShellPreviewUri, shelfPictureJob } from './preview';
import { dieFaceJobs, dieFaceKey, PatternId } from './patterns';
import { DIE_SHADE_KEY, dieShadeTexture, stickerJob, stickerKey } from './dieShading';
import { hasCachedTexture } from '../arena/textureCache';
import { fromList, MENU_SLICE_MS, once, PaintStep, runSliced, SlicedRun } from './slicedPaint';
import { fishSchoolJobs, fishWaterJob } from './fishSwim';
import { circuitPulseJob } from './circuitPulse';
import { neonGlowJob } from './neonGlow';
import { oceanChopJob, oceanSwellJob } from './oceanFlow';
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
 * The pictures are painted in TIME-BUDGETED slices, not one die per tick.
 *
 * David, 3 Nov 2026: "The game runs very slow when you open it ... it all
 * has to be lightning fast." One die per tick was meant to be one frame;
 * measured on 3 Nov it was up to 333ms for one shelf picture (Pizza) and
 * up to 1.4 seconds for one die's six sides, on a desktop — a phone is
 * several times slower — so the warm-up that was supposed to be
 * invisible froze the home screen for the first minute. Every picture is
 * now a job of about a millisecond a step (squareJob in patterns.ts) and
 * the caller's budget decides the slice (slicedPaint.ts): the loading
 * screen's while it is up, a frame's worth on the menu after.
 */

/** Every skin that has a picture to paint, in the order they are painted. */
export function skinsNeedingPreview(): string[] {
  return DICE_SKINS.filter((s) => s.pattern !== 'plain').map((s) => s.id);
}

let started = false;
let finished = false;
/** Pictures wanted first: the first screenful of each shelf, or a card on screen. */
const firstIds: string[] = [];

/**
 * Paint these shelf pictures before any other.
 *
 * The loading screen asks for the first screenful of the Store and the
 * Inventory, so the first tap on either finds its cards already drawn;
 * a card that comes on screen before its picture is painted asks for
 * its own (DiceSwatch). Returns whether a warm-up is running that will
 * get to them — false means nothing is painting and the caller must
 * paint for itself.
 */
export function prioritiseShelfPictures(ids: readonly string[]): boolean {
  for (let i = ids.length - 1; i >= 0; i--) {
    const at = firstIds.indexOf(ids[i]);
    if (at >= 0) firstIds.splice(at, 1);
    firstIds.unshift(ids[i]);
  }
  return started && !finished;
}

/** Whether every one of these shelf pictures is painted. */
export function shelfPicturesReady(ids: readonly string[]): boolean {
  return ids.every((id) => {
    const skin = skinById(id);
    return !skin || cachedShellPreviewUri(skin) !== null || skin.pattern === 'plain';
  });
}

/**
 * Paint the remaining shelf pictures, a slice at a time, until they are
 * all done.
 *
 * Safe to call more than once: a second call while one is running, or
 * after it finished, does nothing. Never throws — a picture that fails to
 * paint is painted again on demand, the way it was before this existed.
 *
 * `schedule` is injected so the headless tests can run it to completion
 * without a timer, and so the caller can decide what "later" means.
 * `budget` is read before every slice, so the same run can go from the
 * loading screen's budget to the menu's the moment the home screen is up.
 *
 * `onDone` fires once the last picture is cached, and only then.
 */
export function warmDicePreviews(
  schedule: (run: () => void) => void = (run) => setTimeout(run, 0),
  shouldContinue: () => boolean = () => true,
  onDone: () => void = () => {},
  budget: () => number = () => MENU_SLICE_MS,
): void {
  if (started || finished) return;
  started = true;

  const rest = DICE_SKINS.filter((s) => s.pattern !== 'plain');
  let i = 0;
  const next = (): PaintStep | null => {
    // The asked-for pictures first, then the shelf order.
    while (firstIds.length > 0) {
      const skin = skinById(firstIds.shift()!);
      const job = skin ? safeJob(skin) : null;
      if (job) return job;
    }
    while (i < rest.length) {
      const job = safeJob(rest[i++]);
      if (job) return job;
    }
    return null;
  };

  runSliced(next, {
    schedule,
    shouldContinue,
    budget,
    // Stopped rather than finished — let a later call pick it up.
    onStop: () => {
      started = false;
    },
    onDone: () => {
      started = false;
      finished = true;
      // A caller that fails must not look like a failed paint.
      try {
        onDone();
      } catch {
        // Swallowed; see above.
      }
    },
  });
}

/** One bad skin must not stop the other fifty-nine. */
function safeJob(skin: DiceSkin): PaintStep | null {
  try {
    return shelfPictureJob(skin);
  } catch {
    return null;
  }
}

let startedFaces = false;

/**
 * Paint the SIX SIDES of every die in the background.
 *
 * David, 10 Sep 2026: "the game is very slow and laggy when you click to
 * open an item to view it." One die's six sides is a lot of painting —
 * measured again on 3 Nov 2026 at 200ms to 1.8 seconds on a desktop
 * depending on the die, over 13 seconds for all of them — and it used to
 * be paid in the frame a preview was trying to appear in. So every die
 * is painted ahead of time, in slices now rather than a die per tick
 * (see the note at the top of this file), and only on the menu.
 *
 * RUN THIS LAST. It is by far the biggest of the warm-up jobs, so it goes
 * behind the shelf pictures and the loading screen. Nobody can open a
 * preview before the shelf it is opened from exists.
 */
export function warmAllDieFaces(
  schedule: (run: () => void) => void = (run) => setTimeout(run, 0),
  shouldContinue: () => boolean = () => true,
  onDone: () => void = () => {},
  budget: () => number = () => MENU_SLICE_MS,
): void {
  if (startedFaces) return;
  startedFaces = true;

  const queue = DICE_SKINS.filter((s) => s.pattern !== 'plain');
  let i = 0;
  let pending: PaintStep[] = shadingJobs();
  const next = (): PaintStep | null => {
    while (pending.length === 0 && i < queue.length) pending = dieJobs(queue[i++]);
    return pending.shift() ?? null;
  };
  runSliced(next, {
    schedule,
    shouldContinue,
    budget,
    // Stopped rather than finished — let a later call pick it up. What
    // was painted stays painted, so it carries on where it left off.
    onStop: () => {
      startedFaces = false;
    },
    onDone,
  });
}

/**
 * Paint the equipped die — its shade, its stickers and its six sides —
 * in slices, and call `onDone` when it is on the table ready to draw.
 *
 * For the loading screen: the die in the player's hand is the one thing
 * here that would otherwise stutter in the middle of their first roll,
 * and it used to be painted in one block the moment the board mounted.
 */
export function warmEquippedDie(
  skin: DiceSkin | undefined,
  options: Parameters<typeof runSliced>[1] = {},
): SlicedRun {
  return runSliced(fromList(equippedDieJobs(skin)), options);
}

/**
 * The cache keys of everything equippedDieJobs paints, for keeping them
 * between launches (keptTextures.ts).
 */
export function equippedDieKeys(skin: DiceSkin | undefined): string[] {
  const keys = [DIE_SHADE_KEY, ...DIE_FACE_COLORS.map((c) => stickerKey(c.hex, null))];
  if (!skin || skin.pattern === 'plain') return keys;
  const faces = [0, 1, 2, 3, 4, 5];
  if (skin.pattern === 'fish') {
    keys.push(
      ...faces.map((f) => `die:fish-swim:water:${f}`),
      'die:fish-swim:school:1',
      'die:fish-swim:school:-1',
      'die:fish-swim:cap',
    );
  }
  if (skin.pattern === 'circuit') keys.push(...faces.map((f) => `die:circuit-pulse:${f}`));
  if (skin.pattern === 'neon') keys.push(...faces.map((f) => `die:neon-glow:${f}`));
  // The Ocean die's table picture is its two maps alone; see dieJobs.
  if (skin.pattern === 'ocean') {
    keys.push(...faces.map((f) => `die:ocean-swell:${f}`), ...faces.map((f) => `die:ocean-chop:${f}`));
    return keys;
  }
  keys.push(...faces.map((f) => dieFaceKey(skin.pattern, skin.body, skin.ink ?? skin.body, f)));
  return keys;
}

/** The jobs warmEquippedDie runs, for a caller that counts them. */
export function equippedDieJobs(skin: DiceSkin | undefined): PaintStep[] {
  return [...shadingJobs(), ...(skin ? dieJobs(skin) : [])];
}

/** The shade map and the six plain stickers every die wears. */
function shadingJobs(): PaintStep[] {
  return present([
    hasCachedTexture(DIE_SHADE_KEY) ? null : once(dieShadeTexture),
    ...DIE_FACE_COLORS.map((c) => stickerJob(c.hex, null)),
  ]);
}

/**
 * Everything one die's skin paints for the table, as jobs.
 *
 * The extra maps the moving dice draw on top come first — the Fish
 * die's water and schools (fishSwim.ts), the Circuit Board's wiring
 * (circuitPulse.ts), the Neon die's glow (neonGlow.ts) — then the six
 * painted sides, a few texels a step. The Ocean die's sea is coloured
 * by the GPU from its swell and chop maps (oceanFlow.ts), so its six
 * painted sides are nobody's: only the shelf card shows the still.
 */
export function dieJobs(skin: DiceSkin): PaintStep[] {
  if (skin.pattern === 'plain') return [];
  const jobs: PaintStep[] = [];
  const faces = [0, 1, 2, 3, 4, 5];
  if (skin.pattern === 'fish') {
    jobs.push(...present(faces.map(fishWaterJob)), ...present(fishSchoolJobs()));
  }
  if (skin.pattern === 'circuit') jobs.push(...present(faces.map(circuitPulseJob)));
  if (skin.pattern === 'neon') jobs.push(...present(faces.map(neonGlowJob)));
  if (skin.pattern === 'ocean') {
    jobs.push(...present(faces.map(oceanSwellJob)), ...present(faces.map(oceanChopJob)));
    return jobs;
  }
  try {
    jobs.push(
      ...dieFaceJobs(
        skin.pattern as Exclude<PatternId, 'plain'>,
        skin.body,
        skin.ink ?? skin.body,
      ),
    );
  } catch {
    // Painted again on demand, exactly as it was before this existed.
  }
  return jobs;
}

/** The jobs that still have something to paint. */
function present(jobs: readonly (PaintStep | null)[]): PaintStep[] {
  return jobs.filter((job): job is PaintStep => job !== null);
}

/** Test seam: allow warming to be started again. */
export function resetWarmForTest(): void {
  started = false;
  finished = false;
  startedFaces = false;
  firstIds.length = 0;
}

/**
 * Paint the six sides of one die, all at once.
 *
 * The same jobs as the warm-up, run to the end on the spot. Kept for the
 * tests and for anything that must have the die NOW; the game itself
 * uses warmEquippedDie and warmAllDieFaces, which never block.
 */
export function warmDieFaces(skin: DiceSkin | undefined): void {
  const jobs = [...shadingJobs(), ...(skin ? dieJobs(skin) : [])];
  for (const job of jobs) {
    try {
      while (!job.step());
    } catch {
      // Painted again on demand, exactly as it was before this existed.
    }
  }
}
