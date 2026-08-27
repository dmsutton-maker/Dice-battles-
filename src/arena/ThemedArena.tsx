import React, { useMemo } from 'react';
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
import { createGroundSurface, createTraySurface } from './groundTexture';
import { cachedTexture } from './textureCache';
import { ArenaStructure, ArenaTheme, PropPlacement } from './themeData';
import { buildRim, RimSpot } from './rim';

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
 * What shelters the retreat, and what the jail is caged with.
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
 * far wall, in a coral reef and on a rooftop alike.
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
    case 'station':
      // A floodlight on a bracket, pointing down at the ice.
      return (
        <>
          <mesh position={[0, 1.42, 0.1]} rotation={[0.5, 0, 0]}>
            <cylinderGeometry args={[0.34, 0.42, 0.4, 10]} />
            <meshStandardMaterial color={r.post} roughness={0.4} metalness={0.55} />
          </mesh>
          <mesh position={[0, 1.28, 0.28]} rotation={[0.5, 0, 0]}>
            <circleGeometry args={[0.36, 12]} />
            <meshBasicMaterial color={r.canopy} />
          </mesh>
        </>
      );
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
    case 'battlement':
      // The parasol the other fifteen used to borrow. It belongs here.
      return (
        <mesh position={[0, 1.42, 0]}>
          <coneGeometry args={[0.85, 0.5, 10]} />
          <meshStandardMaterial color={r.canopy} roughness={0.7} />
        </mesh>
      );
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

/**
 * What the jail is caged with. Nine identical iron bars stood behind the
 * far wall of every battlefield, including the ones with no iron in them.
 */
function jailBarShape(structure: ArenaStructure): {
  geometry: React.ReactElement;
  metalness: number;
  roughness: number;
} {
  switch (structure) {
    case 'snowFence':
    case 'logPile':
    case 'picket':
    case 'driftwood':
      // Timber stakes, squared off.
      return { geometry: <boxGeometry args={[0.09, 1.15, 0.09]} />, metalness: 0, roughness: 0.95 };
    case 'adobe':
      // Mud pillars, fatter at the foot.
      return {
        geometry: <cylinderGeometry args={[0.07, 0.11, 1.15, 6]} />,
        metalness: 0,
        roughness: 1,
      };
    case 'basalt':
    case 'stalagmite':
    case 'coralRim':
      // Grown, not made: tapering to a point.
      return { geometry: <coneGeometry args={[0.08, 1.15, 6]} />, metalness: 0, roughness: 0.9 };
    case 'station':
    case 'airlock':
    case 'parapet':
      // Machined rod.
      return {
        geometry: <cylinderGeometry args={[0.035, 0.035, 1.15, 8]} />,
        metalness: 0.75,
        roughness: 0.3,
      };
    case 'gingerbread':
      // Candy canes, twisted and fat.
      return {
        geometry: <cylinderGeometry args={[0.075, 0.075, 1.15, 6]} />,
        metalness: 0,
        roughness: 0.35,
      };
    case 'mossStone':
      // Living saplings.
      return {
        geometry: <cylinderGeometry args={[0.05, 0.08, 1.15, 5]} />,
        metalness: 0,
        roughness: 1,
      };
    case 'shipHull':
      // Rope, hung between the rails.
      return {
        geometry: <cylinderGeometry args={[0.055, 0.055, 1.15, 6]} />,
        metalness: 0,
        roughness: 1,
      };
    case 'blocks':
      // A stack of bricks rather than a bar.
      return { geometry: <boxGeometry args={[0.14, 1.15, 0.14]} />, metalness: 0, roughness: 0.55 };
    case 'battlement':
    default:
      return {
        geometry: <cylinderGeometry args={[0.045, 0.045, 1.15, 6]} />,
        metalness: 0.4,
        roughness: 0.5,
      };
  }
}

