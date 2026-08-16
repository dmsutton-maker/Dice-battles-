import { useFrame } from '@react-three/fiber/native';
import * as CANNON from 'cannon-es';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENAS, CURRENT_ARENA } from '../arena/arenas';
import { createDieBody, throwDie, topFaceColor } from '../dice/die';
import { DieMesh } from '../dice/DieMesh';
import { ColorDef, PrisonerColorId } from '../game/colors';
import { Prisoners } from '../game/Prisoners';
import { TUNING } from '../game/tuning';
import { addTrayBodies, createPhysicsWorld } from '../physics/world';
import { cameraBase } from './cameraFit';
import { CameraRig } from './CameraRig';

export interface SceneControls {
  /** Throw both dice. Pass a flick velocity for directional throws. */
  throwAll: (flick?: { x: number; z: number }) => void;
}

interface DiceSceneProps {
  /** Receives the imperative throw API once the scene is mounted. */
  controlsRef: React.MutableRefObject<SceneControls | null>;
  onThrow: () => void;
  onSettled: (faces: ColorDef[]) => void;
  /** Colors freed so far, in rescue order (drives the prisoner figures). */
  freedOrder: PrisonerColorId[];
  /** Increment to fire a celebratory camera shake (e.g. on each rescue). */
  shakeSignal: number;
}

const DIE_START_POSITIONS: [number, number, number][] = [
  [-0.9, TUNING.dieSize / 2, 2.2],
  [0.9, TUNING.dieSize / 2, 2.4],
];

const ArenaComponent = ARENAS[CURRENT_ARENA].Component;

/**
 * The full 3D scene: physics world, castle arena, two dice, prisoners,
 * blob shadows, settle detection, collision haptics, and camera shake.
 */
