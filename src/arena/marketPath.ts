import { ARENA_THEMES } from './themeData';

/**
 * The route the Twinkle Market's shoppers walk.
 *
 * David, 8 Nov 2026: "the people in twinkle market walk through the
 * surrounding objects so make them go around them." The shoppers used
 * to follow the same rounded rectangle as the Gingerbread Village's
 * train (boardLife.tsx `track`), a lane at x = ±3.3 that runs straight
 * through the stalls and parcel piles standing against the wall at
 * x = ±3.05, and along z = -9.25 through the trees in the far band.
 *
 * Now the route is a closed polyline built FROM the theme's own prop
 * list, so moving a stall in themeData.ts moves the detour with it: up
 * each side strip at x = ±3.3, stepping out round every prop that
 * stands in the way, and across the far band at z = -7.5, between the
 * far wall and the trees. The tests project every point through the
 * game's camera to be sure none of it leaves an iPhone's frame, and
 * measure each point's distance from each prop.
 *
 * Pure numbers, no React, so the tests can walk it.
 */

export interface RoutePoint {
  x: number;
  z: number;
}

/** The lane: how far from the centre the shoppers walk, and the ends. */
export const LANE_X = 3.3;
export const LANE_NEAR = 5.55;
/** Between the far wall (its outer face is at z = -5.1) and the trees (from about -8.4). */
export const LANE_FAR = -7.5;

/**
 * How much room each kind of prop takes on the ground, as half-widths
 * in x and z, at the scale the Twinkle Market places it. A lantern is
 * only its post at a shopper's height; its lamp is well above a hat.
 */
export const FOOTPRINT: Record<string, { hx: number; hz: number }> = {
  stall: { hx: 0.43, hz: 0.45 },
  parcels: { hx: 0.35, hz: 0.35 },
  lantern: { hx: 0.1, hz: 0.1 },
};

/** A shopper's own half-width, parcel under the arm included. */
export const SHOPPER_RADIUS = 0.2;
/** Daylight to leave between a shopper and whatever they pass. */
const MARGIN = 0.1;

/** Props the shoppers have to pass: the ones standing in a side strip with a footprint. */
export function obstacles(): { x: number; z: number; hx: number; hz: number }[] {
  return ARENA_THEMES.twinklemarket.props
    .filter((p) => Math.abs(p.x) >= 3.0 && Math.abs(p.x) <= 3.1 && FOOTPRINT[p.kind])
    .map((p) => ({ x: p.x, z: p.z, ...FOOTPRINT[p.kind] }));
}

/**
 * One side of the route, from zFrom to zTo at x = side * LANE_X,
 * stepping out round each prop on that side in the order they are met.
 */
function sideLeg(side: 1 | -1, zFrom: number, zTo: number): RoutePoint[] {
  const dir = Math.sign(zTo - zFrom);
  const inWay = obstacles()
    .filter((o) => Math.sign(o.x) === side)
    .sort((a, b) => (a.z - b.z) * dir);
  const pts: RoutePoint[] = [{ x: side * LANE_X, z: zFrom }];
  for (const o of inWay) {
    const out = side * (Math.abs(o.x) + o.hx + SHOPPER_RADIUS + MARGIN);
    const reach = o.hz + SHOPPER_RADIUS + MARGIN;
    // Approach on the lane, step out, pass, step back in.
    pts.push({ x: side * LANE_X, z: o.z - dir * (reach + 0.35) });
    pts.push({ x: out, z: o.z - dir * reach });
    pts.push({ x: out, z: o.z + dir * reach });
    pts.push({ x: side * LANE_X, z: o.z + dir * (reach + 0.35) });
  }
  pts.push({ x: side * LANE_X, z: zTo });
  return pts;
}

/**
 * The corners cut: each vertex becomes two points a little way along
 * its two edges, so a shopper turns in two half-steps rather than on
 * the spot. Short edges are left alone.
 */
function chamfer(loop: RoutePoint[], cut: number): RoutePoint[] {
  const out: RoutePoint[] = [];
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const p = loop[(i - 1 + n) % n];
    const v = loop[i];
    const q = loop[(i + 1) % n];
    const lp = Math.hypot(p.x - v.x, p.z - v.z);
    const lq = Math.hypot(q.x - v.x, q.z - v.z);
    const c = Math.min(cut, lp / 2, lq / 2);
    if (c < 0.05) {
      out.push(v);
      continue;
    }
    out.push({ x: v.x + ((p.x - v.x) / lp) * c, z: v.z + ((p.z - v.z) / lp) * c });
    out.push({ x: v.x + ((q.x - v.x) / lq) * c, z: v.z + ((q.z - v.z) / lq) * c });
  }
  return out;
}

export interface Route {
  /** The corners, in walking order; the last joins back to the first. */
  points: RoutePoint[];
  /** Distance along the route at which each point is reached. */
  at: number[];
  /** The whole way round. */
  total: number;
}

function buildRoute(): Route {
  // Clockwise seen from above: up the right side, across the far band,
  // down the left side, back along the near end.
  const loop = [
    ...sideLeg(1, LANE_NEAR, LANE_FAR),
    ...sideLeg(-1, LANE_FAR, LANE_NEAR),
  ];
  const points = chamfer(loop, 0.3);
  const at: number[] = [0];
  for (let i = 1; i <= points.length; i++) {
    const a = points[i - 1];
    const b = points[i % points.length];
    at.push(at[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
  }
  return { points, at, total: at[points.length] };
}

export const MARKET_ROUTE: Route = buildRoute();

/**
 * Where a shopper is at fraction `u` of the way round (any real number;
 * whole laps are dropped), and which way they face: the same heading
 * convention as `track` in boardLife.tsx, so Math.PI walks toward -z.
 */
export function alongRoute(route: Route, u: number, out: { x: number; z: number }): number {
  const n = route.points.length;
  const d = (((u % 1) + 1) % 1) * route.total;
  let i = 0;
  while (i < n - 1 && route.at[i + 1] <= d) i++;
  const a = route.points[i];
  const b = route.points[(i + 1) % n];
  const len = route.at[i + 1] - route.at[i];
  const t = len > 0 ? (d - route.at[i]) / len : 0;
  out.x = a.x + (b.x - a.x) * t;
  out.z = a.z + (b.z - a.z) * t;
  return Math.atan2(b.x - a.x, b.z - a.z);
}
