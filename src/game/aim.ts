import { GestureResponderEvent, PanResponderGestureState } from 'react-native';
import { TUNING } from './tuning';

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
  options: { rotated?: boolean } = {},
): { x: number; z: number } | null {
  const speed = Math.hypot(gesture.vx, gesture.vy);
  if (speed < TUNING.throw.flickThreshold) return null;

  const { flickScale, flickMaxSpeed } = TUNING.throw;
  const clamp = (v: number) => Math.max(-flickMaxSpeed, Math.min(flickMaxSpeed, v));
  // Screen up (negative vy) throws away from the player (-z). The top zone
  // of a split screen is rotated 180°, so its axes flip.
  const sign = options.rotated ? -1 : 1;
  return {
    x: clamp(gesture.vx * flickScale * sign),
    z: clamp(gesture.vy * flickScale * sign),
  };
}
