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
  /** Which die this is, so the pair leaves the hand side by side. */
  index?: number;
  /**
   * World-space flick from the player's gesture. Omitted for a plain tap,
   * which becomes a gentle roll away from the player.
   */
  flick?: { x: number; z: number };
}

/**
 * Throw a die from the player's edge of the board.
 *
 * A flick carries the player's own speed and direction — that is what makes
 * throwing feel like throwing. A tap is a soft roll forward. Either way the
 * die is picked up first: starting every throw from the hand is what reads
 * as a throw rather than the die twitching where it lies.
 */
export function throwDie(body: CANNON.Body, input: ThrowInput = {}): void {
  const t = TUNING.throw;
  const index = input.index ?? 0;
  const side = index === 0 ? -1 : 1;

  body.position.set(
    side * t.handSpread + rand(-0.12, 0.12),
    t.handY + rand(0, 0.18),
    t.handZ + rand(-0.15, 0.15),
  );
  body.quaternion.setFromEuler(
    rand(0, Math.PI * 2),
    rand(0, Math.PI * 2),
    rand(0, Math.PI * 2),
  );
  body.wakeUp();

  const jitter = () => rand(-t.lateralJitter, t.lateralJitter);

  if (input.flick) {
    const { x, z } = input.flick;
    // Hard flicks fly flatter and faster; gentle ones arc more.
    const strength = Math.min(Math.hypot(x, z) / t.flickMaxSpeed, 1);
    const lift = t.flickUpMax - (t.flickUpMax - t.flickUpMin) * strength;
    // A gentle forward flick still needs enough pace to leave the hand and
    // travel; a sideways or backward flick is honoured exactly as thrown.
    const forward = z < 0 ? Math.min(z, -t.flickMinForward) : z;
    body.velocity.set(x + jitter(), lift, forward);
  } else {
    body.velocity.set(
      rand(-t.tapLateral, t.tapLateral),
      rand(t.tapUpMin, t.tapUpMax),
      -rand(t.tapForwardMin, t.tapForwardMax),
    );
  }

  body.angularVelocity.set(
    randSign() * rand(t.spinMin, t.spinMax),
    randSign() * rand(t.spinMin, t.spinMax),
    randSign() * rand(t.spinMin, t.spinMax),
  );
}
