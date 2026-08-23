import React, { useMemo } from 'react';
import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import {
  RETREAT_POOL,
  RETREAT_POST_XS,
  RETREAT_POST_Z,
  RETREAT_PROPS,
  RETREAT_XS,
  RETREAT_Z,
} from '../game/stations';

import { createFlagstoneTexture } from './flagstoneTexture';

/**
 * Space Station arena — the 700🏆 Mystery Arena. A dice deck floating in
 * orbit: metal panel floor, glowing energy-field jail, antenna pylons,
 * starfield and a ringed planet. Same footprint as the castle (dimensions
 * from TUNING) so physics and every prisoner slot line up unchanged.
 *
 * Glowing accents use MeshBasicMaterial (unlit) with toneMapped:false so
 * they read as emissive light sources without a bloom pass.
 */

const HULL = '#8a93a8';
const HULL_DARK = '#5c6478';
const GLOW_CYAN = '#3ff2ff';
/**
 * How much of the boundary is solid hull. The rest is the containment
 * field: see-through, so the deck reads as open rather than walled in.
 * Knee-high on the dice, which is enough to look like a real edge you
 * could trip over without becoming a wall.
 */
const RIM_HEIGHT = 0.42;
const GLOW_MAGENTA = '#ff5fd0';

/** Starfield: one Points draw call, ~320 stars on a big sphere shell. */
function Starfield() {
  const geometry = useMemo(() => {
    const COUNT = 320;
    const positions = new Float32Array(COUNT * 3);
    // Deterministic-ish scatter (seeded by index) on the upper hemisphere of
    // a big shell so stars surround the deck without dipping below it.
    for (let i = 0; i < COUNT; i++) {
      const a = i * 2.399963; // golden-angle spiral = even coverage
      const t = (i + 0.5) / COUNT;
      const y = 0.05 + t * 0.95; // keep above the horizon
      const r = Math.sqrt(1 - y * y);
      const R = 55 + ((i * 37) % 20);
      positions[i * 3] = Math.cos(a) * r * R;
      positions[i * 3 + 1] = y * R * 0.7 - 4;
      positions[i * 3 + 2] = Math.sin(a) * r * R - 10;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#ffffff',
        size: 0.28,
        sizeAttenuation: true,
        toneMapped: false,
      }),
    [],
  );

  return <points geometry={geometry} material={material} />;
}

