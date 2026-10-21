import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ARENAS, ArenaId } from '../../src/arena/arenas';
import { fitCamera } from '../../src/demo/cameraFit';
import { DieMesh } from '../../src/dice/DieMesh';
import { FISH_TICK } from '../../src/dice/fishSwim';
import { PULSE_TICK } from '../../src/dice/circuitPulse';
import { DICE_SKINS } from '../../src/game/diceSkins';
import { TUNING } from '../../src/game/tuning';

/**
 * The real DieMesh, in a real WebGL renderer, for looking at the dice
 * themselves rather than at a painter's flat output.
 *
 * shot-face.ts and shot-net.ts show what a painter paints. Neither shows
 * what the die LOOKS like: the rounded bevel, the stickers on top of the
 * shell, how the unlit body reads from the game's own camera. That is
 * the question any change to DieMesh is about, and until this existed it
 * could only be answered on a phone.
 *
 * Two views:
 *
 *   ?view=table  The game's camera (fitCamera) over a real arena, with
 *                dice resting at the size and angle a player sees them.
 *   ?view=close  A raking three-quarter view on a plain ground, dice
 *                large — for the bevel and the sticker edges.
 *
 * ?skins=ivory,gold,fire   which dice, in order
 * ?symbols=1               colourblind shapes on the stickers
 * ?arena=castle            the battlefield under the table view
 * ?fishT=4                 where the Fish dice's fish have swum to, in
 *                          seconds (there is no clock here to move them)
 *
 * Usage (react-dom and playwright must be in node_modules, and taken out
 * again afterwards — see tools/arena-preview/README.md for why):
 *
 *     npx esbuild tools/die-preview/entry.tsx --bundle --jsx=automatic \
 *       --outfile=tools/die-preview/bundle.js --loader:.tsx=tsx \
 *       --loader:.png=dataurl --define:process.env.NODE_ENV='"production"'
 *     OUT=/tmp/dice node tools/die-preview/shoot.js table ivory,gold,fire
 *     OUT=/tmp/dice node tools/die-preview/shoot.js close ivory,gold,fire
 */
const P = new URLSearchParams(location.search);
const VIEW = P.get('view') ?? 'table';
const SKINS = (P.get('skins') ?? 'ivory').split(',');
const SYMBOLS = P.get('symbols') === '1';
const ARENA = (P.get('arena') ?? 'castle') as ArenaId;
const W = Number(P.get('w') ?? 393);
const H = Number(P.get('h') ?? 852);
FISH_TICK(Number(P.get('fishT') ?? 0));
// The same clock moves the Circuit Board's pulses.
PULSE_TICK(Number(P.get('fishT') ?? 0));

/** Resting orientations that put a different face up, with some yaw. */
const RESTS: [number, number, number][] = [
  [0, 0.35, 0],
  [Math.PI / 2, 0, 0.6],
  [0, -0.5, Math.PI / 2],
  [-Math.PI / 2, 0.9, 0],
  [Math.PI, 0.2, 0],
  [0, 1.1, -Math.PI / 2],
];

function Rig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useEffect(() => {
    if (VIEW === 'table') {
      fitCamera(camera, W / H);
    } else {
      camera.fov = 30;
      camera.aspect = W / H;
      camera.position.set(0, 4.2, 6.4);
      camera.lookAt(0, 0.2, 0);
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld(true);
  }, [camera]);
  return null;
}

function Dice() {
  const half = TUNING.dieSize / 2;
  const cols = VIEW === 'table' ? 3 : Math.min(4, SKINS.length);
  const gap = VIEW === 'table' ? 1.55 : 1.45;
  return (
    <>
      {SKINS.map((id, i) => {
        const skin = DICE_SKINS.find((s) => s.id === id) ?? DICE_SKINS[0];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = (col - (cols - 1) / 2) * gap;
        const z = VIEW === 'table' ? -2.6 + row * 1.6 : (row - 0.5) * 1.6;
        // In the close view, every other die is caught mid-tumble so the
        // bevel is seen edge-on as well as face-on.
        const tumble = VIEW === 'close' && i % 2 === 1;
        const rot: [number, number, number] = tumble
          ? [0.6, 0.75, 0.3]
          : RESTS[i % RESTS.length];
        return (
          <group key={i}>
            <group position={[x, half + (tumble ? 0.25 : 0), z]} rotation={rot}>
              <DieMesh
                bodyColor={skin.body}
                pattern={skin.pattern}
                patternInk={skin.ink}
                symbols={SYMBOLS}
              />
            </group>
            {/* The game's blob shadow, so the die sits on something. */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, z]}>
              <circleGeometry args={[TUNING.dieSize * 0.62, 24]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.28} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function Scene() {
  const arena = ARENAS[ARENA];
  const l = arena.lighting ?? {
    hemisphere: { sky: '#eef2fa', ground: '#8f877b', intensity: 1.0 },
    key: { position: [4, 12, 6] as [number, number, number], intensity: 2.4, color: '#ffffff' },
    fill: { position: [-6, 8, -4] as [number, number, number], intensity: 0.7, color: '#f2f4f8' },
  };
  const Arena = arena.Component;
  return (
    <>
      <hemisphereLight args={[l.hemisphere.sky, l.hemisphere.ground, l.hemisphere.intensity]} />
      <directionalLight position={l.key.position} intensity={l.key.intensity} color={l.key.color} />
      <directionalLight position={l.fill.position} intensity={l.fill.intensity} color={l.fill.color} />
      {VIEW === 'table' ? (
        <Arena />
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color="#b9a98c" roughness={0.95} />
        </mesh>
      )}
      <Dice />
    </>
  );
}

document.body.style.margin = '0';
const host = document.createElement('div');
host.style.width = `${W}px`;
host.style.height = `${H}px`;
document.body.appendChild(host);
createRoot(host).render(
  <Canvas
    style={{ width: W, height: H }}
    gl={{ antialias: true, preserveDrawingBuffer: true }}
    onCreated={({ gl }) => {
      gl.toneMapping = THREE.ACESFilmicToneMapping;
    }}
  >
    <color attach="background" args={[ARENAS[ARENA].skyColor]} />
    <Rig />
    <Scene />
  </Canvas>,
);
setTimeout(() => {
  (window as unknown as { __ready: boolean }).__ready = true;
}, 1500);
