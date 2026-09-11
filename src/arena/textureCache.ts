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
}
