import { useFrame } from '@react-three/fiber/native';
import * as CANNON from 'cannon-es';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { addTrayBodies, createPhysicsWorld } from '../physics/world';
import { createDieBody, createDieMaterials, throwDie, topFaceColor } from '../dice/die';
import { ColorDef } from '../game/colors';
import { TUNING } from '../game/tuning';

export interface SceneControls {
  /** Throw both dice. Pass a flick velocity for directional throws. */
  throwAll: (flick?: { x: number; z: number }) => void;
}

interface DiceSceneProps {
  /** Receives the imperative throw API once the scene is mounted. */
  controlsRef: React.MutableRefObject<SceneControls | null>;
  onThrow: () => void;
  onSettled: (faces: ColorDef[]) => void;
}

const DIE_START_POSITIONS: [number, number, number][] = [
  [-1.1, TUNING.dieSize / 2, 2.2],
  [1.1, TUNING.dieSize / 2, 2.4],
];

/**
 * The full 3D demo scene: physics world, tray, two dice, blob shadows,
 * settle detection, and collision haptics. Lives inside the r3f Canvas.
 */
export function DiceScene({ controlsRef, onThrow, onSettled }: DiceSceneProps) {
  const physics = useMemo(() => {
    const p = createPhysicsWorld();
    addTrayBodies(p);
    return p;
  }, []);

  const diceBodies = useMemo(
    () => DIE_START_POSITIONS.map((pos) => {
      const body = createDieBody(physics.dieMaterial, pos);
      physics.world.addBody(body);
      return body;
    }),
    [physics],
  );

  const dieMaterials = useMemo(
    () => DIE_START_POSITIONS.map(() => createDieMaterials()),
    [],
  );

  const dieMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const shadowRefs = useRef<(THREE.Mesh | null)[]>([]);

  // Settle tracking (mutable, not state — updated every frame).
  const stillFrames = useRef(0);
  const awaitingSettle = useRef(false);

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

  useFrame((_state, delta) => {
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

      const speed =
        body.velocity.length() + body.angularVelocity.length() * 0.5;
      if (speed > TUNING.settle.speedThreshold) allStill = false;
    });

    if (awaitingSettle.current) {
      stillFrames.current = allStill ? stillFrames.current + 1 : 0;
      if (stillFrames.current >= TUNING.settle.stillFrames) {
        awaitingSettle.current = false;
        const faces = diceBodies.map((body) =>
          topFaceColor(
            new THREE.Quaternion(
              body.quaternion.x,
              body.quaternion.y,
              body.quaternion.z,
              body.quaternion.w,
            ),
          ),
        );
        onSettled(faces);
      }
    }
  });

  const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 10, 6]} intensity={2.6} />
      <directionalLight position={[-6, 8, -4]} intensity={0.8} color="#bcd4ff" />

      {/* Tray floor */}
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry
          args={[innerWidth + wallThickness * 2, 0.5, innerDepth + wallThickness * 2]}
        />
        <meshStandardMaterial color="#caa96e" roughness={0.9} />
      </mesh>

      {/* Tray walls */}
      {(
        [
          [-(innerWidth / 2 + wallThickness / 2), 0, innerDepth + wallThickness * 2, wallThickness],
          [innerWidth / 2 + wallThickness / 2, 0, innerDepth + wallThickness * 2, wallThickness],
        ] as const
      ).map(([x, z, depth, width], i) => (
        <mesh key={`side-${i}`} position={[x, wallHeight / 2, z]}>
          <boxGeometry args={[width, wallHeight, depth]} />
          <meshStandardMaterial color="#8a6a3b" roughness={0.85} />
        </mesh>
      ))}
      {(
        [
          [-(innerDepth / 2 + wallThickness / 2)],
          [innerDepth / 2 + wallThickness / 2],
        ] as const
      ).map(([z], i) => (
        <mesh key={`end-${i}`} position={[0, wallHeight / 2, z]}>
          <boxGeometry args={[innerWidth, wallHeight, wallThickness]} />
          <meshStandardMaterial color="#8a6a3b" roughness={0.85} />
        </mesh>
      ))}

      {/* Dice */}
      {DIE_START_POSITIONS.map((pos, i) => (
        <mesh
          key={`die-${i}`}
          ref={(mesh) => {
            dieMeshRefs.current[i] = mesh;
          }}
          position={pos}
          material={dieMaterials[i]}
        >
          <boxGeometry args={[TUNING.dieSize, TUNING.dieSize, TUNING.dieSize]} />
        </mesh>
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
