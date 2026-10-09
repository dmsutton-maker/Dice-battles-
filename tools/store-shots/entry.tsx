import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ThemedArena } from '../../src/arena/ThemedArena';
import { ARENA_THEMES, ThemedArenaId } from '../../src/arena/themeData';
import { Prisoners } from '../../src/game/Prisoners';
import { DieMesh } from '../../src/dice/DieMesh';
import { DICE_SKINS } from '../../src/game/diceSkins';
import { PRISONER_COLORS } from '../../src/game/colors';
import { PrisonerUnit } from '../../src/game/modes';

/**
 * The board, rendered for the App Store rather than for play.
 *
 * Everything in frame is the REAL game: the same ThemedArena the player
 * stands on, the same Prisoners figures, the same DieMesh with the same
 * painted skin. What changes is the CAMERA — the game looks almost
 * straight down because that is the only way a 5.6 x 10.2 tray fits a
 * phone, and straight down is the least flattering angle there is. A
 * listing wants the low, raking three-quarter view that shows the walls
 * have height and the dice are solid.
 *
 * Transparent background on purpose: the scene is composited into a
 * painted one by shoot.js, which is where the sky and the caption live.
 */
const P = new URLSearchParams(location.search);
const W = Number(P.get('w') ?? 1400);
const H = Number(P.get('h') ?? 1500);
const ARENA = (P.get('arena') ?? 'castle') as ThemedArenaId;
const SKIN = P.get('skin') ?? 'ivory';
/** How far round the board to stand, and how low. */
const YAW = Number(P.get('yaw') ?? 0.42);
const PITCH = Number(P.get('pitch') ?? 0.62);
const DIST = Number(P.get('dist') ?? 15.5);
const LOOK_Y = Number(P.get('looky') ?? 0.2);
/** Dice in the foreground, tumbling toward the camera. */
const DICE = P.get('dice') !== '0';

function Rig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useEffect(() => {
    camera.fov = 34;
    camera.aspect = W / H;
    camera.position.set(
      Math.sin(YAW) * Math.cos(PITCH) * DIST,
      Math.sin(PITCH) * DIST,
      Math.cos(YAW) * Math.cos(PITCH) * DIST,
    );
    camera.lookAt(0, LOOK_Y, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }, [camera]);
  return null;
}

/** A lineup with some freed and some still in jail, which is the story. */
function lineup(): PrisonerUnit[] {
  const stations: PrisonerUnit['station'][] = [
    { kind: 'retreat', index: 0 },
    { kind: 'retreat', index: 1 },
    { kind: 'retreat', index: 2 },
    { kind: 'jail', index: 3 },
    { kind: 'jail', index: 4 },
    { kind: 'jail', index: 5 },
  ];
  return PRISONER_COLORS.map((c, i) => ({
    key: `p${i}`,
    colorId: c.id,
    hex: c.hex,
    jailIndex: i,
    station: stations[i],
  }));
}

function Scene() {
  const theme = ARENA_THEMES[ARENA];
  const l = theme.lighting ?? {
    hemisphere: { sky: '#eef2fa', ground: '#8f877b', intensity: 1.0 },
    key: { position: [4, 12, 6] as [number, number, number], intensity: 2.4, color: '#ffffff' },
    fill: { position: [-6, 8, -4] as [number, number, number], intensity: 0.7, color: '#f2f4f8' },
  };
  const skin = DICE_SKINS.find((s) => s.id === SKIN) ?? DICE_SKINS[0];
  return (
    <>
      <hemisphereLight args={[l.hemisphere.sky, l.hemisphere.ground, l.hemisphere.intensity * 1.15]} />
      <directionalLight position={l.key.position} intensity={l.key.intensity * 1.15} color={l.key.color} />
      <directionalLight position={l.fill.position} intensity={l.fill.intensity} color={l.fill.color} />
      <ThemedArena theme={theme} id={ARENA} />
      <Prisoners units={lineup()} />
      {DICE && (
        <>
          {/* Mid-roll, caught by the camera — the moment the game is about. */}
          <group position={[-1.9, 3.4, 2.2]} rotation={[0.5, 0.7, 0.24]} scale={1.7}>
            <DieMesh bodyColor={skin.body} pattern={skin.pattern} patternInk={skin.ink} />
          </group>
          <group position={[1.7, 2.4, 3.1]} rotation={[-0.35, -0.5, -0.18]} scale={1.7}>
            <DieMesh bodyColor={skin.body} pattern={skin.pattern} patternInk={skin.ink} />
          </group>
        </>
      )}
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
    style={{ width: W, height: H, background: 'transparent' }}
    gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true }}
    onCreated={({ gl }) => {
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.setClearColor(0x000000, 0);
    }}
  >
    <Rig />
    <Scene />
  </Canvas>,
);
setTimeout(() => { (window as any).__ready = true; }, 1600);
