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
    /**
     * A GRAZE is not a throw. A touch that lasted under `minTouchMs` AND
     * moved under `minTouchPx` is the back of a finger brushing the
     * screen on the way past — the second touch of a swipe made twice
     * too fast — and rolls nothing. Marc, 5 Nov 2026: "If someone swipes
     * twice too fast and doesn't even really touch it the second time it
     * automatically rolls the second time but it shouldn't." Both have to
     * hold: a fast flick is short but travels, and a deliberate press
     * stays put but lasts. The one exception is the first touch of a
     * round on an idle board, which is a tap however light (aim.ts,
     * isGraze; DiceDemoScreen.tsx, onPanResponderRelease).
     *
     * 60 ms is about four frames; a meant tap, even a child's, holds the
     * glass longer than that. 6 pt is under the width of a fingertip's
     * wobble, so a still finger qualifies and a flick never does.
     */
    minTouchMs: 60,
    minTouchPx: 6,
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
    /*
      `queuedThrowDelayMs` (130) and `hurriedThrowDelayMs` (34) used to
      sit here: the pause after the dice landed before a tap that had
      arrived mid-roll was thrown by itself. Tapping early used to end the
      roll in flight (the bug above), then only shorten that pause, and
      since 5 Nov 2026 it does nothing at all — Marc: "If someone swipes
      twice too fast and doesn't even really touch it the second time it
      automatically rolls the second time but it shouldn't." A touch
      during a roll is ignored (DiceScene.tsx, throwAll), so there is no
      pause to tune. `hurriedSpeed` and `hurriedFlatness` went the same
      way earlier, when `isReadable` was deleted.
    */
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
    /**
     * Min impact for the soft tap and squash when a die glances off the
     * bump (DiceScene). Lower than a full tick: the bump is the thing you
     * are trying to roll around, so touching it at all is worth a nudge.
     */
    moundMinImpact: 1.0,
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
  /**
   * The Neon die's light (diceNeon.ts), 20 Oct 2026. Looks only, like
   * Fire and Ice: none of this reaches the physics.
   */
  neon: {
    particles: 420,
    /** World units a die travels between two dots of its trail. */
    trailSpacing: 0.07,
    /** Seconds a trail dot glows before it is gone. */
    trailLife: 0.55,
    /** Dots in the ring of light where a die comes to rest. */
    landingRing: 36,
    /** How fast that ring spreads across the floor, units a second. */
    landingSpeed: 2.6,
    /*
      THE TUBES THEMSELVES move since 1 Nov 2026 (neonGlow.ts). David:
      "make it more interactive with moving details and stuff." A head
      of light chases round each tube, the whole tube breathes, its
      colour drifts, it stutters now and then like a real sign, the
      bends sparkle and the tube flares the moment the die lands. All of
      it on the GPU from one map painted once; none of it on the stickers.
    */
    /** Seconds the head of light takes to go once round the die. */
    pulseLapSeconds: 2.4,
    /** How sharply the light fades behind the head: bigger is a shorter tail (16 is about a third of a side). */
    pulseTail: 16,
    /**
     * How much light the head adds on top of the painted tube. Added in
     * linear light, where a little goes a long way: 1.4 turned the whole
     * tube white in the preview.
     */
    pulseGain: 0.9,
    /** How far out from the middle of a tube the light reaches, in texels. */
    pulseReach: 4,
    /** Seconds of one slow breath, and how far the tube dims and brightens (0.15 is 85% to 115%). */
    breathSeconds: 3.2,
    breathDepth: 0.15,
    /**
     * A real sign's stutter: every `flickerEvery` seconds there is a
     * `flickerChance` chance of one, lasting `flickerSeconds`, dipping
     * the tube to (1 - flickerDepth) three times. Never off, never a
     * strobe: the game is for five-year-olds.
     */
    flickerEvery: 4,
    flickerChance: 0.35,
    flickerSeconds: 0.36,
    flickerDepth: 0.42,
    /** Seconds for the pink to drift toward violet and the cyan toward blue and back, and how far. */
    driftSeconds: 11,
    driftAmount: 0.6,
    /** How near an edge of the die (share of a side) the tube sparkles, and how bright. */
    bendReach: 0.05,
    bendGain: 0.45,
    /** The flare when a die lands: how bright, and seconds to fade. */
    flareGain: 0.8,
    flareSeconds: 0.5,
  },
  /**
   * The Sun dice (diceSun.ts), season 2 of the pass, 21 Oct 2026: motes
   * of light rising off them as they roll, a sunburst where one lands,
   * and a warm pool of light on the floor under one at rest. Looks only,
   * like Fire and Ice: none of this reaches the physics.
   */
  sun: {
    particles: 520,
    /** Motes of light born per second per die, tumbling and at rest. */
    moteRateMoving: 40,
    moteRateStill: 14,
    /** Rays in the sunburst where a die lands, and how fast they fly out. */
    burstRays: 16,
    burstSpeed: 4.5,
    /** How strong the pool of light on the floor is under a resting die. */
    glowOpacity: 0.45,
  },
  /**
   * The Moon dice (diceMoon.ts), season 2: a halo of moonlight round
   * them, stardust trailing behind as they roll, and a ripple of
   * moonlight where one comes to rest. Looks only, like the rest.
   */
  moon: {
    particles: 420,
    /** World units a die travels between two grains of stardust. */
    trailSpacing: 0.1,
    /** Seconds a grain shines before it is gone. */
    trailLife: 0.9,
    /** Grains of stardust per second drifting off a die at rest. */
    driftRate: 6,
    /** Dots in the ripple of moonlight where a die comes to rest, and its speed. */
    rippleDots: 28,
    rippleSpeed: 1.8,
    /** How strong the moonlight on the floor is under a resting die. */
    glowOpacity: 0.22,
  },
  ocean: {
    /*
      THE OCEAN DICE DO SOMETHING since 4 Nov 2026. Marc: "do option c
      with the flowing water and splash" — the sea on the shell flows
      (oceanFlow.ts) and a die that lands throws a splash (diceOcean.ts).
      Of an earlier try: "once the water starts flowing, it's going off
      sync so fix that" — so every side of both dice reads ONE clock,
      wrapped to `flowSeconds`, and the picture repeats exactly once a
      period.
    */
    /** Seconds the sea takes to come round to the same picture: one swell and one chop along. */
    flowSeconds: 1.8,
    /** Particle budget for every droplet, both dice together. */
    particles: 360,
    /** Droplets in the ring thrown out when a die comes to rest. */
    splashDrops: 14,
    /** Droplets off a bounce on the way down, and off each die as it leaves the hand. */
    sprayDrops: 5,
    throwDrops: 8,
    /** Droplets and fine spray when a die goes under in the moat. */
    sinkDrops: 40,
    sinkMist: 12,
    /** A die that comes to rest again sooner than this after a splash only sprays: a wobble is not a second landing. */
    splashAgainSeconds: 0.6,
    /** The wet sheen on the board round a landed die: how strong, how wide (world units), and seconds to dry. */
    sheenOpacity: 0.35,
    sheenSize: 1.3,
    sheenSeconds: 0.5,
  },
  /**
   * The Gingerbread dice (diceGingerbread.ts), season 2 of the pass,
   * Sugar & Snow, 8 Nov 2026: crumbs falling off them as they roll, a
   * puff of icing sugar where one lands, and three crumbs that bounce
   * away. Looks only, like the rest.
   */
  gingerbread: {
    particles: 360,
    /** Crumbs shed per second by a tumbling die. */
    crumbRate: 22,
    /** Grains in the puff of sugar where a die lands. */
    puffCount: 18,
    /** Crumbs that bounce away from the landing. */
    bounceCrumbs: 3,
  },
  /**
   * The Bauble dice (diceBauble.ts), season 2: a trail of gold glitter
   * behind a rolling die, a ring of glitter rising where one lands, one
   * bright twinkle on its top corner, and a sheen of light on the glass.
   */
  bauble: {
    particles: 460,
    /** World units a die travels between two flecks of glitter. */
    trailSpacing: 0.09,
    /** Seconds a fleck twinkles before it is gone. */
    trailLife: 0.8,
    /** Flecks per second drifting off a die at rest. */
    driftRate: 5,
    /** Flecks in the ring where a die lands, and how fast they rise. */
    ringDots: 24,
    ringSpeed: 1.6,
    /** How strong the pool of gold light on the floor is under a resting die. */
    glowOpacity: 0.18,
  },
} as const;

/**
 * HOW LONG A BATTLE LASTS: two and a half minutes.
 *
 * David, 1 Nov 2026: "Add a two minute thirty second timer and if the
 * game doesn't finish by then it is a tie if the score is tied, or a win
 * for whoever is winning at that moment."
 *
 * The clock starts when the round does (after "BATTLE!"), not when Play
 * is pressed, so the matchmaking reveal and the countdown cost nobody
 * any time. The rules that read it are in src/game/battleTimer.ts. The
 * friendly-battle server keeps its own copy of this number
 * (hq/src/lib/battleClock.ts, which cannot import from the game), and
 * tests/battleTimer.test.ts fails if the two ever disagree.
 */
export const BATTLE_TIME_MS = 150_000;

/**
 * The last stretch of the clock, which turns red and ticks once a second
 * so nobody is surprised when it runs out. Ten seconds: long enough to
 * notice and roll once or twice more, short enough not to nag.
 */
export const BATTLE_FINAL_MS = 10_000;

/**
 * How long "Time's up!" stays on its own before the result replaces it.
 * Long enough to read and to understand why the battle stopped; short
 * enough that nobody wonders whether the game has frozen.
 */
export const TIME_UP_PAUSE_MS = 1_600;
