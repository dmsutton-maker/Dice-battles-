import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSceneryTick } from './sceneryClock';

/**
 * Snowy Hollow: a snowball fight, a snowman being built, and a snowman
 * out for a walk. 19 Oct 2026.
 *
 * David: "On the snowboard, I want to see people having a snowball
 * fight and I wanna see snowman being built and walking around."
 *
 * Three scenes, all on a scenery tick that allocates nothing
 * (sceneryClock.ts), all outside the tray:
 *
 * - THE FIGHT, beyond the far wall between the two pines: two children
 *   in winter coats and bobble hats take turns. One winds up and throws,
 *   the snowball arcs across, the other ducks sideways and takes it, and
 *   throws back.
 * - THE BUILD, in the far right corner where a snowman used to simply
 *   stand: a child rolls a snowball that grows as it goes, stops it at
 *   the site, the middle and the head rise onto it, the nose and the hat
 *   go on, the child steps back to admire it — and then it sinks into
 *   the snow and the child goes back for another. Fourteen seconds a
 *   snowman.
 * - THE WALK, along the front of the board between the wall and the
 *   landing pads: a finished snowman waddles from one side to the other
 *   and back, stick arms swinging, hat and scarf on.
 *
 * Built to be read from ABOVE: coats and hats are the bright things,
 * snowmen are three white discs with a black hat on top, and the
 * snowball is the only thing that moves fast.
 */

const SNOW = '#f4f8fb';
const SNOW_SHADE = '#dde8f0';

/* ── The fight ─────────────────────────────────────────────────────── */

const FIGHT_Z = -9.55;
const THROWERS = [
  { x: -1.25, coat: '#d9423a', hat: '#ffd21f', skin: '#e0b088' },
  { x: 1.25, coat: '#2f6fd0', hat: '#2fb88a', skin: '#8a5a3a' },
];
/** One throw each way takes this long, in seconds. */
const THROW_PERIOD = 2.6;
/** The ball is in the air for this share of the period. */
const FLIGHT = 0.42;

/* ── The build ─────────────────────────────────────────────────────── */

const SITE = { x: 3.45, z: -7.45 };
const ROLL_FROM_Z = -6.1;
const BUILD_PERIOD = 14;

/* ── The walk ──────────────────────────────────────────────────────── */

const WALK_Z = 5.55;
const WALK_REACH = 2.1;

export function SnowLife() {
  return (
    <group>
      <SnowballFight />
      <SnowmanBuild />
      <SnowmanWalk />
    </group>
  );
}

/** A child in a winter coat and a bobble hat. */
function Kid({ coat, hat, skin, arm }: { coat: string; hat: string; skin: string; arm?: React.Ref<THREE.Group> }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <capsuleGeometry args={[0.085, 0.2, 4, 8]} />
        <meshStandardMaterial color={coat} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.075, 8, 6]} />
        <meshStandardMaterial color={skin} roughness={0.8} />
      </mesh>
      {/* Bobble hat: a dome and a bobble, the brightest thing from above. */}
      <mesh position={[0, 0.46, 0]} scale={[0.085, 0.07, 0.085]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color={hat} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.54, 0]}>
        <sphereGeometry args={[0.035, 6, 5]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
      {/* Legs. */}
      {[-0.04, 0.04].map((lx) => (
        <mesh key={lx} position={[lx, 0.05, 0]}>
          <boxGeometry args={[0.05, 0.1, 0.06]} />
          <meshStandardMaterial color="#3a3f52" roughness={0.9} />
        </mesh>
      ))}
      {/* The throwing arm, hung from the shoulder so it can wind up. */}
      <group ref={arm} position={[0.1, 0.3, 0]}>
        <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.03, 0.14, 4, 6]} />
          <meshStandardMaterial color={coat} roughness={0.9} />
        </mesh>
      </group>
      <mesh position={[-0.1, 0.28, 0]}>
        <capsuleGeometry args={[0.03, 0.12, 4, 6]} />
        <meshStandardMaterial color={coat} roughness={0.9} />
      </mesh>
    </group>
  );
}

