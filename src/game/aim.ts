import { GestureResponderEvent, PanResponderGestureState } from 'react-native';
import { TUNING } from './tuning';

export interface TouchSample {
  x: number;
  y: number;
  /** Milliseconds, from any monotonic clock. */
  t: number;
}

/**
 * Speed and direction from the TAIL of a gesture, in points per ms.
 *
 * PanResponder's own vx/vy is a running average over the whole gesture and
 * collapses toward zero if the finger slows or pauses before lifting — so
 * a real flick that ended with a moment's hesitation was read as a tap and
 * the dice rolled gently forward instead of going where they were thrown.
 * That is the "dice do not respond to your finger" complaint.
 *
 * Measuring only the last `windowMs` of movement answers what the finger
 * was doing at the moment of release, which is what a throw is.
 */
export function velocityFromSamples(
  samples: TouchSample[],
  windowMs = 90,
): { vx: number; vy: number } {
  if (samples.length < 2) return { vx: 0, vy: 0 };
  const last = samples[samples.length - 1];

  // Walk back to the oldest sample still inside the window, always keeping
  // at least one earlier point so a fast flick with few samples still reads.
  let first = samples[samples.length - 2];
  for (let i = samples.length - 2; i >= 0; i--) {
    first = samples[i];
    if (last.t - samples[i].t >= windowMs) break;
  }

  const dt = last.t - first.t;
  if (dt <= 0) return { vx: 0, vy: 0 };
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
}

/**
 * Was this touch a graze — too quick AND too still to have been meant?
 *
 * Marc, 5 Nov 2026: "If someone swipes twice too fast and doesn't even
 * really touch it the second time it automatically rolls the second time
 * but it shouldn't." The second touch of a hurried double swipe is a few
 * frames long and barely moves. A deliberate tap lasts longer; a flick
 * travels. Both bars are in tuning.ts (`throw.minTouchMs`,
 * `throw.minTouchPx`), and both have to be under for a graze, so neither
 * a quick flick nor a slow press is ever thrown away.
 *
 * `durationMs` is the whole gesture, grant to release, measured by the
 * caller: the sample list only keeps the tail, so it cannot say how long
 * the finger was down. Travel is the furthest any sample got from the
 * first one kept.
 */
export function isGraze(samples: readonly TouchSample[], durationMs: number): boolean {
  if (durationMs >= TUNING.throw.minTouchMs) return false;
  if (samples.length === 0) return true;
  const first = samples[0];
  let travel = 0;
  for (const s of samples) travel = Math.max(travel, Math.hypot(s.x - first.x, s.y - first.y));
  return travel < TUNING.throw.minTouchPx;
}

/**
 * Turn a finished gesture into a throw.
 *
 * Read on RELEASE, because a flick's speed and direction only exist once
 * the finger lifts — that is the whole reason the throw waits for release
 * rather than firing on touch-down. A slow gesture is a tap, and a tap is
 * thrown as a gentle roll (returns null: the caller throws with defaults).
 */
export function flickFromGesture(
  gesture: PanResponderGestureState,
  options: { rotated?: boolean; velocity?: { vx: number; vy: number } } = {},
): { x: number; z: number } | null {
  // Prefer the measured tail when the caller tracked one; fall back to
  // PanResponder's average, which is all that is available otherwise.
  const measured = options.velocity;
  const useMeasured =
    measured !== undefined &&
    Math.hypot(measured.vx, measured.vy) > Math.hypot(gesture.vx, gesture.vy);
  const vx = useMeasured ? measured!.vx : gesture.vx;
  const vy = useMeasured ? measured!.vy : gesture.vy;

  const speed = Math.hypot(vx, vy);
  if (speed < TUNING.throw.flickThreshold) return null;

  const { flickScale, flickMaxSpeed } = TUNING.throw;
  const clamp = (v: number) => Math.max(-flickMaxSpeed, Math.min(flickMaxSpeed, v));
  // Screen up (negative vy) throws away from the player (-z). The top zone
  // of a split screen is rotated 180°, so its axes flip.
  const sign = options.rotated ? -1 : 1;
  return {
    x: clamp(vx * flickScale * sign),
    z: clamp(vy * flickScale * sign),
  };
}
