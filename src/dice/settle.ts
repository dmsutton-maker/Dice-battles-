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
 * hurried roll waited until it was true of both dice.
 *
 * It is not needed now for the opposite reason to the one written here
 * before. The old note said `snapDieToNearestFace` made the question moot
 * because the die is PUT onto a face rather than watched until it reaches
 * one — which was true, and was exactly the problem: a die can be put onto
 * a face in mid-air. A roll now ends only when the dice are actually at
 * rest, and a die at rest is already flat, so there is nothing left to
 * ask. Snapping survives only on the stuck-die backstops.
 */

/**
 * Should the roll be called now? `stillFrames` is the caller's running
 * count of consecutive frames where `allStill` held.
 *
 * THE DICE HAVE TO LAND. That is the whole rule, and it is deliberately
 * the ONLY thing this function will accept as a finished roll — asleep,
 * or still for `stillFrames` frames in a row. Nothing a player does with
 * their thumb appears anywhere below.
 *
 * It did once, and it was wrong twice over. There used to be a `hurried`
 * argument meaning "the player has already swiped for the next throw, so
 * stop waiting", and it returned true on the spot. The first version of
 * this bug resolved a roll in a single frame; the fix on 24 Aug 2026 put
 * a 650ms floor under it, and David reported the same thing again:
 *
 *   "You're still able to just spam and get the dice. They should have to
 *    fully land for it to count as getting the color."
 *
 * He was right both times, and the second time the suite proved it in one
 * line — hurried rolls came out at median 650ms AND p95 650ms, exactly
 * the floor, every roll, because `hurried` fired on the first frame past
 * it. The floor was not a floor at all; it was the duration of a spammed
 * roll. Dice that take ~1500ms to come to rest were being read at 650ms
 * and SNAPPED onto whichever face they happened to be nearest, mid-air.
 * The colour you got was decided by a clock, not by the throw.
 *
 * So the argument is gone rather than tightened. A number can be tuned
 * back down by anybody who finds the game slow; an argument that does not
 * exist cannot be re-wired into an early exit.
 *
 * NONE OF THIS COSTS RESPONSIVENESS, because the thing David asked for
 * twice was never "call the roll early" — it was "don't leave me waiting
 * with nothing happening". A swipe during a roll is not dropped: DiceScene
 * queues it and fires it `hurriedThrowDelayMs` after the dice land, which
 * is a third of the normal pause. The input is always heard. What changed
 * is that it no longer reaches back and ends the roll that is still in the
 * air.
 *
 * `minRollMs` stays as a genuine floor now — cover for a feather-light
 * throw that could satisfy `stillFrames` almost immediately.
 *
 * A roll does NOT cancel. Every roll is binding, which is what stops a bad
 * result being thrown away mid-air — in Ultimate a matched colour sends a
 * rescued prisoner back to jail, so a roll you can dodge is a rule you can
 * opt out of.
 */
export function shouldCallRoll(
  bodies: CANNON.Body[],
  elapsedMs: number,
  stillFrames: number,
): boolean {
  const s = TUNING.settle;

  // Nothing counts as a roll until the dice have actually rolled.
  if (elapsedMs < s.minRollMs) return false;

  // The two honest endings: the physics engine put the dice to sleep, or
  // they have measured as still for several frames running.
  if (bodies.every((body) => body.sleepState === CANNON.Body.SLEEPING)) return true;
  if (stillFrames >= s.stillFrames) return true;

  // Backstops, for a die wedged against a wall or grinding forever on a
  // corner. These are the only paths that can call a roll while something
  // is still moving, which is why DiceScene snaps the faces afterwards.
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
