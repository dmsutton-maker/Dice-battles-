import React, { useMemo } from 'react';
import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { createFlagstoneTexture } from './flagstoneTexture';

const STONE = '#9a8a72';
const STONE_DARK = '#7d6e58';
const ROOF = '#e2574c';

/**
 * The castle-courtyard battlefield. Purely visual — the matching collision
 * bodies live in src/physics/world.ts. Walls carry merlons (the notched
 * battlement teeth) and each corner has a round tower with a toy-like red
 * roof, so the tray reads as a playset diorama rather than a plain box.
 */
export function Arena() {
  const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;
  const halfW = innerWidth / 2;
  const halfD = innerDepth / 2;

  const floorTexture = useMemo(() => {
    const texture = createFlagstoneTexture();
    // Keep the stones square on the non-square floor.
    const floorW = innerWidth + wallThickness * 2;
    const floorD = innerDepth + wallThickness * 2;
    texture.repeat.set(1, floorD / floorW);
    return texture;
  }, [innerWidth, innerDepth, wallThickness]);

  const wallMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.9 }),
    [],
  );
  const merlonMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: STONE_DARK, roughness: 0.9 }),
    [],
  );

  // Merlon positions along each wall top.
  const merlons = useMemo(() => {
    const list: { pos: [number, number, number]; alongX: boolean }[] = [];
    const y = wallHeight + 0.12;
    const stepX = 1.1;
    for (let x = -halfW + 0.4; x <= halfW - 0.3; x += stepX) {
      list.push({ pos: [x, y, -(halfD + wallThickness / 2)], alongX: true });
      list.push({ pos: [x, y, halfD + wallThickness / 2], alongX: true });
    }
    const stepZ = 1.15;
    for (let z = -halfD + 0.6; z <= halfD - 0.4; z += stepZ) {
      list.push({ pos: [-(halfW + wallThickness / 2), y, z], alongX: false });
      list.push({ pos: [halfW + wallThickness / 2, y, z], alongX: false });
    }
    return list;
  }, [halfW, halfD, wallHeight, wallThickness]);

  const towerPositions: [number, number][] = [
    [-(halfW + wallThickness), -(halfD + wallThickness)],
    [halfW + wallThickness, -(halfD + wallThickness)],
    [-(halfW + wallThickness), halfD + wallThickness],
    [halfW + wallThickness, halfD + wallThickness],
  ];

  return (
    <group>
      {/* Courtyard floor */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry
          args={[innerWidth + wallThickness * 2, innerDepth + wallThickness * 2]}
        />
        <meshStandardMaterial map={floorTexture} roughness={0.95} />
      </mesh>

      {/* Ground apron outside the walls, so the castle sits on something */}
      <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[innerWidth * 3.2, innerDepth * 2.6]} />
        <meshStandardMaterial color="#5b7d4a" roughness={1} />
      </mesh>

      {/* Walls */}
      <mesh
        material={wallMaterial}
        position={[-(halfW + wallThickness / 2), wallHeight / 2, 0]}
      >
        <boxGeometry
          args={[wallThickness, wallHeight, innerDepth + wallThickness * 2]}
        />
      </mesh>
      <mesh
        material={wallMaterial}
        position={[halfW + wallThickness / 2, wallHeight / 2, 0]}
      >
        <boxGeometry
          args={[wallThickness, wallHeight, innerDepth + wallThickness * 2]}
        />
      </mesh>
      <mesh material={wallMaterial} position={[0, wallHeight / 2, -(halfD + wallThickness / 2)]}>
        <boxGeometry args={[innerWidth, wallHeight, wallThickness]} />
      </mesh>
      <mesh material={wallMaterial} position={[0, wallHeight / 2, halfD + wallThickness / 2]}>
        <boxGeometry args={[innerWidth, wallHeight, wallThickness]} />
      </mesh>

      {/* Battlement merlons */}
      {merlons.map((m, i) => (
        <mesh key={`merlon-${i}`} material={merlonMaterial} position={m.pos}>
          <boxGeometry
            args={m.alongX ? [0.45, 0.24, wallThickness] : [wallThickness, 0.24, 0.5]}
          />
        </mesh>
      ))}

      {/* Corner towers */}
      {towerPositions.map(([x, z], i) => (
        <group key={`tower-${i}`} position={[x, 0, z]}>
          <mesh material={wallMaterial} position={[0, wallHeight / 2 + 0.2, 0]}>
            <cylinderGeometry args={[0.5, 0.56, wallHeight + 0.4, 12]} />
          </mesh>
          <mesh position={[0, wallHeight + 0.72, 0]}>
            <coneGeometry args={[0.6, 0.8, 12]} />
            <meshStandardMaterial color={ROOF} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