export function DiceScene({
  controlsRef,
  onThrow,
  onSettled,
  freedOrder,
  shakeSignal,
}: DiceSceneProps) {
  const physics = useMemo(() => {
    const p = createPhysicsWorld();
    addTrayBodies(p);
    return p;
  }, []);

  const diceBodies = useMemo(
    () =>
      DIE_START_POSITIONS.map((pos) => {
        const body = createDieBody(physics.dieMaterial, pos);
        physics.world.addBody(body);
        return body;
      }),
    [physics],
  );

  const dieMeshRefs = useRef<(THREE.Group | null)[]>([]);
  const shadowRefs = useRef<(THREE.Mesh | null)[]>([]);

  // Settle tracking (mutable, not state — updated every frame).
  const stillFrames = useRef(0);
  const awaitingSettle = useRef(false);

  // Camera shake amount, decays every frame.
  const shake = useRef(0);
  const lastShakeSignal = useRef(shakeSignal);
  useEffect(() => {
    if (shakeSignal !== lastShakeSignal.current) {
      lastShakeSignal.current = shakeSignal;
      shake.current = 1;
    }
  }, [shakeSignal]);

  // Collision haptics: light tick on hard impacts, throttled.
  useEffect(() => {
    const lastTick = { t: 0 };
    const onCollide = (event: { contact: CANNON.ContactEquation }) => {
      const impact = event.contact.getImpactVelocityAlongNormal();
      const now = Date.now();
      if (
        impact > TUNING.haptics.collisionMinImpact &&
        now - lastTick.t > TUNING.haptics.collisionCooldownMs
      ) {
        lastTick.t = now;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    };
    diceBodies.forEach((body) => body.addEventListener('collide', onCollide));
    return () => {
      diceBodies.forEach((body) => body.removeEventListener('collide', onCollide));
    };
  }, [diceBodies]);

  useEffect(() => {
    controlsRef.current = {
      throwAll: (flick) => {
        awaitingSettle.current = true;
        stillFrames.current = 0;
        diceBodies.forEach((body) =>
          throwDie(body, flick ? { flickVelocity: flick } : {}),
        );
        onThrow();
      },
    };
    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef, diceBodies, onThrow]);

  useFrame((state, delta) => {
    physics.world.step(
      TUNING.physics.timeStep,
      Math.min(delta, 0.05),
      TUNING.physics.maxSubSteps,
    );

    let allStill = true;
    diceBodies.forEach((body, i) => {
      const mesh = dieMeshRefs.current[i];
      if (mesh) {
        mesh.position.set(body.position.x, body.position.y, body.position.z);
        mesh.quaternion.set(
          body.quaternion.x,
          body.quaternion.y,
          body.quaternion.z,
          body.quaternion.w,
        );
      }

      // Cheap blob shadow: follows the die, shrinks/fades with height.
      const shadow = shadowRefs.current[i];
      if (shadow) {
        shadow.position.set(body.position.x, 0.02, body.position.z);
        const height = Math.max(body.position.y - TUNING.dieSize / 2, 0);
        const scale = Math.max(1 - height * 0.12, 0.45);
        shadow.scale.setScalar(scale);
        const material = shadow.material as THREE.MeshBasicMaterial;
        material.opacity = 0.28 * Math.max(1 - height * 0.18, 0.25);
      }

      // Safety net: if a die somehow leaves the sealed tray (e.g. tunneling
      // through a corner at extreme speed), teleport it back instead of
      // letting it fall forever and soft-lock settle detection.
      if (
        body.position.y < -1 ||
        Math.abs(body.position.x) > TUNING.tray.innerWidth / 2 + 0.8 ||
        Math.abs(body.position.z) > TUNING.tray.innerDepth / 2 + 0.8
      ) {
        const [startX, startY, startZ] = DIE_START_POSITIONS[i];
        body.position.set(startX, startY + 1.5, startZ);
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
        body.wakeUp();
      }

      const speed =
        body.velocity.length() + body.angularVelocity.length() * 0.5;
      if (speed > TUNING.settle.speedThreshold) allStill = false;
    });

    // Camera shake with decay, offset from the auto-fitted base position.
    if (shake.current > 0.01) {
      state.camera.position.set(
        cameraBase.x + (Math.random() - 0.5) * 0.18 * shake.current,
        cameraBase.y + (Math.random() - 0.5) * 0.12 * shake.current,
        cameraBase.z + (Math.random() - 0.5) * 0.18 * shake.current,
      );
      shake.current *= 0.88;
    } else if (shake.current !== 0) {
      shake.current = 0;
      state.camera.position.copy(cameraBase);
    }

    if (awaitingSettle.current) {
      stillFrames.current = allStill ? stillFrames.current + 1 : 0;
      if (stillFrames.current >= TUNING.settle.stillFrames) {
        awaitingSettle.current = false;
        // Report faces in ON-SCREEN left-to-right order, not spawn order:
        // the dice trade places while rolling, and the HUD swatches must
        // match what the player sees or a die looks like the wrong color.
        const settled = diceBodies
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
          .sort((a, b) => a.x - b.x);
        onSettled(settled.map((s) => s.color));
      }
    }
  });

  return (
    <>
      <CameraRig />
      {/* Neutral lights only: any color tint here shifts material hues. */}
      <hemisphereLight args={['#f4f6fa', '#9aa0a8', 0.9]} />
      <directionalLight position={[4, 12, 6]} intensity={1.9} />
      <directionalLight position={[-6, 8, -4]} intensity={0.5} color="#eef2f8" />

      <ArenaComponent />
      <Prisoners freedOrder={freedOrder} />

      {/* Dice */}
      {DIE_START_POSITIONS.map((_pos, i) => (
        <DieMesh
          key={`die-${i}`}
          ref={(mesh: THREE.Group | null) => {
            dieMeshRefs.current[i] = mesh;
          }}
        />
      ))}

      {/* Blob shadows */}
      {DIE_START_POSITIONS.map((_pos, i) => (
        <mesh
          key={`shadow-${i}`}
          ref={(mesh) => {
            shadowRefs.current[i] = mesh;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.02, 0]}
        >
          <circleGeometry args={[TUNING.dieSize * 0.62, 24]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.28} />
        </mesh>
      ))}
    </>
  );
}
