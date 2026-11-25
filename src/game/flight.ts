import { TUNING } from './tuning';

/**
 * The arc a prisoner figure follows when it leaps between stations.
 *
 * Kept out of `Prisoners.tsx` so it can be tested headlessly — that file
 * pulls in `@react-three/fiber/native` and `three`, neither of which run
 * under the plain Node test harness. Same split as `settle.ts` and
 * `slider.ts`.
 */

export interface FlightPoint {
  x: number;
  y: number;
  z: number;
}

export const FLIGHT_SECONDS = 1.4;

/** How high above the higher end of the trip the figure arcs. */
export const FLIGHT_LIFT = 3.4;

/**
 * The highest a figure is ever allowed to reach.
 *
 * A leap adds its lift on top of wherever the figure IS, and in Ultimate
 * mode a figure can be sent back to jail while still in the air from
 * being rescued — a fast double-match. Without a ceiling the second leap
 * stacks a full arc on top of an already-airborne figure and it rockets
 * toward the invisible roof at y=6.5, well out of the camera's framing.
 *
 * 4.6 is chosen so an ordinary ground-to-ground leap is completely
 * unaffected (it peaks around 4.0) and only the stacked case is reined
 * in. Comfortably above the castle wall at 1.4 plus its merlons.
 */
export const FLIGHT_APEX = 4.6;

/**
 * How much lift this particular leap gets.
 *
 * A leap starting on the ground gets the full arc. One starting mid-air
 * gets only whatever headroom is left below the apex — so interrupting a
 * leap can never launch the figure higher than an ordinary one.
 */
export function liftFor(from: FlightPoint, to: FlightPoint): number {
  const highestEnd = Math.max(from.y, to.y);
  return Math.min(FLIGHT_LIFT, Math.max(0, FLIGHT_APEX - highestEnd));
}

/** Smoothstep: eases out of the launch and into the landing. */
export function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Where the figure is, part-way through a leap.
 *
 * `t` is clamped to 0..1 on the way in. The render clock is not something
 * this module controls — a paused canvas, a backgrounded app or a clock
 * reset can hand it a negative or wild `t`, and an unclamped smoothstep
 * turns that into a figure flung far outside the arena.
 */
export function flightAt(from: FlightPoint, to: FlightPoint, t: number): FlightPoint {
  const clamped = Math.min(1, Math.max(0, t));
  const e = ease(clamped);
  return {
    x: from.x + (to.x - from.x) * e,
    y:
      from.y +
      (to.y - from.y) * e +
      Math.sin(Math.PI * clamped) * liftFor(from, to),
    z: from.z + (to.z - from.z) * e,
  };
}

/** The top of the tray's playable box — where the dice live. */
export const TRAY_HALF_DEPTH = TUNING.tray.innerDepth / 2;
export const TRAY_HALF_WIDTH = TUNING.tray.innerWidth / 2;
/** A die resting on the floor reaches this high. */
export const DIE_TOP = TUNING.dieSize;

/** True while the figure is above the playable area, where the dice are. */
export function isOverTray(p: FlightPoint): boolean {
  return Math.abs(p.z) <= TRAY_HALF_DEPTH && Math.abs(p.x) <= TRAY_HALF_WIDTH;
}

/**
 * The lowest the figure gets while crossing over the dice, sampled along
 * the whole leap. Infinity when the leap never crosses the tray at all.
 */
export function lowestOverTray(from: FlightPoint, to: FlightPoint, samples = 240): number {
  let lowest = Infinity;
  for (let i = 0; i <= samples; i++) {
    const p = flightAt(from, to, i / samples);
    if (isOverTray(p) && p.y < lowest) lowest = p.y;
  }
  return lowest;
}

/** The highest point of a leap, sampled along its whole path. */
export function peakOf(from: FlightPoint, to: FlightPoint, samples = 240): number {
  let peak = -Infinity;
  for (let i = 0; i <= samples; i++) {
    const p = flightAt(from, to, i / samples);
    if (p.y > peak) peak = p.y;
  }
  return peak;
}
