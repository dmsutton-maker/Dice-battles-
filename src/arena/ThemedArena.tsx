import { troughOf, WaterSurface } from './water';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import {
  CORNER_TOWERS,
  RETREAT_POOL,
  RETREAT_POOL_RADIUS,
  RETREAT_POST_XS,
  RETREAT_POST_Z,
  RETREAT_PROPS,
  RETREAT_XS,
  RETREAT_Z,
} from '../game/stations';
import { createGroundSurface, createTraySurface, surfaceExtras } from './groundTexture';
import { cachedTexture } from './textureCache';
import { ArenaStructure, ArenaTheme, PropPlacement, ThemedArenaId } from './themeData';
import { ARENA_JAILS } from './jailKinds';
import { Jail } from './jails';
import { buildRim, RimSpot } from './rim';
import { ArenaProps } from './arenaProps';
import { Campfire, Crate, Duel, Signpost } from './sceneryProps';
import { StoreBackdrop, StoreCorner, StoreCrest } from './storeBoards';
import {
  AdobeCorner,
  AdobeCrest,
  BasaltCorner,
  BasaltCrest,
  BOARD_KITS,
  BoardScenery,
  floorBreath,
  IceCorner,
  IceCrest,
  IceShelter,
  LogCorner,
  LogCrest,
  MoonCorner,
  MoonCrest,
  SkyCorner,
  SkyCrest,
  SkyShelter,
  SnowCorner,
  SnowCrest,
  StalagmiteCorner,
  StalagmiteCrest,
  useBoardLive,
} from './boardKits';

/**
 * One renderer for all sixteen themed battlefields.
 *
 * The four original arenas are bespoke five-hundred-line scenes; this
 * component is what lets the other sixteen exist at all. It draws the
 * same furniture every arena must have — the tray, its walls and towers,
 * the jail pen behind the far wall, the retreat row on the player's
 * side, and the ground it all stands on — from an ArenaTheme
 * (themeData.ts), which is pure data.
 *
 * Everything is placed with the shared constants in src/game/stations.ts,
 * for the same reason those constants exist: the prisoner figures stand
 * at fixed world positions in EVERY arena, and scenery that ignored them
 * would intersect a figure. The Skirmish-prisoners-in-the-scenery bug was
 * exactly this, once, in a hand-built arena.
 *
 * Props are deliberately simple shapes — a pine is two cones on a
 * cylinder. The originals set that style: this is a toy diorama, and a
 * highly modelled tree beside a four-box castle would look wrong, not
 * better. Each prop is unconditionally cheap because sixteen arenas
 * multiply everything.
 */

const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;

/**
 * How far the ground plane reaches.
 *
 * Cut from 70 to 26: the camera cannot see past z -10.5 or |x| 4.5, so
 * the other 44 units were a very large quad rendered for nobody.
 */
const GROUND_SPAN = 26;
const halfW = innerWidth / 2;
const halfD = innerDepth / 2;


/* ── the prop library ─────────────────────────────────────────────── */

function Pine({ color = '#2f6b34', snow }: { color?: string; snow?: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.14, 0.18, 0.6, 8]} />
        <meshStandardMaterial color="#6b4a2c" roughness={0.9} />
      </mesh>
      {[0.9, 1.5, 2.05].map((y, i) => (
        <mesh key={y} position={[0, y, 0]}>
          <coneGeometry args={[0.85 - i * 0.22, 0.9, 8]} />
          <meshStandardMaterial color={snow && i === 2 ? '#eef5fa' : color} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function RoundTree({ color = '#5c9e3d' }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.16, 0.22, 0.9, 8]} />
        <meshStandardMaterial color="#6b4a2c" roughness={0.9} />
      </mesh>
      {/*
        Three overlapping clumps rather than one sphere. Seen from almost
        directly overhead — which is the only way this is ever seen — a
        sphere projects to a plain circle, and a row of plain circles
        down the side of the board reads as coloured dots rather than as
        trees.
      */}
      {([[0, 1.4, 0, 0.66], [0.42, 1.18, 0.2, 0.5], [-0.36, 1.24, -0.24, 0.46]] as const).map(
        ([cx, cy, cz, r], i) => (
          <mesh key={i} position={[cx, cy, cz]} scale={[1, 0.88, 1]}>
            <sphereGeometry args={[r, 10, 8]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        ),
      )}
    </group>
  );
}

function Palm() {
  return (
    <group>
      <mesh position={[0, 0.9, 0]} rotation={[0, 0, 0.12]}>
        <cylinderGeometry args={[0.12, 0.2, 1.8, 8]} />
        <meshStandardMaterial color="#8a6338" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          position={[0.2, 1.85, 0]}
          rotation={[0.5, (i * Math.PI * 2) / 5, 0]}
        >
          <coneGeometry args={[0.16, 1.2, 4]} />
          <meshStandardMaterial color="#3a8a4a" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function Cactus() {
  return (
    <group>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.28, 0.32, 1.5, 8]} />
        <meshStandardMaterial color="#4a8f4f" roughness={0.85} />
      </mesh>
      <mesh position={[0.42, 0.95, 0]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.14, 0.16, 0.7, 8]} />
        <meshStandardMaterial color="#4a8f4f" roughness={0.85} />
      </mesh>
      <mesh position={[-0.4, 0.75, 0]} rotation={[0, 0, 0.5]}>
        <cylinderGeometry args={[0.13, 0.15, 0.6, 8]} />
        <meshStandardMaterial color="#4a8f4f" roughness={0.85} />
      </mesh>
    </group>
  );
}

