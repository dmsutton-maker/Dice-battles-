import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { ColorDef } from '../game/colors';
import { TUNING } from '../game/tuning';
import { topFaceColor } from './die';

/**
 * The rule that decides when a roll is over.
 *
 * Pure functions over cannon bodies, deliberately free of React/RN imports
 * so the headless test suite exercises the SAME code the game runs rather
 * than a copy of it (this logic drifting from its tests is how the "roll
 * lock felt like dead input" regression slipped through).
 *
 * The shape of the rule: dice tumble freely for a moment, then a settle
 * assist bleeds off any straggler's velocity so it glides to rest, and the
 * roll is called as soon as the dice are asleep, still, or out of time —
 * at which point they are FROZEN, which is what makes calling it early
 * safe (a frozen die cannot move, so its face can never go stale).
 */

/** Is this die resting/creeping rather than in free flight? */
function isGrounded(body: CANNON.Body): boolean {
  return body.position.y <= TUNING.dieSize * 0.95;
}

export function dieSpeed(body: CANNON.Body): number {
  return body.velocity.length() + body.angularVelocity.length() * 0.5;
}

/**
 * Bleed velocity off grounded-but-creeping dice, gently at first and firmer
 * the longer they take. Airborne dice are untouched — damping a falling die
 * makes it float down.
 */
export function applySettleAssist(bodies: CANNON.Body[], elapsedMs: number): void {
  const s = TUNING.settle;
  if (elapsedMs <= s.assistAfterMs) return;

  const ramp = Math.min((elapsedMs - s.assistAfterMs) / s.assistRampMs, 1);
  const factor =
    elapsedMs >= s.maxRollMs
      ? s.hardStopFactor
      : s.assistStartFactor - (s.assistStartFactor - s.assistEndFactor) * ramp;

  bodies.forEach((body) => {
    if (!isGrounded(body)) return;
    body.velocity.scale(factor, body.velocity);
    body.angularVelocity.scale(factor, body.angularVelocity);
  });
}

/** Are all dice below the settle speed threshold this frame? */
export function allStill(bodies: CANNON.Body[]): boolean {
  return bodies.every((body) => dieSpeed(body) <= TUNING.settle.speedThreshold);
}

/**
 * Should the roll be called now? `stillFrames` is the caller's running
 * count of consecutive frames where `allStill` held.
 */
export function shouldCallRoll(
  bodies: CANNON.Body[],
  elapsedMs: number,
  stillFrames: number,
): boolean {
  const s = TUNING.settle;
  if (bodies.every((body) => body.sleepState === CANNON.Body.SLEEPING)) return true;
  if (stillFrames >= s.stillFrames) return true;

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
