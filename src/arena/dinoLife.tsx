import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { loop, track } from './boardLife';
import {
  dinoGeometries,
  dinoMaterials,
  gait,
  LONG_NECK_GAIT,
  newPose,
  RAPTOR_GAIT,
  TRICERATOPS_GAIT,
} from './dinoParts';
import { useSceneryTick } from './sceneryClock';

/**
 * Dino Valley's dinosaurs, a concept, 20 Oct 2026; rebuilt 1 Nov 2026.
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
 *
 * David, 1 Nov 2026: "Make the dinosaurs in Dino valley look much
 * better." The first ones were blobs: a sphere, a cone, one flat colour,
 * legs that did not move. These are built from the shared parts in
 * dinoParts.ts — the silhouettes a child knows (the long-neck's arched
 * neck and whip tail, the triceratops's frill, three horns and beak,
 * the raptors' sickle claws, stiff tails and feathered crests, the
 * pterodactyls' head crests and bat wings), hides painted with a pale
 * belly and spots or stripes, cartoon eyes with whites and pupils, and
 * legs that swing in step with how far they have walked. Friendly, not
 * fierce: round snouts, big eyes, no teeth (ages 5+).
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

export function DinoLife() {
  return (
    <group>
      <LongNeck />
      <Triceratops />
      <Raptor offset={0.15} size={1.15} />
      <Raptor offset={0.19} size={1.02} />
      <Pterodactyl offset={0} height={2.2} size={1.3} />
      <Pterodactyl offset={0.5} height={2.6} size={1.1} />
    </group>
  );
}

/** A pair of cartoon eyes, at the upper sides of a head. */
function Eyes({ whites, pupils, position }: { whites: THREE.BufferGeometry; pupils: THREE.BufferGeometry; position: [number, number, number] }) {
  const M = dinoMaterials();
  return (
    <group position={position}>
      <mesh geometry={whites} material={M.eye} />
      <mesh geometry={pupils} material={M.pupil} />
    </group>
  );
}

/** Where a quadruped's four hips are: front-left, front-right, back-left, back-right. */
const hips = (x: number, y: number, z: number): [number, number, number][] => [
  [-x, y, z],
  [x, y, z],
  [-x, y, -z],
  [x, y, -z],
];

/** How far forward of vertical the long-neck's neck leans, at the shoulder and again at the middle. */
const NECK_LEAN = 0.45;
const NECK_BEND = 0.5;

/** A brachiosaurus-shaped walker, nose toward +z in its own frame. */
function LongNeck() {
  const body = useRef<THREE.Group | null>(null);
  const neck = useRef<THREE.Group | null>(null);
  const head = useRef<THREE.Group | null>(null);
  const tail = useRef<THREE.Group | null>(null);
  const tailTip = useRef<THREE.Group | null>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const tick = useMemo(() => {
    const pose = newPose();
    return (t: number) => {
      const g = body.current;
      if (!g) return;
      const walked = t * LONG_NECK_GAIT.pace;
      const heading = track(walked / OUTER_LAP, OUTER.half, OUTER.far, OUTER.near, OUTER.r, P);
      gait(LONG_NECK_GAIT, walked, pose);
      g.position.set(P.x, pose.bob, P.z);
      g.rotation.set(0, heading, pose.roll);
      // The neck nods with each step and swings slowly side to side,
      // looking about; the head keeps roughly level as it does.
      if (neck.current) neck.current.rotation.set(NECK_LEAN + pose.nod, Math.sin(t * 0.4) * 0.25, 0);
      if (head.current) head.current.rotation.x = -(NECK_LEAN + NECK_BEND) + 0.15 - pose.nod;
      if (tail.current) tail.current.rotation.y = pose.tail;
      if (tailTip.current) tailTip.current.rotation.y = pose.tailTip;
      for (let k = 0; k < 4; k++) {
        const leg = legs.current[k];
        if (leg) leg.rotation.x = pose.legs[k];
      }
    };
  }, []);
  useSceneryTick(tick);
  const G = dinoGeometries().longNeck;
  const M = dinoMaterials();
  return (
    <group ref={body} scale={0.62}>
      <mesh geometry={G.body} material={M.skin.longNeck} position={[0, 1.0, 0]} />
      {/* The neck rises from the shoulders and bends forward again
          halfway up, the arch a child draws; the head hangs off the end. */}
      <group ref={neck} position={[0, 1.2, 0.72]} rotation={[NECK_LEAN, 0, 0]}>
        <mesh geometry={G.neckLow} material={M.skin.longNeck} />
        <group position={[0, 1.0, 0]} rotation={[NECK_BEND, 0, 0]}>
          <mesh geometry={G.neckHigh} material={M.skin.longNeck} />
          <group ref={head} position={[0, 0.78, 0]} rotation={[-(NECK_LEAN + NECK_BEND) + 0.15, 0, 0]}>
            <mesh geometry={G.head} material={M.skin.longNeck} position={[0, 0.02, 0.12]} />
            <Eyes whites={G.whites} pupils={G.pupils} position={[0, 0.12, 0.18]} />
          </group>
        </group>
      </group>
      {/* The tail: thick at the hips, lifted a little, then a whip that
          droops to its tip, swinging behind with the tip a beat later. */}
      <group ref={tail} position={[0, 1.05, -0.82]} rotation={[0.25, 0, 0]}>
        <mesh geometry={G.tailBase} material={M.skin.longNeck} />
        <group ref={tailTip} position={[0, 0, -1.0]} rotation={[-0.45, 0, 0]}>
          <mesh geometry={G.tailTip} material={M.skin.longNeck} />
        </group>
      </group>
      {/* Hips set wide and the feet out past the belly, so the walk
          shows from overhead, where legs tucked under a body vanish. */}
      {hips(0.37, 0.8, 0.6).map((at, k) => (
        <group key={k} ref={(g) => { legs.current[k] = g; }} position={at}>
          <mesh geometry={G.leg} material={M.hide.longNeck} />
        </group>
      ))}
    </group>
  );
}

