import { useFrame } from '@react-three/fiber/native';
import * as CANNON from 'cannon-es';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { playClack, playThrow } from '../audio/sounds';
import { MOAT, MOUND, ObstacleLayout } from '../game/obstacles';
import { ARENAS, ArenaId } from '../arena/arenas';
import { TreasureChest } from '../arena/TreasureChest';
import { createDieBody, throwDie } from '../dice/die';
import {
  dieSpeed,
  freezeDice,
  isOutOfBounds,
  readFaces,
  shouldCallRoll,
} from '../dice/settle';
import { DieMesh } from '../dice/DieMesh';
import { PatternId } from '../dice/patterns';
import { ColorDef } from '../game/colors';
import { PrisonerUnit } from '../game/modes';
import { Prisoners } from '../game/Prisoners';
import { TUNING } from '../game/tuning';
import { addTrayBodies, createPhysicsWorld } from '../physics/world';
import { cameraBase } from './cameraFit';
import { CameraRig } from './CameraRig';

/** A flick in world space, from the player's gesture. */
export interface Flick {
  x: number;
  z: number;
}

export interface SceneControls {
  /**
   * Throw both dice, carrying the player's flick if there was one. Reports
   * whether the throw went out now or was queued behind a roll still in
   * progress, since rolls are binding until the dice settle.
   */
  throwAll: (flick?: Flick) => 'launched' | 'queued';
}

interface DiceSceneProps {
  /** Receives the imperative throw API once the scene is mounted. */
  controlsRef: React.MutableRefObject<SceneControls | null>;
  onThrow: () => void;
  onSettled: (faces: ColorDef[]) => void;
  /** A die just went under in the moat (Hard mode). */
  onMoatSink?: () => void;
  /** The prisoner lineup with current stations (drives the figures). */
  units: PrisonerUnit[];
  /** Increment to fire a celebratory camera shake (e.g. on each rescue). */
  shakeSignal: number;
  /** This round's obstacle placements. Remount the scene when it changes. */
  layout: ObstacleLayout;
  /** Which arena theme to draw (trophy unlocks switch this). */
  arenaId: ArenaId;
  /** Equipped dice skin's shell colour and pattern (src/game/diceSkins.ts). */
  dieBodyColor: string;
  diePattern?: PatternId;
  diePatternInk?: string;
  dieSymbols?: boolean;
  /** Trophy unlock that adds the courtyard treasure. */
  showTreasure: boolean;
  /**
   * Whether throws are currently allowed (true during a live round). A tap
   * queued mid-roll is discarded rather than fired if the round ended while
   * the dice were still tumbling.
   */
  throwsEnabled?: boolean;
}

const DIE_START_POSITIONS: [number, number, number][] = [
  [-0.9, TUNING.dieSize / 2, 2.2],
  [0.9, TUNING.dieSize / 2, 2.4],
];

/**
 * The full 3D scene: physics world, castle arena, two dice, prisoners,
 * blob shadows, settle detection, collision haptics, and camera shake.
 */
