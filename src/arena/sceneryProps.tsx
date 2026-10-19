import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSceneryTick } from './sceneryClock';

/**
 * Scenery that more than one arena wants.
 *
 * David, 25 Sep 2026: "make the surroundings of all arenas on all the
 * maps more decorative and maybe put like people fighting on some of
 * them." ALL the arenas — which is twenty, not sixteen: the castle, the
 * sunset castle, the jungle and the space station are bespoke scenes
 * with their own five hundred lines each, and they cannot reach into
 * ThemedArena. These four pieces live here so both halves of the game's
 * scenery draw the same fighters and the same crates rather than two
 * versions that drift apart.
 */

/**
 * Where the four bespoke arenas put their extra scenery.
 *
 * The sixteen themed battlefields keep their placements in themeData,
 * where the test suite reads them; the castle, the sunset castle, the
 * jungle and the station each hard-code their own scene, so without
 * this their new props would be eight coordinate pairs repeated in
 * three files that nothing could check. Shared here, one test covers
 * all four.
 *
 * Every spot satisfies the same four rules the themed props do —
 * outside the tray, clear of every jail and retreat slot, inside the
 * frame on both phone shapes — plus a fifth the suite could not see
 * until it was written down: OUT OF THE JAIL PEN'S SHADOW. The pen's
 * platform stands 1.15 high directly between the camera and the middle
 * of the back, so a prop there is inside the frame and behind a wall.
 * The first attempt at this put a sword fight exactly there and it was
 * rendering for nobody.
 *
 * Back pairs first, then the two side columns, so an arena can hand the
 * first few its best pieces.
 */
export const EXTRA_SPOTS: readonly (readonly [number, number])[] = [
  [-3.85, -7],
  [3.85, -7],
  [-3.95, -9.15],
  [3.95, -9.15],
  [-3.05, -2.1],
  [3.05, -2.1],
  [-3.05, 0.4],
  [3.05, 0.4],
];

/**
 * Two little figures having a fight, for the edges of the board.
 *
 * David, 25 Sep 2026: "make the surroundings of all arenas on all the
 * maps more decorative and maybe put like people fighting on some of
 * them."
 *
 * CROSSED BLADES, because of the camera. The first version posed them
 * the way you would draw a duel side-on — one lunging, one braced behind
 * a shield — and rendering it showed why that was wrong: this camera
 * looks almost straight DOWN, from (0, 19.5, 5.8), so a lunge reads as a
 * lean and a raised sword reads as a stick. Two blades crossing in the
 * air between two figures is the one arrangement of a fight that is
 * unmistakable from above, which is the only angle anybody will ever see
 * these from.
 *
 * BUILT LIKE THE PRISONERS otherwise — same capsule body, same ball
 * head, same proportions as src/game/Prisoners.tsx — because anything
 * built differently would read as a second kind of person in a game that
 * has exactly one.
 *
 * ANIMATED since 19 Oct 2026. They were posed still, on the grounds that
 * motion in the corner competes with the dice; David then asked for it
 * outright: "Animate the guys fighting around castle courtyard." So
 * they fight. The pair circle each other slowly, and take turns: one
 * lunges in with a swing, the other rocks back and parries, the blades
 * cross and part, then it goes the other way. Everything is movement
 * SEEN FROM ABOVE — footwork across the ground and blades swinging in
 * the ground plane — for the same reason the blades were laid flat in
 * the first place. The tick writes numbers into groups built once (see
 * sceneryClock.ts) and allocates nothing.
 *
 * `color` tints one fighter; the other takes a fixed cool slate so the
 * pair reads as two people rather than as one object with a blur.
 * `seed` starts each fight at its own moment, so two on one board are
 * not in step.
 */
