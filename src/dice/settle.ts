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

/**
 * Is this die lying flat enough, and moving slowly enough, that the face
 * on top is genuinely the face it has landed on?
 *
 * Speed alone is not enough. A die can be barely moving and still balanced
 * on an edge on its way over, where "the top face" is a coin toss between
 * two colours — so the orientation is checked as well.
 */
export function isReadable(body: CANNON.Body): boolean {
  const s = TUNING.settle;
  if (body.position.y > TUNING.dieSize * 1.1) return false;
  if (dieSpeed(body) > s.hurriedSpeed) return false;
  const q = new THREE.Quaternion(
    body.quaternion.x,
    body.quaternion.y,
    body.quaternion.z,
    body.quaternion.w,
  );
  return topFaceAlignment(q) >= s.hurriedFlatness;
}

/**
 * Should the roll be called now? `stillFrames` is the caller's running
 * count of consecutive frames where `allStill` held.
 *
 * `hurried` means the player has already tapped for the next throw. It
 * does NOT cancel this roll — every roll is binding, which is what stops
 * a bad result being thrown away mid-air — it only stops the counting
 * waiting for the dice to come to a dead stop when they have already
 * landed on a readable face.
 */
export function shouldCallRoll(
  bodies: CANNON.Body[],
  elapsedMs: number,
  stillFrames: number,
  hurried = false,
): boolean {
  const s = TUNING.settle;
  if (bodies.every((body) => body.sleepState === CANNON.Body.SLEEPING)) return true;
  if (stillFrames >= s.stillFrames) return true;

  if (hurried && bodies.every(isReadable)) return true;

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