export function DiceScene({
  controlsRef,
  onThrow,
  onSettled,
  onMoatSink,
  units,
  shakeSignal,
  layout,
  arenaId,
  dieBodyColor,
  diePattern = 'plain',
  diePatternInk,
  dieSymbols = false,
  showTreasure,
  throwsEnabled = true,
}: DiceSceneProps) {
  const ArenaComponent = ARENAS[arenaId].Component;
  // The parent remounts this scene (key includes the round) whenever the
  // layout changes, so building the world once per mount is correct.
  const obstacles = layout;
  const physics = useMemo(() => {
    const p = createPhysicsWorld();
    addTrayBodies(p, obstacles);
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const throwStartedAt = useRef(0);
  /**
   * A tap made while the dice are still rolling is REMEMBERED and fired the
   * moment they settle, instead of being swallowed. Frantic tapping is the
   * whole feel of the game, but a roll must still be binding (you can't
   * cancel a bad roll mid-air), so the queued throw always lands after the
   * previous roll has been counted.
   */
  const queuedThrow = useRef<{ flick?: Flick } | null>(null);
  const queuedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launchRef = useRef<((flick?: Flick) => void) | null>(null);
  /** Mirrors the `throwsEnabled` prop for use inside the frame loop. */
  const throwsEnabledRef = useRef(true);
  throwsEnabledRef.current = throwsEnabled;

  // Moat sinking: timestamp until which each die stays underwater before
  // being fished out; 0 = not sinking. Splash ring animation progress.
  const sinkUntil = useRef<number[]>([0, 0]);
  /**
   * A die can be swallowed by the moat at most once per roll. Without this
   * the same die can be knocked back in again and again, and each capture
   * restarts the settle clock — a roll that drags on for many seconds and
   * is tedious rather than dramatic.
   */
  const sankThisRoll = useRef<boolean[]>([false, false]);
  const splashRef = useRef<THREE.Mesh | null>(null);
  const splashT = useRef(1); // >= 1 means idle

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
        playClack();
      }
    };
    diceBodies.forEach((body) => body.addEventListener('collide', onCollide));
    return () => {
      diceBodies.forEach((body) => body.removeEventListener('collide', onCollide));
    };
  }, [diceBodies]);

  useEffect(() => {
    const launch = (flick?: Flick) => {
      awaitingSettle.current = true;
      stillFrames.current = 0;
      throwStartedAt.current = Date.now();
      sankThisRoll.current = [false, false];
      diceBodies.forEach((body) => throwDie(body, { flick }));
      playThrow();
      onThrow();
    };

    controlsRef.current = {
      throwAll: (flick) => {
        // Every roll is binding: no re-throwing while dice are still
        // tumbling, or players could cancel bad rolls mid-air (which
        // guts Ultimate's prisoner-exchange rule entirely). The tap is
        // queued rather than dropped so rapid tapping still feels alive.
        if (awaitingSettle.current) {
          queuedThrow.current = { flick };
          return 'queued';
        }
        launch(flick);
        return 'launched';
      },
    };
    launchRef.current = launch;
    return () => {
      controlsRef.current = null;
      launchRef.current = null;
    };
  }, [controlsRef, diceBodies, onThrow]);

  // Cancel any pending queued throw on unmount (round change, arena swap).
  useEffect(
    () => () => {
      if (queuedTimer.current) clearTimeout(queuedTimer.current);
      queuedThrow.current = null;
    },
    [],
  );

  useFrame((state, delta) => {
    physics.world.step(
      TUNING.physics.timeStep,
      Math.min(delta, 0.05),
      TUNING.physics.maxSubSteps,
    );

    let stillNow = true;
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

      // Moat sinking: when a die dips under the surface it is marked as
      // sinking and left to fall VISIBLY through the translucent water for
      // ~0.9s before being fished back out — so the player sees it drown.
      const now = Date.now();
      const inMoatZone =
        obstacles.moat !== null &&
        Math.abs(body.position.x - obstacles.moat.x) < MOAT.size / 2 + 0.15 &&
        Math.abs(body.position.z - obstacles.moat.z) < MOAT.size / 2 + 0.15;
      const sinking = sinkUntil.current[i] > 0;
      if (!sinking && !sankThisRoll.current[i] && inMoatZone && body.position.y < 0.12) {
        sinkUntil.current[i] = now + 900;
        splashT.current = 0; // kick off the splash ring
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        onMoatSink?.();
      }
      const respawn = () => {
        const [startX, startY, startZ] = DIE_START_POSITIONS[i];
        // Placed back on the board rather than dropped: a die fished out
        // of the moat has already cost the player the sinking animation, so
        // it settles almost at once instead of bouncing around again.
        body.position.set(startX, startY + 0.15, startZ);
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
        body.wakeUp();
        sinkUntil.current[i] = 0;
        sankThisRoll.current[i] = true;
        // A die fished out of the moat is dropped back in and rolls again,
        // so the settle deadline restarts here. Measuring from the original
        // throw charged it for the time it spent underwater and left it
        // being snapped still mid-bounce when the backstop fired.
        throwStartedAt.current = Date.now();
      };
      if (sinking) {
        // Slow the fall so the die lingers visibly under the water.
        body.velocity.y = Math.max(body.velocity.y, -1.6);
        if (now >= sinkUntil.current[i] || body.position.y < -3) respawn();
      } else if (isOutOfBounds(body)) {
        respawn();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }

      if (dieSpeed(body) > TUNING.settle.speedThreshold) stillNow = false;
    });

    // Splash ring animation over the moat.
    if (splashRef.current && splashT.current < 1) {
      splashT.current = Math.min(splashT.current + delta / 0.7, 1);
      const t = splashT.current;
      splashRef.current.visible = true;
      splashRef.current.scale.setScalar(0.4 + t * 1.5);
      (splashRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.85 * (1 - t);
    } else if (splashRef.current) {
      splashRef.current.visible = false;
    }

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
      // The settle rule itself lives in src/dice/settle.ts so the headless
      // test suite can exercise exactly this logic (see tests/physics).
      const elapsed = Date.now() - throwStartedAt.current;
      stillFrames.current = stillNow ? stillFrames.current + 1 : 0;

      if (shouldCallRoll(diceBodies, elapsed, stillFrames.current)) {
        awaitingSettle.current = false;
        freezeDice(diceBodies);
        onSettled(readFaces(diceBodies));

        // Fire a tap that arrived mid-roll, just after the result lands so
        // the player sees what they rolled. Dropped if the round ended.
        const queued = queuedThrow.current;
        queuedThrow.current = null;
        if (queued) {
          if (queuedTimer.current) clearTimeout(queuedTimer.current);
          queuedTimer.current = setTimeout(() => {
            if (throwsEnabledRef.current && !awaitingSettle.current) {
              launchRef.current?.(queued.flick);
            }
          }, TUNING.settle.queuedThrowDelayMs);
        }
      }
    }
  });

  return (
    <>
      <CameraRig />
      {/* Near-neutral lights (tints shift hues), back at the brighter
          intensities that suited filmic tone mapping. */}
      <hemisphereLight args={['#eef2fa', '#8f877b', 1.0]} />
      <directionalLight position={[4, 12, 6]} intensity={2.4} />
      <directionalLight position={[-6, 8, -4]} intensity={0.7} color="#f2f4f8" />

      <ArenaComponent />
      {showTreasure && <TreasureChest />}
      <Prisoners units={units} />

      {/* Difficulty obstacles */}
      {obstacles.mound && (
        <mesh position={[obstacles.mound.x, -MOUND.buried, obstacles.mound.z]}>
          <sphereGeometry args={[MOUND.radius, 20, 14]} />
          <meshStandardMaterial color="#7fae66" roughness={0.85} />
        </mesh>
      )}
      {obstacles.moat && (
        <group position={[obstacles.moat.x, 0, obstacles.moat.z]}>
          {/* Dark depths below, so a sinking die silhouettes against it */}
          <mesh position={[0, -1.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[MOAT.size + 0.3, MOAT.size + 0.3]} />
            <meshBasicMaterial color="#0a2c4a" />
          </mesh>
          {/* Translucent water surface — the die is visible sinking under */}
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[MOAT.size + 0.25, MOAT.size + 0.25]} />
            <meshStandardMaterial
              color="#2f9be2"
              roughness={0.12}
              transparent
              opacity={0.62}
            />
          </mesh>
          {/* Foam ring marks it unmistakably as water */}
          <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[MOAT.size / 2 - 0.06, MOAT.size / 2 + 0.06, 4, 1]} />
            <meshBasicMaterial color="#dff2ff" transparent opacity={0.85} />
          </mesh>
          {/* Splash ring (animated on sink) */}
          <mesh
            ref={(m) => {
              splashRef.current = m;
            }}
            visible={false}
            position={[0, 0.06, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.42, 0.55, 24]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0} />
          </mesh>
          {/* Stone rim */}
          {(
            [
              [0, -(MOAT.size / 2 + 0.2), MOAT.size + 0.55, 0.16],
              [0, MOAT.size / 2 + 0.2, MOAT.size + 0.55, 0.16],
            ] as const
          ).map(([x, z, w, d], i) => (
            <mesh key={`rimz-${i}`} position={[x, 0.06, z]}>
              <boxGeometry args={[w, 0.12, d]} />
              <meshStandardMaterial color="#8a7c66" roughness={0.9} />
            </mesh>
          ))}
          {(
            [
              [-(MOAT.size / 2 + 0.2), 0],
              [MOAT.size / 2 + 0.2, 0],
            ] as const
          ).map(([x, z], i) => (
            <mesh key={`rimx-${i}`} position={[x, 0.06, z]}>
              <boxGeometry args={[0.16, 0.12, MOAT.size + 0.25]} />
              <meshStandardMaterial color="#8a7c66" roughness={0.9} />
            </mesh>
          ))}
        </group>
      )}

      {/* Dice */}
      {DIE_START_POSITIONS.map((_pos, i) => (
        <DieMesh
          key={`die-${i}`}
          bodyColor={dieBodyColor}
            pattern={diePattern}
            patternInk={diePatternInk}
            symbols={dieSymbols}
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