/** A little triceratops pottering along the near strip. */
function Triceratops() {
  const body = useRef<THREE.Group | null>(null);
  const head = useRef<THREE.Group | null>(null);
  const tail = useRef<THREE.Group | null>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const tick = useMemo(() => {
    const pose = newPose();
    return (t: number) => {
      const g = body.current;
      if (!g) return;
      // Plods round behind the long-neck, a third of a lap on, and
      // stops every so often to graze, head down.
      // Fourteen seconds a cycle: walks ten, stands and grazes four.
      const cycle = Math.floor(t / 14);
      const within = t - cycle * 14;
      const walked = (cycle * 10 + Math.min(within, 10)) * TRICERATOPS_GAIT.pace;
      const grazing = within > 10;
      const graze = grazing ? Math.min(1, (within - 10) * 2, (14 - within) * 2) : 0;
      const heading = track(walked / OUTER_LAP + 0.33, OUTER.half, OUTER.far, OUTER.near, OUTER.r, P);
      // The gait is a function of distance, so the legs stop when it does.
      gait(TRICERATOPS_GAIT, walked, pose);
      g.position.set(P.x, pose.bob, P.z);
      g.rotation.set(0, heading, pose.roll);
      if (head.current) head.current.rotation.x = graze * 0.6 + pose.nod;
      if (tail.current) tail.current.rotation.y = pose.tail;
      for (let k = 0; k < 4; k++) {
        const leg = legs.current[k];
        if (leg) leg.rotation.x = pose.legs[k];
      }
    };
  }, []);
  useSceneryTick(tick);
  const G = dinoGeometries().triceratops;
  const M = dinoMaterials();
  return (
    <group ref={body} scale={1.1}>
      <mesh geometry={G.body} material={M.skin.triceratops} position={[0, 0.34, 0]} />
      <group ref={head} position={[0, 0.38, 0.4]}>
        {/* The frill: a scalloped shield behind the head, orange round
            the rim with a green plate inside. It lies well back over the
            shoulders, because the camera is nearly overhead and a frill
            standing upright is a line from there. */}
        <mesh geometry={G.frill} material={M.frill} position={[0, -0.05, -0.02]} rotation={[-0.95, 0, 0]} />
        <mesh geometry={G.plate} material={M.hide.triceratops} position={[0, -0.05, -0.02]} rotation={[-0.95, 0, 0]} />
        <mesh geometry={G.head} material={M.skin.triceratops} position={[0, 0, 0.1]} />
        {/* A parrot's beak, pointing forward and down, and three horns. */}
        <mesh geometry={G.beak} material={M.bone} position={[0, -0.04, 0.3]} rotation={[Math.PI / 2 + 0.35, 0, 0]} />
        <mesh geometry={G.horns} material={M.bone} />
        <Eyes whites={G.whites} pupils={G.pupils} position={[0, 0.05, 0.17]} />
      </group>
      <group ref={tail} position={[0, 0.32, -0.44]} rotation={[-0.15, 0, 0]}>
        <mesh geometry={G.tail} material={M.skin.triceratops} />
      </group>
      {hips(0.25, 0.26, 0.31).map((at, k) => (
        <group key={k} ref={(g) => { legs.current[k] = g; }} position={at}>
          <mesh geometry={G.leg} material={M.hide.triceratops} />
        </group>
      ))}
    </group>
  );
}

