import { TUNING } from './tuning';
import { Station } from './modes';

/**
 * Where a prisoner figure stands for each station, in world coordinates.
 *
 * These live here rather than inside the Prisoners component because the
 * arenas have to build their scenery around them — the jail pen, the
 * retreat towels/pads, and the battlement parade all have to line up with
 * the figures in EVERY arena. Keeping one source of truth means a new arena
 * can't quietly drift out of alignment, and the test suite asserts it.
 */
export interface Slot {
  x: number;
  y: number;
  z: number;
  /** Y rotation the figure faces while idling here. */
  facing: number;
}

/** Six cells across the jail pen behind the far wall. */
export const JAIL_SLOTS: Slot[] = (() => {
  const { innerDepth, wallThickness } = TUNING.tray;
  const pen = TUNING.prison;
  const z = -(innerDepth / 2 + wallThickness + pen.depth / 2);
  const usable = pen.innerWidth - 0.8;
  const step = usable / 5;
  return Array.from({ length: 6 }, (_v, i) => ({
    x: -usable / 2 + i * step,
    y: pen.platformHeight,
    z,
    facing: 0,
  }));
})();

/** X positions of the six retreat spots on the player's side. */
export const RETREAT_XS = [-3.3, -2.4, -1.5, 1.5, 2.4, 3.3];
/** Z of the retreat row, and of the two parasol/beacon posts behind it. */
export const RETREAT_Z = 6.4;
export const RETREAT_POST_XS = [-2.4, 2.4];
export const RETREAT_POST_Z = 5.55;
/** Centre of the retreat's pool feature. */
export const RETREAT_POOL: [number, number] = [-2.9, 7.6];

export const RETREAT_SLOTS: Slot[] = RETREAT_XS.map((x) => ({
  x,
  y: 0.03,
  z: RETREAT_Z,
  facing: 0,
}));

/** Captured prisoners paraded along the far battlement (Skirmish/War). */
export const WALL_SLOTS: Slot[] = (() => {
  const { innerDepth, wallHeight, wallThickness } = TUNING.tray;
  const z = -(innerDepth / 2 + wallThickness / 2);
  const xs = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
  return xs.map((x) => ({ x, y: wallHeight + 0.26, z, facing: 0 }));
})();

export function slotFor(station: Station): Slot {
  const list =
    station.kind === 'jail'
      ? JAIL_SLOTS
      : station.kind === 'retreat'
        ? RETREAT_SLOTS
        : WALL_SLOTS;
  return list[Math.min(station.index, list.length - 1)];
}
