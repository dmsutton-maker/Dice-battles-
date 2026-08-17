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
