import { ARENA_THEMES } from './themeData';

/*
 * The pirate cove's shark, the pure half: where it swims, where the
 * boats sit, and when it goes UNDER one. No three.js and no React in
 * here, so the tests can import it (CoveShark in boardLife.tsx is the
 * half that draws it).
 *
 * David, 1 Nov 2026: "In the pirates cove the shark goes over the boats
 * and overlaps with them, make it swim under them."
 *
 * The cove's sea is painted on an opaque ground at y = 0, so a shark
 * whose y is below zero is simply hidden. The dive is made to read as
 * going UNDER the boat, not as vanishing, by being short, smooth and
 * tilted: the nose dips first on the way in, and on the way out the nose
 * comes up and the dorsal fin breaks the surface before the back does.
 * An earlier shark that vanished for a couple of seconds got a complaint
 * (David, 20 Oct 2026), so it dives ONLY where a boat is, and for no
 * longer than the boat needs.
 */

/* ── The lap ──────────────────────────────────────────────────────── */

/**
 * The shark's lanes: inner going round the bow, outer coming back. The
 * strip of sea between the hull and the edge of an iPhone 15's screen is
 * only about 0.6 wide, and narrowest toward the player, so the lanes are
 * close together (one shark, never on both at once) and the U-turns come
 * at about the middle of the ship, where the strip is still wide enough
 * to see the whole shark.
 */
export const SHARK_IN = 3.6;
export const SHARK_OUT = 3.78;
export const SHARK_FAR = -6.4;
export const SHARK_NEAR = -2.2;
/** How far past SHARK_NEAR the U-turns swing, so they are wide, not a spin. */
export const SHARK_DIP = 1.3;
const SHARK_TURN = (SHARK_OUT - SHARK_IN) / 2;
/** Half the perimeter of the U-turn's half-ellipse (Ramanujan). */
const SHARK_UTURN =
  (Math.PI * (3 * (SHARK_TURN + SHARK_DIP) - Math.sqrt((3 * SHARK_TURN + SHARK_DIP) * (SHARK_TURN + 3 * SHARK_DIP)))) / 2;
const SHARK_STRAIGHT = SHARK_NEAR - SHARK_FAR;
export const SHARK_LAP = 4 * SHARK_STRAIGHT + Math.PI * SHARK_IN + Math.PI * SHARK_OUT + 2 * SHARK_UTURN;
/** World units a second. */
export const SHARK_SPEED = 1.6;

/** Anything with an x and a z, so a THREE.Vector3 fits. */
export interface PathPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * A point on the shark's lap, `u` 0..1, written into `out` (at y 0);
 * returns the heading for a thing built nose toward +z. Up the left side
 * on the inner lane, round behind the bow, down the right side, a U-turn
 * out to the outer lane, back up the right side, round the bow the other
 * way, down the left side, and a U-turn back in to where it started.
 */
export function sharkPath(u: number, out: PathPoint): number {
  let d = (((u % 1) + 1) % 1) * SHARK_LAP;
  const a = SHARK_IN;
  const b = SHARK_OUT;
  const zF = SHARK_FAR;
  const zN = SHARK_NEAR;
  out.y = 0;
  const uturn = (cx: number, f: number) => {
    // A half-ellipse bulging toward the player, f 0..1.
    const phi = f * Math.PI;
    out.x = cx - SHARK_TURN * Math.cos(phi);
    out.z = zN + SHARK_DIP * Math.sin(phi);
    return Math.atan2(SHARK_TURN * Math.sin(phi), SHARK_DIP * Math.cos(phi));
  };
  const at = (x: number, z: number) => {
    out.x = x;
    out.z = z;
  };
  // 1. Left side, inner lane, swimming away from the player.
  if (d < SHARK_STRAIGHT) { at(-a, zN - d); return Math.PI; }
  d -= SHARK_STRAIGHT;
  // 2. Round behind the bow, inner lane, left to right.
  if (d < Math.PI * a) {
    const phi = d / a;
    at(-a * Math.cos(phi), zF - a * Math.sin(phi));
    return Math.atan2(Math.sin(phi), -Math.cos(phi));
  }
  d -= Math.PI * a;
  // 3. Right side, inner lane, toward the player.
  if (d < SHARK_STRAIGHT) { at(a, zF + d); return 0; }
  d -= SHARK_STRAIGHT;
  // 4. The U-turn out to the right's outer lane.
  if (d < SHARK_UTURN) return uturn((a + b) / 2, d / SHARK_UTURN);
  d -= SHARK_UTURN;
  // 5. Right side, outer lane, away from the player.
  if (d < SHARK_STRAIGHT) { at(b, zN - d); return Math.PI; }
  d -= SHARK_STRAIGHT;
  // 6. Round behind the bow, outer lane, right to left.
  if (d < Math.PI * b) {
    const phi = d / b;
    at(b * Math.cos(phi), zF - b * Math.sin(phi));
    return Math.atan2(-Math.sin(phi), -Math.cos(phi));
  }
  d -= Math.PI * b;
  // 7. Left side, outer lane, toward the player.
  if (d < SHARK_STRAIGHT) { at(-b, zF + d); return 0; }
  d -= SHARK_STRAIGHT;
  // 8. The U-turn back in to the left's inner lane.
  return uturn(-(a + b) / 2, Math.min(1, d / SHARK_UTURN));
}