function SnowballFight() {
  const kids = useRef<(THREE.Group | null)[]>([]);
  const arms = useRef<(THREE.Group | null)[]>([]);
  const balls = useRef<(THREE.Mesh | null)[]>([]);
  const tick = useMemo(
    () => (t: number) => {
      // Thrower 0 throws in the first half of a double period, thrower
      // 1 in the second.
      const cycle = (t / THROW_PERIOD) % 2;
      for (let i = 0; i < 2; i++) {
        const mine = ((cycle % 2) + 2) % 2;
        const phase = mine >= i && mine < i + 1 ? mine - i : -1;
        const kid = kids.current[i];
        const other = THROWERS[1 - i];
        const me = THROWERS[i];
        const dir = i === 0 ? 1 : -1;
        if (kid) {
          // Sidestep while the other one is throwing.
          const dodge = phase < 0 ? Math.sin(t * 2.1 + i * 2) * 0.22 : 0;
          kid.position.set(me.x, 0, FIGHT_Z + dodge);
          // Face the other one; flinch back when the ball lands.
          const theirs = ((cycle % 2) + 2) % 2;
          const incoming = theirs >= 1 - i && theirs < 2 - i ? theirs - (1 - i) : -1;
          const hit = incoming > FLIGHT - 0.06 && incoming < FLIGHT + 0.12 ? 0.35 : 0;
          kid.rotation.set(0, dir * Math.PI / 2, -dir * hit);
          kid.scale.setScalar(1.3);
        }
        const arm = arms.current[i];
        if (arm) {
          // Wind up, then whip forward as the ball leaves.
          const wind = phase < 0 ? 0 : phase < 0.12 ? -phase / 0.12 : phase < 0.2 ? -1 + ((phase - 0.12) / 0.08) * 1.6 : Math.max(0, 0.6 - (phase - 0.2) * 2);
          arm.rotation.x = wind * 1.2;
        }
        const ball = balls.current[i];
        if (ball) {
          // In the air from the moment the arm whips until it lands.
          const s = phase < 0.2 ? -1 : (phase - 0.2) / FLIGHT;
          const flying = s >= 0 && s <= 1;
          ball.visible = flying;
          if (flying) {
            ball.position.set(me.x + (other.x - me.x) * s, 0.5 + Math.sin(s * Math.PI) * 0.5, FIGHT_Z);
          }
        }
      }
    },
    [],
  );
  useSceneryTick(tick);
  return (
    <group>
      {THROWERS.map((k, i) => (
        <group key={i} ref={(g) => { kids.current[i] = g; }}>
          <Kid coat={k.coat} hat={k.hat} skin={k.skin} arm={(g) => { arms.current[i] = g; }} />
        </group>
      ))}
      {[0, 1].map((i) => (
        <mesh key={`ball-${i}`} ref={(m) => { balls.current[i] = m; }} visible={false}>
          <sphereGeometry args={[0.08, 8, 6]} />
          <meshStandardMaterial color="#ffffff" roughness={1} />
        </mesh>
      ))}
      {/* A little heap of ready snowballs beside each thrower. */}
      {THROWERS.map((k, i) => (
        <group key={`heap-${i}`} position={[k.x - (i === 0 ? 0.3 : -0.3), 0, FIGHT_Z + 0.25]}>
          {[[0, 0.05, 0], [0.09, 0.05, 0.04], [-0.07, 0.05, 0.06], [0.01, 0.13, 0.03]].map(([bx, by, bz], j) => (
            <mesh key={j} position={[bx, by, bz]}>
              <sphereGeometry args={[0.05, 7, 5]} />
              <meshStandardMaterial color="#ffffff" roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** A snowman, built from refs so the build can raise it piece by piece. */
function Snowman({
  base, middle, head, hat, nose, armL, armR, scarf,
}: {
  base?: React.Ref<THREE.Mesh>; middle?: React.Ref<THREE.Group>; head?: React.Ref<THREE.Group>;
  hat?: React.Ref<THREE.Group>; nose?: React.Ref<THREE.Mesh>; armL?: React.Ref<THREE.Mesh>; armR?: React.Ref<THREE.Mesh>;
  scarf?: string;
}) {
  return (
    <group>
      <mesh ref={base} position={[0, 0.22, 0]}>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial color={SNOW} roughness={1} />
      </mesh>
      <group ref={middle} position={[0, 0.5, 0]}>
        <mesh>
          <sphereGeometry args={[0.16, 12, 10]} />
          <meshStandardMaterial color={SNOW} roughness={1} />
        </mesh>
        {/* Coal buttons, on the front. */}
        {[0.05, -0.03].map((by) => (
          <mesh key={by} position={[0, by, 0.15]}>
            <sphereGeometry args={[0.018, 6, 5]} />
            <meshStandardMaterial color="#1b1b1b" roughness={0.8} />
          </mesh>
        ))}
        {scarf && (
          <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.13, 0.035, 6, 14]} />
            <meshStandardMaterial color={scarf} roughness={0.9} />
          </mesh>
        )}
        {/* Stick arms, out to the sides. */}
        <mesh ref={armL} position={[-0.2, 0.04, 0]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[0.22, 0.02, 0.02]} />
          <meshStandardMaterial color="#6a4a2a" roughness={1} />
        </mesh>
        <mesh ref={armR} position={[0.2, 0.04, 0]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[0.22, 0.02, 0.02]} />
          <meshStandardMaterial color="#6a4a2a" roughness={1} />
        </mesh>
      </group>
      <group ref={head} position={[0, 0.74, 0]}>
        <mesh>
          <sphereGeometry args={[0.11, 12, 10]} />
          <meshStandardMaterial color={SNOW} roughness={1} />
        </mesh>
        {[-0.04, 0.04].map((ex) => (
          <mesh key={ex} position={[ex, 0.04, 0.09]}>
            <sphereGeometry args={[0.015, 6, 5]} />
            <meshStandardMaterial color="#1b1b1b" roughness={0.8} />
          </mesh>
        ))}
        <mesh ref={nose} position={[0, 0, 0.14]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.02, 0.1, 6]} />
          <meshStandardMaterial color="#ff8a3c" roughness={0.9} />
        </mesh>
        <group ref={hat} position={[0, 0.09, 0]}>
          <mesh position={[0, 0.005, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.015, 14]} />
            <meshStandardMaterial color="#1b1b1b" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.085, 0.09, 0.13, 14]} />
            <meshStandardMaterial color="#1b1b1b" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.092, 0.092, 0.025, 14]} />
            <meshStandardMaterial color="#d9423a" roughness={0.9} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function SnowmanBuild() {
  const kid = useRef<THREE.Group | null>(null);
  const rolling = useRef<THREE.Mesh | null>(null);
  const snowman = useRef<THREE.Group | null>(null);
  const base = useRef<THREE.Mesh | null>(null);
  const middle = useRef<THREE.Group | null>(null);
  const head = useRef<THREE.Group | null>(null);
  const hat = useRef<THREE.Group | null>(null);
  const nose = useRef<THREE.Mesh | null>(null);
  const tick = useMemo(
    () => (t: number) => {
      const p = (t / BUILD_PERIOD) % 1;
      const k = kid.current;
      const ball = rolling.current;
      const man = snowman.current;
      if (!k || !ball || !man) return;
      // How far along the roll, 0..1 over the first 40%.
      const roll = Math.min(1, p / 0.4);
      const ballZ = ROLL_FROM_Z + (SITE.z - ROLL_FROM_Z) * roll;
      const ballR = 0.07 + 0.15 * roll;
      if (p < 0.4) {
        // Rolling: the ball grows, the child pushes from behind and the
        // ball turns as it goes.
        ball.visible = true;
        ball.scale.setScalar(ballR / 0.22);
        ball.position.set(SITE.x, ballR, ballZ);
        ball.rotation.x = -roll * 14;
        k.position.set(SITE.x, 0, ballZ + ballR + 0.16);
        k.rotation.set(0.25, Math.PI, 0);
        man.visible = false;
      } else {
        ball.visible = false;
        man.visible = true;
        man.position.set(SITE.x, 0, SITE.z);
        // The pieces rise on in turn, then the whole thing sinks away.
        const rise = (from: number, to: number) => Math.min(1, Math.max(0, (p - from) / (to - from)));
        const mid = rise(0.42, 0.5);
        const top = rise(0.52, 0.6);
        const trim = rise(0.61, 0.67);
        const sink = rise(0.93, 1);
        if (middle.current) middle.current.position.y = 0.16 + (0.5 - 0.16) * mid;
        if (head.current) {
          head.current.position.y = 0.11 + (0.74 - 0.11) * top;
          head.current.visible = top > 0;
        }
        if (middle.current) middle.current.visible = mid > 0;
        if (hat.current) hat.current.scale.setScalar(Math.max(0.001, trim));
        if (nose.current) nose.current.scale.setScalar(Math.max(0.001, trim));
        man.position.y = -1.1 * sink;
        // The child: lifts the middle, then the head, then steps back
        // and bounces on the spot, pleased.
        if (p < 0.6) {
          k.position.set(SITE.x + 0.28, 0, SITE.z + 0.2);
          k.rotation.set(0, -Math.PI / 2 - 0.5, 0);
        } else if (p < 0.93) {
          const bounce = Math.abs(Math.sin(t * 5)) * 0.05;
          k.position.set(SITE.x - 0.1, bounce, SITE.z + 0.62);
          k.rotation.set(0, Math.PI, 0);
        } else {
          // Back to the start for the next one.
          const back = (p - 0.93) / 0.07;
          k.position.set(SITE.x, 0, SITE.z + 0.62 + (ROLL_FROM_Z + 0.25 - SITE.z - 0.62) * back);
          k.rotation.set(0, 0, 0);
        }
      }
    },
    [],
  );
  useSceneryTick(tick);
  return (
    <group>
      <group ref={kid}>
        <Kid coat="#8a4a9a" hat="#ff8a3c" skin="#c68a5c" />
      </group>
      <mesh ref={rolling} visible={false}>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial color={SNOW_SHADE} roughness={1} />
      </mesh>
      <group ref={snowman} visible={false}>
        <Snowman base={base} middle={middle} head={head} hat={hat} nose={nose} />
      </group>
    </group>
  );
}

function SnowmanWalk() {
  const man = useRef<THREE.Group | null>(null);
  const armL = useRef<THREE.Mesh | null>(null);
  const armR = useRef<THREE.Mesh | null>(null);
  const tick = useMemo(
    () => (t: number) => {
      const g = man.current;
      if (!g) return;
      const p = t * 0.22;
      const x = Math.sin(p) * WALK_REACH;
      const vx = Math.cos(p);
      const step = t * 5.5;
      g.position.set(x, Math.abs(Math.sin(step)) * 0.03, WALK_Z);
      // Face the way it is going, with a waddle.
      g.rotation.set(0, vx >= 0 ? Math.PI / 2 : -Math.PI / 2, Math.sin(step) * 0.09);
      g.scale.setScalar(1.15);
      if (armL.current) armL.current.rotation.y = Math.sin(step) * 0.5;
      if (armR.current) armR.current.rotation.y = -Math.sin(step) * 0.5;
    },
    [],
  );
  useSceneryTick(tick);
  return (
    <group ref={man}>
      <Snowman armL={armL} armR={armR} scarf="#2f6fd0" />
    </group>
  );
}
