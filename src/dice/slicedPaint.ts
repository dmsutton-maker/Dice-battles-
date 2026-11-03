/**
 * Painting in slices: a little at a time, handing the thread back between.
 *
 * David, 3 Nov 2026: "The game runs very slow when you open it,
 * especially if I have everything unlocked. It cannot be slow, it all
 * has to be lightning fast." Measured rather than guessed, the slow part
 * was not the saved game or the shop's lists — those take under a
 * millisecond each — it was painting. React Native has no canvas, so
 * every picture of a die and every battlefield floor is painted pixel by
 * pixel in JavaScript, on the one thread that also draws the menus and
 * answers taps. The warm-up painted a whole die per tick: up to 1.4
 * seconds on a desktop for the Pizza die and several times that on a
 * phone, during which the home screen could not move.
 *
 * Every painter now comes as a job whose `step()` does about a
 * millisecond of work and says whether it is finished. This runs jobs
 * one after another until a time budget is spent, then hands the thread
 * back and carries on in the next slice — so the budget, not the
 * painter, decides how long the game is ever held up.
 */

/** A piece of painting that can stop between any two steps. */
export interface PaintStep {
  /** Do a little more; true once finished. */
  step(): boolean;
}

/**
 * The budget per slice under the loading screen.
 *
 * The title card is still while it waits, so it can afford a longer
 * slice than the menu: the progress bar is animated by the native side
 * (BootSplash) and does not need this thread to move. Still sliced, so
 * the bar's figure keeps moving on and nothing is ever one long block.
 */
export const LOAD_SLICE_MS = 40;

/**
 * The budget per slice once the home screen is up: what a frame can
 * spare. Same as the battlefield floors' (textureCache.ts).
 */
export const MENU_SLICE_MS = 6;

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export interface SlicedRun {
  /** Stop for good; nothing more is scheduled. */
  cancel(): void;
}

/**
 * Run jobs from `next` until it returns null, `budget()` milliseconds at
 * a time.
 *
 * `shouldContinue` is asked before every slice; false stops the run and
 * calls `onStop` (so the caller can start it again later — finished jobs
 * stay painted, since every job writes into a cache). A job that throws
 * is dropped: a picture that fails here is painted on demand instead,
 * the way it was before any warm-up existed.
 */
export function runSliced(
  next: () => PaintStep | null,
  {
    schedule = (run) => setTimeout(run, 0),
    shouldContinue = () => true,
    budget = () => MENU_SLICE_MS,
    onDone = () => {},
    onStop = () => {},
    onSlice = () => {},
  }: {
    schedule?: (run: () => void) => void;
    shouldContinue?: () => boolean;
    budget?: () => number;
    onDone?: () => void;
    onStop?: () => void;
    /** After every slice, for a progress figure. */
    onSlice?: () => void;
  } = {},
): SlicedRun {
  let job: PaintStep | null = null;
  let cancelled = false;

  const slice = () => {
    if (cancelled) return;
    if (!shouldContinue()) {
      safely(onStop);
      return;
    }
    const t0 = now();
    const limit = budget();
    for (;;) {
      if (!job) {
        try {
          job = next();
        } catch {
          job = null;
        }
        if (!job) {
          safely(onSlice);
          safely(onDone);
          return;
        }
      }
      let finished = true;
      try {
        finished = job.step();
      } catch {
        // Dropped; see above.
      }
      if (finished) job = null;
      if (now() - t0 >= limit) break;
    }
    safely(onSlice);
    schedule(slice);
  };

  schedule(slice);
  return {
    cancel() {
      cancelled = true;
    },
  };
}

/** A caller's callback failing must never look like a failed paint. */
function safely(fn: () => void): void {
  try {
    fn();
  } catch {
    // Swallowed on purpose.
  }
}

/** Jobs from a list, in order. */
export function fromList(jobs: readonly PaintStep[]): () => PaintStep | null {
  let i = 0;
  return () => (i < jobs.length ? jobs[i++] : null);
}

/** A one-step job: something that cannot be cut up any finer. */
export function once(work: () => unknown): PaintStep {
  return {
    step() {
      work();
      return true;
    },
  };
}
