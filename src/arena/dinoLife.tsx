import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { loop, track } from './boardLife';
import { useSceneryTick } from './sceneryClock';

/**
 * Dino Valley's dinosaurs, a concept, 20 Oct 2026.
 *
 * They ROAM, right round the board (David, 20 Oct 2026: "make the
 * dinosaurs move around the surroundings"). Every walker follows the
 * same rounded loop outside the tray — down one side, behind the jail,
 * up the other side and across the front between the near wall and the
 * landing pads — in two lanes: the long-neck and the triceratops plod
 * round the outer one, and two little raptors dash round the inner one,
 * overtaking them. Two pterodactyls circle high above. Built to be read
 * from above, moved on a scenery tick that allocates nothing
 * (sceneryClock.ts), and never over the tray except the pterodactyls,
 * which fly far above it.
 */

/** The two lanes round the board: rounded rectangles outside the tray. */
const OUTER = { half: 3.56, far: -9.3, near: 5.6, r: 0.7 };
const INNER = { half: 3.3, far: -8.95, near: 5.3, r: 0.6 };
/** Lap lengths, so a pace in world units a second becomes laps a second. */
const lapOf = (l: { half: number; far: number; near: number; r: number }) =>
  2 * (2 * l.half - 2 * l.r) + 2 * (l.near - l.far - 2 * l.r) + 2 * Math.PI * l.r;
const OUTER_LAP = lapOf(OUTER);
const INNER_LAP = lapOf(INNER);

const P = new THREE.Vector3();

/**
 * One pterodactyl wing in its own plane, x out to the tip and y toward
 * the nose: leading edge from the shoulder out to a point, trailing edge
 * swept back in a curve to the hip. Built once for every pterodactyl.
 */
function wing(side: 1 | -1): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0.12);
  s.lineTo(side * 0.55, 0.16);
  s.lineTo(side * 1.0, -0.02);
  s.quadraticCurveTo(side * 0.55, -0.12, side * 0.3, -0.3);
  s.lineTo(0, -0.18);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}
const WING_L = wing(-1);
const WING_R = wing(1);

export function DinoLife() {
  return (
    <group>
      <LongNeck />
      <Triceratops />
      <Raptor offset={0.15} tone="#d9823a" stripe="#7a3a1a" />
      <Raptor offset={0.19} tone="#3a9a8a" stripe="#1f5a50" />
      <Pterodactyl offset={0} height={2.2} tone="#c0784a" />
      <Pterodactyl offset={0.5} height={2.6} tone="#9a6a8a" />
    </group>
  );
}

const NECK_SKIN = '#8aa070';
const NECK_BELLY = '#c4cfa8';
const NECK_SPOT = '#6a8456';

