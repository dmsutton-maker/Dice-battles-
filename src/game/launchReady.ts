/**
 * What the loading screen is waiting for, and how far along it is.
 *
 * David's family, 3 Nov 2026: "The game runs very slow when you open it,
 * especially if I have everything unlocked. It cannot be slow, it all has
 * to be lightning fast" — and then: "i want the speed fixes now. like make
 * sure the game is fully loaded before showing the home screen".
 *
 * So the title card (BootSplash) is a real loading screen now. It used to
 * be held for a fixed 1.9 seconds and then lifted whether or not the game
 * behind it was ready, and the home screen then spent its first minute
 * painting dice in blocks of up to a second and more, so the first taps
 * stuck. Now the card stays up until every step below has reported in,
 * shows how far along that is, and only then hands over — so the first
 * touch on the home screen and on every tab is answered at once.
 *
 * Pure on purpose (no React Native), so the tests can drive it. The game
 * screen reports the steps (DiceDemoScreen); the card draws the bar from
 * `launchProgress`; App lifts the card when `shouldReveal` says so.
 */

/** The steps, in roughly the order they finish, weighted by their usual cost. */
export const LAUNCH_STEPS = [
  /** The saved game, loadout, wallet and settings, read from storage. */
  { id: 'saved', weight: 1 },
  /** The sound players, created (src/audio/sounds.ts). */
  { id: 'sounds', weight: 1 },
  /** The equipped die: its shade, stickers and six painted sides. */
  { id: 'die', weight: 3 },
  /** The equipped battlefield's floor and ground. */
  { id: 'arena', weight: 2 },
  /** The first screenful of shelf pictures in the Store and the Inventory. */
  { id: 'pictures', weight: 3 },
  /** The Store and the Inventory pages, built and hidden, ready to show. */
  { id: 'pages', weight: 2 },
  /** The board's first frames drawn, so the first battle starts warm. */
  { id: 'scene', weight: 2 },
] as const;

export type LaunchStep = (typeof LAUNCH_STEPS)[number]['id'];

/**
 * The shortest time the card is up, so it never just flashes. David's
 * card used to be held 1.9 seconds whatever happened; the family asked
 * for it to be a loading screen instead, with a short minimum.
 */
export const LOADING_MIN_MS = 800;

/**
 * The longest the card ever waits. If anything takes absurdly long — a
 * phone far slower than any measured, a picture that will not finish —
 * the home screen is shown anyway and the rest carries on behind it.
 */
export const LOADING_CAP_MS = 12000;

const done = new Map<LaunchStep, number>();
let gaveUp = false;
const listeners = new Set<() => void>();

function tell(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // One listener failing must not stop the others hearing.
    }
  }
}

/**
 * Report a step as finished (1), or part of the way there (0..1) so the
 * bar can move during the long ones. A step never goes backwards.
 */
export function reportStep(id: LaunchStep, fraction = 1): void {
  const now = Math.max(0, Math.min(1, fraction));
  const before = done.get(id) ?? 0;
  if (now <= before) return;
  done.set(id, now);
  tell();
}

/** How far along the launch is, 0 to 1, by weight. */
export function launchProgress(): number {
  let total = 0;
  let got = 0;
  for (const step of LAUNCH_STEPS) {
    total += step.weight;
    got += step.weight * (done.get(step.id) ?? 0);
  }
  return total === 0 ? 1 : got / total;
}

/** Whether a step has finished. */
export function stepDone(id: LaunchStep): boolean {
  return (done.get(id) ?? 0) >= 1;
}

/** Every step has finished. */
export function launchReady(): boolean {
  return LAUNCH_STEPS.every((step) => stepDone(step.id));
}

/**
 * The cap was reached and the home screen was shown before everything
 * finished. Whatever is still waiting on the launch (the board, which
 * waits for its pictures) should stop waiting and go.
 */
export function giveUpWaiting(): void {
  if (gaveUp) return;
  gaveUp = true;
  tell();
}

/** The launch is over, one way or the other: ready, or given up on. */
export function launchSettled(): boolean {
  return gaveUp || launchReady();
}

/** Called on every change of progress, readiness or giving up. */
export function onLaunchChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Whether the card should lift now, `elapsed` milliseconds after it went
 * up: everything is ready and the card has had its minimum, or the cap
 * has been reached whatever is still going.
 */
export function shouldReveal(elapsed: number, ready: boolean): boolean {
  if (elapsed >= LOADING_CAP_MS) return true;
  return ready && elapsed >= LOADING_MIN_MS;
}

/** Test seam: start the launch again from nothing. */
export function resetLaunchForTests(): void {
  done.clear();
  gaveUp = false;
}
