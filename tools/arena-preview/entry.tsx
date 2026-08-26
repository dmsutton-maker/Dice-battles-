import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ThemedArena } from '../../src/arena/ThemedArena';
import { ARENA_THEMES, ThemedArenaId } from '../../src/arena/themeData';
import { fitCamera } from '../../src/demo/cameraFit';

const DAYLIGHT = {
  hemisphere: { sky: '#eef2fa', ground: '#8f877b', intensity: 1.0 },
  key: { position: [4, 12, 6] as [number, number, number], intensity: 2.4, color: '#ffffff' },
  fill: { position: [-6, 8, -4] as [number, number, number], intensity: 0.7, color: '#f2f4f8' },
};

function Fit({ aspect }: { aspect: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useEffect(() => { fitCamera(camera, aspect); }, [camera, aspect]);
  return null;
}

function Scene({ id }: { id: ThemedArenaId }) {
  const theme = ARENA_THEMES[id];
  const l = theme.lighting ?? DAYLIGHT;
  return (
    <>
      <hemisphereLight args={[l.hemisphere.sky, l.hemisphere.ground, l.hemisphere.intensity]} />
      <directionalLight position={l.key.position} intensity={l.key.intensity} color={l.key.color} />
      <directionalLight position={l.fill.position} intensity={l.fill.intensity} color={l.fill.color} />
      <ThemedArena theme={theme} id={id} />
    </>
  );
}

const W = 393, H = 852;
const id = (new URLSearchParams(location.search).get('id') ?? 'autumn') as ThemedArenaId;
const meta = ARENA_THEMES[id];
document.body.style.margin = '0';
const host = document.createElement('div');
host.style.width = `${W}px`; host.style.height = `${H}px`;
document.body.appendChild(host);
createRoot(host).render(
  <Canvas
    style={{ width: W, height: H, background: '#000' }}
    gl={{ antialias: true, preserveDrawingBuffer: true }}
    onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; }}
  >
    <Fit aspect={W / H} />
    <Scene id={id} />
  </Canvas>,
);
setTimeout(() => { (window as any).__ready = true; }, 1200);
