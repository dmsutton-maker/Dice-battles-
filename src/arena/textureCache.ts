import * as THREE from 'three';

/**
 * Every procedural texture, built once per app run rather than once per
 * mount.
 *
 * This is why switching battlefields showed you the PREVIOUS one for a
 * moment. The textures are painted pixel by pixel in JavaScript — React
 * Native has no canvas — and the jungle floor alone takes 65 to 120ms on a
 * desktop, several hundred on a phone. Each arena built its own inside
 * `useMemo`, which caches only for the life of that component instance, so
 * every switch blocked the JavaScript thread long enough for the old frame
 * to stay on screen while the new arena was still being painted. Coming
 * back to an arena you had already viewed paid the whole cost again.
 *
 * A module-level cache fixes both: the first view of an arena pays once
 * and every view after that is free.
 *
 * These are never disposed. That is deliberate — there are a handful of
 * them, they are small, and they are wanted again the moment the player
 * opens the Inventory. Disposing on unmount is what created the problem.
 */

const cache = new Map<string, THREE.Texture>();

/**
 * The texture for `key`, building it with `make` the first time only.
 *
 * The key must describe everything `make` depends on, or two different
 * textures will collide on one entry — hence the callers passing their
 * colours and settings into it rather than a bare name.
 */
export function cachedTexture(key: string, make: () => THREE.Texture): THREE.Texture {
  const found = cache.get(key);
  if (found) return found;
  const built = make();
  cache.set(key, built);
  return built;
}

/** How many textures have been built. Test-only. */
export function cachedTextureCount(): number {
  return cache.size;
}

/** Test-only: forget everything, so a suite can count builds from zero. */
export function clearTextureCacheForTests(): void {
  cache.clear();
  running.clear();
}

/* ── painting between frames ──────────────────────────────────────── */

/**
 * A picture that can be painted a few rows at a time: `step` paints up
 * to that many more rows and says whether it is finished. See
 * groundTexture.ts, SurfaceJob.
 */
export interface PaintJob {
  readonly texture: THREE.Texture;
  step(rows: number): boolean;
}

/**
 * How long one slice of painting may hold the thread, so a floor is
 * painted over many frames rather than in one. Six milliseconds leaves
 * most of a sixtieth of a second for everything else.
 */
export const PAINT_BUDGET_MS = 6;

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();

const running = new Map<string, Promise<THREE.Texture>>();

/**
 * Paint `key` in the background, a slice at a time, and cache it when
 * it is done.
 *
 * David, 21 Oct 2026: "I want the arenas to load much faster when you
 * click on them to view them." A floor took up to 360ms of painting on
 * a desktop at the moment of the tap. Painted this way the same picture
 * is spread over many short slices between frames, so nothing waits
 * for it: the board shows a stand-in and swaps the real floor in when
 * this resolves (progressiveTexture), and the warm-up paints every
 * board the same way without stalling the menu (warmArenas.ts).
 *
 * Already cached: resolves at once. Already being painted: the same
 * promise, so two askers share one painting. `schedule` decides when
 * the next slice runs — a timer in the app, straight away in the tests.
 * `onDone` is called in the slice that finishes, before the promise
 * settles, so a caller using a synchronous scheduler can carry on
 * synchronously.
 */
export function paintInBackground(
  key: string,
  start: () => PaintJob,
  schedule: (run: () => void) => void = (run) => setTimeout(run, 0),
  onDone: (texture: THREE.Texture) => void = () => {},
): Promise<THREE.Texture> {
  const found = cache.get(key);
  if (found) {
    onDone(found);
    return Promise.resolve(found);
  }
  const going = running.get(key);
  if (going) {
    going.then(onDone).catch(() => {});
    return going;
  }
  const job = start();
  const promise = new Promise<THREE.Texture>((resolve) => {
    const slice = () => {
      const t0 = now();
      let done = job.step(2);
      while (!done && now() - t0 < PAINT_BUDGET_MS) done = job.step(2);
      if (!done) {
        schedule(slice);
        return;
      }
      cache.set(key, job.texture);
      running.delete(key);
      try {
        onDone(job.texture);
      } catch {
        // A caller that fails must not look like a failed paint.
      }
      resolve(job.texture);
    };
    schedule(slice);
  });
  running.set(key, promise);
  return promise;
}

export interface Progressive {
  /** What to show now: the real picture if it is cached, else a stand-in. */
  texture: THREE.Texture;
  /** The real picture, when it has been painted; null if `texture` already is. */
  ready: Promise<THREE.Texture> | null;
}

/**
 * The real picture if it is cached, otherwise a quick stand-in now and
 * the real one when it is painted. `quick` is cached under its own key,
 * so a board opened twice before its floor is done paints the stand-in
 * once.
 */
export function progressiveTexture(
  key: string,
  quick: () => THREE.Texture,
  start: () => PaintJob,
): Progressive {
  const found = cache.get(key);
  if (found) return { texture: found, ready: null };
  return { texture: cachedTexture(`${key}:quick`, quick), ready: paintInBackground(key, start) };
}
