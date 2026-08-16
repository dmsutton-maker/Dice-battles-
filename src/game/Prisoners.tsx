import { useFrame } from '@react-three/fiber/native';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PRISONER_COLORS, PrisonerColorId } from './colors';
import { TUNING } from './tuning';

const FLIGHT_SECONDS = 1.1;
const FLIGHT_PEAK = 2.6;

interface PrisonersProps {
  /** Colors freed so far, in rescue order. Empty array = everyone back in prison. */
  freedOrder: PrisonerColorId[];
}

interface Slot {
  x: number;
  y: number;
  z: number;
  facing: number;
}

/**
 * The six prisoners. They wait on the far battlement (the "prison"), and a
 * rescued prisoner leaps off the wall in an arc to a celebration spot on a
 * side wall, where it bounces happily. Toy-soldier pawn look: round base,
 * capsule body, head — all in the prisoner's color.
 */
export function Prisoners({ freedOrder }: PrisonersProps) {
  const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;

  const prisonSlots = useMemo<Slot[]>(() => {
    const z = -(innerDepth / 2 + wallThickness / 2);
    // Spread the six figures across the far wall, whatever its width.
    const usable = innerWidth - 0.5;
    const step = usable / (PRISONER_COLORS.length - 1);
    return PRISONER_COLORS.map((_c, i) => ({
      x: -usable / 2 + i * step,
      y: wallHeight + 0.24,
      z,
      facing: 0, // face the player
    }));
  }, [innerWidth, innerDepth, wallHeight, wallThickness]);

  const freeSlots = useMemo<Slot[]>(() => {
    const xLeft = -(innerWidth / 2 + wallThickness / 2);
    const xRight = innerWidth / 2 + wallThickness / 2;
    const zs = [-2.2, 0, 2.2];
    const slots: Slot[] = [];
    zs.forEach((z) =>
      slots.push({ x: xLeft, y: wallHeight + 0.24, z, facing: Math.PI / 2 }),
    );
    zs.forEach((z) =>
      slots.push({ x: xRight, y: wallHeight + 0.24, z, facing: -Math.PI / 2 }),
    );
    return slots;
  }, [innerWidth, wallHeight, wallThickness]);

  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  // Flight start time (clock seconds) per color id; cleared on reset.
  const flightStarts = useRef<Map<PrisonerColorId, number>>(new Map());

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    if (freedOrder.length === 0 && flightStarts.current.size > 0) {
      flightStarts.current.clear();
    }

    PRISONER_COLORS.forEach((color, i) => {
      const group = groupRefs.current[i];
      if (!group) return;

      const freedIndex = freedOrder.indexOf(color.id);
      const prison = prisonSlots[i];

      if (freedIndex === -1) {
        // Waiting in prison: subtle nervous sway.
        group.position.set(prison.x, prison.y, prison.z);
        group.rotation.set(0, prison.facing + Math.sin(now * 2 + i) * 0.1, 0);
        group.scale.setScalar(1);
        return;
      }

      const target = freeSlots[freedIndex % freeSlots.length];
      let start = flightStarts.current.get(color.id);
      if (start === undefined) {
        start = now;
        flightStarts.current.set(color.id, start);
      }
      const t = Math.min((now - start) / FLIGHT_SECONDS, 1);

      if (t < 1) {
        // Arc leap from prison battlement to the celebration wall.
        const ease = t * t * (3 - 2 * t); // smoothstep
        const x = prison.x + (target.x - prison.x) * ease;
        const z = prison.z + (target.z - prison.z) * ease;
        const y =
          prison.y +
          (target.y - prison.y) * ease +
          Math.sin(Math.PI * t) * FLIGHT_PEAK;
        group.position.set(x, y, z);
        group.rotation.set(0, prison.facing + t * Math.PI * 2, 0);
      } else {
        // Celebrate: happy bouncing on the wall.
        const bounce = Math.abs(Math.sin(now * 5 + i * 1.3)) * 0.22;
        group.position.set(target.x, target.y + bounce, target.z);
        group.rotation.set(0, target.facing + Math.sin(now * 3 + i) * 0.25, 0);
      }
    });
  });

  return (
    <>
      {PRISONER_COLORS.map((color, i) => (
        <group
          key={color.id}
          ref={(g) => {
            groupRefs.current[i] = g;
          }}
        >
          {/* Base */}
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.2, 0.23, 0.08, 16]} />
            <meshStandardMaterial color="#4b4238" roughness={0.8} />
          </mesh>
          {/* Body */}
          <mesh position={[0, 0.34, 0]}>
            <capsuleGeometry args={[0.15, 0.28, 6, 12]} />
            <meshStandardMaterial color={color.hex} roughness={0.5} />
          </mesh>
          {/* Head */}
          <mesh position={[0, 0.66, 0]}>
            <sphereGeometry args={[0.13, 16, 12]} />
            <meshStandardMaterial color="#ffe3c2" roughness={0.6} />
          </mesh>
          {/* Helmet cap in the prisoner's color */}
          <mesh position={[0, 0.73, 0]}>
            <sphereGeometry args={[0.135, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
            <meshStandardMaterial color={color.hex} roughness={0.45} />
          </mesh>
        </group>
      ))}
    </>
  );
}
