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

/**
 * How wide a standing figure is, including the bounce it does when it
 * arrives. Used both to keep the outermost figures on screen and to keep
 * scenery from intersecting them.
 */
export const FIGURE_RADIUS = 0.3;

/**
 * X positions of the six retreat spots on the player's side.
 *
 * Pulled in from ±3.3: the outermost figures were clipping off the sides
 * of the screen on a phone. The gap in the middle is the walkway.
 */
export const RETREAT_XS = [-2.75, -1.85, -0.95, 0.95, 1.85, 2.75];
/** Z of the retreat row. */
export const RETREAT_Z = 6.4;

/**
 * The two parasol/beacon posts. They used to stand at x ±2.4, z 5.55 —
 * directly over the figures at x ±2.4, with a canopy wide enough to
 * swallow them. Now they flank the row from further out and further back.
 */
export const RETREAT_POST_XS = [-3.3, 3.3];
export const RETREAT_POST_Z = 5.35;
/** Radius of the parasol canopy / beacon head at the top of each post. */
export const RETREAT_POST_RADIUS = 0.85;

/** Centre and rim radius of the retreat's pool feature. */
export const RETREAT_POOL: [number, number] = [-3.3, 7.9];
export const RETREAT_POOL_RADIUS = 1.1;

/** Decorative planting/crates beside the pool, kept clear of the figures. */
export const RETREAT_PROPS: [number, number][] = [
  [3.3, 7.9],
  [0, 8.0],
];
export const RETREAT_PROP_RADIUS = 0.45;

export const RETREAT_SLOTS: Slot[] = RETREAT_XS.map((x) => ({
  x,
  y: 0.03,
  z: RETREAT_Z,
  facing: 0,
}));

/** Captured prisoners paraded along the far battlement (Skirmish/War). */
/**
 * The round corner towers, shared so the arenas that draw them and the
 * tests that check nothing stands inside them agree on one set of numbers.
 * The cone roof is the widest part, so that is the radius quoted.
 */
export const CORNER_TOWER_RADIUS = 0.6;

export const CORNER_TOWERS: { x: number; z: number }[] = (() => {
  const { innerWidth, innerDepth, wallThickness } = TUNING.tray;
  const x = innerWidth / 2 + wallThickness;
  const z = innerDepth / 2 + wallThickness;
  return [
    { x: -x, z: -z },
    { x, z: -z },
    { x: -x, z },
    { x, z },
  ];
})();

/**
 * Where captured prisoners stand on top of the far wall.
 *
 * The outermost two used to sit at x ±2.5, which put them inside the
 * corner towers at ±2.8 — in Skirmish, where the opponent's rescues land
 * here, the figures came out tangled in the stonework. The row is narrower
 * now so all six clear the towers, and still spaced further apart than a
 * figure is wide.
 */
export const WALL_SLOTS: Slot[] = (() => {
  const { innerDepth, wallHeight, wallThickness } = TUNING.tray;
  const z = -(innerDepth / 2 + wallThickness / 2);
  const usable = 3.7;
  const step = usable / 5;
  return Array.from({ length: 6 }, (_v, i) => ({
    x: -usable / 2 + i * step,
    y: wallHeight + 0.26,
    z,
    facing: 0,
  }));
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