/** A pterodactyl circling high over the valley, wings flapping. */
function Pterodactyl({ offset, height, size }: { offset: number; height: number; size: number }) {
  const body = useRef<THREE.Group | null>(null);
  const head = useRef<THREE.Group | null>(null);
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
      // The head dips with each downstroke and looks about between them.
      if (head.current) head.current.rotation.set(0.15 + flap * 0.1, Math.sin(t * 0.5 + offset) * 0.3, 0);
    },
    [offset, height],
  );
  useSceneryTick(tick);
  const G = dinoGeometries().pterodactyl;
  const M = dinoMaterials();
  return (
    <group ref={body} scale={size}>
      <mesh geometry={G.body} material={M.skin.pterodactyl} />
      {/* Head: a long beak forward, a blade of a crest sweeping back. */}
      <group ref={head} position={[0, 0.03, 0.3]} rotation={[0.15, 0, 0]}>
        <mesh geometry={G.head} material={M.skin.pterodactyl} />
        <mesh geometry={G.beak} material={M.bone} position={[0, -0.01, 0.07]} />
        <mesh geometry={G.crest} material={M.mark.pterodactyl} position={[0, 0.02, -0.04]} />
        <Eyes whites={G.whites} pupils={G.pupils} position={[0, 0.03, 0.03]} />
      </group>
      {/* Wings: flat, bat-like, hinged at the shoulder, lying in the
          ground plane so the camera above sees their whole spread. */}
      <group ref={wingL} position={[-0.05, 0, 0.05]}>
        <mesh geometry={G.wingL} material={M.wing} />
      </group>
      <group ref={wingR} position={[0.05, 0, 0.05]}>
        <mesh geometry={G.wingR} material={M.wing} />
      </group>
      <mesh geometry={G.legs} material={M.hide.pterodactyl} position={[0, -0.02, -0.26]} />
    </group>
  );
}

/** How far forward of vertical a raptor's neck leans. */
const RAPTOR_NECK = 0.55;

/** A little raptor: runs upright on two legs, tail out straight behind. */
function Raptor({ offset, size }: { offset: number; size: number }) {
  const body = useRef<THREE.Group | null>(null);
  const head = useRef<THREE.Group | null>(null);
  const tail = useRef<THREE.Group | null>(null);
  const legL = useRef<THREE.Group | null>(null);
  const legR = useRef<THREE.Group | null>(null);
  const tick = useMemo(() => {
    const pose = newPose();
    return (t: number) => {
      const g = body.current;
      if (!g) return;
      // Dashes round the inner lane three times as fast as the walkers,
      // with a little burst and ease in its pace.
      const walked = RAPTOR_GAIT.pace * t + Math.sin(t * 0.7 + offset * 20) * 0.6;
      const heading = track(walked / INNER_LAP + offset, INNER.half, INNER.far, INNER.near, INNER.r, P);
      gait(RAPTOR_GAIT, walked, pose);
      g.position.set(P.x, pose.bob, P.z);
      g.rotation.set(0, heading, 0);
      if (head.current) head.current.rotation.x = -RAPTOR_NECK + 0.05 + pose.nod;
      if (tail.current) tail.current.rotation.set(0.1, pose.tail, 0);
      if (legL.current) legL.current.rotation.x = pose.legs[0];
      if (legR.current) legR.current.rotation.x = pose.legs[1];
    };
  }, [offset]);
  useSceneryTick(tick);
  const G = dinoGeometries().raptor;
  const M = dinoMaterials();
  return (
    <group ref={body} scale={size}>
      <mesh geometry={G.body} material={M.skin.raptor} position={[0, 0.34, 0]} rotation={[-0.15, 0, 0]} />
      {/* Little arms tucked in at the chest. */}
      <mesh geometry={G.arms} material={M.hide.raptor} position={[0, 0.31, 0.14]} />
      {/* Neck up, head forward, a fan of feathers off the back of it. */}
      <group position={[0, 0.4, 0.17]} rotation={[RAPTOR_NECK, 0, 0]}>
        <mesh geometry={G.neck} material={M.skin.raptor} />
        <group ref={head} position={[0, 0.2, 0]} rotation={[-RAPTOR_NECK + 0.05, 0, 0]}>
          <mesh geometry={G.head} material={M.skin.raptor} position={[0, 0.01, 0.06]} />
          <mesh geometry={G.crest} material={M.mark.raptor} position={[0, 0.03, -0.02]} />
          <Eyes whites={G.whites} pupils={G.pupils} position={[0, 0.04, 0.09]} />
        </group>
      </group>
      {/* Tail out stiff behind, for balance, with only a little sway. */}
      <group ref={tail} position={[0, 0.35, -0.22]} rotation={[0.1, 0, 0]}>
        <mesh geometry={G.tail} material={M.skin.raptor} />
      </group>
      {/* Legs bent like a bird's, swung at the hip, a sickle claw held
          up off the inner toe of each foot. */}
      {([[legL, -1], [legR, 1]] as const).map(([ref, side]) => (
        <group key={side} ref={ref} position={[side * 0.07, 0.27, -0.01]}>
          <mesh geometry={G.leg} material={M.hide.raptor} />
          <mesh geometry={G.claw} material={M.bone} position={[-side * 0.022, -0.245, 0.055]} />
        </group>
      ))}
    </group>
  );
}
