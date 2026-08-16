/**
 * Every knob that affects how the dice FEEL, in one place.
 *
 * This file is the iteration surface for the dice-feel milestone: tweak,
 * reload in Expo Go, re-roll. Units are world units (1 die ≈ 0.9 units).
 * Gravity is deliberately much stronger than 9.82 — at dice scale, real
 * gravity feels floaty; snappy arcade gravity is what makes rolls read as
 * quick and physical.
 */
export const TUNING = {
  /** World-units size of a die cube. */
  dieSize: 0.9,

  /** Stronger-than-real gravity for snappy, weighty tumbles. */
  gravity: -34,

  physics: {
    /** Fixed physics timestep (s). */
    timeStep: 1 / 60,
    /** Max catch-up substeps per frame. */
    maxSubSteps: 4,
    dieMass: 1,
    linearDamping: 0.08,
    angularDamping: 0.1,
    /** Die vs tray contact. */
    trayFriction: 0.24,
    trayRestitution: 0.42,
    /** Die vs die contact. */
    dieFriction: 0.1,
    dieRestitution: 0.5,
    sleepSpeedLimit: 0.3,
    sleepTimeLimit: 0.35,
  },

  tray: {
    /**
     * Inner playable area (x = width, z = depth toward the player).
     * Portrait-shaped on purpose: phone screens are tall and narrow, and the
     * camera auto-fits the whole arena (see src/demo/cameraFit.ts), so the
     * closer the arena's footprint matches a phone aspect, the bigger
     * everything renders.
     */
    innerWidth: 4.6,
    innerDepth: 9.2,
    wallHeight: 1.4,
    wallThickness: 0.5,
    /** Invisible ceiling so wild flicks never leave the camera view. */
    ceilingHeight: 6.5,
  },

  /** The jail pen attached behind the far castle wall where prisoners wait. */
  prison: {
    /** Pen width (x). Prisoners line up across it. */
    innerWidth: 4.4,
    /** Pen depth (z), extending away from the far wall. */
    depth: 1.6,
    /**
     * Height of the stone platform the pen sits on. Raised so the whole
     * prisoner figure is visible over the castle's far wall from the
     * near-top-down camera — at ground level the wall hid their bodies.
     */
    platformHeight: 1.15,
    /** Iron bar height around the pen. */
    barHeight: 1.15,
  },

  throw: {
    /** Tap: upward pop range. */
    tapUpMin: 7.5,
    tapUpMax: 10.5,
    /** Tap: random sideways scatter. */
    tapLateral: 3.2,
    /** Flick: gesture velocity (pt/ms) -> world velocity multiplier. */
    flickScale: 9,
    /** Flick: max horizontal world speed. */
    flickMaxSpeed: 14,
    /** Flick: fixed upward pop added to any flick. */
    flickUp: 6.5,
    /** Gesture speed (pt/ms) above which a release counts as a flick. */
    flickThreshold: 0.35,
    /** Tumble: random angular speed per axis (rad/s). */
    spinMin: 8,
    spinMax: 24,
  },

  settle: {
    /** Both dice slower than this (linear + angular) counts as still. */
    speedThreshold: 0.28,
    /**
     * FALLBACK ONLY: the primary settle signal is cannon's sleep state
     * (immovable once asleep, so face reads can't go stale). This counter
     * only fires if a body somehow never sleeps.
     */
    stillFrames: 45,
  },

  haptics: {
    /**
     * Min impact velocity along contact normal to fire a tick + click.
     * Kept high so only meaty hits register — the full throw recording
     * already carries the roll sound; accents should be occasional.
     */
    collisionMinImpact: 3.0,
    /** Min ms between collision haptic ticks / click accents. */
    collisionCooldownMs: 130,
  },
} as const;