function Rock({ color = '#8a8e99' }: { color?: string }) {
  return (
    <mesh position={[0, 0.32, 0]} scale={[1, 0.7, 0.85]} rotation={[0, 0.6, 0]}>
      <dodecahedronGeometry args={[0.55, 0]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}

function Crystal({ color = '#b06ee8' }: { color?: string }) {
  return (
    <group>
      {[[0, 0, 1.4], [0.35, 0.4, 0.9], [-0.32, -0.3, 0.7]].map(([x, r, h], i) => (
        <mesh key={i} position={[x, h / 2, x * 0.4]} rotation={[0, r, x * 0.3]}>
          <coneGeometry args={[0.22, h, 5]} />
          {/* Emissive so it glows in the dark worlds it decorates. */}
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function GlowMushroom({ color = '#4fd0c9' }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.13, 0.2, 0.9, 8]} />
        <meshStandardMaterial color="#d9d2c2" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.95, 0]} scale={[1, 0.62, 1]}>
        <sphereGeometry args={[0.55, 12, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Snowman() {
  return (
    <group>
      {[[0.42, 0.4], [0.3, 1.0], [0.2, 1.42]].map(([r, y], i) => (
        <mesh key={i} position={[0, y, 0]}>
          <sphereGeometry args={[r, 12, 10]} />
          <meshStandardMaterial color="#f7fafc" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 1.44, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.05, 0.24, 6]} />
        <meshStandardMaterial color="#fc8403" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Lollipop({ color = '#ff6e6e' }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 1.8, 6]} />
        <meshStandardMaterial color="#f7f0e0" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.05, 0]}>
        <sphereGeometry args={[0.5, 12, 10]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Umbrella({ color = '#ff6e6e' }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.6, 6]} />
        <meshStandardMaterial color="#e8e0d0" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.62, 0]}>
        <coneGeometry args={[0.9, 0.45, 10]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    </group>
  );
}

function ShipMast() {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} scale={[1, 0.55, 0.5]}>
        <sphereGeometry args={[1.4, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#6b4a2c" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 2.4, 6]} />
        <meshStandardMaterial color="#4a3823" roughness={0.9} />
      </mesh>
      <mesh position={[0.42, 1.9, 0]}>
        <boxGeometry args={[0.8, 1.1, 0.04]} />
        <meshStandardMaterial color="#e9e4d8" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Barn() {
  return (
    <group>
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[1.8, 1.4, 1.4]} />
        <meshStandardMaterial color="#c23b3b" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.62, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.35, 0.9, 4]} />
        <meshStandardMaterial color="#8a8e99" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.5, 0.71]}>
        <boxGeometry args={[0.6, 1, 0.02]} />
        <meshStandardMaterial color="#f0e6c4" roughness={0.9} />
      </mesh>
    </group>
  );
}

function HayBale() {
  return (
    <mesh position={[0, 0.4, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.4, 0.4, 0.7, 12]} />
      <meshStandardMaterial color="#dfc060" roughness={1} />
    </mesh>
  );
}