/** Ringed planet hanging in the distance behind the station. */
function Planet() {
  return (
    <group position={[8.5, 7.5, -26]} rotation={[0.4, 0, -0.35]}>
      <mesh>
        <sphereGeometry args={[3.4, 20, 16]} />
        <meshBasicMaterial color="#c98a5c" toneMapped={false} />
      </mesh>
      {/* Simple band detail */}
      <mesh position={[0, 0.7, 0.1]} scale={[1.001, 1, 1.001]}>
        <sphereGeometry args={[3.4, 20, 4, 0, Math.PI * 2, 1.2, 0.25]} />
        <meshBasicMaterial color="#a86b42" toneMapped={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.2, 5.6, 40]} />
        <meshBasicMaterial
          color="#e8d5a8"
          toneMapped={false}
          side={THREE.DoubleSide}
          transparent
          opacity={0.8}
        />
      </mesh>
      {/* A small moon */}
      <mesh position={[-5.5, 2.8, 1]}>
        <sphereGeometry args={[0.6, 12, 10]} />
        <meshBasicMaterial color="#b8bcc9" toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * Containment-cell jail pen: same platform and bar coordinates as the
 * castle's JailPen (slots synced with src/game/Prisoners.tsx), themed as a
 * hull platform with glowing energy-field bars.
 */
function SpaceJailPen() {
  const { innerDepth, wallThickness } = TUNING.tray;
  const { innerWidth: penW, depth: penD, platformHeight, barHeight } = TUNING.prison;
  const zNear = -(innerDepth / 2 + wallThickness);
  const zFar = zNear - penD;
  const zCenter = (zNear + zFar) / 2;
  const halfW = penW / 2;
  const floorY = platformHeight;

  const bars: [number, number][] = [];
  const farCount = 10;
  for (let i = 0; i <= farCount; i++) {
    bars.push([-halfW + (i * penW) / farCount, zFar]);
  }
  const endCount = 3;
  for (let i = 1; i <= endCount; i++) {
    const z = zNear - (i * penD) / (endCount + 1);
    bars.push([-halfW, z]);
    bars.push([halfW, z]);
  }

  const glowBar = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: GLOW_CYAN,
        toneMapped: false,
        transparent: true,
        opacity: 0.85,
      }),
    [],
  );

  return (
    <group>
      {/* Hull platform */}
      <mesh position={[0, floorY / 2, zCenter]}>
        <boxGeometry args={[penW + 0.4, floorY, penD + 0.3]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.5} metalness={0.5} />
      </mesh>

      {/* Energy-field bars */}
      {bars.map(([x, z], i) => (
        <mesh key={`bar-${i}`} material={glowBar} position={[x, floorY + barHeight / 2, z]}>
          <cylinderGeometry args={[0.035, 0.035, barHeight, 6]} />
        </mesh>
      ))}

      {/* Emitter rails top and corners */}
      <mesh position={[0, floorY + barHeight, zFar]}>
        <boxGeometry args={[penW + 0.2, 0.1, 0.1]} />
        <meshStandardMaterial color="#3a4052" roughness={0.4} metalness={0.6} />
      </mesh>
      {([-halfW, halfW] as const).map((x, i) => (
        <mesh key={`rail-${i}`} position={[x, floorY + barHeight, zCenter]}>
          <boxGeometry args={[0.1, 0.1, penD + 0.1]} />
          <meshStandardMaterial color="#3a4052" roughness={0.4} metalness={0.6} />
        </mesh>
      ))}

      {/* Corner emitter posts with warning lights */}
      {(
        [
          [-halfW, zFar],
          [halfW, zFar],
        ] as const
      ).map(([x, z], i) => (
        <group key={`post-${i}`} position={[x, 0, z]}>
          <mesh position={[0, (floorY + barHeight + 0.15) / 2, 0]}>
            <boxGeometry args={[0.24, floorY + barHeight + 0.15, 0.24]} />
            <meshStandardMaterial color="#3a4052" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[0, floorY + barHeight + 0.26, 0]}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshBasicMaterial color={GLOW_MAGENTA} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Freedom retreat: same landing-slot coordinates as the castle's
 * RetreatGarden (synced with src/game/Prisoners.tsx), themed as a shuttle
 * bay — glowing landing pads, beacon masts, a cryo-pool, and crate stacks.
 */
function SpaceRetreat() {
  const padXs = RETREAT_XS;
  const padColors = ['#3ff2ff', '#7fff9e', '#ffd93f', '#ff9e5f', '#c98aff', '#ff5fd0'];
  return (
    <group>
      {/* Glowing landing pads where freed prisoners celebrate */}
      {padXs.map((x, i) => (
        <group key={`pad-${i}`} position={[x, 0, RETREAT_Z]}>
          <mesh position={[0, 0.015, 0]}>
            <boxGeometry args={[0.62, 0.03, 0.97]} />
            <meshStandardMaterial color={HULL_DARK} roughness={0.5} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.18, 0.26, 16]} />
            <meshBasicMaterial color={padColors[i]} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Beacon masts at the umbrella slots */}
      {[GLOW_CYAN, GLOW_MAGENTA].map((color, i) => (
        <group
          key={`beacon-${i}`}
          position={[RETREAT_POST_XS[i], 0, RETREAT_POST_Z]}
        >
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 1.4, 8]} />
            <meshStandardMaterial color={HULL} roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[0, 1.48, 0]}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <mesh position={[0, 1.32, 0]}>
            <coneGeometry args={[0.24, 0.16, 10]} />
            <meshStandardMaterial color={HULL_DARK} roughness={0.4} metalness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Cryo-pool (same spot as the castle pool) */}
      <group position={[RETREAT_POOL[0], 0, RETREAT_POOL[1]]}>
        <mesh position={[0, 0.09, 0]}>
          <cylinderGeometry args={[1.05, 1.1, 0.18, 20]} />
          <meshStandardMaterial color={HULL_DARK} roughness={0.5} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.92, 20]} />
          <meshBasicMaterial color="#5fd8ff" toneMapped={false} transparent opacity={0.9} />
        </mesh>
      </group>

      {/* Supply crate stacks where the castle bushes were */}
      {RETREAT_PROPS.map(([x, z], i) => (
        <group key={`crates-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.5, 0.4, 0.5]} />
            <meshStandardMaterial color="#6b7488" roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position={[0.12, 0.55, -0.05]} rotation={[0, 0.5, 0]}>
            <boxGeometry args={[0.34, 0.3, 0.34]} />
            <meshStandardMaterial color="#8a93a8" roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position={[0.12, 0.72, -0.05]}>
            <sphereGeometry args={[0.05, 8, 6]} />
            <meshBasicMaterial color="#7fff9e" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The orbital surroundings: apron ring, solar wings, stars, planet. */
function SpaceWorld() {
  const { innerWidth, innerDepth, wallThickness } = TUNING.tray;
  const apronW = innerWidth + wallThickness * 2 + 9;
  const apronD = innerDepth + wallThickness * 2 + 10;

  const panel = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2a4a8a', roughness: 0.35, metalness: 0.5 }),
    [],
  );

  return (
    <group>
      {/* Dark hull apron the whole station sits on (replaces the meadow) */}
      <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[apronW, apronD]} />
        <meshStandardMaterial color="#353b4d" roughness={0.6} metalness={0.4} />
      </mesh>

      {/* Glowing walkway strip toward the player (replaces the dirt path) */}
      <mesh position={[0, -0.055, 8.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.7, 6.4]} />
        <meshBasicMaterial color="#1f5f7a" toneMapped={false} />
      </mesh>
      {[6.2, 7.4, 8.6, 9.8].map((z, i) => (
        <mesh key={`chevron-${i}`} position={[0, -0.05, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.2, 0.18]} />
          <meshBasicMaterial color={GLOW_CYAN} toneMapped={false} />
        </mesh>
      ))}

      {/* Solar panel wings off both sides of the deck */}
      {([-1, 1] as const).map((side) => (
        <group key={`wing-${side}`} position={[side * (apronW / 2 + 2.6), 0.3, -1]}>
          <mesh position={[side * -2.1, 0, 0]}>
            <boxGeometry args={[4.4, 0.12, 0.4]} />
            <meshStandardMaterial color={HULL} roughness={0.4} metalness={0.6} />
          </mesh>
          {[-1.6, 0, 1.6].map((z, i) => (
            <mesh key={i} material={panel} position={[0, 0, z]} rotation={[0.35, 0, 0]}>
              <boxGeometry args={[4.6, 0.06, 1.35]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Docked shuttle beyond the far wall */}
      <group position={[-6.8, 0.4, -8.6]} rotation={[0, 0.5, 0]}>
        <mesh>
          <capsuleGeometry args={[0.55, 1.6, 6, 12]} />
          <meshStandardMaterial color="#c9ccd8" roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.4]}>
          <boxGeometry args={[0.1, 2.6, 1.2]} />
          <meshStandardMaterial color="#8a93a8" roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh position={[0, -1.15, 0]}>
          <coneGeometry args={[0.32, 0.4, 10]} />
          <meshBasicMaterial color="#ff9e3f" toneMapped={false} />
        </mesh>
      </group>

      <Starfield />
      <Planet />
    </group>
  );
}

/**
 * The space-station battlefield. Hull walls with glowing light strips
 * replace the castle battlements; antenna pylons stand at the corners.
 * Collision bodies are unchanged in src/physics/world.ts — all visual.
 */
export function SpaceArena() {
  const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;
  const halfW = innerWidth / 2;
  const halfD = innerDepth / 2;

  const floorTexture = useMemo(() => {
    // Steel deck panels with dark seams.
    const texture = createFlagstoneTexture({ r: 118, g: 124, b: 138 }, 0.45);
    const floorW = innerWidth + wallThickness * 2;
    const floorD = innerDepth + wallThickness * 2;
    texture.repeat.set(1, floorD / floorW);
    return texture;
  }, [innerWidth, innerDepth, wallThickness]);

  const wallMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: HULL, roughness: 0.45, metalness: 0.5 }),
    [],
  );
  const stripMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: GLOW_CYAN, toneMapped: false }),
    [],
  );
  /**
   * The containment field. Unlit and see-through, drawn on both sides so
   * it reads the same looking out from the deck as looking in — a
   * one-sided panel would vanish from whichever side the camera is on.
   */
  const fieldMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: GLOW_CYAN,
        transparent: true,
        opacity: 0.17,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  /** Studs along the rim, evenly spaced, that the field hangs between. */
  const emitters = useMemo(() => {
    const list: [number, number, number][] = [];
    for (let x = -halfW - wallThickness / 2; x <= halfW + wallThickness / 2 + 0.01; x += 0.72) {
      list.push([x, RIM_HEIGHT, -(halfD + wallThickness / 2)]);
      list.push([x, RIM_HEIGHT, halfD + wallThickness / 2]);
    }
    for (let z = -halfD - wallThickness / 2 + 0.72; z <= halfD + wallThickness / 2 - 0.5; z += 0.78) {
      list.push([-(halfW + wallThickness / 2), RIM_HEIGHT, z]);
      list.push([halfW + wallThickness / 2, RIM_HEIGHT, z]);
    }
    return list;
  }, [halfW, halfD, wallThickness]);

  // Glowing light strips along every wall top — the station's "battlements".
  const strips = useMemo(() => {
    // On the rim, not at wall height: the wall above the rim is a
    // see-through field now, so a light strip up there would be a glowing
    // line floating in the air.
    const y = RIM_HEIGHT + 0.04;
    return [
      { pos: [0, y, -(halfD + wallThickness / 2)] as const, size: [innerWidth, 0.08, 0.12] as const },
      { pos: [0, y, halfD + wallThickness / 2] as const, size: [innerWidth, 0.08, 0.12] as const },
      { pos: [-(halfW + wallThickness / 2), y, 0] as const, size: [0.12, 0.08, innerDepth] as const },
      { pos: [halfW + wallThickness / 2, y, 0] as const, size: [0.12, 0.08, innerDepth] as const },
    ];
  }, [halfW, halfD, wallThickness, innerWidth, innerDepth]);

  /**
   * Vents low on the rim, where the portholes used to be.
   *
   * Portholes need a wall to be set into. They sat at 55% of wall height,
   * which is now open field — they would have hung in mid-air. Dropped to
   * the rim they read as deck vents, which is what a low hull edge would
   * actually carry.
   */
  const portholes = useMemo(() => {
    const list: { pos: [number, number, number]; rotY: number }[] = [];
    const y = RIM_HEIGHT * 0.55;
    for (let i = 0; i < 4; i++) {
      const x = -halfW + 0.9 + i * 1.0;
      list.push({ pos: [x, y, -(halfD - 0.01)], rotY: 0 });
      list.push({ pos: [x, y, halfD - 0.01], rotY: Math.PI });
    }
    for (let i = 0; i < 5; i++) {
      const z = -halfD + 1.2 + i * 1.7;
      list.push({ pos: [-(halfW - 0.01), y, z], rotY: Math.PI / 2 });
      list.push({ pos: [halfW - 0.01, y, z], rotY: -Math.PI / 2 });
    }
    return list;
  }, [halfW, halfD]);

  const pylonPositions: [number, number][] = [
    [-(halfW + wallThickness), -(halfD + wallThickness)],
    [halfW + wallThickness, -(halfD + wallThickness)],
    [-(halfW + wallThickness), halfD + wallThickness],
    [halfW + wallThickness, halfD + wallThickness],
  ];

  return (
    <group>
      {/* Deck floor */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry
          args={[innerWidth + wallThickness * 2, innerDepth + wallThickness * 2]}
        />
        <meshStandardMaterial map={floorTexture} roughness={0.6} metalness={0.35} />
      </mesh>

      <SpaceWorld />
      <SpaceJailPen />
      <SpaceRetreat />

      {/*
        A knee-high hull rim, and above it a containment field.
        
        The station used to be four full-height solid walls — the castle's
        walls in grey, which is why it read as a castle in space. It is now
        mostly OPEN: you can see out across the deck in every direction,
        and what stops the dice is light rather than stone.
        
        The physics boundary has not moved. It is still a full-height
        invisible box (src/physics/world.ts), and the field panel is drawn
        at exactly that height so a die visibly stops where it always did
        rather than appearing to halt in mid-air.
      */}
      {(
        [
          [-(halfW + wallThickness / 2), 0, wallThickness, innerDepth + wallThickness * 2],
          [halfW + wallThickness / 2, 0, wallThickness, innerDepth + wallThickness * 2],
          [0, -(halfD + wallThickness / 2), innerWidth + wallThickness * 2, wallThickness],
          [0, halfD + wallThickness / 2, innerWidth + wallThickness * 2, wallThickness],
        ] as const
      ).map(([x, z, w, d], i) => (
        <mesh key={`rim-${i}`} material={wallMaterial} position={[x, RIM_HEIGHT / 2, z]}>
          <boxGeometry args={[w, RIM_HEIGHT, d]} />
        </mesh>
      ))}

      {/* Emitter studs along the rim, which is what the field hangs off. */}
      {emitters.map((e, i) => (
        <group key={`emitter-${i}`} position={e}>
          <mesh material={wallMaterial} position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.07, 0.09, 0.18, 6]} />
          </mesh>
          <mesh material={stripMaterial} position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.055, 8, 6]} />
          </mesh>
        </group>
      ))}

      {/* The containment field: full height, and you can see through it. */}
      {(
        [
          [-(halfW + wallThickness / 2), 0, 0.06, innerDepth + wallThickness * 2],
          [halfW + wallThickness / 2, 0, 0.06, innerDepth + wallThickness * 2],
          [0, -(halfD + wallThickness / 2), innerWidth + wallThickness * 2, 0.06],
          [0, halfD + wallThickness / 2, innerWidth + wallThickness * 2, 0.06],
        ] as const
      ).map(([x, z, w, d], i) => (
        <mesh key={`field-${i}`} material={fieldMaterial} position={[x, wallHeight / 2 + RIM_HEIGHT / 2, z]}>
          <boxGeometry args={[w, wallHeight - RIM_HEIGHT, d]} />
        </mesh>
      ))}

      {/* Light strips along the wall tops */}
      {strips.map((s, i) => (
        <mesh key={`strip-${i}`} material={stripMaterial} position={[...s.pos]}>
          <boxGeometry args={[...s.size]} />
        </mesh>
      ))}

      {/* Portholes */}
      {portholes.map((p, i) => (
        <mesh key={`porthole-${i}`} position={p.pos} rotation={[0, p.rotY, 0]}>
          <circleGeometry args={[0.14, 12]} />
          <meshBasicMaterial color="#0a0e2a" toneMapped={false} />
        </mesh>
      ))}

      {/* Corner antenna pylons */}
      {pylonPositions.map(([x, z], i) => (
        <group key={`pylon-${i}`} position={[x, 0, z]}>
          {/*
            A thin mast on a small base, not a tower. At 0.42-0.55 radius
            and full wall height these were the castle's corner towers in
            grey — four cylinders with a cap on is a keep whatever colour
            it is painted, and it was half of why this read as a castle in
            space.
          */}
          <mesh material={wallMaterial} position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.34, 0.44, 0.24, 8]} />
          </mesh>
          <mesh material={wallMaterial} position={[0, wallHeight * 0.85, 0]}>
            <cylinderGeometry args={[0.07, 0.11, wallHeight * 1.5, 6]} />
          </mesh>
          <mesh material={wallMaterial} position={[0, wallHeight + 0.75, 0]}>
            <cylinderGeometry args={[0.05, 0.08, 0.7, 6]} />
          </mesh>
          <mesh position={[0, wallHeight + 1.14, 0]}>
            <sphereGeometry args={[0.11, 10, 8]} />
            <meshBasicMaterial
              color={i % 2 === 0 ? GLOW_CYAN : GLOW_MAGENTA}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
