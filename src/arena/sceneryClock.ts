import { useEffect } from 'react';

/**
 * The slow idle life of the four hand-built battlefields: a brazier's
 * flame flickering, a pennant stirring, a station beacon blinking, a vine
 * swaying.
 *
 * It works exactly the way the water does (see water.tsx and
 * waterClock.tsx). An arena registers a tick here, and the one
 * `WaterClock` in the scene calls every registered tick from its frame
 * loop. The arena files cannot call `useFrame` themselves: they are
 * loaded by the headless test suite and by the browser preview tool,
 * and neither of those has the native renderer to import it from. A
 * scene with no clock simply holds still, which is what the preview and
 * the tests want anyway.
 *
 * Ticks must not allocate. They run every drawn frame on a phone, so
 * each one is built once, closes over the objects it moves, and only
 * writes numbers into them.
 *
 * Nothing here keeps the board drawing. The board stops rendering
 * between rolls (see the frameloop rule in DiceDemoScreen), and the life
 * stops with it — a flame that holds still while nobody is rolling costs
 * no battery, which is the right trade for decoration.
 */

export type SceneryTick = (seconds: number) => void;

/** Every tick currently mounted. Advanced by WaterClock. */
export const SCENERY_LIFE = new Set<SceneryTick>();

/**
 * Register `tick` for as long as the calling component is mounted.
 *
 * `tick` should be stable — built in a `useMemo` — or it will be
 * removed and re-added on every render.
 */
export function useSceneryTick(tick: SceneryTick | null): void {
  useEffect(() => {
    if (!tick) return;
    SCENERY_LIFE.add(tick);
    return () => {
      SCENERY_LIFE.delete(tick);
    };
  }, [tick]);
}
