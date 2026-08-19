import React, { useMemo } from 'react';
import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import {
  CORNER_TOWERS,
  RETREAT_POOL,
  RETREAT_POST_XS,
  RETREAT_POST_Z,
  RETREAT_PROPS,
  RETREAT_XS,
  RETREAT_Z,
} from '../game/stations';

import { createFlagstoneTexture } from './flagstoneTexture';

const STONE = '#9a8a72';
const STONE_DARK = '#7d6e58';

/** Palette knobs that differ between the day and sunset variants. */
const VARIANTS = {
  day: {
    roof: '#e2574c',
    meadow: '#6a9a58',
    hill: '#5c8c4c',
    water: '#57b0e8',
    cloud: '#ffffff',
    umbrellaA: '#ff7f66',
    umbrellaB: '#5bc8e8',
  },
  sunset: {
    roof: '#b84fa0',
    meadow: '#7d9150',
    hill: '#6b7f45',
    water: '#e8955c',
    cloud: '#ffd9b8',
    umbrellaA: '#ff9d5c',
    umbrellaB: '#c084e8',
  },
} as const;
export type CastleVariant = keyof typeof VARIANTS;

/** Simple toy tree: trunk + cone of leaves. */
function Tree({
  position,
  scale = 1,
  leaf = '#3e9450',
}: {
  position: [number, number, number];
  scale?: number;
  leaf?: string;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.13, 0.17, 0.56, 8]} />
        <meshStandardMaterial color="#7a5230" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <coneGeometry args={[0.72, 1.5, 9]} />
        <meshStandardMaterial color={leaf} roughness={0.85} />
      </mesh>
    </group>
  );
}

const TREES: { position: [number, number, number]; scale: number; leaf: string }[] = [
  { position: [-6.2, -0.1, -3.2], scale: 1.15, leaf: '#3e9450' },
  { position: [-7.6, -0.1, -6.4], scale: 1.4, leaf: '#347e44' },
  { position: [6.3, -0.1, -2.6], scale: 1.05, leaf: '#48a457' },
  { position: [7.2, -0.1, -5.8], scale: 1.3, leaf: '#3e9450' },
  { position: [-5.6, -0.1, 6.6], scale: 1.2, leaf: '#48a457' },
  { position: [6.1, -0.1, 7.1], scale: 1.35, leaf: '#347e44' },
  { position: [8.2, -0.1, 2.1], scale: 1.0, leaf: '#3e9450' },
  { position: [-8.6, -0.1, 0.6], scale: 1.25, leaf: '#48a457' },
  { position: [4.9, -0.1, 9.3], scale: 1.1, leaf: '#3e9450' },
  { position: [-4.6, -0.1, -8.4], scale: 1.2, leaf: '#347e44' },
  { position: [5.6, -0.1, -8.7], scale: 1.0, leaf: '#48a457' },
  { position: [-8.9, -0.1, 4.6], scale: 1.15, leaf: '#3e9450' },
];

/**
 * Open-top jail pen attached behind the far castle wall: raised stone slab,
 * iron bars on the three outer sides (the castle wall is the fourth), stone
 * corner posts. The prisoners line up inside; a rescue leaps them over the
 * castle wall. Open top keeps them visible to the near-overhead camera.
 */
