import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { ColorDef, DIE_FACE_COLORS } from '../game/colors';
import { TUNING } from '../game/tuning';

/** Local-space outward normals in BoxGeometry material-group order. */
const FACE_NORMALS: readonly THREE.Vector3[] = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

const scratchNormal = new THREE.Vector3();

/**
 * How squarely a face is pointing up: 1 is dead flat, 0.707 is balanced on
 * an edge, 0.577 on a corner.
 *
 * "A settled die is always near 1" is what this comment used to claim, and
 * it is not true. 720 simulated rolls on 25 Aug 2026 found a die resting
 * DEAD STILL at 0.58 — about 54 degrees off flat, perched on an obstacle
 * on Hard. Stopped and flat are two different questions, and reading a
 * colour off a die at 45° is picking one of two faces at random and
 * calling it a result. That is what this measures and `TUNING.settle
 * .flatEnough` is the bar it is measured against.
 */
export function topFaceAlignment(quaternion: THREE.Quaternion): number {
  let bestDot = -Infinity;
  for (let i = 0; i < FACE_NORMALS.length; i++) {
    const dot = scratchNormal.copy(FACE_NORMALS[i]).applyQuaternion(quaternion).y;
    if (dot > bestDot) bestDot = dot;
  }
  return bestDot;
}

/** Which color face is pointing up for the given body orientation. */
export function topFaceColor(quaternion: THREE.Quaternion): ColorDef {
  let bestIndex = 0;
  let bestDot = -Infinity;
  for (let i = 0; i < FACE_NORMALS.length; i++) {
    const dot = scratchNormal.copy(FACE_NORMALS[i]).applyQuaternion(quaternion).y;
    if (dot > bestDot) {
      bestDot = dot;
      bestIndex = i;
    }
  }
  return DIE_FACE_COLORS[bestIndex];
}

/**
 * Turn a die so the face nearest to upward is squarely up, and drop it to
 * rest on the tray floor.
 *
 * NOTHING IS INVENTED. `topFaceColor` reports the nearest-up face, and
 * this turns that same face square, so the result is identical either way
 * — what changes is only what the player sees.
 *
 * That distinction is the whole reason this is safe, and it was also how
 * it got misused. It used to run whenever a player tapped again, which
 * let a roll be called with the dice still IN THE AIR: a die put onto a
 * face mid-flight looks perfectly landed afterwards, so nothing
 * downstream could tell. David reported the result of that twice as
 * "you can just spam and get the dice". A roll now ends only when the
 * dice have come to rest, and this is left for the case it was always
 * good for — a die that stops cocked on an obstacle, which really does
 * happen (see `topFaceAlignment`).
 */
export function snapDieToNearestFace(body: CANNON.Body): void {
  const quaternion = new THREE.Quaternion(
    body.quaternion.x,
    body.quaternion.y,
    body.quaternion.z,
    body.quaternion.w,
  );

  let bestIndex = 0;
  let bestDot = -Infinity;
  for (let i = 0; i < FACE_NORMALS.length; i++) {
    const dot = scratchNormal.copy(FACE_NORMALS[i]).applyQuaternion(quaternion).y;
    if (dot > bestDot) {
      bestDot = dot;
      bestIndex = i;
    }
  }

  // The shortest rotation taking that face's normal to straight up. Only
  // the tilt is corrected — the die keeps the heading it had, so it does
  // not visibly spin on the spot as it settles.
  const worldNormal = scratchNormal
    .copy(FACE_NORMALS[bestIndex])
    .applyQuaternion(quaternion)
    .normalize();
  const correction = new THREE.Quaternion().setFromUnitVectors(
    worldNormal,
    new THREE.Vector3(0, 1, 0),
  );
  quaternion.premultiply(correction).normalize();

  body.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  body.position.y = TUNING.dieSize / 2;
  body.velocity.setZero();
  body.angularVelocity.setZero();
}

/** One material per face, in BoxGeometry group order. Shared per die. */
export function createDieMaterials(): THREE.MeshStandardMaterial[] {
  return DIE_FACE_COLORS.map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color: color.hex,
        roughness: 0.32,
        metalness: 0.04,
      }),
  );
}

export function createDieBody(
  material: CANNON.Material,
  position: [number, number, number],
): CANNON.Body {
  const half = TUNING.dieSize / 2;
  const body = new CANNON.Body({
    mass: TUNING.physics.dieMass,
    material,
    shape: new CANNON.Box(new CANNON.Vec3(half, half, half)),
    position: new CANNON.Vec3(...position),
    linearDamping: TUNING.physics.linearDamping,
    angularDamping: TUNING.physics.angularDamping,
    allowSleep: true,
    sleepSpeedLimit: TUNING.physics.sleepSpeedLimit,
    sleepTimeLimit: TUNING.physics.sleepTimeLimit,
  });
  return body;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randSign = () => (Math.random() < 0.5 ? -1 : 1);

export interface ThrowInput {
  /**
   * World-space flick from the player's gesture. Omitted for a plain tap,
   * which pops the dice up with a random scatter.
   */
  flick?: { x: number; z: number };
}

/**
 * Launch a die: a tap pops it up with random scatter and spin; a flick
 * throws it with the speed and direction of the player's hand.
 *
 * The die is thrown from wherever it is lying, exactly like picking dice up
 * off the table and tossing them again. Resetting every throw to a fixed
 * spot was tried and reverted — it made throws uniform and mechanical.
 */
export function throwDie(body: CANNON.Body, input: ThrowInput = {}): void {
  const t = TUNING.throw;
  body.wakeUp();

  if (input.flick) {
    body.velocity.set(
      input.flick.x + rand(-1, 1),
      t.flickUp + rand(0, 2),
      input.flick.z + rand(-1, 1),
    );
  } else {
    body.velocity.set(
      rand(-t.tapLateral, t.tapLateral),
      rand(t.tapUpMin, t.tapUpMax),
      rand(-t.tapLateral, t.tapLateral),
    );
  }

  body.angularVelocity.set(
    randSign() * rand(t.spinMin, t.spinMax),
    randSign() * rand(t.spinMin, t.spinMax),
    randSign() * rand(t.spinMin, t.spinMax),
  );
}
