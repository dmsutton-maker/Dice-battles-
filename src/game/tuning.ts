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
    /**
     * Low damping and a lively bounce: these are what make a roll look
     * like real dice. Raising them shortens rolls but the dice read as
     * tumbling through syrup, which is exactly how this drifted away from
     * feeling natural. Feel wins over the extra fraction of a second.
     */
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

  /**
   * The throw is the original one: the dice are picked up from wherever
   * they lie and tossed, and a flick sends them with the speed and
   * direction of your hand.
   *
   * Later versions launched every throw from a fixed spot at the player's
   * edge and metered its power. That is tidier and it is not how throwing
   * dice feels — the tidiness is what made it feel mechanical.
   */
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
     * Frames of stillness before a roll is called. Short because the dice
     * are FROZEN the moment a roll is called, so the face read can never go
     * stale — that safety used to cost a full extra second of waiting.
     */
    stillFrames: 5,
    /**
     * A roll is called as soon as the dice are still, and they are FROZEN
     * at that instant so the face cannot change afterwards. That freeze is
     * what makes an early call safe, and it costs nothing in feel.
     *
     * There is no artificial damping here any more: bleeding velocity off
     * a rolling die to end the roll sooner is felt immediately as the dice
     * being grabbed.
     */
    maxRollMs: 2200,
    /** Absolute backstop if a die is somehow still moving at maxRollMs. */
    hardMaxRollMs: 3200,
    /** Delay before a tap queued mid-roll fires, so the result registers. */
    queuedThrowDelayMs: 130,
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
