import type { DiceSkin } from '../game/diceSkins';
import type { LaunchStep } from '../game/launchReady';
import { arenaLaunchJobs } from '../arena/warmArenas';
import { onShelfPicture } from './preview';
import { PaintStep, runSliced, SlicedRun } from './slicedPaint';
import {
  equippedDieJobs,
  prioritiseShelfPictures,
  shelfPicturesReady,
  warmDicePreviews,
} from './warmPreviews';

/**
 * The painting the loading screen waits for, in order.
 *
 * David's family, 3 Nov 2026: "make sure the game is fully loaded before
 * showing the home screen." Measured that day, everything the home
 * screen needs that is SLOW is painting: the die in your hand, the
 * battlefield you stand on, and the pictures on the shelves. Each is now
 * a list of small jobs (slicedPaint.ts) and this runs them under the
 * title card, reporting as it goes so the bar moves:
 *
 *   1. the equipped die — shade, stickers, its six sides ('die');
 *   2. the equipped battlefield's floor and ground ('arena') — after
 *      which the board may mount, onto pictures already painted;
 *   3. the first screenful of shelf pictures in the Store and the
 *      Inventory ('pictures'). The rest of the shelf carries on straight
 *      after, at the menu's gentler pace, before the die faces.
 *
 * NOT here: every die's six sides and every other battlefield. Painting
 * those takes some eighteen seconds on a desktop — over a minute on a
 * phone — so they stay in the background on the menu, as before.
 */
export interface LaunchWarm {
  skin: DiceSkin | undefined;
  arenaId: string;
  /** The shelf pictures the first screenful of each shelf shows. */
  shelfIds: readonly string[];
  schedule?: (run: () => void) => void;
  /** Read before every slice: the loading screen's, then the menu's. */
  budget: () => number;
  report: (step: LaunchStep, fraction: number) => void;
  /** The die and the battlefield are painted: the board may mount. */
  onBoard: () => void;
  /** The first screenful of pictures is painted: build the pages. */
  onPictures: () => void;
  /** Whether the rest of the shelf may keep painting (the app is on screen). */
  shelfMayContinue: () => boolean;
  /** Every shelf picture is painted. */
  onShelfDone: () => void;
}

export function runLaunchWarm(warm: LaunchWarm): { cancel(): void } {
  const schedule = warm.schedule ?? ((run: () => void) => setTimeout(run, 0));
  let cancelled = false;
  let current: SlicedRun | null = null;
  let unlisten: (() => void) | null = null;

  /** Run `jobs`, reporting `step` as they go, then `then`. */
  const stage = (step: LaunchStep, jobs: PaintStep[], then: () => void) => {
    let i = 0;
    current = runSliced(
      () => {
        warm.report(step, jobs.length === 0 ? 1 : i / jobs.length);
        return i < jobs.length ? jobs[i++] : null;
      },
      {
        schedule,
        budget: warm.budget,
        onDone: () => {
          if (cancelled) return;
          warm.report(step, 1);
          then();
        },
      },
    );
  };

  const pictures = () => {
    const ids = warm.shelfIds;
    const check = () => {
      if (cancelled) return;
      const painted = ids.filter((id) => shelfPicturesReady([id])).length;
      warm.report('pictures', ids.length === 0 ? 1 : painted / ids.length);
      if (painted < ids.length) return;
      unlisten?.();
      unlisten = null;
      warm.onPictures();
    };
    unlisten = onShelfPicture(check);
    prioritiseShelfPictures(ids);
    warmDicePreviews(schedule, warm.shelfMayContinue, warm.onShelfDone, warm.budget);
    check();
  };

  stage('die', equippedDieJobs(warm.skin), () =>
    stage('arena', arenaLaunchJobs(warm.arenaId), () => {
      warm.onBoard();
      pictures();
    }),
  );

  return {
    cancel() {
      cancelled = true;
      current?.cancel();
      unlisten?.();
    },
  };
}
