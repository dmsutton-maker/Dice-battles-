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
import { createFlagstoneTexture } from './flagstoneTexture';
import { cachedTexture } from './textureCache';
import { ArenaTheme, PropPlacement } from './themeData';

/**
 * One renderer for all sixteen themed battlefields.
 *
 * The four original arenas are bespoke five-hundred-line scenes; this
 * component is what lets the other sixteen exist at all. It draws the
 * same furniture every arena must have — the tray, its walls and towers,
 * the jail pen behind the far wall, the retreat row on the player's side,
 * a landscape out to the horizon — from an ArenaTheme (themeData.ts),
 * which is pure data.
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
const halfW = innerWidth / 2;
const halfD = innerDepth / 2;

function hexRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

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
      <mesh position={[0, 1.35, 0]}>
        <sphereGeometry args={[0.85, 12, 10]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
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
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} roughness={0.3} />
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
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} roughness={0.5} />
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
        <meshStandardMaterial color="#1d1f2b" roughness={0.7} />
      </mesh>
      {/* Lit windows: a few emissive squares, not a texture — cheap. */}
      {[0.6, 1.3, 2.0, 2.7].map((y) =>
        [-0.3, 0.3].map((x) => (
          <mesh key={`${x}-${y}`} position={[x, y, 0.61]}>
            <boxGeometry args={[0.22, 0.28, 0.02]} />
            <meshBasicMaterial color={(x + y) % 0.9 > 0.45 ? '#ffc95c' : '#5c6478'} />
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

/** The jail pen behind the far wall — same geometry as the originals. */
function ThemedJailPen({ platform, bars }: { platform: string; bars: string }) {
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
          <cylinderGeometry args={[0.045, 0.045, barHeight, 6]} />
          <meshStandardMaterial color={bars} roughness={0.5} metalness={0.4} />
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
          <mesh position={[0, 1.42, 0]}>
            <coneGeometry args={[0.85, 0.5, 10]} />
            <meshStandardMaterial color={r.canopy} roughness={0.7} />
          </mesh>
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

/** Sky dressing: sun, stars, and the one big celestial body. */
function ThemedSky({ theme }: { theme: ArenaTheme }) {
  const stars = useMemo(() => {
    if (!theme.sky.stars) return [];
    // Deterministic: the same sky every visit, and no Math.random in render.
    const out: [number, number, number][] = [];
    for (let i = 0; i < 60; i++) {
      const h = Math.abs(Math.sin(i * 127.1) * 43758.5453) % 1;
      const v = Math.abs(Math.sin(i * 311.7) * 27183.29) % 1;
      out.push([(h - 0.5) * 60, 6 + v * 18, -24 - (h * 7 + v * 5) % 10]);
    }
    return out;
  }, [theme.sky.stars]);

  const body = theme.sky.body;
  return (
    <group>
      {theme.sky.sun && (
        <mesh position={[9, 13, -22]}>
          <sphereGeometry args={[theme.sky.sun.size, 14, 12]} />
          <meshBasicMaterial color={theme.sky.sun.color} />
        </mesh>
      )}
      {stars.map((p, i) => (
        <mesh key={`star-${i}`} position={p}>
          <sphereGeometry args={[0.09, 4, 4]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
      {body?.kind === 'moon' && (
        <mesh position={[-8, 13, -23]}>
          <sphereGeometry args={[1.5, 14, 12]} />
          <meshBasicMaterial color={body.color} />
        </mesh>
      )}
      {body?.kind === 'earth' && (
        <group position={[-8, 12, -23]}>
          <mesh>
            <sphereGeometry args={[2, 16, 14]} />
            <meshBasicMaterial color={body.color} />
          </mesh>
          <mesh position={[0.5, 0.5, 1.6]} scale={[1, 0.6, 0.4]}>
            <sphereGeometry args={[0.8, 10, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      )}
      {body?.kind === 'aurora' && (
        // Three broad emissive ribbons leaning across the sky.
        <group position={[0, 14, -24]}>
          {[-9, 0, 9].map((x, i) => (
            <mesh key={i} position={[x, i * 1.5, 0]} rotation={[0.2, 0, 0.35 - i * 0.3]}>
              <planeGeometry args={[3, 14]} />
              <meshBasicMaterial color={body.color} transparent opacity={0.35} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      )}
      {body?.kind === 'rainbow' && (
        <mesh position={[0, 6, -24]} rotation={[0, 0, 0]}>
          <torusGeometry args={[10, 0.9, 8, 40, Math.PI]} />
          <meshBasicMaterial color={body.color} transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

/* ── what the tray is BUILT of ────────────────────────────────────── */

/** One spot along the top of the tray wall. */
interface RimSpot {
  pos: [number, number, number];
  alongX: boolean;
}

/**
 * The rim of the tray, in whichever material this world is made of.
 *
 * David, 26 Aug 2026: "the arenas all don't have to look like castles.
 * They can be something that makes sense for the arena name, like how the
 * space station doesn't look like a castle." He was right — the first
 * sixteen were one castle wearing sixteen coats of paint, notched merlons
 * and cone-roofed turrets on a coral reef and on a rooftop at night.
 *
 * The tray the dice bounce in is IDENTICAL in all four: same walls, same
 * thickness, same height, same physics. Only what sits on top of it and
 * what stands at its corners changes, exactly the way the hazards already
 * work. Nothing here may affect play, and nothing here does.
 */
function ThemedCrest({ theme, rim }: { theme: ArenaTheme; rim: RimSpot[] }) {
  const cap = theme.wall.cap;
  const y = wallHeight + 0.12;

  if (theme.structure === 'hull') {
    /*
      Built, not fortified: a flat panelled coaming with one lit strip
      running round it. The moon base, the polar station, the rooftop and
      the beached pirate hull all read as made by somebody.
    */
    const long = innerDepth + wallThickness * 2;
    const sides: [number, number, number, number][] = [
      [-(halfW + wallThickness / 2), 0, wallThickness, long],
      [halfW + wallThickness / 2, 0, wallThickness, long],
      [0, -(halfD + wallThickness / 2), innerWidth, wallThickness],
      [0, halfD + wallThickness / 2, innerWidth, wallThickness],
    ];
    return (
      <group>
        {sides.map(([x, z, w, d], i) => (
          <group key={`coaming-${i}`}>
            <mesh position={[x, wallHeight + 0.07, z]}>
              <boxGeometry args={[w, 0.14, d]} />
              <meshStandardMaterial color={cap} roughness={0.45} metalness={0.35} />
            </mesh>
            <mesh position={[x, wallHeight + 0.16, z]}>
              <boxGeometry args={[w * 0.9, 0.05, d * 0.9]} />
              <meshBasicMaterial color={theme.tower.roof} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  if (theme.structure === 'rocks') {
    // Boulders heaped along the rim. Sizes vary from the index, so the
    // line is ragged without any randomness at render time.
    return (
      <group>
        {rim.map((m, i) => {
          const r = 0.26 + ((i * 37) % 11) / 44;
          return (
            <mesh
              key={`boulder-${i}`}
              position={[m.pos[0], wallHeight + r * 0.6, m.pos[2]]}
              rotation={[i * 0.7, i * 1.3, i * 0.4]}
              scale={[1, 0.78, 1]}
            >
              <dodecahedronGeometry args={[r, 0]} />
              <meshStandardMaterial color={cap} roughness={1} />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (theme.structure === 'posts') {
    // A timber fence: uprights with a rail threaded between them.
    const long = innerDepth + wallThickness * 2;
    const rails: [number, number, number, number][] = [
      [-(halfW + wallThickness / 2), 0, 0.07, long],
      [halfW + wallThickness / 2, 0, 0.07, long],
      [0, -(halfD + wallThickness / 2), innerWidth, 0.07],
      [0, halfD + wallThickness / 2, innerWidth, 0.07],
    ];
    return (
      <group>
        {rails.map(([x, z, w, d], i) => (
          <mesh key={`rail-${i}`} position={[x, wallHeight + 0.3, z]}>
            <boxGeometry args={[w, 0.09, d]} />
            <meshStandardMaterial color={cap} roughness={0.95} />
          </mesh>
        ))}
        {rim.map((m, i) => (
          <mesh key={`post-${i}`} position={[m.pos[0], wallHeight + 0.28, m.pos[2]]}>
            <cylinderGeometry args={[0.1, 0.12, 0.56, 6]} />
            <meshStandardMaterial color={cap} roughness={0.95} />
          </mesh>
        ))}
      </group>
    );
  }

  // battlement — notched stone teeth, the original crest.
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
}

/** What stands at the four corners, matching the crest. */
function ThemedCorners({
  theme,
  wallMaterial,
}: {
  theme: ArenaTheme;
  wallMaterial: THREE.Material;
}) {
  const roof = theme.tower.roof;
  return (
    <group>
      {CORNER_TOWERS.map(({ x, z }, i) => (
        <group key={`corner-${i}`} position={[x, 0, z]}>
          {theme.structure === 'battlement' && (
            <>
              <mesh material={wallMaterial} position={[0, wallHeight / 2 + 0.2, 0]}>
                <cylinderGeometry args={[0.5, 0.56, wallHeight + 0.4, 12]} />
              </mesh>
              <mesh position={[0, wallHeight + 0.72, 0]}>
                <coneGeometry args={[0.6, 0.8, 12]} />
                <meshStandardMaterial color={roof} roughness={0.6} />
              </mesh>
            </>
          )}

          {theme.structure === 'rocks' && (
            // A cairn: three boulders stacked, the top one the accent
            // stone this world glows or burns in.
            <>
              {([[0.58, 0.34], [0.44, 0.92], [0.3, 1.36]] as const).map(([r, y], k) => (
                <mesh key={k} position={[0, y, 0]} rotation={[k * 0.8, k * 1.1, k * 0.5]} scale={[1, 0.8, 1]}>
                  <dodecahedronGeometry args={[r, 0]} />
                  <meshStandardMaterial
                    color={k === 2 ? roof : theme.wall.cap}
                    roughness={1}
                  />
                </mesh>
              ))}
            </>
          )}

          {theme.structure === 'posts' && (
            // A gatepost, taller than the fence, with a turned finial.
            <>
              <mesh material={wallMaterial} position={[0, (wallHeight + 0.9) / 2, 0]}>
                <cylinderGeometry args={[0.24, 0.28, wallHeight + 0.9, 8]} />
              </mesh>
              <mesh position={[0, wallHeight + 1.02, 0]}>
                <sphereGeometry args={[0.28, 10, 8]} />
                <meshStandardMaterial color={roof} roughness={0.7} />
              </mesh>
            </>
          )}

          {theme.structure === 'hull' && (
            // A slim mast with a lit head — an aerial, a beacon, a
            // lantern at the masthead, depending on where you are.
            <>
              <mesh material={wallMaterial} position={[0, (wallHeight + 1.6) / 2, 0]}>
                <cylinderGeometry args={[0.09, 0.14, wallHeight + 1.6, 8]} />
              </mesh>
              <mesh position={[0, wallHeight + 1.68, 0]}>
                <sphereGeometry args={[0.18, 10, 8]} />
                <meshBasicMaterial color={roof} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}

/* ── the arena itself ─────────────────────────────────────────────── */

export function ThemedArena({ theme, id }: { theme: ArenaTheme; id: string }) {
  const floorTexture = useMemo(
    () =>
      cachedTexture(`themed-floor-${id}`, () => {
        const texture = createFlagstoneTexture(hexRgb(theme.floor.a), 0.78);
        const floorW = innerWidth + wallThickness * 2;
        const floorD = innerDepth + wallThickness * 2;
        texture.repeat.set(1, floorD / floorW);
        return texture;
      }),
    [id, theme.floor.a],
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

  const rim = useMemo(() => {
    const list: RimSpot[] = [];
    const y = wallHeight + 0.12;
    for (let x = -halfW + 0.4; x <= halfW - 0.3; x += 1.1) {
      list.push({ pos: [x, y, -(halfD + wallThickness / 2)], alongX: true });
      list.push({ pos: [x, y, halfD + wallThickness / 2], alongX: true });
    }
    for (let z = -halfD + 0.6; z <= halfD - 0.4; z += 1.15) {
      list.push({ pos: [-(halfW + wallThickness / 2), y, z], alongX: false });
      list.push({ pos: [halfW + wallThickness / 2, y, z], alongX: false });
    }
    return list;
  }, []);

  return (
    <group>
      {/* Tray floor */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[innerWidth + wallThickness * 2, innerDepth + wallThickness * 2]} />
        <meshStandardMaterial map={floorTexture} roughness={0.95} />
      </mesh>

      {/* The world's ground, out to the horizon. */}
      <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 70]} />
        <meshStandardMaterial color={theme.meadow} roughness={1} />
      </mesh>

      {/* Soft mounds. */}
      {([[-12, -9, 5], [12.5, -10, 5.2], [0, -17, 8.5], [-13, 4, 4.8], [13.5, 6, 5]] as const).map(
        ([x, z, r], i) => (
          <mesh key={`hill-${i}`} position={[x, -1.8, z]} scale={[1, 0.45, 1]}>
            <sphereGeometry args={[r, 14, 10]} />
            <meshStandardMaterial color={theme.hill} roughness={1} />
          </mesh>
        ),
      )}

      {/* Horizon cones. */}
      {theme.mountain &&
        ([[-9.5, -19, 5, 6.5], [0.5, -23, 7.5, 9], [9.5, -18, 4.6, 5.5]] as const).map(
          ([x, z, r, h], i) => (
            <mesh key={`mtn-${i}`} position={[x, h / 2 - 1.2, z]}>
              <coneGeometry args={[r, h, 10]} />
              <meshStandardMaterial color={theme.mountain!} roughness={1} />
            </mesh>
          ),
        )}

      {/* Clouds. */}
      {theme.cloud &&
        ([[-8, 7.5, -13, 1.6], [7.5, 8.5, -15, 2], [-2.5, 9.5, -19, 2.6]] as const).map(
          ([x, y, z, s], i) => (
            <group key={`cloud-${i}`} position={[x, y, z]} scale={[s, s * 0.5, s]}>
              <mesh>
                <sphereGeometry args={[1, 10, 8]} />
                <meshBasicMaterial color={theme.cloud!} />
              </mesh>
              <mesh position={[1.1, -0.1, 0.2]} scale={0.7}>
                <sphereGeometry args={[1, 10, 8]} />
                <meshBasicMaterial color={theme.cloud!} />
              </mesh>
            </group>
          ),
        )}

      <ThemedSky theme={theme} />
      <ThemedJailPen platform={theme.jail.platform} bars={theme.jail.bars} />
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