/** The jail pen behind the far wall — same geometry as the originals. */
function ThemedJailPen({
  platform,
  bars,
  structure,
}: {
  platform: string;
  bars: string;
  structure: ArenaStructure;
}) {
  const bar = jailBarShape(structure);
  const pen = TUNING.prison;
  const zNear = -(innerDepth / 2 + wallThickness);
  const zFar = zNear - pen.depth;
  const zCenter = (zNear + zFar) / 2;
  const floorY = pen.platformHeight;
  const barHeight = 1.15;
  const penW = pen.innerWidth;
  const penD = pen.depth;
  const halfPen = penW / 2;

  const sideBars: { x: number; z: number }[] = [];
  const count = 9;
  for (let i = 0; i < count; i++) {
    const x = -halfPen + (i * penW) / (count - 1);
    sideBars.push({ x, z: zNear });
  }
  const endCount = 3;
  for (let i = 1; i <= endCount; i++) {
    const z = zNear - (i * penD) / (endCount + 1);
    sideBars.push({ x: -halfPen, z });
    sideBars.push({ x: halfPen, z });
  }

  return (
    <group>
      <mesh position={[0, floorY / 2, zCenter]}>
        <boxGeometry args={[penW + 0.5, floorY, penD + 0.4]} />
        <meshStandardMaterial color={platform} roughness={0.95} />
      </mesh>
      {sideBars.map((b, i) => (
        <mesh key={`bar-${i}`} position={[b.x, floorY + barHeight / 2, b.z]}>
          {bar.geometry}
          <meshStandardMaterial color={bars} roughness={bar.roughness} metalness={bar.metalness} />
        </mesh>
      ))}
      <mesh position={[0, floorY + barHeight, zFar]}>
        <boxGeometry args={[penW + 0.3, 0.08, 0.08]} />
        <meshStandardMaterial color={bars} roughness={0.5} metalness={0.4} />
      </mesh>
      {([-halfPen, halfPen] as const).map((x, i) => (
        <mesh key={`rail-${i}`} position={[x, floorY + barHeight, zCenter]}>
          <boxGeometry args={[0.08, 0.08, penD]} />
          <meshStandardMaterial color={bars} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** The retreat row on the player's side, at the shared coordinates. */
function ThemedRetreat({ theme }: { theme: ArenaTheme }) {
  const r = theme.retreat;
  return (
    <group>
      {RETREAT_XS.map((x, i) => (
        <mesh key={`pad-${i}`} position={[x, 0.015, RETREAT_Z]}>
          <boxGeometry args={[0.62, 0.03, 0.62]} />
          <meshStandardMaterial color={i % 2 === 0 ? r.padA : r.padB} roughness={0.9} />
        </mesh>
      ))}
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
        <mesh position={[0, 0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[RETREAT_POOL_RADIUS, 16]} />
          <meshStandardMaterial color={r.pool} roughness={0.2} />
        </mesh>
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
  const y = wallHeight + 0.12;

  switch (theme.structure) {
    /* ── ladder ──────────────────────────────────────────────────── */

    case 'snowFence':
      /*
        Timber palings, standing PROUD of the snow lying along the rail.

        They used to top out at 0.40 above the wall and the drift of snow
        was a slab from 0.355 to 0.485 across the full width of it — so
        from the camera, which looks down, the fence was buried and every
        wall of the Snowy Woods read as a blank white kerb. The posts had
        been there the whole time. Nobody could see one.
      */
      return (
        <group>
          {WALL_RUNS.map(([x, z, w, d], i) => (
            <group key={`rail-${i}`}>
              <mesh position={[x, wallHeight + 0.22, z]}>
                <boxGeometry args={[w, 0.09, d]} />
                <meshStandardMaterial color={cap} roughness={0.95} />
              </mesh>
              <mesh position={[x, wallHeight + 0.32, z]}>
                <boxGeometry args={[w * 0.86, 0.11, d * 0.86]} />
                <meshStandardMaterial color="#f7fafc" roughness={0.8} />
              </mesh>
            </group>
          ))}
          {rim.map((m, i) => {
            const h = 0.62 + ((i * 37) % 5) / 20;
            return (
              <group key={`paling-${i}`} position={[m.pos[0], wallHeight, m.pos[2]]}>
                <mesh position={[0, h / 2, 0]}>
                  <boxGeometry args={[0.19, h, 0.19]} />
                  <meshStandardMaterial
                    color={i % 3 === 0 ? theme.wall.color : cap}
                    roughness={0.95}
                  />
                </mesh>
                {/* A cap of snow sitting on each post, not over it. */}
                <mesh position={[0, h + 0.05, 0]}>
                  <boxGeometry args={[0.23, 0.1, 0.23]} />
                  <meshStandardMaterial color="#f7fafc" roughness={0.8} />
                </mesh>
              </group>
            );
          })}
        </group>
      );

    case 'adobe':
      // Sun-dried brick: fat rounded blocks, no two the same height.
      return (
        <group>
          {rim.map((m, i) => {
            const h = 0.3 + ((i * 29) % 7) / 22;
            return (
              <mesh key={`brick-${i}`} position={[m.pos[0], wallHeight + h / 2, m.pos[2]]}>
                <boxGeometry args={m.alongX ? [0.62, h, 0.44] : [0.44, h, 0.62]} />
                <meshStandardMaterial color={i % 3 === 0 ? theme.wall.color : cap} roughness={1} />
              </mesh>
            );
          })}
        </group>
      );

    case 'basalt':
      // Hexagonal columns, the way cooling lava actually splits.
      return (
        <group>
          {rim.map((m, i) => {
            const h = 0.34 + ((i * 41) % 9) / 16;
            return (
              <mesh
                key={`column-${i}`}
                position={[m.pos[0], wallHeight + h / 2, m.pos[2]]}
                rotation={[0, i * 0.4, 0]}
              >
                <cylinderGeometry args={[0.28, 0.3, h, 6]} />
                <meshStandardMaterial color={i % 4 === 0 ? accent : cap} roughness={0.95} />
              </mesh>
            );
          })}
        </group>
      );

    case 'logPile':
      // Cordwood stacked along the rim, cut ends showing.
      return (
        <group>
          {rim.map((m, i) => (
            <mesh
              key={`log-${i}`}
              position={[m.pos[0], wallHeight + 0.23, m.pos[2]]}
              rotation={m.alongX ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.24, 0.24, m.alongX ? 0.95 : 1, 8]} />
              <meshStandardMaterial color={i % 2 === 0 ? cap : theme.wall.color} roughness={1} />
            </mesh>
          ))}
        </group>
      );

    case 'station':
      // A polar station: sealed panels with a strip light running round.
      return (
        <group>
          {WALL_RUNS.map(([x, z, w, d], i) => (
            <group key={`panel-${i}`}>
              <mesh position={[x, wallHeight + 0.08, z]}>
                <boxGeometry args={[w, 0.16, d]} />
                <meshStandardMaterial color={cap} roughness={0.4} metalness={0.45} />
              </mesh>
              <mesh position={[x, wallHeight + 0.18, z]}>
                <boxGeometry args={[w * 0.88, 0.05, d * 0.88]} />
                <meshBasicMaterial color={accent} />
              </mesh>
            </group>
          ))}
          {rim.map((m, i) =>
            i % 2 === 0 ? (
              <mesh key={`rib-${i}`} position={[m.pos[0], wallHeight + 0.3, m.pos[2]]}>
                <boxGeometry args={[0.16, 0.28, 0.16]} />
                <meshStandardMaterial color={theme.wall.color} roughness={0.4} metalness={0.5} />
              </mesh>
            ) : null,
          )}
        </group>
      );

    case 'stalagmite': {
      /*
        Crystal, not dripstone teeth. David: "make the crystal cavern
        look less weird and more like crystals." A crystal is a solid
        with flat faces and a blunt end — a smooth six-sided cone is a
        spike, and a rim of them is a portcullis.
      */
      return (
        <group>
          {rim.map((m, i) => {
            const h = 0.36 + ((i * 53) % 11) / 14;
            const lit = i % 4 === 0;
            return (
              <group
                key={`crystal-${i}`}
                position={[m.pos[0], wallHeight, m.pos[2]]}
                rotation={[((i % 5) - 2) * 0.07, i * 0.9, ((i % 3) - 1) * 0.08]}
              >
                {/* The shaft: a stubby hexagonal prism. */}
                <mesh position={[0, h * 0.42, 0]}>
                  <cylinderGeometry args={[0.15, 0.2, h * 0.84, 6]} />
                  <meshStandardMaterial
                    color={lit ? accent : cap}
                    emissive={lit ? accent : '#000000'}
                    emissiveIntensity={lit ? 0.3 : 0}
                    roughness={0.35}
                  />
                </mesh>
                {/* And the blunt pyramid capping it. */}
                <mesh position={[0, h * 0.96, 0]}>
                  <coneGeometry args={[0.15, h * 0.36, 6]} />
                  <meshStandardMaterial
                    color={lit ? accent : cap}
                    emissive={lit ? accent : '#000000'}
                    emissiveIntensity={lit ? 0.3 : 0}
                    roughness={0.3}
                  />
                </mesh>
                {i % 2 === 0 && (
                  <mesh position={[0.17, h * 0.3, 0.06]} rotation={[0, 0, 0.35]}>
                    <cylinderGeometry args={[0.07, 0.1, h * 0.55, 6]} />
                    <meshStandardMaterial color={cap} roughness={0.4} />
                  </mesh>
                )}
              </group>
            );
          })}
        </group>
      );
    }

    case 'battlement':
      // Notched stone teeth. The Sky Kingdom is a kingdom.
      return (
        <group>
          {rim.map((m, i) => (
            <mesh key={`merlon-${i}`} position={[m.pos[0], y, m.pos[2]]}>
              <boxGeometry args={m.alongX ? [0.45, 0.24, wallThickness] : [wallThickness, 0.24, 0.5]} />
              <meshStandardMaterial color={cap} roughness={0.85} />
            </mesh>
          ))}
        </group>
      );

    case 'airlock':
      // Ribbed hull plating with a hazard stripe along the seam.
      return (
        <group>
          {WALL_RUNS.map(([x, z, w, d], i) => (
            <group key={`plate-${i}`}>
              <mesh position={[x, wallHeight + 0.07, z]}>
                <boxGeometry args={[w, 0.14, d]} />
                <meshStandardMaterial color={cap} roughness={0.35} metalness={0.6} />
              </mesh>
              <mesh position={[x, wallHeight + 0.15, z]}>
                <boxGeometry args={[w * 0.6, 0.04, d * 0.6]} />
                <meshBasicMaterial color={accent} />
              </mesh>
            </group>
          ))}
          {rim.map((m, i) => (
            <mesh key={`rib-${i}`} position={[m.pos[0], wallHeight + 0.24, m.pos[2]]}>
              <boxGeometry args={m.alongX ? [0.12, 0.22, wallThickness * 0.9] : [wallThickness * 0.9, 0.22, 0.12]} />
              <meshStandardMaterial color={theme.wall.color} roughness={0.3} metalness={0.7} />
            </mesh>
          ))}
        </group>
      );

    /* ── store ───────────────────────────────────────────────────── */

    case 'driftwood':
      // Weathered planks driven into the sand, each leaning its own way.
      return (
        <group>
          {rim.map((m, i) => {
            const lean = (((i * 37) % 9) - 4) * 0.07;
            const h = 0.42 + ((i * 23) % 5) / 12;
            return (
              <mesh
                key={`plank-${i}`}
                position={[m.pos[0], wallHeight + h / 2, m.pos[2]]}
                rotation={m.alongX ? [0, 0, lean] : [lean, 0, 0]}
              >
                <boxGeometry args={m.alongX ? [0.3, h, 0.16] : [0.16, h, 0.3]} />
                <meshStandardMaterial color={i % 3 === 0 ? theme.wall.color : cap} roughness={1} />
              </mesh>
            );
          })}
        </group>
      );

    case 'gingerbread':
      // Piped icing: scallops along the rim with a sweet on every third.
      return (
        <group>
          {rim.map((m, i) => (
            <group key={`icing-${i}`} position={[m.pos[0], wallHeight + 0.14, m.pos[2]]}>
              <mesh scale={[1, 0.7, 1]}>
                <sphereGeometry args={[0.27, 10, 8]} />
                <meshStandardMaterial color="#fff0f7" roughness={0.5} />
              </mesh>
              {i % 3 === 0 && (
                <mesh position={[0, 0.2, 0]}>
                  <sphereGeometry args={[0.15, 8, 6]} />
                  <meshStandardMaterial color={accent} roughness={0.35} />
                </mesh>
              )}
            </group>
          ))}
        </group>
      );

    case 'mossStone':
      // Rounded boulders with moss on their tops.
      return (
        <group>
          {rim.map((m, i) => {
            const r = 0.21 + ((i * 31) % 8) / 48;
            return (
              <group key={`stone-${i}`} position={[m.pos[0], wallHeight + r * 0.62, m.pos[2]]}>
                <mesh rotation={[i * 0.6, i * 1.1, i * 0.3]} scale={[1, 0.78, 1]}>
                  <dodecahedronGeometry args={[r, 0]} />
                  <meshStandardMaterial color={cap} roughness={1} />
                </mesh>
                <mesh position={[0, r * 0.5, 0]} scale={[1, 0.35, 1]}>
                  <sphereGeometry args={[r * 0.78, 8, 6]} />
                  <meshStandardMaterial color={theme.meadow} roughness={1} />
                </mesh>
              </group>
            );
          })}
        </group>
      );

    case 'shipHull':
      // Strake planking with a capping rail along the gunwale.
      return (
        <group>
          {WALL_RUNS.map(([x, z, w, d], i) => (
            <mesh key={`gunwale-${i}`} position={[x, wallHeight + 0.11, z]}>
              <boxGeometry args={[w * 1.02, 0.22, d * 1.02]} />
              <meshStandardMaterial color={cap} roughness={0.9} />
            </mesh>
          ))}
          {rim.map((m, i) => (
            <mesh key={`peg-${i}`} position={[m.pos[0], wallHeight + 0.3, m.pos[2]]}>
              <cylinderGeometry args={[0.07, 0.08, 0.2, 6]} />
              <meshStandardMaterial color={accent} roughness={0.6} metalness={0.3} />
            </mesh>
          ))}
        </group>
      );

    case 'picket':
      // A picket fence: pointed slats with two rails behind them.
      return (
        <group>
          {WALL_RUNS.map(([x, z, w, d], i) => (
            <mesh key={`rail-${i}`} position={[x, wallHeight + 0.24, z]}>
              <boxGeometry args={[w, 0.08, d]} />
              <meshStandardMaterial color={cap} roughness={0.95} />
            </mesh>
          ))}
          {rim.map((m, i) => (
            <group key={`picket-${i}`} position={[m.pos[0], 0, m.pos[2]]}>
              <mesh position={[0, wallHeight + 0.2, 0]}>
                <boxGeometry args={m.alongX ? [0.22, 0.4, 0.1] : [0.1, 0.4, 0.22]} />
                <meshStandardMaterial color="#f7f4ea" roughness={0.9} />
              </mesh>
              <mesh position={[0, wallHeight + 0.48, 0]}>
                <coneGeometry args={[0.16, 0.2, 4]} />
                <meshStandardMaterial color="#f7f4ea" roughness={0.9} />
              </mesh>
            </group>
          ))}
        </group>
      );

    case 'coralRim': {
      /*
        Coral, not spikes. David: "make the things on the walls look less
        like spikes and more like coral." Thin cones pointing straight up
        are a fence of spears; coral is lumpy, it branches, it comes in a
        dozen colours, and no two heads on a reef are the same size.
      */
      const REEF = ['#ff8a5c', '#ff6e9e', '#ffc95c', '#8ad4e8', '#b884d8', '#5ce0b0'];
      return (
        <group>
          {rim.map((m, i) => {
            const tint = REEF[i % REEF.length];
            const kind = i % 3;
            return (
              <group key={`coral-${i}`} position={[m.pos[0], wallHeight, m.pos[2]]}>
                {kind === 0 && (
                  // A brain coral: a fat lobed dome.
                  <>
                    <mesh position={[0, 0.16, 0]} scale={[1, 0.72, 1]}>
                      <sphereGeometry args={[0.27, 10, 8]} />
                      <meshStandardMaterial color={tint} roughness={0.85} />
                    </mesh>
                    <mesh position={[0.13, 0.13, 0.09]} scale={[1, 0.7, 1]}>
                      <sphereGeometry args={[0.16, 8, 6]} />
                      <meshStandardMaterial color={cap} roughness={0.85} />
                    </mesh>
                  </>
                )}
                {kind === 1 &&
                  // Staghorn: stubby branches forking off a short trunk.
                  ([[0, 0.34, 0], [-0.17, 0.24, 0.5], [0.18, 0.26, -0.55]] as const).map(
                    ([ox, h, tilt], k) => (
                      <mesh key={k} position={[ox, h / 2 + 0.04, ox * 0.5]} rotation={[0, 0, tilt]}>
                        <cylinderGeometry args={[0.055, 0.085, h, 6]} />
                        <meshStandardMaterial color={k === 0 ? tint : cap} roughness={0.8} />
                      </mesh>
                    ),
                  )}
                {kind === 2 && (
                  // A fan, stood edge-on to the current.
                  <mesh position={[0, 0.22, 0]} scale={[1, 0.95, 0.2]}>
                    <sphereGeometry args={[0.26, 10, 8]} />
                    <meshStandardMaterial color={tint} roughness={0.8} />
                  </mesh>
                )}
              </group>
            );
          })}
        </group>
      );
    }

    case 'parapet':
      /*
        A rooftop: coping cast in slabs, with a steel handrail above it.

        It used to be one smooth grey band and a rail cut from the wall's
        own width — 0.5 across, wider than anything standing on the
        coping — with 0.04-radius posts underneath it. From above that is
        a bare grey frame. Every other battlefield has something you can
        count along its wall; this one had nothing at all.

        So the coping is slabs now, alternating shade, one per crest spot
        the whole way round, and the rail is a thin bar that leaves them
        showing on both sides of it.
      */
      return (
        <group>
          {WALL_RUNS.map(([x, z, w, d], i) => (
            <mesh key={`coping-${i}`} position={[x, wallHeight + 0.06, z]}>
              <boxGeometry args={[w * 1.04, 0.12, d * 1.04]} />
              <meshStandardMaterial color={cap} roughness={0.9} />
            </mesh>
          ))}
          {rim.map((m, i) => (
            <group key={`bay-${i}`} position={[m.pos[0], wallHeight, m.pos[2]]}>
              <mesh position={[0, 0.19, 0]}>
                <boxGeometry
                  args={m.alongX ? [0.52, 0.14, 0.6] : [0.6, 0.14, 0.52]}
                />
                <meshStandardMaterial
                  color={i % 2 === 0 ? cap : theme.wall.color}
                  roughness={0.92}
                />
              </mesh>
              {/* The stanchion, with a base plate you can pick out from above. */}
              <mesh position={[0, 0.29, 0]}>
                <boxGeometry args={[0.17, 0.06, 0.17]} />
                <meshStandardMaterial color="#6a7285" roughness={0.4} metalness={0.6} />
              </mesh>
              <mesh position={[0, 0.47, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.34, 6]} />
                <meshStandardMaterial color="#8f96a8" roughness={0.4} metalness={0.6} />
              </mesh>
            </group>
          ))}
          {RAIL_RUNS.map(([x, z, w, d], i) => (
            <mesh key={`rail-${i}`} position={[x, wallHeight + 0.65, z]}>
              <boxGeometry args={[w, 0.06, d]} />
              <meshStandardMaterial color="#8f96a8" roughness={0.4} metalness={0.6} />
            </mesh>
          ))}
        </group>
      );

    case 'blocks':
    default:
      // Wooden bricks, alternating colours the way a child would stack them.
      return (
        <group>
          {rim.map((m, i) => {
            const shade = [theme.wall.color, cap, accent][i % 3];
            return (
              <mesh key={`block-${i}`} position={[m.pos[0], wallHeight + 0.19, m.pos[2]]}>
                <boxGeometry args={[0.38, 0.38, 0.38]} />
                <meshStandardMaterial color={shade} roughness={0.55} />
              </mesh>
            );
          })}
        </group>
      );
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
      case 'snowFence':
        // A gatepost under a hat of snow.
        return (
          <>
            <mesh material={wallMaterial} position={[0, (wallHeight + 1) / 2, 0]}>
              <boxGeometry args={[0.42, wallHeight + 1, 0.42]} />
            </mesh>
            <mesh position={[0, wallHeight + 1.06, 0]} scale={[1, 0.6, 1]}>
              <sphereGeometry args={[0.34, 10, 8]} />
              <meshStandardMaterial color="#f7fafc" roughness={0.8} />
            </mesh>
          </>
        );
      case 'adobe':
        // A stepped mud-brick pier, three courses narrowing upward.
        return (
          <>
            {([0.9, 0.62, 0.4] as const).map((w, k) => (
              <mesh key={k} position={[0, wallHeight * 0.4 + k * 0.5, 0]}>
                <boxGeometry args={[w, 0.5, w]} />
                <meshStandardMaterial color={k === 2 ? roof : cap} roughness={1} />
              </mesh>
            ))}
          </>
        );
      case 'basalt':
        // An obsidian spire out of a bundle of columns.
        return (
          <>
            <mesh material={wallMaterial} position={[0, (wallHeight + 0.6) / 2, 0]}>
              <cylinderGeometry args={[0.44, 0.5, wallHeight + 0.6, 6]} />
            </mesh>
            <mesh position={[0, wallHeight + 1.15, 0]}>
              <coneGeometry args={[0.34, 1.4, 6]} />
              <meshStandardMaterial color={roof} emissive={roof} emissiveIntensity={0.35} roughness={0.4} />
            </mesh>
          </>
        );
      case 'logPile':
        // A sawn stump with the axe-cut face showing.
        return (
          <>
            <mesh material={wallMaterial} position={[0, (wallHeight + 0.3) / 2, 0]}>
              <cylinderGeometry args={[0.52, 0.6, wallHeight + 0.3, 10]} />
            </mesh>
            <mesh position={[0, wallHeight + 0.33, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.52, 12]} />
              <meshStandardMaterial color={roof} roughness={1} />
            </mesh>
          </>
        );
      case 'station':
        // A mast with an anemometer cup head.
        return (
          <>
            <mesh material={wallMaterial} position={[0, (wallHeight + 1.8) / 2, 0]}>
              <cylinderGeometry args={[0.08, 0.13, wallHeight + 1.8, 8]} />
            </mesh>
            {([0, 1, 2] as const).map((k) => (
              <mesh
                key={k}
                position={[
                  Math.cos((k * Math.PI * 2) / 3) * 0.3,
                  wallHeight + 1.82,
                  Math.sin((k * Math.PI * 2) / 3) * 0.3,
                ]}
              >
                <sphereGeometry args={[0.11, 8, 6]} />
                <meshBasicMaterial color={roof} />
              </mesh>
            ))}
          </>
        );
      case 'stalagmite':
        // A cluster of crystals growing out of the corner.
        return (
          <>
            {([[0, 1.7, 0.26], [0.3, 1.1, 0.2], [-0.28, 1.3, 0.22]] as const).map(([ox, h, r], k) => (
              <mesh key={k} position={[ox, h / 2, ox * 0.5]} rotation={[0, k, ox * 0.4]}>
                <coneGeometry args={[r, h, 5]} />
                <meshStandardMaterial color={roof} emissive={roof} emissiveIntensity={0.5} roughness={0.3} />
              </mesh>
            ))}
          </>
        );
      case 'battlement':
        return (
          <>
            <mesh material={wallMaterial} position={[0, wallHeight / 2 + 0.2, 0]}>
              <cylinderGeometry args={[0.5, 0.56, wallHeight + 0.4, 12]} />
            </mesh>
            <mesh position={[0, wallHeight + 0.72, 0]}>
              <coneGeometry args={[0.6, 0.8, 12]} />
              <meshStandardMaterial color={roof} roughness={0.6} />
            </mesh>
          </>
        );
      case 'airlock':
        // A dish antenna on a short stanchion.
        return (
          <>
            <mesh material={wallMaterial} position={[0, (wallHeight + 0.9) / 2, 0]}>
              <cylinderGeometry args={[0.22, 0.3, wallHeight + 0.9, 8]} />
            </mesh>
            <mesh position={[0, wallHeight + 1.15, 0]} rotation={[-0.7, 0, 0]}>
              <sphereGeometry args={[0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
              <meshStandardMaterial color="#e9ecf5" roughness={0.4} metalness={0.4} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, wallHeight + 1.34, 0.18]}>
              <sphereGeometry args={[0.09, 8, 6]} />
              <meshBasicMaterial color={roof} />
            </mesh>
          </>
        );
      case 'driftwood':
        // A beach parasol jammed into the corner post.
        return (
          <>
            <mesh material={wallMaterial} position={[0, (wallHeight + 1.2) / 2, 0]}>
              <cylinderGeometry args={[0.1, 0.14, wallHeight + 1.2, 8]} />
            </mesh>
            <mesh position={[0, wallHeight + 1.28, 0]}>
              <coneGeometry args={[0.72, 0.42, 10]} />
              <meshStandardMaterial color={roof} roughness={0.7} />
            </mesh>
          </>
        );
      case 'gingerbread':
        // A candy swirl on a stick.
        return (
          <>
            <mesh material={wallMaterial} position={[0, (wallHeight + 1) / 2, 0]}>
              <cylinderGeometry args={[0.13, 0.16, wallHeight + 1, 8]} />
            </mesh>
            <mesh position={[0, wallHeight + 1.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.34, 0.14, 8, 16]} />
              <meshStandardMaterial color={roof} roughness={0.35} />
            </mesh>
            <mesh position={[0, wallHeight + 1.24, 0]}>
              <sphereGeometry args={[0.2, 10, 8]} />
              <meshStandardMaterial color="#fff0f7" roughness={0.35} />
            </mesh>
          </>
        );
      case 'mossStone':
        // A giant toadstool over a mossy cairn.
        return (
          <>
            <mesh material={wallMaterial} position={[0, (wallHeight + 0.5) / 2, 0]}>
              <cylinderGeometry args={[0.2, 0.3, wallHeight + 0.5, 8]} />
            </mesh>
            {/*
              0.5, down from 0.78. Sat on a stalk at the tray corner it
              projects to a pale dome most of a world unit across, and
              four of those at the corners of the board were doing a
              small-scale version of the horizon blob.
            */}
            <mesh position={[0, wallHeight + 0.5, 0]} scale={[1, 0.62, 1]}>
              <sphereGeometry args={[0.5, 12, 8]} />
              <meshStandardMaterial color={roof} emissive={roof} emissiveIntensity={0.22} roughness={0.55} />
            </mesh>
          </>
        );
      case 'shipHull':
        // A barrel with a lantern hung above it.
        return (
          <>
            <mesh material={wallMaterial} position={[0, (wallHeight + 0.2) / 2, 0]}>
              <cylinderGeometry args={[0.46, 0.4, wallHeight + 0.2, 10]} />
            </mesh>
            <mesh position={[0, wallHeight * 0.6, 0]}>
              <cylinderGeometry args={[0.5, 0.5, 0.1, 10]} />
              <meshStandardMaterial color="#33241a" roughness={0.6} metalness={0.4} />
            </mesh>
            <mesh position={[0, wallHeight + 0.5, 0]}>
              <sphereGeometry args={[0.22, 10, 8]} />
              <meshBasicMaterial color={roof} />
            </mesh>
          </>
        );
      case 'picket':
        // A gatepost with a lantern on top and a knob under it.
        return (
          <>
            <mesh material={wallMaterial} position={[0, (wallHeight + 0.7) / 2, 0]}>
              <boxGeometry args={[0.36, wallHeight + 0.7, 0.36]} />
            </mesh>
            <mesh position={[0, wallHeight + 0.78, 0]}>
              <boxGeometry args={[0.46, 0.12, 0.46]} />
              <meshStandardMaterial color={cap} roughness={0.9} />
            </mesh>
            <mesh position={[0, wallHeight + 0.98, 0]}>
              <sphereGeometry args={[0.2, 10, 8]} />
              <meshStandardMaterial color={roof} roughness={0.7} />
            </mesh>
          </>
        );
      case 'coralRim':
        // A sea anemone on a coral stump, fronds waving.
        return (
          <>
            <mesh material={wallMaterial} position={[0, (wallHeight + 0.3) / 2, 0]}>
              <cylinderGeometry args={[0.36, 0.46, wallHeight + 0.3, 10]} />
            </mesh>
            {([0, 1, 2, 3, 4, 5] as const).map((k) => {
              const a = (k * Math.PI * 2) / 6;
              return (
                <mesh
                  key={k}
                  position={[Math.cos(a) * 0.24, wallHeight + 0.6, Math.sin(a) * 0.24]}
                  rotation={[Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5]}
                >
                  <coneGeometry args={[0.09, 0.72, 5]} />
                  <meshStandardMaterial color={roof} roughness={0.65} />
                </mesh>
              );
            })}
          </>
        );
      case 'parapet':
        // An aerial mast with a red beacon, the way city roofs are.
        return (
          <>
            <mesh material={wallMaterial} position={[0, (wallHeight + 0.4) / 2, 0]}>
              <boxGeometry args={[0.62, wallHeight + 0.4, 0.62]} />
            </mesh>
            <mesh position={[0, wallHeight + 1.2, 0]}>
              <cylinderGeometry args={[0.05, 0.07, 1.6, 6]} />
              <meshStandardMaterial color="#8f96a8" roughness={0.4} metalness={0.6} />
            </mesh>
            <mesh position={[0, wallHeight + 2.02, 0]}>
              <sphereGeometry args={[0.14, 8, 6]} />
              <meshBasicMaterial color="#ff6e6e" />
            </mesh>
            <mesh position={[0, wallHeight + 0.75, 0]}>
              <boxGeometry args={[0.5, 0.3, 0.5]} />
              <meshStandardMaterial color={roof} roughness={0.5} metalness={0.3} />
            </mesh>
          </>
        );
      case 'blocks':
      default:
        // A tower of three bricks with a ball balanced on top.
        return (
          <>
            {([0, 1, 2] as const).map((k) => (
              <mesh key={k} position={[0, 0.34 + k * 0.66, 0]} rotation={[0, k * 0.3, 0]}>
                <boxGeometry args={[0.66, 0.66, 0.66]} />
                <meshStandardMaterial
                  color={[theme.wall.color, theme.tower.body, cap][k]}
                  roughness={0.55}
                />
              </mesh>
            ))}
            <mesh position={[0, 2.5, 0]}>
              <sphereGeometry args={[0.34, 12, 10]} />
              <meshStandardMaterial color={roof} roughness={0.45} />
            </mesh>
          </>
        );
    }
  };

  return (
    <group>
      {CORNER_TOWERS.map(({ x, z }, i) => (
        <group key={`corner-${i}`} position={[x, 0, z]}>
          {piece(theme.structure)}
        </group>
      ))}
    </group>
  );
}

/* ── the arena itself ─────────────────────────────────────────────── */

export function ThemedArena({ theme, id }: { theme: ArenaTheme; id: string }) {
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
      cachedTexture(`themed-floor-${id}`, () =>
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
      cachedTexture(`themed-ground-${id}`, () =>
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

  return (
    <group>
      {/* Tray floor */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[innerWidth + wallThickness * 2, innerDepth + wallThickness * 2]} />
        <meshStandardMaterial map={floorTexture} roughness={0.95} />
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
      <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GROUND_SPAN, GROUND_SPAN]} />
        <meshStandardMaterial map={groundTexture} roughness={1} />
      </mesh>

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

      <ThemedJailPen
        platform={theme.jail.platform}
        bars={theme.jail.bars}
        structure={theme.structure}
      />
      <ThemedRetreat theme={theme} />

      {/* Standing scenery. */}
      {theme.props.map((p, i) => (
        <Prop key={`prop-${i}`} p={p} />
      ))}

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