export function Duel({ color = '#c23b3b', seed = 0 }: { color?: string; seed?: number }) {
  const ring = useRef<THREE.Group | null>(null);
  const left = useRef<THREE.Group | null>(null);
  const right = useRef<THREE.Group | null>(null);
  const bladeL = useRef<THREE.Group | null>(null);
  const bladeR = useRef<THREE.Group | null>(null);
  const tick = useMemo(
    () => (seconds: number) => {
      const t = seconds + seed * 1.7;
      // The whole fight turns, so "around" is literal: a full circle
      // every twenty seconds or so, slow enough to be footwork.
      if (ring.current) ring.current.rotation.y = t * 0.3 + seed;
      // One exchange every two and a half seconds. `bout` runs -1..1:
      // positive is the left fighter pressing in, negative the right.
      const bout = Math.sin(t * 2.5);
      // A press is sharper than a sine: hold, then step. Cubing keeps
      // the sign and the range and squashes the middle.
      const press = bout * bout * bout;
      const l = left.current;
      const r = right.current;
      if (l) {
        l.position.x = -0.36 + Math.max(0, press) * 0.2 - Math.max(0, -press) * 0.08;
        l.rotation.z = 0.16 + press * 0.14;
        l.position.y = Math.max(0, press) * 0.03;
      }
      if (r) {
        r.position.x = 0.36 - Math.max(0, -press) * 0.2 + Math.max(0, press) * 0.08;
        r.rotation.z = -0.16 + press * 0.14;
        r.position.y = Math.max(0, -press) * 0.03;
      }
      // The blades: each swings about its hand (the mesh is offset so
      // the hilt end sits at the pivot), and they meet when `bout` peaks
      // either way. The attacker's blade comes across the middle; the
      // defender's comes up to it. In between they open out again.
      const swingL = 0.62 + press * 0.55 + Math.sin(t * 5) * 0.08;
      const swingR = -0.62 - press * 0.55 + Math.sin(t * 5 + 1.3) * 0.08;
      if (bladeL.current) bladeL.current.rotation.y = swingL;
      if (bladeR.current) bladeR.current.rotation.y = swingR;
    },
    [seed],
  );
  useSceneryTick(tick);
  return (
    <group ref={ring}>
      <group ref={left} position={[-0.36, 0, 0]} rotation={[0, 0, 0.16]}>
        <Fighter tunic={color} />
      </group>
      <group ref={right} position={[0.36, 0, 0]} rotation={[0, 0, -0.16]}>
        <Fighter tunic="#4a5570" />
      </group>
      {/*
        The two blades, crossing in the GROUND plane rather than the
        upright one.

        Upright was the obvious way to draw it and it came out as a
        barbell: from a camera that is very nearly overhead, two blades
        crossing in a vertical plane project onto the same line, so the
        pair read as one bar joining two heads. Laid almost flat and
        angled across each other, the X is an X from exactly the angle
        the game is played at. `Math.PI / 2` on Z is what turns a box
        that is long in Y into one that is long in X; the Y rotation then
        swings each one out to its own diagonal, and the small X tilt
        lifts the far end so they still look held rather than dropped.

        Each blade pivots at its holder's side (the box is shifted along
        its own length so the hilt sits at the group origin), so the
        swing the tick writes into rotation.y reads as a sword swung from
        the hand, not a bar spinning about its middle.
      */}
      <group ref={bladeL} position={[-0.2, 0.46, 0.04]} rotation={[0.18, 0.62, 0]}>
        <mesh position={[0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.05, 0.66, 0.05]} />
          <meshStandardMaterial color="#dce2ea" roughness={0.3} metalness={0.55} />
        </mesh>
      </group>
      <group ref={bladeR} position={[0.2, 0.46, -0.04]} rotation={[0.18, -0.62, 0]}>
        <mesh position={[-0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.05, 0.66, 0.05]} />
          <meshStandardMaterial color="#dce2ea" roughness={0.3} metalness={0.55} />
        </mesh>
      </group>
      {/* A shield laid at the near fighter's feet, to break the symmetry. */}
      <mesh position={[-0.52, 0.04, 0.24]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[0.24, 0.06, 0.3]} />
        <meshStandardMaterial color="#8a5a34" roughness={0.85} />
      </mesh>
    </group>
  );
}

/** One fighter, built like a prisoner: capsule body, ball head. */
function Fighter({ tunic }: { tunic: string }) {
  return (
    <group>
      <mesh position={[0, 0.24, 0]}>
        <capsuleGeometry args={[0.12, 0.26, 4, 8]} />
        <meshStandardMaterial color={tunic} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshStandardMaterial color="#f0d2b4" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Stacked boxes — a camp, a dock, a loading bay. */
export function Crate({ color = '#8a5a34' }: { color?: string }) {
  const boxes: [number, number, number, number, number][] = [
    [0, 0.17, 0, 0.34, 0],
    [0.3, 0.13, 0.12, 0.26, 0.4],
    [-0.04, 0.44, -0.05, 0.24, -0.25],
  ];
  return (
    <group>
      {boxes.map(([x, y, z, size, spin], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, spin, 0]}>
          <boxGeometry args={[size, size, size]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** A post with boards across it. Points nowhere in particular. */
export function Signpost({ color = '#8a5a34' }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 0.68, 6]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0.1, 0.6, 0]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.42, 0.14, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh position={[-0.08, 0.44, 0]} rotation={[0, -0.2, 0]}>
        <boxGeometry args={[0.32, 0.11, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    </group>
  );
}

/**
 * A ring of stones with a flame in it.
 *
 * `meshBasicMaterial` on the flame, like every other fire and glow in
 * this file: an emissive that is LIT goes grey in the night arenas,
 * which is exactly where a campfire has to read.
 */
export function Campfire({ color = '#ff9440' }: { color?: string }) {
  return (
    <group>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.26, 0.06, Math.sin(a) * 0.26]}>
            <sphereGeometry args={[0.09, 7, 6]} />
            <meshStandardMaterial color="#8d8a84" roughness={0.95} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.2, 0]}>
        <coneGeometry args={[0.15, 0.36, 7]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

