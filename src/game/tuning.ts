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
  gravity: -44,

  physics: {
    /** Fixed physics timestep (s). */
    timeStep: 1 / 60,
    /** Max catch-up substeps per frame. */
    maxSubSteps: 4,
    dieMass: 1,
    /**
     * Damping and friction are deliberately high: the exciting part of a
     * roll is the first ~0.4s of tumbling, while the slow creep at the end
     * is dead time the player waits through (rolls are locked until the
     * dice stop). These values kill the creep without flattening the
     * tumble — verified by simulation, see settle timings in the README.
     */
    linearDamping: 0.2,
    angularDamping: 0.4,
    /** Die vs tray contact. */
    trayFriction: 0.38,
    trayRestitution: 0.34,
    /** Die vs die contact. */
    dieFriction: 0.1,
    dieRestitution: 0.5,
    /** Aggressive sleep thresholds so a resting die is detected fast. */
    sleepSpeedLimit: 0.6,
    sleepTimeLimit: 0.12,
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
   * The throw follows the player's hand: you flick, and the dice leave your
   * edge of the board carrying the speed and direction you flicked.
   *
   * This requires throwing on RELEASE rather than touch-down, because a
   * gesture's velocity is not knowable until the finger lifts. Throwing on
   * touch-down predates the roll lock, and once rolls became binding for
   * about a second it bought nothing — while making a real flick
   * impossible, since every throw left before the hand had moved.
   */
  throw: {
    /** Where the dice leave the hand: player's edge, slightly raised. */
    handZ: 3.4,
    handY: 1.0,
    /** Sideways offset of each die at the hand, so they don't start fused. */
    handSpread: 0.75,

    /** Gesture velocity (points/ms) -> world speed. */
    flickScale: 11,
    /** Ceiling on flick speed, so a violent swipe cannot break the tray. */
    flickMaxSpeed: 15,
    /** A gesture slower than this counts as a tap, not a flick. */
    flickThreshold: 0.28,
    /** Lift added to a flick, scaled a little by how hard it was thrown. */
    flickUpMin: 3.2,
    flickUpMax: 5.0,
    /** Smallest forward speed a flick gets, so a weak one still travels. */
    flickMinForward: 5.5,

    /**
     * A plain tap: a solid roll away from the player. Tapping is the
     * frantic-race input, so it still has to carry the dice down the board
     * — a limp tap reads as the dice barely leaving your hand.
     */
    tapForwardMin: 7.4,
    tapForwardMax: 9.2,
    tapUpMin: 3.2,
    tapUpMax: 4.4,
    tapLateral: 1.6,

    /** Randomness on every throw, so no two rolls are identical. */
    lateralJitter: 0.7,
    /** Tumble: random angular speed per axis (rad/s). */
    spinMin: 12,
    spinMax: 28,
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
     * Settle assist. A die that is down but still creeping gets its
     * velocity bled off, gently at first and firmer the longer it refuses
     * to stop, so it glides to rest instead of wandering the tray. Applied
     * only to dice already on the floor — damping a falling die would make
     * it float down. Starts shortly after the dice land: with the hand
     * throw they travel before settling, and waiting longer left a heavy
     * tail of slow rolls on Hard, where obstacles keep them moving.
     */
    assistAfterMs: 285,
    assistStartFactor: 0.93,
    assistEndFactor: 0.72,
    assistRampMs: 700,
    /**
     * Soft ceiling on a roll: past this the assist clamps down hard so any
     * stragglers glide to a stop within a few frames rather than being
     * snapped still, and the roll is called as soon as they are slow.
     */
    maxRollMs: 1400,
    hardStopFactor: 0.55,
    /** Absolute backstop if a die is somehow still airborne at maxRollMs. */
    hardMaxRollMs: 2600,
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
