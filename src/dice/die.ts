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
  /** Where across the screen the player touched: -1 left .. +1 right. */
  aim?: number;
  /** How far up the screen they touched: 0 near the player .. 1 far. */
  power?: number;
}

/**
 * Tip a die out of the hand at the player's edge and send it down the
 * board. Position is reset on every throw so a roll always starts from the
 * same place — picking the dice up is part of what makes it read as a
 * throw rather than the dice twitching where they lie.
 */
export function throwDie(body: CANNON.Body, input: ThrowInput = {}): void {
  const t = TUNING.throw;
  const index = input.index ?? 0;
  const aim = Math.max(-1, Math.min(1, input.aim ?? 0));
  const power =
    t.powerMin + (t.powerMax - t.powerMin) * Math.max(0, Math.min(1, input.power ?? 0.5));

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

  body.velocity.set(
    aim * t.aimScale + rand(-t.lateralJitter, t.lateralJitter),
    rand(t.upMin, t.upMax) * power,
    -rand(t.forwardMin, t.forwardMax) * power,
  );

  body.angularVelocity.set(
    randSign() * rand(t.spinMin, t.spinMax),
    randSign() * rand(t.spinMin, t.spinMax),
    randSign() * rand(t.spinMin, t.spinMax),
  );
}