/** A brachiosaurus-shaped walker, nose toward +z in its own frame. */
function LongNeck() {
  const body = useRef<THREE.Group | null>(null);
  const neck = useRef<THREE.Group | null>(null);
  const tail = useRef<THREE.Group | null>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const tick = useMemo(
    () => (t: number) => {
      const g = body.current;
      if (!g) return;
      const heading = track((t * 0.3) / OUTER_LAP, OUTER.half, OUTER.far, OUTER.near, OUTER.r, P);
      const step = t * 2.2;
      g.position.set(P.x, Math.abs(Math.sin(step)) * 0.03, P.z);
      g.rotation.set(0, heading, Math.sin(step) * 0.03);
      if (neck.current) neck.current.rotation.set(0.55 + Math.sin(step * 0.5) * 0.08, Math.sin(t * 0.4) * 0.25, 0);
      if (tail.current) tail.current.rotation.y = Math.sin(step * 0.5) * 0.3;
      for (let k = 0; k < 4; k++) {
        const leg = legs.current[k];
        if (leg) leg.rotation.x = Math.sin(step + (k === 0 || k === 3 ? 0 : Math.PI)) * 0.35;
      }
    },
    [],
  );
  useSceneryTick(tick);
  return (
    <group ref={body} scale={0.62}>
      <mesh position={[0, 1.0, 0]} scale={[0.5, 0.45, 0.95]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color={NECK_SKIN} roughness={0.8} />
      </mesh>
      {/* Spots along the back, where the camera sees them. */}
      {[[-0.15, 0.3], [0.18, 0], [-0.1, -0.35], [0.12, 0.5]].map(([sx, sz], k) => (
        <mesh key={k} position={[sx, 1.43, sz]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1.3, 1]}>
          <circleGeometry args={[0.1, 10]} />
          <meshStandardMaterial color={NECK_SPOT} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 0.72, 0]} scale={[0.42, 0.2, 0.8]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color={NECK_BELLY} roughness={0.8} />
      </mesh>
      {/* The neck, rising and leaning forward, and the little head. */}
      <group ref={neck} position={[0, 1.25, 0.75]} rotation={[0.55, 0, 0]}>
        <mesh position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.1, 0.17, 1.5, 10]} />
          <meshStandardMaterial color={NECK_SKIN} roughness={0.8} />
        </mesh>
        <group position={[0, 1.55, 0.06]}>
          <mesh scale={[0.15, 0.13, 0.26]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color={NECK_SKIN} roughness={0.8} />
          </mesh>
          {[-0.09, 0.09].map((ex) => (
            <mesh key={ex} position={[ex, 0.07, 0.06]}>
              <sphereGeometry args={[0.03, 6, 5]} />
              <meshStandardMaterial color="#1b1b1b" roughness={0.5} />
            </mesh>
          ))}
        </group>
      </group>
      {/* The tail, long and tapering, swinging. */}
      <group ref={tail} position={[0, 0.95, -0.85]}>
        <mesh position={[0, -0.15, -0.6]} rotation={[-Math.PI / 2 - 0.25, 0, 0]}>
          <coneGeometry args={[0.2, 1.4, 10]} />
          <meshStandardMaterial color={NECK_SKIN} roughness={0.8} />
        </mesh>
      </group>
      {[[-0.28, 0.45], [0.28, 0.45], [-0.28, -0.45], [0.28, -0.45]].map(([lx, lz], k) => (
        <group key={k} ref={(g) => { legs.current[k] = g; }} position={[lx, 0.8, lz]}>
          <mesh position={[0, -0.4, 0]}>
            <cylinderGeometry args={[0.13, 0.14, 0.8, 8]} />
            <meshStandardMaterial color={NECK_SKIN} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A little triceratops pottering along the near strip. */
function Triceratops() {
  const body = useRef<THREE.Group | null>(null);
  const head = useRef<THREE.Group | null>(null);
  const tick = useMemo(
    () => (t: number) => {
      const g = body.current;
      if (!g) return;
      // Plods round behind the long-neck, a third of a lap on, and
      // stops every so often to graze, head down.
      // Fourteen seconds a cycle: walks ten, stands and grazes four.
      const cycle = Math.floor(t / 14);
      const within = t - cycle * 14;
      const walked = (cycle * 10 + Math.min(within, 10)) * 0.3;
      const grazing = within > 10;
      const graze = grazing ? Math.min(1, (within - 10) * 2, (14 - within) * 2) : 0;
      const heading = track(walked / OUTER_LAP + 0.33, OUTER.half, OUTER.far, OUTER.near, OUTER.r, P);
      const step = t * 5;
      g.position.set(P.x, grazing ? 0 : Math.abs(Math.sin(step)) * 0.02, P.z);
      g.rotation.set(0, heading, 0);
      if (head.current) head.current.rotation.x = graze * 0.6;
    },
    [],
  );
  useSceneryTick(tick);
  return (
    <group ref={body} scale={1.1}>
      <mesh position={[0, 0.3, 0]} scale={[0.26, 0.22, 0.4]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color="#7a9a4a" roughness={0.85} />
      </mesh>
      <group ref={head} position={[0, 0.32, 0.38]}>
        {/* The frill: a shield standing up behind the head. */}
        <mesh position={[0, 0.12, 0]} rotation={[-0.4, 0, 0]}>
          <circleGeometry args={[0.26, 14]} />
          <meshStandardMaterial color="#e09a4a" roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.02, 0.12]} scale={[0.15, 0.13, 0.2]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#7a9a4a" roughness={0.85} />
        </mesh>
        {/* Three horns. */}
        {[[-0.08, 0.1, 0.18], [0.08, 0.1, 0.18], [0, 0.0, 0.3]].map(([hx, hy, hz], k) => (
          <mesh key={k} position={[hx, hy, hz]} rotation={[Math.PI / 2 - 0.5, 0, 0]}>
            <coneGeometry args={[0.025, k === 2 ? 0.1 : 0.16, 6]} />
            <meshStandardMaterial color="#f2ead2" roughness={0.6} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.3, -0.42]} rotation={[-Math.PI / 2 - 0.3, 0, 0]}>
        <coneGeometry args={[0.1, 0.35, 8]} />
        <meshStandardMaterial color="#7a9a4a" roughness={0.85} />
      </mesh>
      {[[-0.14, 0.2], [0.14, 0.2], [-0.14, -0.2], [0.14, -0.2]].map(([lx, lz], k) => (
        <mesh key={k} position={[lx, 0.1, lz]}>
          <cylinderGeometry args={[0.06, 0.07, 0.2, 6]} />
          <meshStandardMaterial color="#6a8a40" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** A pterodactyl circling high over the valley, wings flapping. */
function Pterodactyl({ offset, height, tone }: { offset: number; height: number; tone: string }) {
  const body = useRef<THREE.Group | null>(null);
  const wingL = useRef<THREE.Group | null>(null);
  const wingR = useRef<THREE.Group | null>(null);
  const tick = useMemo(
    () => (t: number) => {
      const g = body.current;
      if (!g) return;
      const heading = loop(t * 0.035 + offset, 2.95, -8.2, 2.6, P);
      g.position.set(P.x, height + Math.sin(t * 0.9 + offset * 6) * 0.15, P.z);
      g.rotation.set(0, heading, Math.sin(t * 0.7 + offset) * 0.2);
      // Flap, then glide a little, the way a big wing beats.
      const flap = Math.sin(t * 5 + offset * 10) * 0.55 * (0.6 + 0.4 * Math.sin(t * 0.8 + offset));
      if (wingL.current) wingL.current.rotation.z = flap;
      if (wingR.current) wingR.current.rotation.z = -flap;
    },
    [offset, height],
  );
  useSceneryTick(tick);
  return (
    <group ref={body} scale={1.3}>
      <mesh scale={[0.08, 0.07, 0.3]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color={tone} roughness={0.8} />
      </mesh>
      {/* Head: a long beak forward and a crest back. */}
      <mesh position={[0, 0.03, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.04, 0.28, 6]} />
        <meshStandardMaterial color="#e8c070" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.07, 0.22]} rotation={[-Math.PI / 2 - 0.3, 0, 0]}>
        <coneGeometry args={[0.035, 0.26, 4]} />
        <meshStandardMaterial color={tone} roughness={0.8} />
      </mesh>
      {/* Wings: flat, bat-like, hinged at the shoulder, lying in the
          ground plane so the camera above sees their whole spread. */}
      {([[wingL, -1], [wingR, 1]] as const).map(([ref, side]) => (
        <group key={side} ref={ref} position={[side * 0.05, 0, 0.05]}>
          <mesh geometry={side < 0 ? WING_L : WING_R} rotation={[-Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color={tone} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A little raptor: runs upright on two legs, tail out straight behind. */
function Raptor({ offset, tone, stripe }: { offset: number; tone: string; stripe: string }) {
  const body = useRef<THREE.Group | null>(null);
  const legL = useRef<THREE.Group | null>(null);
  const legR = useRef<THREE.Group | null>(null);
  const tick = useMemo(
    () => (t: number) => {
      const g = body.current;
      if (!g) return;
      // Dashes round the inner lane three times as fast as the walkers,
      // with a little burst and ease in its pace.
      const pace = 1.1 * t + Math.sin(t * 0.7 + offset * 20) * 0.6;
      const heading = track(pace / INNER_LAP + offset, INNER.half, INNER.far, INNER.near, INNER.r, P);
      const stride = t * 14 + offset * 30;
      g.position.set(P.x, Math.abs(Math.sin(stride)) * 0.04, P.z);
      g.rotation.set(0, heading, 0);
      if (legL.current) legL.current.rotation.x = Math.sin(stride) * 0.8;
      if (legR.current) legR.current.rotation.x = -Math.sin(stride) * 0.8;
    },
    [offset],
  );
  useSceneryTick(tick);
  return (
    <group ref={body} scale={1.15}>
      <mesh position={[0, 0.32, 0]} rotation={[0.2, 0, 0]} scale={[0.11, 0.11, 0.24]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color={tone} roughness={0.8} />
      </mesh>
      {/* Stripes across the back. */}
      {[-0.08, 0, 0.08].map((sz) => (
        <mesh key={sz} position={[0, 0.425, sz]}>
          <boxGeometry args={[0.16, 0.012, 0.025]} />
          <meshStandardMaterial color={stripe} roughness={0.8} />
        </mesh>
      ))}
      {/* Neck up, head forward. */}
      <mesh position={[0, 0.45, 0.2]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.055, 0.2, 6]} />
        <meshStandardMaterial color={tone} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.55, 0.3]} scale={[0.065, 0.06, 0.13]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color={tone} roughness={0.8} />
      </mesh>
      {[-0.035, 0.035].map((ex) => (
        <mesh key={ex} position={[ex, 0.585, 0.33]}>
          <sphereGeometry args={[0.014, 5, 4]} />
          <meshStandardMaterial color="#141414" roughness={0.5} />
        </mesh>
      ))}
      {/* Tail out straight behind, for balance. */}
      <mesh position={[0, 0.34, -0.38]} rotation={[-Math.PI / 2 - 0.1, 0, 0]}>
        <coneGeometry args={[0.06, 0.4, 6]} />
        <meshStandardMaterial color={tone} roughness={0.8} />
      </mesh>
      {([[legL, -0.06], [legR, 0.06]] as const).map(([ref, lx]) => (
        <group key={lx} ref={ref} position={[lx, 0.26, 0]}>
          <mesh position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.025, 0.03, 0.25, 5]} />
            <meshStandardMaterial color={stripe} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
