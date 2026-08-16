import { useFrame } from '@react-three/fiber/native';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PrisonerUnit, Station } from './modes';
import { Slot, slotFor as sharedSlotFor } from './stations';
import { TUNING } from './tuning';

const FLIGHT_SECONDS = 1.4;
/** High enough to clear BOTH castle walls + merlons along the way. */
const FLIGHT_PEAK = 3.4;

interface PrisonersProps {
  /** The full lineup with each figure's current station. */
  units: PrisonerUnit[];
}

function stationKey(s: Station): string {
  return `${s.kind}:${s.index}`;
}

/**
 * Generic prisoner-figure animator. Each unit stands at a station (jail pen,
 * player retreat towel, or the far battlement where Sir Rollsalot parades
 * his captures). When a unit's station changes, the figure leaps there in a
 * spinning arc — including BACK to jail in Ultimate mode.
 */
export function Prisoners({ units }: PrisonersProps) {
  const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;

  // Slot coordinates are shared with the arenas (src/game/stations.ts) so
  // every battlefield builds its jail, retreat and battlement around the
  // same positions these figures stand on.
  const slotFor = (s: Station): Slot => sharedSlotFor(s);

  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());
  const balloonRefs = useRef<Map<string, THREE.Group>>(new Map());
  /** Last known station per unit key, to detect moves. */
  const lastStation = useRef<Map<string, string>>(new Map());
  /** In-progress flights: from-slot, to-station, start clock time. */
  const flights = useRef<Map<string, { from: Slot; start: number }>>(new Map());

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;

    units.forEach((unit, i) => {
      const group = groupRefs.current.get(unit.key);
      if (!group) return;
      const balloon = balloonRefs.current.get(unit.key);
      const target = slotFor(unit.station);
      const stKey = stationKey(unit.station);
      const prev = lastStation.current.get(unit.key);

      if (prev !== undefined && prev !== stKey) {
        // Station changed: launch a flight from wherever the figure is now.
        flights.current.set(unit.key, {
          from: { x: group.position.x, y: group.position.y, z: group.position.z, facing: 0 },
          start: now,
        });
      }
      lastStation.current.set(unit.key, stKey);

      const flight = flights.current.get(unit.key);
      if (flight) {
        const t = Math.min((now - flight.start) / FLIGHT_SECONDS, 1);
        if (t < 1) {
          const ease = t * t * (3 - 2 * t);
          const x = flight.from.x + (target.x - flight.from.x) * ease;
          const z = flight.from.z + (target.z - flight.from.z) * ease;
          const y =
            flight.from.y +
            (target.y - flight.from.y) * ease +
            Math.sin(Math.PI * t) * FLIGHT_PEAK;
          group.position.set(x, y, z);
          group.rotation.set(0, t * Math.PI * 2, 0);
          group.scale.setScalar(1.1);
          if (balloon) balloon.visible = false;
          return;
        }
        flights.current.delete(unit.key);
      }

      // Settled at the station: idle animation per station kind.
      if (unit.station.kind === 'jail') {
        group.position.set(target.x, target.y, target.z);
        group.rotation.set(0, Math.sin(now * 2 + i) * 0.1, 0);
        group.scale.setScalar(1);
        if (balloon) balloon.visible = false;
      } else if (unit.station.kind === 'retreat') {
        const bounce = Math.abs(Math.sin(now * 5 + i * 1.3)) * 0.22;
        group.position.set(target.x, target.y + bounce, target.z);
        group.rotation.set(0, Math.sin(now * 3 + i) * 0.25, 0);
        group.scale.setScalar(1.35);
        if (balloon) {
          balloon.visible = true;
          balloon.position.y = 1.35 + Math.sin(now * 1.8 + i * 2) * 0.08;
          balloon.rotation.z = Math.sin(now * 1.2 + i) * 0.08;
        }
      } else {
        // Captured on the battlement: droopy little march in place.
        group.position.set(
          target.x,
          target.y + Math.abs(Math.sin(now * 2.4 + i)) * 0.05,
          target.z,
        );
        group.rotation.set(0.12, Math.sin(now * 1.5 + i) * 0.12, 0);
        group.scale.setScalar(1.05);
        if (balloon) balloon.visible = false;
      }
    });
  });

  return (
    <>
      {units.map((unit) => (
        <group
          key={unit.key}
          ref={(g) => {
            if (g) groupRefs.current.set(unit.key, g);
            else groupRefs.current.delete(unit.key);
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
            <meshBasicMaterial color={unit.hex} toneMapped={false} />
          </mesh>
          {/* Head */}
          <mesh position={[0, 0.66, 0]}>
            <sphereGeometry args={[0.13, 16, 12]} />
            <meshStandardMaterial color="#ffe3c2" roughness={0.6} />
          </mesh>
          {/* Helmet cap — unlit exact palette hex, same reason as the body */}
          <mesh position={[0, 0.73, 0]}>
            <sphereGeometry args={[0.135, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
            <meshBasicMaterial color={unit.hex} toneMapped={false} />
          </mesh>
          {/* Celebration balloon (visible once safely at the retreat) */}
          <group
            ref={(g) => {
              if (g) balloonRefs.current.set(unit.key, g);
              else balloonRefs.current.delete(unit.key);
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
              <meshBasicMaterial color={unit.hex} toneMapped={false} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}
