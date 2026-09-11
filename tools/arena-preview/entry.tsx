import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ThemedArena } from '../../src/arena/ThemedArena';
import { ARENA_THEMES, ThemedArenaId } from '../../src/arena/themeData';
import { fitCamera } from '../../src/demo/cameraFit';
import { TUNING } from '../../src/game/tuning';

const W = 393, H = 852;

const DAYLIGHT = {
  hemisphere: { sky: '#eef2fa', ground: '#8f877b', intensity: 1.0 },
  key: { position: [4, 12, 6] as [number, number, number], intensity: 2.4, color: '#ffffff' },
  fill: { position: [-6, 8, -4] as [number, number, number], intensity: 0.7, color: '#f2f4f8' },
};

function Fit({ aspect }: { aspect: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useEffect(() => {
    if (new URLSearchParams(location.search).get('top') === '1') {
      // Straight down and pulled back: an inspection view for checking
      // that a crest actually runs the whole way round the tray. NOT the
      // game's camera — see cameraFit.ts for that.
      camera.fov = 40;
      camera.aspect = aspect;
      camera.position.set(0, 22, 0.01);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      return;
    }
    fitCamera(camera, aspect);
  }, [camera, aspect]);

  useEffect(() => {
    /*
      What audit.js reads the picture through.

      It needs to know where on the SCREEN a given point on the wall top
      ended up, and the only thing that knows that is the camera that
      just drew it. Projecting here rather than re-deriving the maths in
      node means the audit measures the render, not a model of it.
    */
    const w = TUNING.tray;
    const top = w.wallHeight + 0.3;
    (window as any).__project = (x: number, z: number) => {
      const v = new THREE.Vector3(x, top, z).project(camera);
      return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H];
    };
    (window as any).__walls = () => {
      const endX = w.innerWidth / 2 + w.wallThickness / 2;
      const endZ = w.innerDepth / 2 + w.wallThickness / 2;
      /*
        The middle of the wall only. Every battlefield puts a big bright
        corner piece at each end, and a corner is not evidence that the
        wall between the corners has anything on it — measuring through
        them makes the quiet middle of a bare wall look like a dip in a
        decorated one.
      */
      const line = (from: [number, number], to: [number, number]) => {
        const out: [number, number][] = [];
        for (let t = 0.09; t <= 0.91; t += 1 / 400)
          out.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
        return out;
      };
      return {
        left: line([-endX, -endZ], [-endX, endZ]),
        right: line([endX, -endZ], [endX, endZ]),
        near: line([-endX, -endZ], [endX, -endZ]),
        far: line([-endX, endZ], [endX, endZ]),
      };
    };
  }, [camera]);

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
