import { useFrame } from '@react-three/fiber/native';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PRISONER_COLORS, PrisonerColorId } from './colors';
import { TUNING } from './tuning';

/** Long jailbreak leap: across the whole castle to the player's retreat. */
const FLIGHT_SECONDS = 1.4;
/** High enough to clear BOTH castle walls + merlons along the way. */
const FLIGHT_PEAK = 3.4;

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
    // Lined up inside the jail pen behind the far wall (see JailPen in
    // CastleArena), standing on its raised floor slab.
    const pen = TUNING.prison;
    const z = -(innerDepth / 2 + wallThickness + pen.depth / 2);
    const usable = pen.innerWidth - 0.8;
    const step = usable / (PRISONER_COLORS.length - 1);
    return PRISONER_COLORS.map((_c, i) => ({
      x: -usable / 2 + i * step,
      y: pen.platformHeight,
      z,
      facing: 0, // face the player through the castle
    }));
  }, [innerDepth, wallThickness]);

  const freeSlots = useMemo<Slot[]>(() => {
    // The freedom retreat on the player's side of the castle — freed
    // prisoners leap the whole castle to reach their rescuer and celebrate
    // on the beach towels (positions match RetreatGarden in CastleArena).
    const towelXs = [-3.3, -2.4, -1.5, 1.5, 2.4, 3.3];
    return towelXs.map((x) => ({
      x,
      y: 0.03,
      z: 6.4,
      facing: 0, // face the castle they escaped (and the player's dice)
    }));
  }, []);

  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const balloonRefs = useRef<(THREE.Group | null)[]>([]);
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

      const balloon = balloonRefs.current[i];
      if (freedIndex === -1) {
        // Waiting in prison: subtle nervous sway.
        group.position.set(prison.x, prison.y, prison.z);
        group.rotation.set(0, prison.facing + Math.sin(now * 2 + i) * 0.1, 0);
        group.scale.setScalar(1);
        if (balloon) balloon.visible = false;
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
        group.scale.setScalar(1.1);
        if (balloon) balloon.visible = false;
      } else {
        // Celebrate at the retreat: bigger figure, happy bouncing, and a
        // floating balloon in the prisoner's color so rescues are easy to
        // spot at the bottom of the screen.
        const bounce = Math.abs(Math.sin(now * 5 + i * 1.3)) * 0.22;
        group.position.set(target.x, target.y + bounce, target.z);
        group.rotation.set(0, target.facing + Math.sin(now * 3 + i) * 0.25, 0);
        group.scale.setScalar(1.35);
        if (balloon) {
          balloon.visible = true;
          balloon.position.y = 1.35 + Math.sin(now * 1.8 + i * 2) * 0.08;
          balloon.rotation.z = Math.sin(now * 1.2 + i) * 0.08;
        }
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
          {/* Body — unlit exact palette hex: this color is a game signal and
              must match the die stickers and HUD swatches precisely. */}
          <mesh position={[0, 0.34, 0]}>
            <capsuleGeometry args={[0.15, 0.28, 6, 12]} />
            <meshBasicMaterial color={color.hex} toneMapped={false} />
          </mesh>
          {/* Head */}
          <mesh position={[0, 0.66, 0]}>
            <sphereGeometry args={[0.13, 16, 12]} />
            <meshStandardMaterial color="#ffe3c2" roughness={0.6} />
          </mesh>
          {/* Helmet cap — unlit exact palette hex, same reason as the body */}
          <mesh position={[0, 0.73, 0]}>
            <sphereGeometry args={[0.135, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
            <meshBasicMaterial color={color.hex} toneMapped={false} />
          </mesh>
          {/* Celebration balloon (visible once rescued) */}
          <group
            ref={(g) => {
              balloonRefs.current[i] = g;
            }}
            visible={false}
            position={[0, 1.35, 0]}
          >
            <mesh position={[0, -0.28, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.55, 4]} />
              <meshBasicMaterial color="#f5f5f5" />
            </mesh>
            <mesh scale={[1, 1.15, 1]}>
              <sphereGeometry args={[0.16, 12, 10]} />
              <meshBasicMaterial color={color.hex} toneMapped={false} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}