function Coral({ color = '#ff8a5c' }: { color?: string }) {
  return (
    <group>
      {[[-0.25, 0.1, 0.9], [0, -0.15, 1.3], [0.28, 0.25, 0.8]].map(([x, tilt, h], i) => (
        <mesh key={i} position={[x, h / 2, x * 0.5]} rotation={[0, 0, tilt]}>
          <coneGeometry args={[0.18, h, 6]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Seaweed() {
  return (
    <group>
      {[-0.25, 0, 0.25].map((x, i) => (
        <mesh key={i} position={[x, 0.7 + i * 0.12, 0]} rotation={[0, 0, x * 0.5]}>
          <cylinderGeometry args={[0.05, 0.09, 1.4 + i * 0.25, 6]} />
          <meshStandardMaterial color="#2a9a6e" emissive="#1a5c42" emissiveIntensity={0.3} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function LavaPool() {
  return (
    <group>
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial color="#ff8c2e" />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1, 1.25, 16]} />
        <meshStandardMaterial color="#241d23" roughness={1} />
      </mesh>
    </group>
  );
}

function CityTower() {
  return (
    <group>
      <mesh position={[0, 1.6, 0]}>
        <boxGeometry args={[1.2, 3.2, 1.2]} />
        <meshStandardMaterial color="#454a63" roughness={0.7} />
      </mesh>
      {/* A lit roof, so the tower is not one flat dark shape from above. */}
      <mesh position={[0, 3.22, 0]}>
        <boxGeometry args={[1.24, 0.1, 1.24]} />
        <meshStandardMaterial color="#5e6480" roughness={0.6} />
      </mesh>
      {/* Lit windows: a few emissive squares, not a texture — cheap. */}
      {[0.6, 1.3, 2.0, 2.7].map((y) =>
        [-0.3, 0.3].map((x) => (
          <mesh key={`${x}-${y}`} position={[x, y, 0.61]}>
            <boxGeometry args={[0.22, 0.28, 0.02]} />
            <meshBasicMaterial color={(x + y) % 0.9 > 0.45 ? '#ffd98a' : '#79809c'} />
          </mesh>
        )),
      )}
    </group>
  );
}

function CloudIsle() {
  return (
    <group position={[0, 0.5, 0]}>
      {[[0, 0, 0.8], [0.7, -0.1, 0.55], [-0.7, -0.12, 0.5]].map(([x, y, r], i) => (
        <mesh key={i} position={[x, y, 0]} scale={[1, 0.55, 1]}>
          <sphereGeometry args={[r, 12, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

function ToyBlock({ color = '#c23b3b' }: { color?: string }) {
  return (
    <group rotation={[0, 0.4, 0]}>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[1.1, 1.1, 1.1]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.16, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.12, 12]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Balloon({ color = '#ff6e6e' }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 2.4, 4]} />
        <meshStandardMaterial color="#8a8e99" roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.85, 0]} scale={[1, 1.15, 1]}>
        <sphereGeometry args={[0.45, 12, 10]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
    </group>
  );
}

function MoonRock() {
  return (
    <group>
      <mesh position={[0, 0.4, 0]} scale={[1, 0.65, 0.9]}>
        <dodecahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color="#c9ccd4" roughness={1} />
      </mesh>
      <mesh position={[0.2, 0.72, 0.3]}>
        <sphereGeometry args={[0.14, 8, 6]} />
        <meshStandardMaterial color="#9a9eaa" roughness={1} />
      </mesh>
    </group>
  );
}

function Lantern({ color = '#ffc95c' }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 1.4, 6]} />
        <meshStandardMaterial color="#3d3730" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.22, 10, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function Flowers({ color = '#ff6e6e' }: { color?: string }) {
  return (
    <group>
      {([[-0.22, 0.34, 0.1], [0, 0.46, -0.12], [0.24, 0.38, 0.14]] as const).map(([x, h, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, h / 2, 0]}>
            <cylinderGeometry args={[0.025, 0.03, h, 5]} />
            <meshStandardMaterial color="#4a8f4f" roughness={0.9} />
          </mesh>
          <mesh position={[0, h, 0]}>
            <sphereGeometry args={[0.11, 8, 6]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Bush({ color = '#3f7a4a' }: { color?: string }) {
  return (
    <group>
      {([[0, 0.34, 0, 0.42], [0.3, 0.26, 0.1, 0.32], [-0.28, 0.28, -0.08, 0.34]] as const).map(
        ([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} scale={[1, 0.82, 1]}>
            <sphereGeometry args={[r, 10, 8]} />
            <meshStandardMaterial color={color} roughness={0.95} />
          </mesh>
        ),
      )}
    </group>
  );
}

function Pebbles({ color = '#8a8e99' }: { color?: string }) {
  return (
    <group>
      {([[0, 0, 0.26], [0.42, 0.18, 0.18], [-0.34, -0.22, 0.15], [0.12, -0.4, 0.12]] as const).map(
        ([x, z, r], i) => (
          <mesh key={i} position={[x, r * 0.5, z]} scale={[1, 0.6, 0.9]} rotation={[0, i * 0.9, 0]}>
            <dodecahedronGeometry args={[r, 0]} />
            <meshStandardMaterial color={color} roughness={1} />
          </mesh>
        ),
      )}
    </group>
  );
}

function Torch({ color = '#ff9440' }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 1.2, 6]} />
        <meshStandardMaterial color="#4a3823" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.28, 0]}>
        <cylinderGeometry args={[0.17, 0.11, 0.26, 8]} />
        <meshStandardMaterial color="#33281f" roughness={0.9} />
      </mesh>
      {/* Basic material, so the flame is the same brightness in a dark
          world as the lava is — a lit thing, not a lit-up thing. */}
      <mesh position={[0, 1.6, 0]} scale={[1, 1.5, 1]}>
        <sphereGeometry args={[0.2, 10, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function Banner({ color = '#c23b3b' }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 2.2, 6]} />
        <meshStandardMaterial color="#6b4a2c" roughness={0.9} />
      </mesh>
      <mesh position={[0.36, 1.64, 0]}>
        <boxGeometry args={[0.72, 1, 0.03]} />
        <meshStandardMaterial color={color} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      {/* The swallowtail, so it reads as cloth and not a signboard. */}
      <mesh position={[0.36, 1.04, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.26, 0.26, 0.03]} />
        <meshStandardMaterial color={color} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 2.24, 0]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial color="#e8c76e" roughness={0.4} metalness={0.5} />
      </mesh>
    </group>
  );
}

function Prop({ p }: { p: PropPlacement }) {
  const inner = (() => {
    switch (p.kind) {
      case 'pine': return <Pine color={p.color} snow={p.color === undefined} />;
      case 'roundTree': return <RoundTree color={p.color} />;
      case 'palm': return <Palm />;
      case 'cactus': return <Cactus />;
      case 'rock': return <Rock color={p.color} />;
      case 'crystal': return <Crystal color={p.color} />;
      case 'mushroom': return <GlowMushroom color={p.color} />;
      case 'snowman': return <Snowman />;
      case 'lollipop': return <Lollipop color={p.color} />;
      case 'umbrella': return <Umbrella color={p.color} />;
      case 'shipMast': return <ShipMast />;
      case 'barn': return <Barn />;
      case 'hayBale': return <HayBale />;
      case 'coral': return <Coral color={p.color} />;
      case 'seaweed': return <Seaweed />;
      case 'lavaPool': return <LavaPool />;
      case 'cityTower': return <CityTower />;
      case 'cloudIsle': return <CloudIsle />;
      case 'toyBlock': return <ToyBlock color={p.color} />;
      case 'balloon': return <Balloon color={p.color} />;
      case 'moonRock': return <MoonRock />;
      case 'lantern': return <Lantern color={p.color} />;
      case 'flowers': return <Flowers color={p.color} />;
      case 'bush': return <Bush color={p.color} />;
      case 'pebbles': return <Pebbles color={p.color} />;
      case 'torch': return <Torch color={p.color} />;
      case 'banner': return <Banner color={p.color} />;
      case 'duel': return <Duel color={p.color} />;
      case 'crate': return <Crate color={p.color} />;
      case 'signpost': return <Signpost color={p.color} />;
      case 'campfire': return <Campfire color={p.color} />;
    }
  })();
  return (
    <group position={[p.x, 0, p.z]} scale={p.scale ?? 1}>
      {inner}
    </group>
  );
}

/* ── shared furniture, themed ─────────────────────────────────────── */

/**
 * What shelters the retreat.
 *
 * David, 26 Aug 2026: "not every arena needs to have the same castle
 * toppers on the bottom corners of the screen, make everything about
 * every arena unique."
 *
 * He is describing the retreat canopies. They sit at x ±3.3, z 5.35 —
 * the two bottom corners of the frame, the closest things to the camera
 * and among the largest — and they were one cone on one post in all
 * sixteen battlefields, repainted. A cone on a post is a turret roof, so
 * every arena had a castle turret in each bottom corner no matter what
 * the rest of it was built of.
 *
 * The same was true of the jail: nine identical iron bars behind every
 * far wall, in a coral reef and on a rooftop alike. That is jails.tsx's
 * job now, with one design per board rather than one per structure.
 */
function RetreatShelter({ theme }: { theme: ArenaTheme }) {
  const r = theme.retreat;
  switch (theme.structure) {
    case 'snowFence':
      // A lean-to board under a load of snow.
      return (
        <>
          <mesh position={[0, 1.34, 0]} rotation={[0.26, 0, 0]}>
            <boxGeometry args={[1.5, 0.08, 1.1]} />
            <meshStandardMaterial color={r.post} roughness={0.95} />
          </mesh>
          <mesh position={[0, 1.46, -0.06]} rotation={[0.26, 0, 0]} scale={[1, 0.34, 1]}>
            <sphereGeometry args={[0.72, 12, 8]} />
            <meshStandardMaterial color="#f7fafc" roughness={0.8} />
          </mesh>
        </>
      );
    case 'adobe':
      // A reed sunshade, flat and square against a vertical sun.
      return (
        <>
          <mesh position={[0, 1.4, 0]} rotation={[0, 0.3, 0]}>
            <boxGeometry args={[1.5, 0.07, 1.5]} />
            <meshStandardMaterial color={r.canopy} roughness={1} />
          </mesh>
          {([-0.45, 0, 0.45] as const).map((o, k) => (
            <mesh key={k} position={[o, 1.46, 0]} rotation={[0, 0.3, 0]}>
              <boxGeometry args={[0.09, 0.05, 1.5]} />
              <meshStandardMaterial color={r.post} roughness={1} />
            </mesh>
          ))}
        </>
      );
    case 'basalt':
      // A brazier: a bowl of embers hung off the post.
      return (
        <>
          <mesh position={[0, 1.36, 0]}>
            <cylinderGeometry args={[0.5, 0.32, 0.34, 10]} />
            <meshStandardMaterial color="#2e2226" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.44, 12]} />
            <meshBasicMaterial color={r.canopy} />
          </mesh>
        </>
      );
    case 'logPile':
      // A split-log A-frame.
      return (
        <>
          {([-1, 1] as const).map((s, k) => (
            <mesh key={k} position={[s * 0.34, 1.36, 0]} rotation={[0, 0, s * 0.55]}>
              <boxGeometry args={[0.14, 1.1, 1.2]} />
              <meshStandardMaterial color={k === 0 ? r.post : r.canopy} roughness={1} />
            </mesh>
          ))}
        </>
      );
    case 'iceBlocks':
      // A block of ice with a light frozen inside it (boardKits.tsx).
      return <IceShelter theme={theme} />;
    case 'stalagmite':
      // A crystal hung point-down, glowing.
      return (
        <mesh position={[0, 1.2, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.42, 1, 6]} />
          <meshStandardMaterial
            color={r.canopy}
            emissive={r.canopy}
            emissiveIntensity={0.4}
            roughness={0.3}
          />
        </mesh>
      );
    case 'cloudBalustrade':
      // A little cloud caught on the post, a gold ring through it.
      return <SkyShelter theme={theme} />;
    case 'airlock':
      // A landing beacon: a ring light on a short mast.
      return (
        <>
          <mesh position={[0, 1.36, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.52, 0.09, 8, 16]} />
            <meshStandardMaterial color={r.post} roughness={0.35} metalness={0.6} />
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <sphereGeometry args={[0.17, 10, 8]} />
            <meshBasicMaterial color={r.canopy} />
          </mesh>
        </>
      );
    case 'driftwood':
      // A sail stretched off the post as a windbreak.
      return (
        <>
          <mesh position={[0.02, 1.1, 0]} rotation={[0, 0, -0.22]}>
            <boxGeometry args={[1.3, 0.9, 0.04]} />
            <meshStandardMaterial color={r.canopy} roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 1.56, 0]}>
            <sphereGeometry args={[0.11, 8, 6]} />
            <meshStandardMaterial color={r.post} roughness={0.9} />
          </mesh>
        </>
      );
    case 'gingerbread':
      // A lollipop, because of course.
      return (
        <>
          <mesh position={[0, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.4, 0.16, 8, 16]} />
            <meshStandardMaterial color={r.canopy} roughness={0.35} />
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <sphereGeometry args={[0.26, 10, 8]} />
            <meshStandardMaterial color="#fff0f7" roughness={0.35} />
          </mesh>
        </>
      );
    case 'mossStone':
      // A cage of fireflies swinging from the post.
      return (
        <>
          <mesh position={[0, 1.24, 0]}>
            <sphereGeometry args={[0.3, 10, 8]} />
            <meshStandardMaterial
              color={r.canopy}
              emissive={r.canopy}
              emissiveIntensity={0.45}
              roughness={0.4}
            />
          </mesh>
          {([0, 1, 2, 3] as const).map((k) => (
            <mesh key={k} position={[0, 1.24, 0]} rotation={[0, (k * Math.PI) / 4, 0]}>
              <torusGeometry args={[0.33, 0.025, 6, 14]} />
              <meshStandardMaterial color={r.post} roughness={0.8} />
            </mesh>
          ))}
        </>
      );
    case 'shipHull':
      // A ship's lantern on a gallows arm.
      return (
        <>
          <mesh position={[0.22, 1.5, 0]}>
            <boxGeometry args={[0.5, 0.07, 0.07]} />
            <meshStandardMaterial color={r.post} roughness={0.9} />
          </mesh>
          <mesh position={[0.42, 1.26, 0]}>
            <cylinderGeometry args={[0.19, 0.22, 0.36, 8]} />
            <meshBasicMaterial color={r.canopy} />
          </mesh>
        </>
      );
    case 'picket':
      // A birdhouse, gable roof and all.
      return (
        <>
          <mesh position={[0, 1.26, 0]}>
            <boxGeometry args={[0.52, 0.5, 0.5]} />
            <meshStandardMaterial color="#f7f4ea" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.6, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[0.46, 0.32, 4]} />
            <meshStandardMaterial color={r.canopy} roughness={0.85} />
          </mesh>
          <mesh position={[0, 1.28, 0.26]}>
            <cylinderGeometry args={[0.11, 0.11, 0.03, 10]} />
            <meshStandardMaterial color={r.post} roughness={0.9} />
          </mesh>
        </>
      );
    case 'coralRim':
      // A sea fan, standing edge-on in the current.
      return (
        <>
          <mesh position={[0, 1.2, 0]} scale={[1, 0.9, 0.14]}>
            <sphereGeometry args={[0.62, 10, 8]} />
            <meshStandardMaterial color={r.canopy} roughness={0.7} />
          </mesh>
          <mesh position={[0, 1.2, 0]} scale={[0.72, 0.66, 0.2]}>
            <sphereGeometry args={[0.62, 8, 6]} />
            <meshStandardMaterial color={r.post} roughness={0.75} />
          </mesh>
        </>
      );
    case 'parapet':
      // A street lamp: a shade with the bulb glowing under it.
      return (
        <>
          <mesh position={[0, 1.44, 0]}>
            <cylinderGeometry args={[0.14, 0.5, 0.3, 10]} />
            <meshStandardMaterial color={r.post} roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position={[0, 1.24, 0]}>
            <sphereGeometry args={[0.2, 10, 8]} />
            <meshBasicMaterial color={r.canopy} />
          </mesh>
        </>
      );
    case 'blocks':
    default:
      // A pinwheel, four coloured vanes.
      return (
        <>
          {([0, 1, 2, 3] as const).map((k) => (
            <mesh
              key={k}
              position={[
                Math.cos((k * Math.PI) / 2) * 0.34,
                1.42,
                Math.sin((k * Math.PI) / 2) * 0.34,
              ]}
              rotation={[0, (k * Math.PI) / 2, 0.3]}
            >
              <boxGeometry args={[0.56, 0.05, 0.34]} />
              <meshStandardMaterial
                color={[r.canopy, r.pool, r.padA, r.post][k]}
                roughness={0.55}
              />
            </mesh>
          ))}
          <mesh position={[0, 1.42, 0]}>
            <sphereGeometry args={[0.13, 8, 6]} />
            <meshStandardMaterial color={r.post} roughness={0.6} />
          </mesh>
        </>
      );
  }
}

/** The retreat row on the player's side, at the shared coordinates. */
function ThemedRetreat({
  theme,
  padColors,
}: { theme: ArenaTheme } & ArenaProps) {
  const r = theme.retreat;
  return (
    <group>
      {/*
        Two meshes per pad, not one, and the reason is the sixteen themes.

        The pad TOP is the lane's prisoner colour — that is the whole
        point of it: your red soldier walks out to the red square. But
        sixteen battlefields painting the same six squares would rub out
        most of what tells snow from sand from deck plating down here. So
        the theme's own stone keeps the row, as a slightly wider base the
        colour sits on, and shows as a rim around every pad.

        Falls back to the theme's two-tone row when no round is being
        played (see ArenaProps), which is also what makes this safe to
        render before the units exist.
      */}
      {RETREAT_XS.map((x, i) => {
        const themed = i % 2 === 0 ? r.padA : r.padB;
        const lane = padColors?.[i] ?? null;
        return (
          <group key={`pad-${i}`} position={[x, 0, RETREAT_Z]}>
            <mesh position={[0, 0.014, 0]}>
              <boxGeometry args={[0.78, 0.028, 0.78]} />
              <meshStandardMaterial color={themed} roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.015, 0]}>
              <boxGeometry args={[0.62, 0.03, 0.62]} />
              <meshStandardMaterial color={lane ?? themed} roughness={0.9} />
            </mesh>
          </group>
        );
      })}
      {RETREAT_POST_XS.map((x, i) => (
        <group key={`post-${i}`} position={[x, 0, RETREAT_POST_Z]}>
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.06, 0.07, 1.4, 8]} />
            <meshStandardMaterial color={r.post} roughness={0.7} />
          </mesh>
          <RetreatShelter theme={theme} />
        </group>
      ))}
      <group position={[RETREAT_POOL[0], 0, RETREAT_POOL[1]]}>
        <mesh position={[0, 0.09, 0]}>
          <cylinderGeometry args={[RETREAT_POOL_RADIUS + 0.18, RETREAT_POOL_RADIUS + 0.24, 0.18, 16]} />
          <meshStandardMaterial color={theme.wall.cap} roughness={0.9} />
        </mesh>
        {theme.look.pit.water ? (
          // A water world's pool moves like its moat does.
          <WaterSurface
            look={{ shallow: r.pool, deep: troughOf(r.pool), foam: '#f2fbff', opacity: 1 }}
            shape="round"
            size={[RETREAT_POOL_RADIUS * 2, RETREAT_POOL_RADIUS * 2]}
            flow={[0.05, 0.03]}
            position={[0, 0.19, 0]}
          />
        ) : (
          <mesh position={[0, 0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[RETREAT_POOL_RADIUS, 16]} />
            <meshStandardMaterial color={r.pool} roughness={0.2} />
          </mesh>
        )}
      </group>
      {RETREAT_PROPS.map(([x, z], i) => (
        <mesh key={`crate-${i}`} position={[x, 0.26, z]} rotation={[0, i * 0.5, 0]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color={r.post} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/*
  The sky component used to live here: a sun disc at (9, 13, -22), sixty
  stars at z -24, and one big celestial body — a moon, the Earth, an
  aurora, a rainbow — at z -23.

  It is gone because none of it was ever visible. The camera looks almost
  straight down from (0, 19.5, 5.8) with a 17-degree tilt and a 46-degree
  lens; anything past z -10.5 falls outside that cone no matter how high
  it is hung, because height moves a distant object further UP the frame
  and out of it rather than into view. Sixteen arenas were each building
  a sky nobody could see.

  The theme data still describes one (ArenaTheme.sky), and deliberately:
  the Inventory thumbnails are drawn wide and DO show the sun, the stars
  and the aurora — see assets/arenas/make-themed-art.py, which reads
  those very fields. What was wrong was rendering it in 3D.
*/

/* ── what the tray is BUILT of ────────────────────────────────────── */

/** Where the crest ring turns, i.e. the outside face of the wall. */
const RIM_END_X = halfW + wallThickness / 2;
const RIM_END_Z = halfD + wallThickness / 2;

/**
 * A thin bar along each wall, corner to corner.
 *
 * Not WALL_RUNS scaled down: those carry the wall's own width, so a bar
 * cut from them is as broad as the wall is thick and hides whatever
 * stands on the coping underneath it. These are 0.12 across and reach
 * the true corners, so a handrail looks like a handrail.
 */
const RAIL_RUNS: [number, number, number, number][] = [
  [-RIM_END_X, 0, 0.12, RIM_END_Z * 2],
  [RIM_END_X, 0, 0.12, RIM_END_Z * 2],
  [0, -RIM_END_Z, RIM_END_X * 2, 0.12],
  [0, RIM_END_Z, RIM_END_X * 2, 0.12],
];

/** The four wall runs, as [centreX, centreZ, width, depth]. */
const WALL_RUNS: [number, number, number, number][] = [
  [-(halfW + wallThickness / 2), 0, wallThickness, innerDepth + wallThickness * 2],
  [halfW + wallThickness / 2, 0, wallThickness, innerDepth + wallThickness * 2],
  [0, -(halfD + wallThickness / 2), innerWidth, wallThickness],
  [0, halfD + wallThickness / 2, innerWidth, wallThickness],
];

/**
 * The rim of the tray, in whatever this world is actually built of.
 *
 * David, 26 Aug 2026, twice. First: "the arenas all don't have to look
 * like castles. They can be something that makes sense for the arena
 * name, like how the space station doesn't look like a castle." That got
 * four shared kinds. Then, straight back: "you just used the same like 4
 * different templates for the arenas now, make them all unique."
 *
 * He is right both times, and for the same reason: a SKYLINE is what you
 * recognise a place by. One skyline across sixteen arenas is one place in
 * sixteen colours; four skylines is four. So there are sixteen, and no
 * two battlefields share a crest or a corner piece.
 *
 * Nothing here may affect play and nothing here does — the tray the dice
 * bounce in is byte-for-byte identical under all sixteen, and the suite
 * asserts the wall geometry never reads this field.
 */
function ThemedCrest({ theme, rim }: { theme: ArenaTheme; rim: RimSpot[] }) {
  const cap = theme.wall.cap;
  const accent = theme.tower.roof;

  switch (theme.structure) {
    /* ── ladder (and the two season-pass boards) ─────────────────── */

    /*
      These eight are built in boardKits.tsx since the October 2026 board
      redesign, each from its own shape language and each with its
      repeated pieces instanced. The cases stay here, one per board, so
      this switch still shows at a glance that every structure has a
      crest of its own.
    */
    case 'snowFence':
      return <SnowCrest theme={theme} rim={rim} />;
    case 'adobe':
      return <AdobeCrest theme={theme} rim={rim} />;
    case 'basalt':
      return <BasaltCrest theme={theme} rim={rim} />;
    case 'logPile':
      return <LogCrest theme={theme} rim={rim} />;
    case 'iceBlocks':
      return <IceCrest theme={theme} rim={rim} />;
    case 'stalagmite':
      return <StalagmiteCrest theme={theme} rim={rim} />;
    case 'cloudBalustrade':
      return <SkyCrest theme={theme} rim={rim} />;
    case 'airlock':
      return <MoonCrest theme={theme} rim={rim} />;

    /* ── store ───────────────────────────────────────────────────── */

    /*
      The eight store boards build their walls in storeBoards.tsx, one
      component each, from instanced parts — a picket fence is a hundred
      and fifty pickets and a brick wall two hundred bricks, which is one
      draw call there and would be hundreds here. The board redesign
      (18 Oct 2026, docs/board-redesign.md) is what they answer; the
      history of each one's earlier crest is in git.
    */
    case 'driftwood':
    case 'gingerbread':
    case 'mossStone':
    case 'shipHull':
    case 'picket':
    case 'coralRim':
    case 'parapet':
    case 'blocks':
    default:
      return <StoreCrest theme={theme} />;
  }
}

/** What stands at the four corners — one piece per world, like the crest. */
function ThemedCorners({
  theme,
  wallMaterial,
}: {
  theme: ArenaTheme;
  wallMaterial: THREE.Material;
}) {
  const roof = theme.tower.roof;
  const cap = theme.wall.cap;

  const piece = (s: ArenaStructure) => {
    switch (s) {
      // The eight redesigned boards: boardKits.tsx, one corner each.
      case 'snowFence':
        return <SnowCorner theme={theme} wallMaterial={wallMaterial} />;
      case 'adobe':
        return <AdobeCorner theme={theme} wallMaterial={wallMaterial} />;
      case 'basalt':
        return <BasaltCorner theme={theme} wallMaterial={wallMaterial} />;
      case 'logPile':
        return <LogCorner theme={theme} wallMaterial={wallMaterial} />;
      case 'iceBlocks':
        return <IceCorner theme={theme} wallMaterial={wallMaterial} />;
      case 'stalagmite':
        return <StalagmiteCorner theme={theme} wallMaterial={wallMaterial} />;
      case 'cloudBalustrade':
        return <SkyCorner theme={theme} wallMaterial={wallMaterial} />;
      case 'airlock':
        return <MoonCorner theme={theme} wallMaterial={wallMaterial} />;
      // The store boards' corners live with their walls, in storeBoards.tsx.
      case 'driftwood':
      case 'gingerbread':
      case 'mossStone':
      case 'shipHull':
      case 'picket':
      case 'coralRim':
      case 'parapet':
      case 'blocks':
      default:
        return <StoreCorner theme={theme} />;
    }
  };

  return (
    <group>
      {CORNER_TOWERS.map(({ x, z }, i) => (
        <group key={`corner-${i}`} position={[x, 0, z]}>
          {/*
            The NEAR pair (bottom of the screen) is a low capped post in
            the board's own wall, not the full corner piece. Domes, water
            tanks, roofs and lollipops that close to an almost-overhead
            camera are big discs over the pads — they read as umbrellas
            (David, 18 Oct 2026: "get rid of the umbrellas at the bottom
            of the arenas where it's unnecessary"). The far pair keeps the
            board's real corner, small and at the top where it reads.
          */}
          {z > 0 ? <NearCornerPost theme={theme} wallMaterial={wallMaterial} /> : piece(theme.structure)}
        </group>
      ))}
    </group>
  );
}

/** The near corner: a squared post at wall height with the board's cap. */
function NearCornerPost({ theme, wallMaterial }: { theme: ArenaTheme; wallMaterial: THREE.Material }) {
  const side = wallThickness + 0.125;
  return (
    <>
      <mesh material={wallMaterial} position={[0, (wallHeight + 0.125) / 2, 0]}>
        <boxGeometry args={[side, wallHeight + 0.125, side]} />
      </mesh>
      <mesh position={[0, wallHeight + 0.125 + 0.0625, 0]}>
        <boxGeometry args={[side + 0.125, 0.125, side + 0.125]} />
        <meshStandardMaterial color={theme.wall.cap} roughness={0.85} />
      </mesh>
    </>
  );
}

/* ── the arena itself ─────────────────────────────────────────────── */

export function ThemedArena({
  theme,
  id,
  padColors,
}: { theme: ArenaTheme; id: string } & ArenaProps) {
  /*
    The tray floor, painted for THIS battlefield.

    It used to be `createFlagstoneTexture(theme.floor.a)` — one colour,
    one painter — so all sixteen arenas rolled their dice on the same
    grey eight-by-eight grid, and `theme.floor.b` was never read by
    anything. That grid is most of what is on screen, which is a large
    part of why David called the new maps unfinished.
  */
  const floorW = innerWidth + wallThickness * 2;
  const floorD = innerDepth + wallThickness * 2;
  const floorTexture = useMemo(
    () =>
      cachedTexture(
        // Everything the picture is built FROM is in the key. Keyed on
        // the arena id alone, repainting a theme's floor colours — which
        // this project does — would hand back the picture painted from
        // the old ones, and the deps array below would be the only thing
        // that noticed.
        `themed-floor-${id}-${theme.structure}-${theme.floor.a}-${theme.floor.b}` +
          `-${theme.wall.cap}-${floorW}x${floorD}`, () =>
        createTraySurface(
          theme.structure,
          { a: theme.floor.a, b: theme.floor.b, accent: theme.wall.cap },
          [floorW, floorD],
        ),
      ),
    [id, theme.structure, theme.floor.a, theme.floor.b, theme.wall.cap, floorW, floorD],
  );

  /* The ground outside it, in the same material family a shade duller. */
  const groundTexture = useMemo(
    () =>
      cachedTexture(
        `themed-ground-${id}-${theme.structure}-${theme.meadow}-${theme.hill}` +
          `-${theme.mountain ?? theme.wall.cap}`, () =>
        createGroundSurface(
          theme.structure,
          { a: theme.meadow, b: theme.hill, accent: theme.mountain ?? theme.wall.cap },
          GROUND_SPAN / 6.5,
        ),
      ),
    [id, theme.structure, theme.meadow, theme.hill, theme.mountain, theme.wall.cap],
  );

  const wallMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: theme.wall.color,
        roughness: 0.85,
        metalness: theme.wall.metalness ?? 0,
      }),
    [theme.wall.color, theme.wall.metalness],
  );

  const rim = useMemo(() => buildRim(), []);

  /*
    Relief and glow, for the surfaces that paint them (groundTexture.ts,
    SIDE): a bump map the key light rakes, and an emissive map for lava,
    crystal and aurora that shines whatever the rig. Null everywhere
    else, so the other boards draw exactly as before.
  */
  const kit = BOARD_KITS[theme.structure];
  const floorExtras = surfaceExtras(floorTexture);
  const groundExtras = surfaceExtras(groundTexture);
  const floorRef = useRef<THREE.Mesh>(null);
  const groundRef = useRef<THREE.Mesh>(null);
  const breath = useMemo(() => floorBreath(theme.structure), [theme.structure]);
  useBoardLive(floorRef, floorExtras.glow ? breath : undefined);
  useBoardLive(groundRef, groundExtras.glow ? breath : undefined);

  return (
    <group>
      {/* Tray floor */}
      <mesh ref={floorRef} position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[innerWidth + wallThickness * 2, innerDepth + wallThickness * 2]} />
        <meshStandardMaterial
          map={floorTexture}
          roughness={0.95}
          bumpMap={floorExtras.bump}
          bumpScale={kit?.relief ?? 1}
          emissiveMap={floorExtras.glow}
          emissive={floorExtras.glow ? '#ffffff' : '#000000'}
        />
      </mesh>

      {/*
        The world's ground.

        Everything that used to stand on it — five hills at |x| 12, three
        mountain cones at z -19, clouds at z -13, the sun, the stars and
        the one big sky body — is gone, and its going is the point rather
        than a saving. The camera (cameraFit.ts) frames x ±3.9 and z from
        -10.5 to 7.8. Not one of those things was ever inside that box on
        any phone, so all of them were cost with no picture: the arenas
        really were a tray in a wash of flat colour, which is what David
        was looking at.

        What replaces them is a textured ground and a bank at the very
        back — both of which ARE in frame.
      */}
      <mesh ref={groundRef} position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GROUND_SPAN, GROUND_SPAN]} />
        <meshStandardMaterial
          map={groundTexture}
          roughness={1}
          bumpMap={groundExtras.bump}
          bumpScale={kit?.relief ?? 1}
          emissiveMap={groundExtras.glow}
          emissive={groundExtras.glow ? '#ffffff' : '#000000'}
        />
      </mesh>

      {/*
        What lies past the ground on a store board — the sea, the reef's
        drop-off, fireflies. Flat or small, never a bank; see below.
      */}
      <StoreBackdrop theme={theme} />

      {/*
        There is no horizon bank here, and there must not be one.

        A previous version put a squashed sphere of radius 7.5 at z -10.4
        "to give the world an edge to end at". A sphere of radius 7.5 at
        z -10.4 reaches forward to z -2.9 — past the far wall of the tray
        at -5.1 — and stood 3.3 high against a wall 1.4 high. It did not
        read as a horizon. It filled the top third of the screen with a
        featureless dome sitting on top of the jail, and David's whole
        reaction to it was "what is this giant blob".

        The lesson is the one this file keeps relearning: the camera is
        near top-down and very tight, so anything placed BEHIND the board
        is not far away, it is directly above the part of the board you
        care about. The ground plane and its texture are the backdrop.
        Nothing else belongs back there.
      */}

      {/*
        The jail is chosen by the arena's id, not its structure: the
        structure is what the WALLS are made of, and walls get rebuilt.
        See jailKinds.ts.
      */}
      <Jail
        kind={ARENA_JAILS[id as ThemedArenaId]}
        platform={theme.jail.platform}
        bars={theme.jail.bars}
      />
      <ThemedRetreat theme={theme} padColors={padColors} />

      {/* Standing scenery. */}
      {theme.props.map((p, i) => (
        <Prop key={`prop-${i}`} p={p} />
      ))}

      {/* The far haze and the idle life, for the boards that have them. */}
      <BoardScenery theme={theme} />

      {/* Walls */}
      <mesh material={wallMaterial} position={[-(halfW + wallThickness / 2), wallHeight / 2, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, innerDepth + wallThickness * 2]} />
      </mesh>
      <mesh material={wallMaterial} position={[halfW + wallThickness / 2, wallHeight / 2, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, innerDepth + wallThickness * 2]} />
      </mesh>
      <mesh material={wallMaterial} position={[0, wallHeight / 2, -(halfD + wallThickness / 2)]}>
        <boxGeometry args={[innerWidth, wallHeight, wallThickness]} />
      </mesh>
      <mesh material={wallMaterial} position={[0, wallHeight / 2, halfD + wallThickness / 2]}>
        <boxGeometry args={[innerWidth, wallHeight, wallThickness]} />
      </mesh>

      {/* What the rim and the corners are made of — merlons only where
          the place is actually a castle. */}
      <ThemedCrest theme={theme} rim={rim} />
      <ThemedCorners theme={theme} wallMaterial={wallMaterial} />
    </group>
  );
}