/* ── The boats ────────────────────────────────────────────────────── */

/*
 * The hull is drawn by ThemedArena.tsx's ShipMast: the bottom half of a
 * sphere of radius 1.4, squashed to 0.5 deep (z) and 0.55 high, set on
 * a group scaled by the prop's `scale`. So from above it is an ellipse
 * 1.4 * scale across (x) and 0.7 * scale deep (z), and that is the
 * footprint, widest at its rim. tests/coveShark.test.ts reads
 * ThemedArena.tsx and fails if these two drift from what is drawn.
 */
export const HULL_HALF_LENGTH = 1.4;
export const HULL_HALF_BEAM = 1.4 * 0.5;

/** Extra room round the drawn hull, so the shark is clear of the rim. */
export const HULL_MARGIN = 0.1;

export interface HullFootprint {
  x: number;
  z: number;
  /** Half-width along x, margin included. */
  rx: number;
  /** Half-depth along z, margin included. */
  rz: number;
}

/** Every boat in the cove, as the ellipse of sea it covers. */
export const COVE_HULLS: readonly HullFootprint[] = ARENA_THEMES.cove.props
  .filter((p) => p.kind === 'shipMast')
  .map((p) => ({
    x: p.x,
    z: p.z,
    rx: HULL_HALF_LENGTH * (p.scale ?? 1) + HULL_MARGIN,
    rz: HULL_HALF_BEAM * (p.scale ?? 1) + HULL_MARGIN,
  }));

/* ── The dive ─────────────────────────────────────────────────────── */

/**
 * How deep it goes under a boat. The shark stands about 0.45 tall (fin
 * and all), so this is enough to hide all of it under the ground.
 */
export const DIVE_DEPTH = 0.6;
/**
 * How far from the edge of a footprint the dive starts, in world units:
 * at 1.6 a second that is about a quarter of a second down and a quarter
 * of a second back up.
 */
export const DIVE_RUN = 0.4;
/**
 * How far ahead of and behind the shark's middle the nose and tail are,
 * for working out whether they are over a boat. It is longer than a
 * boat is wide, so a shark under a boat has its middle under it and
 * its nose and tail are the last bits to go in and the first to come
 * out. Without this the nose and tail swim over the rim.
 */
export const SHARK_NOSE = 0.7;
export const SHARK_TAIL = 0.6;
/** The steepest it ever tilts, radians, however sharp the dive. */
export const DIVE_MAX_PITCH = 0.5;

const smooth = (t: number) => {
  const c = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

/**
 * How far below the surface a thing at (x, z) would be: 0 in open water,
 * -DIVE_DEPTH once inside a footprint, easing between the two over
 * DIVE_RUN of sea round the edge. Never positive.
 */
export function diveDepthAt(x: number, z: number): number {
  let deepest = 0;
  for (let i = 0; i < COVE_HULLS.length; i++) {
    const h = COVE_HULLS[i];
    const dx = x - h.x;
    const dz = z - h.z;
    const q = Math.sqrt((dx * dx) / (h.rx * h.rx) + (dz * dz) / (h.rz * h.rz));
    // Distance from the footprint's edge along the line to its middle.
    const outside = q <= 1 ? 0 : (Math.sqrt(dx * dx + dz * dz) * (q - 1)) / q;
    const depth = -DIVE_DEPTH * (1 - smooth(outside / DIVE_RUN));
    if (depth < deepest) deepest = depth;
  }
  return deepest;
}

/** Where the shark sits relative to the water, written by `sharkPose`. */
export interface SharkPose {
  /** Added to the shark's resting height; 0 at the surface, negative under. */
  dive: number;
  /** Nose-down is positive, radians. */
  pitch: number;
}

/**
 * The shark's height and tilt for a body whose middle is at (x, z) and
 * which faces `heading` (nose toward +z at heading 0). Three places are
 * looked at, the nose, the middle and the tail, and the shark is never
 * higher than any of them allows, so no part of it is above a boat's
 * rim. The tilt follows the slope between nose and tail: nose first
 * going in, nose first coming out, and a dorsal fin standing alone in
 * between because it is the tallest part.
 */
export function sharkPose(x: number, z: number, heading: number, out: SharkPose): SharkPose {
  const sx = Math.sin(heading);
  const sz = Math.cos(heading);
  const nose = diveDepthAt(x + sx * SHARK_NOSE, z + sz * SHARK_NOSE);
  const mid = diveDepthAt(x, z);
  const tail = diveDepthAt(x - sx * SHARK_TAIL, z - sz * SHARK_TAIL);
  const slope = (tail - nose) / (SHARK_NOSE + SHARK_TAIL);
  // The line from nose to tail, read at the middle.
  const line = nose + slope * SHARK_NOSE;
  out.dive = Math.min(mid, line);
  out.pitch = Math.max(-DIVE_MAX_PITCH, Math.min(DIVE_MAX_PITCH, Math.atan(slope)));
  return out;
}
