import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ARENAS, ArenaId } from '../../src/arena/arenas';
import { fitCamera } from '../../src/demo/cameraFit';
import { TUNING } from '../../src/game/tuning';
import { laneColors, makeUnits, ModeId } from '../../src/game/modes';
import { PRISONER_COLORS } from '../../src/game/colors';
import { RETREAT_SLOTS } from '../../src/game/stations';

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

/*
  The retreat pads are painted with the colours of the round being
  played, so a preview with no round shows the arena's own two-tone row
  and tells you nothing about the change that put them there.

  ?mode=classic gives the six-colour row; ?mode=colorwar gives the two
  halves. Built through the real makeUnits and laneColors, so this is
  the picture the game draws and not an arrangement of it.
*/
function padsFor(mode: string | null): (string | null)[] | undefined {
  if (!mode) return undefined;
  const units = makeUnits(
    mode as ModeId,
    PRISONER_COLORS,
    PRISONER_COLORS[0],
    PRISONER_COLORS[3],
  );
  return laneColors(units, RETREAT_SLOTS.length);
}

/*
  Any battlefield in the registry, not only the sixteen themed ones.

  It went through ThemedArena directly until 20 Sep 2026, so the four
  bespoke arenas — castle, castleSunset, jungle, space — were the ones
  that could not be looked at, which is the wrong way round: they are
  the ones with five hundred lines of their own scenery.
*/
function Scene({ id, mode }: { id: ArenaId; mode: string | null }) {
  const arena = ARENAS[id];
  const Arena = arena.Component;
  const l = arena.lighting ?? DAYLIGHT;
  return (
    <>
      <hemisphereLight args={[l.hemisphere.sky, l.hemisphere.ground, l.hemisphere.intensity]} />
      <directionalLight position={l.key.position} intensity={l.key.intensity} color={l.key.color} />
      <directionalLight position={l.fill.position} intensity={l.fill.intensity} color={l.fill.color} />
      <Arena padColors={padsFor(mode)} />
    </>
  );
}

const id = (new URLSearchParams(location.search).get('id') ?? 'autumn') as ArenaId;
const mode = new URLSearchParams(location.search).get('mode');
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
    <Scene id={id} mode={mode} />
  </Canvas>,
);
setTimeout(() => { (window as any).__ready = true; }, 1200);
