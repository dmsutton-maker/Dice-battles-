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
    /**
     * The floor under every roll: dice must actually ROLL for this long
     * before a result may be read off them.
     *
     * This was the 24 Aug 2026 answer to David's "you're able to just spam
     * as fast as you can and get every color in only a matter of seconds",
     * and on 25 Aug he reported the same bug again: "they should have to
     * fully land for it to count as getting the color."
     *
     * He was right, and the suite had the proof in it the whole time —
     * hurried rolls measured median 650ms AND p95 650ms, exactly this
     * number, on every single roll. That is not what a floor looks like.
     * It was the DURATION of a spammed roll: the hurried path fired on the
     * first frame past the floor, so dice needing ~1500ms to come to rest
     * were read at 650 and snapped onto a face in mid-air. Trading one
     * frame for 650ms made the exploit slower, not gone.
     *
     * So the hurried early-exit is deleted (see `shouldCallRoll`) and a
     * roll now ends when the dice are at REST. This number goes back to
     * being what it claims to be: cover for a feather-light throw that
     * could satisfy `stillFrames` almost immediately. In ordinary play
     * nothing reaches it — the dice are still tumbling at 650ms.
     */
    minRollMs: 650,
    /** Delay before a tap queued mid-roll fires, so the result registers. */
    queuedThrowDelayMs: 130,
    /**
     * The pause after the dice land before a tap that arrived mid-roll
     * goes out, for a player who has already tapped: they have been
     * watching and are waiting on it, so they get a short one rather than
     * `queuedThrowDelayMs`.
     *
     * This is now the ONLY thing tapping early changes. It used to also
     * end the roll in flight, which is the bug above.
     *
     * `hurriedSpeed` and `hurriedFlatness` used to sit here, described as
     * bars a hurried roll had to clear — "moving slowly enough" and "lying
     * flat enough". Nothing read them. They were left behind when
     * `isReadable` was deleted, and they made the file describe a safety
     * check the game had not performed for weeks, which is worse than
     * having no comment at all. Removed with the path they belonged to.
     */
    hurriedThrowDelayMs: 34,
    /**
     * Flat enough that the top face is unambiguous. 1 is square, 0.707 is
     * balanced on an edge, 0.577 on a corner.
     *
     * A die that has stopped is NOT automatically flat, which is easy to
     * assume and wrong: simulated rolls find dice resting motionless at
     * 0.62 — about 52 degrees, wedged against a wall or perched on an
     * obstacle. Stopped and flat are two different questions.
     *
     * NOTHING READS THIS SINCE 10 Sep 2026. Anything below the bar used
     * to be turned square before the result was shown, and David asked
     * for that to stop: "when a dice lands too close to the wall and
     * doesn't land flat, it teleports down to be flat, but don't make it
     * do that, just make it count whatever's on top". The number is kept
     * because putting the righting back is one line in DiceScene and
     * this is the line it would need.
     */
    flatEnough: 0.999,
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

  /**
   * The Fire dice (src/dice/diceFire.ts): flames while they roll, and a
   * burst of steam when one goes under in the moat.
   *
   * David, 29 Sep 2026, after a preview page: "make a pair of dice that
   * are on fire ... and if it lands in the water, then it shows the fire
   * going out and smoke coming up."
   *
   * Everything here is looks, never rules. The fire has no body in the
   * physics world and nothing in settle.ts can see it, so no number on
   * this block can change what a roll counts.
   */
  fire: {
    /** Particle budget for flames and sparks, both dice together. */
    hotParticles: 700,
    /** Particle budget for smoke, steam and splash droplets. */
    softParticles: 520,
    /** Flames born per second per die at full heat, while tumbling. */
    flameRateMoving: 110,
    /** ...and once the die is still. A resting fire is a lower one. */
    flameRateStill: 90,
    /** Heat a still die burns at, where 1 is a die in flight. */
    stillHeat: 0.85,
    /** Seconds a flame lives, before the heat scales it. */
    flameLife: [0.4, 0.8] as const,
    /** Flame sprite size in world units at birth and at death. */
    flameSize: [0.66, 0.14] as const,
    /**
     * Upward pull on a flame, world units per second squared.
     *
     * Low. At 5.5 a flame had climbed two whole units — two dice
     * heights — before it died, so the fire rose off the die as a column
     * of faint dots and the die itself looked barely lit.
     */
    flameLift: 2,
    /** Upward speed a flame is born with, low and high. */
    flameRise: [0.5, 1.3] as const,
    /** How much of the die's own speed a new flame carries. Low, so the fire trails. */
    inherit: 0.12,
    /** Heat lost per second under water: 1 to out in under half a second. */
    quenchRate: 2.4,
    /** Seconds the pool keeps steaming after a die goes in. */
    steamSeconds: 4,
    /** Seconds a doused die keeps smoking once it is back on the board. */
    smoulderSeconds: 5,
    /** Scorch mark left where a burning die lands, as a width in world units. */
    scorchSize: 1.5,
  },

  /**
   * Scorch and frost left on the ground by the Fire and Ice dice
   * (src/dice/groundMarks.ts). David, 30 Sep 2026: "remove the char
   * after a few seconds".
   */
  marks: {
    /** How many can be on the ground at once; the oldest is reused. */
    capacity: 14,
    /** Seconds a mark stays at full strength... */
    holdSeconds: 2.5,
    /** ...and then takes to fade away. */
    fadeSeconds: 1.8,
  },

  /**
   * The Ice dice (src/dice/diceIce.ts): cold mist while they roll, frost
   * where they land, and a moat that freezes over with the die stuck
   * half out of it.
   *
   * David, 30 Sep 2026: "dice made of ice and when it touches the ground,
   * it freezes the ground around it a little bit and maybe freezes the
   * pond and you see it like half sticking out of the pond frozen."
   *
   * Looks only, like the fire. A die that freezes the pond still sinks
   * and is fished out on the same clock as any other die.
   */
  ice: {
    hotParticles: 360,
    softParticles: 520,
    /** Cold mist per second per die, tumbling and at rest. */
    mistRateMoving: 45,
    mistRateStill: 22,
    /** Sparkles per second per die. */
    glintRate: 7,
    /** Frost patch left where a die lands, as a width in world units. */
    frostSize: 1.35,
    /**
     * How far below the ice the centre of a frozen-in die sits. Zero is
     * exactly half in, half out; a little under reads as sunk in.
     */
    heldDepth: 0.06,
    /** Seconds the freeze takes to spread across the pond. */
    freezeSeconds: 0.35,
    /** Seconds the pond stays frozen, and then takes to thaw. */
    frozenSeconds: 5,
    thawSeconds: 1.5,
  },
} as const;
