import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { ColorDef } from '../game/colors';
import { TUNING } from '../game/tuning';
import { topFaceAlignment, topFaceColor } from './die';

/**
 * The rule that decides when a roll is over.
 *
 * Pure functions over cannon bodies, deliberately free of React/RN imports
 * so the headless test suite exercises the SAME code the game runs rather
 * than a copy of it (this logic drifting from its tests is how the "roll
 * lock felt like dead input" regression slipped through).
 *
 * The dice are never interfered with while they roll. The roll is called
 * as soon as they are asleep, still, or out of time, and they are FROZEN
 * at that instant — which is what makes calling it early safe, since a
 * frozen die cannot move and its face can never go stale.
 */

export function dieSpeed(body: CANNON.Body): number {
  return body.velocity.length() + body.angularVelocity.length() * 0.5;
}

export function allStill(bodies: CANNON.Body[]): boolean {
  return bodies.every((body) => dieSpeed(body) <= TUNING.settle.speedThreshold);
}

/*
 * `isReadable` used to live here: it answered "has this die landed flat
 * enough that the top face is genuinely the face it landed on?", and the
 * hurried roll waited until it was true of both dice. That wait was most
 * of the delay David asked twice to be rid of, and `snapDieToNearestFace`
 * makes the question moot — the die is PUT onto a definite face instead of
 * being watched until it reaches one. Deleted rather than left behind, so
 * nothing reaches for a safety check that no longer guards anything.
 */

/**
 * Should the roll be called now? `stillFrames` is the caller's running
 * count of consecutive frames where `allStill` held.
 *
 * `hurried` means the player has already swiped for the next throw, so
 * this roll is called as soon as it is allowed to be, rather than waiting
 * for a dead stop. David asked for that twice.
 *
 * BUT NOT INSTANTLY. `minRollMs` is a floor under every path here, and it
 * is the whole reason this function was rewritten on 24 Aug 2026. Without
 * it, `hurried` returned true on the very next frame — the suite has been
 * printing "hurried median 17ms" all along — so one swipe both ended the
 * previous roll and launched the next. That made the rate of SCORING
 * rolls a function of thumb speed instead of physics, and David could
 * "spam as fast as you can and get every color in only a matter of
 * seconds". A roll that resolves in one frame is not a roll.
 *
 * The floor costs nothing in responsiveness, because a swipe inside the
 * window is not dropped: DiceScene queues it and fires it the instant the
 * roll lands. The player's input is always heard; the dice are simply
 * still in the air, which is an honest thing to be waiting for.
 *
 * A roll still does NOT cancel. Every roll is binding, which is what stops
 * a bad result being thrown away mid-air — in Ultimate a matched colour
 * sends a rescued prisoner back to jail, so a roll you can dodge is a rule
 * you can opt out of. The dice are snapped onto the face they were nearest
 * (see `snapDieToNearestFace`) so the colour counted is the colour shown.
 */
export function shouldCallRoll(
  bodies: CANNON.Body[],
  elapsedMs: number,
  stillFrames: number,
  hurried = false,
): boolean {
  const s = TUNING.settle;

  // Before anything else: nothing counts as a roll until the dice have
  // actually rolled. This gates the sleeping and still-frames paths too,
  // not just `hurried` — otherwise a feather-light tap that happens to
  // settle in 200ms becomes the new way to spam.
  if (elapsedMs < s.minRollMs) return false;

  if (bodies.every((body) => body.sleepState === CANNON.Body.SLEEPING)) return true;
  if (stillFrames >= s.stillFrames) return true;

  if (hurried) return true;

  // Past the cap a roll is called where it lies, but only once the dice
  // are down and slow, so it is never snapped still mid-tumble.
  const grounded = bodies.every(
    (body) => body.position.y <= TUNING.dieSize * 1.1,
  );
  const slowEnough = bodies.every((body) => dieSpeed(body) <= 1.2);
  if (elapsedMs >= s.maxRollMs && grounded && slowEnough) return true;
  return elapsedMs >= s.hardMaxRollMs;
}

/** Freeze the dice so their faces cannot change after being read. */
export function freezeDice(bodies: CANNON.Body[]): void {
  bodies.forEach((body) => {
    body.velocity.setZero();
    body.angularVelocity.setZero();
    body.sleep();
  });
}

/**
 * Read the up-facing colors in ON-SCREEN left-to-right order. The dice
 * trade places while rolling, so spawn order would leave the HUD swatches
 * mismatched against what the player sees.
 */
export function readFaces(bodies: CANNON.Body[]): ColorDef[] {
  return bodies
    .map((body) => ({
      x: body.position.x,
      color: topFaceColor(
        new THREE.Quaternion(
          body.quaternion.x,
          body.quaternion.y,
          body.quaternion.z,
          body.quaternion.w,
        ),
      ),
    }))
    .sort((a, b) => a.x - b.x)
    .map((entry) => entry.color);
}

/** Has a die left the tray and need fishing out? */
export function isOutOfBounds(body: CANNON.Body): boolean {
  return (
    body.position.y < -1 ||
    Math.abs(body.position.x) > TUNING.tray.innerWidth / 2 + 0.8 ||
    Math.abs(body.position.z) > TUNING.tray.innerDepth / 2 + 0.8
  );
}
