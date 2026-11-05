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

/**
 * The budget per slice while the Store or the Inventory is open, no
 * battle is running and no preview is up.
 *
 * Marc, 5 Nov 2026: "When I load the game and go to shop and inventory
 * many dice icons are not showing at first." The 6 ms slice exists so
 * the board can animate beside the painting; on a shelf tab the board is
 * behind solid paper and stopped, so nothing 3D needs the thread.
 *
 * Why 12 and not a whole frame. Modelled with one slice per frame (a
 * timer firing on the next 1/60 s) and the real painting in node, all
 * 60 shelf pictures were in after 12.9-13.3 s at 6 ms, 7.8-10.0 s at
 * 12 ms and 9.3-10.4 s at 16 ms — about 6.2 s of painting each time. A
 * slice runs past its budget by up to one step, so one budgeted at a
 * whole frame keeps spilling into the next and losing it; 12 ms ends
 * inside its frame and is the faster of the two, and a tap never waits
 * longer than a frame.
 */
export const SHELF_SLICE_MS = 12;

/**
 * Which budget a background slice gets right now: the loading screen's
 * until it lifts, the shelf's while only a shelf tab is on screen, and
 * the menu's whenever the board might be visible.
 */
export function backgroundSliceMs(at: { launched: boolean; shelfOnly: boolean }): number {
  if (!at.launched) return LOAD_SLICE_MS;
  return at.shelfOnly ? SHELF_SLICE_MS : MENU_SLICE_MS;
}

/**
 * Is the background painting PAUSED because a popup is open?
 *
 * Marc, 5 Nov 2026: "When you load the game for the first time in the
 * how to play pop up, when you click next some of the things are very
 * slow to load." On a first launch the tutorial opens over a home screen
 * that is painting sixty shelf pictures and then every die's six sides
 * in the background, a slice every frame, and every tap on Next landed
 * on the same thread as a slice. So while ANY popup is open — How to
 * play, News, Settings — every background painter stops (its
 * `shouldContinue` says no), and starts again where it left off when the
 * popup closes. Paused rather than slowed: a slice of any length is
 * still a slice the tap has to wait behind.
 *
 * Only once the title card has lifted. The tutorial is opened as the
 * saved game loads, under the card, and the card waits for the first
 * screenful of pictures: pausing them there would hold it to its cap.
 */
export function pausedForPopup(at: { launched: boolean; popupOpen: boolean }): boolean {
  return at.launched && at.popupOpen;
}

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