function JailPen() {
  const { innerDepth, wallThickness } = TUNING.tray;
  const { innerWidth: penW, depth: penD, platformHeight, barHeight } = TUNING.prison;
  const zNear = -(innerDepth / 2 + wallThickness); // shared with the far wall
  const zFar = zNear - penD;
  const zCenter = (zNear + zFar) / 2;
  const halfW = penW / 2;
  const floorY = platformHeight; // top of the platform = pen floor

  const bars: [number, number][] = [];
  // Far side of the pen.
  const farCount = 10;
  for (let i = 0; i <= farCount; i++) {
    bars.push([-halfW + (i * penW) / farCount, zFar]);
  }
  // Short ends.
  const endCount = 3;
  for (let i = 1; i <= endCount; i++) {
    const z = zNear - (i * penD) / (endCount + 1);
    bars.push([-halfW, z]);
    bars.push([halfW, z]);
  }

  return (
    <group>
      {/* Solid stone platform lifting the pen above the castle wall's cover */}
      <mesh position={[0, floorY / 2, zCenter]}>
        <boxGeometry args={[penW + 0.4, floorY, penD + 0.3]} />
        <meshStandardMaterial color="#8f8371" roughness={0.95} />
      </mesh>

      {/* Iron bars */}
      {bars.map(([x, z], i) => (
        <mesh key={`bar-${i}`} position={[x, floorY + barHeight / 2, z]}>
          <cylinderGeometry args={[0.045, 0.045, barHeight, 6]} />
          <meshStandardMaterial color="#454a52" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}

      {/* Top rails */}
      <mesh position={[0, floorY + barHeight, zFar]}>
        <boxGeometry args={[penW + 0.2, 0.09, 0.09]} />
        <meshStandardMaterial color="#3a3f46" roughness={0.5} metalness={0.4} />
      </mesh>
      {([-halfW, halfW] as const).map((x, i) => (
        <mesh key={`rail-${i}`} position={[x, floorY + barHeight, zCenter]}>
          <boxGeometry args={[0.09, 0.09, penD + 0.1]} />
          <meshStandardMaterial color="#3a3f46" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}

      {/* Stone corner posts */}
      {(
        [
          [-halfW, zFar],
          [halfW, zFar],
        ] as const
      ).map(([x, z], i) => (
        <mesh key={`post-${i}`} position={[x, (floorY + barHeight + 0.15) / 2, z]}>
          <boxGeometry args={[0.24, floorY + barHeight + 0.15, 0.24]} />
          <meshStandardMaterial color={STONE_DARK} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The freedom retreat on the player's side of the castle — the rescuer's
 * camp where freed prisoners come to relax: beach towels to land on, two
 * sun umbrellas, a little pool, and flowering bushes. Slot positions must
 * stay in sync with the free slots in src/game/Prisoners.tsx.
 */
function RetreatGarden({ palette }: { palette: (typeof VARIANTS)[CastleVariant] }) {
  const towelXs = RETREAT_XS;
  const towelColors = ['#ffe08a', '#9be0ff', '#ffc4d6', '#c9f0b8', '#e8d5ff', '#ffd7b0'];
  return (
    <group>
      {/* Beach towels the freed prisoners celebrate on */}
      {towelXs.map((x, i) => (
        <mesh key={`towel-${i}`} position={[x, 0.015, RETREAT_Z]}>
          <boxGeometry args={[0.6, 0.03, 0.95]} />
          <meshStandardMaterial color={towelColors[i]} roughness={0.9} />
        </mesh>
      ))}

      {/* Sun umbrellas */}
      {[palette.umbrellaA, palette.umbrellaB].map((color, i) => (
        <group
          key={`umbrella-${i}`}
          position={[RETREAT_POST_XS[i], 0, RETREAT_POST_Z]}
        >
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 1.4, 8]} />
            <meshStandardMaterial color="#e8e0d0" roughness={0.7} />
          </mesh>
          <mesh position={[0, 1.42, 0]}>
            <coneGeometry args={[0.85, 0.42, 10]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Little pool */}
      <group position={[RETREAT_POOL[0], 0, RETREAT_POOL[1]]}>
        <mesh position={[0, 0.09, 0]}>
          <cylinderGeometry args={[1.05, 1.1, 0.18, 20]} />
          <meshStandardMaterial color="#bcae94" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.92, 20]} />
          <meshStandardMaterial color={palette.water} roughness={0.2} />
        </mesh>
      </group>

      {/* Flowering bushes */}
      {RETREAT_PROPS.map(([x, z], i) => (
        <group key={`bush-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.28, 0]} scale={[1, 0.72, 1]}>
            <sphereGeometry args={[0.42, 12, 8]} />
            <meshStandardMaterial color="#48a457" roughness={0.9} />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh
              key={k}
              position={[
                Math.cos(k * 2.1) * 0.3,
                0.42 + Math.sin(k * 1.7) * 0.12,
                Math.sin(k * 2.1) * 0.3,
              ]}
            >
              <sphereGeometry args={[0.07, 8, 6]} />
              <meshStandardMaterial color={['#ff8ab0', '#ffe521', '#ff7f66'][k]} roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * The toy world around the castle: meadow, path to the gate, pond, trees,
 * rolling hills, distant mountains, and a few clouds. Everything procedural
 * and cheap — unlit clouds, low-poly cones and squashed spheres.
 */
function Landscape({ palette }: { palette: (typeof VARIANTS)[CastleVariant] }) {
  return (
    <group>
      {/* Meadow */}
      <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[34, 40]} />
        <meshStandardMaterial color={palette.meadow} roughness={1} />
      </mesh>

      {/* Dirt path from the near gate out toward the player */}
      <mesh position={[0, -0.06, 8.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.7, 6.4]} />
        <meshStandardMaterial color="#c7ad83" roughness={1} />
      </mesh>

      {/* Pond */}
      <mesh position={[-6.6, -0.05, 2.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.1, 24]} />
        <meshStandardMaterial color={palette.water} roughness={0.25} />
      </mesh>

      {/* Trees */}
      {TREES.map((tree, i) => (
        <Tree key={`tree-${i}`} {...tree} />
      ))}

      {/* Rolling hills */}
      {(
        [
          [-12, -1.4, -9, 4.5],
          [12.5, -1.6, -10, 5.2],
          [0, -2.6, -17, 8.5],
          [-13, -1.8, 4, 4.8],
          [13.5, -2, 6, 5],
        ] as const
      ).map(([x, y, z, r], i) => (
        <mesh key={`hill-${i}`} position={[x, y, z]} scale={[1, 0.45, 1]}>
          <sphereGeometry args={[r, 16, 12]} />
          <meshStandardMaterial color={palette.hill} roughness={1} />
        </mesh>
      ))}

      {/* Distant mountains */}
      {(
        [
          [-9.5, -19, 5, 6.5],
          [0.5, -23, 7.5, 9],
          [9.5, -18, 4.6, 5.5],
        ] as const
      ).map(([x, z, r, h], i) => (
        <mesh key={`mountain-${i}`} position={[x, h / 2 - 1.2, z]}>
          <coneGeometry args={[r, h, 10]} />
          <meshStandardMaterial color="#8b93a5" roughness={1} />
        </mesh>
      ))}

      {/* Clouds — unlit flat white puffs */}
      {(
        [
          [-8, 7.5, -13, 1.6],
          [7.5, 8.5, -15, 2],
          [-2.5, 9.5, -19, 2.6],
          [10, 7, -9, 1.4],
        ] as const
      ).map(([x, y, z, s], i) => (
        <group key={`cloud-${i}`} position={[x, y, z]} scale={[s, s * 0.5, s]}>
          <mesh>
            <sphereGeometry args={[1, 12, 8]} />
            <meshBasicMaterial color={palette.cloud} />
          </mesh>
          <mesh position={[1.1, -0.1, 0.2]} scale={0.7}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshBasicMaterial color={palette.cloud} />
          </mesh>
          <mesh position={[-1.1, -0.15, -0.1]} scale={0.6}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshBasicMaterial color={palette.cloud} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * The castle-courtyard battlefield. Purely visual — the matching collision
 * bodies live in src/physics/world.ts. Walls carry merlons (the notched
 * battlement teeth) and each corner has a round tower with a toy-like red
 * roof, and the castle sits in a toy landscape (meadow, trees, pond, hills,
 * mountains, clouds) so it reads as a playset diorama in a world rather
 * than a box floating in space.
 */
export function CastleArena({ variant = 'day' }: { variant?: CastleVariant }) {
  const palette = VARIANTS[variant];
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

  // Shared with the station maths so the wall row can be checked against
  // these without the two drifting apart.
  const towerPositions: [number, number][] = CORNER_TOWERS.map((t) => [t.x, t.z]);

  return (
    <group>
      {/* Courtyard floor */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry
          args={[innerWidth + wallThickness * 2, innerDepth + wallThickness * 2]}
        />
        <meshStandardMaterial map={floorTexture} roughness={0.95} />
      </mesh>

      <Landscape palette={palette} />
      <JailPen />
      <RetreatGarden palette={palette} />

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
            <meshStandardMaterial color={palette.roof} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}


/** Sunset variant used by the arena registry (trophy unlock). */
export function SunsetCastleArena() {
  return <CastleArena variant="sunset" />;
}
