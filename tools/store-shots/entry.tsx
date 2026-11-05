import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ThemedArena } from '../../src/arena/ThemedArena';
import { ARENA_THEMES, ThemedArenaId } from '../../src/arena/themeData';
import { Prisoners } from '../../src/game/Prisoners';
import { DieMesh } from '../../src/dice/DieMesh';
import { createDieEffect, DieEffectId, DieSample } from '../../src/dice/dieEffect';
import { DICE_SKINS } from '../../src/game/diceSkins';
import { PRISONER_COLORS } from '../../src/game/colors';
import { PrisonerUnit } from '../../src/game/modes';

/**
 * The board, rendered for the App Store rather than for play.
 *
 * Everything in frame is the REAL game: the same ThemedArena the player
 * stands on, the same Prisoners figures, the same DieMesh with the same
 * painted skin, and — for a skin that does something, like Fire and Ice —
 * the same effect (src/dice/dieEffect.ts) the table draws, run for a
 * moment so its flames or mist are already in the air. What changes is
 * the CAMERA — the game looks almost straight down because that is the
 * only way a 5.6 x 10.2 tray fits a phone, and straight down is the least
 * flattering angle there is. A listing wants the low, raking
 * three-quarter view that shows the walls have height and the dice are
 * solid.
 *
 * One query parameter, `cfg`, holds the whole shot as JSON (see
 * shots.json). Transparent background on purpose: the scene is
 * composited into a painted one by build-shots.py, which is where the
 * sky and the caption live.
 */
interface DieSpec {
  /** A skin id from diceSkins.ts. */
  skin: string;
  /** Where the die hangs, mid-roll. */
  p: [number, number, number];
  /** Its tumble. */
  r: [number, number, number];
  /** Bigger than life, so it reads at thumbnail size. */
  s?: number;
  /** Run the skin's effect (fire, ice, neon, ...) if it has one. */
  fx?: boolean;
  /** The die's flight while its effect runs, in its own units a second. */
  v?: [number, number, number];
  /** How many 60ths of a second of flight the effect is run for. */
  steps?: number;
}

interface Shot {
  w: number;
  h: number;
  arena: ThemedArenaId;
  /** How far round the board to stand, how low, and how far back. */
  yaw: number;
  pitch: number;
  dist: number;
  fov?: number;
  /** The point the camera looks at. */
  look?: [number, number, number];
  dice?: DieSpec[];
}

const P = new URLSearchParams(location.search);
const SHOT: Shot = JSON.parse(P.get('cfg') ?? '{}');
const W = SHOT.w ?? 1400;
const H = SHOT.h ?? 1500;
const LOOK = SHOT.look ?? [0, 0.2, 0];
const FOV = SHOT.fov ?? 34;

function Rig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useEffect(() => {
    camera.fov = FOV;
    camera.aspect = W / H;
    camera.position.set(
      LOOK[0] + Math.sin(SHOT.yaw) * Math.cos(SHOT.pitch) * SHOT.dist,
      LOOK[1] + Math.sin(SHOT.pitch) * SHOT.dist,
      LOOK[2] + Math.cos(SHOT.yaw) * Math.cos(SHOT.pitch) * SHOT.dist,
    );
    camera.lookAt(LOOK[0], LOOK[1], LOOK[2]);
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

/**
 * The skin's effect, run for a second and a half of play so the shot
 * catches it mid-flight, then frozen. It is built in the die's own
 * frame and scaled with it, so flames sized for a life-size die sit on
 * a die drawn bigger than life instead of vanishing inside it.
 */
function Effect({ spec }: { spec: DieSpec }) {
  const skin = DICE_SKINS.find((s) => s.id === spec.skin);
  const group = React.useMemo(() => new THREE.Group(), []);
  const { size, viewport, camera } = useThree();
  useEffect(() => {
    if (!skin?.effect) return;
    const fx = createDieEffect(skin.effect as DieEffectId, 1, null);
    group.add(fx.group);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...spec.r));
    // Flying toward the camera and a little across, as a throw does, and
    // really MOVING there while the effect runs: a die held still in a
    // moving die's flames is buried in them instead of trailing them.
    const v = spec.v ?? [-0.5, -0.6, 1.6];
    const STEPS = spec.steps ?? 60;
    const sample: DieSample = { x: 0, y: 0, z: 0, vx: v[0], vy: v[1], vz: v[2], quaternion: q, moving: true };
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 45;
    const pointScale = (size.height * viewport.dpr) / (2 * Math.tan((fov * Math.PI) / 360));
    for (let i = 0; i <= STEPS; i++) {
      const t = (i - STEPS) / 60;
      sample.x = v[0] * t;
      sample.y = v[1] * t;
      sample.z = v[2] * t;
      if (i === 0) fx.thrown([sample]);
      fx.update(1 / 60, i / 60, [sample], pointScale);
    }
    return () => {
      group.remove(fx.group);
      fx.dispose();
    };
  }, [group]);
  return <primitive object={group} />;
}

function Die({ spec }: { spec: DieSpec }) {
  const skin = DICE_SKINS.find((s) => s.id === spec.skin) ?? DICE_SKINS[0];
  const s = spec.s ?? 1.7;
  return (
    <group position={spec.p} scale={s}>
      <group rotation={spec.r}>
        <DieMesh bodyColor={skin.body} pattern={skin.pattern} patternInk={skin.ink} />
      </group>
      {spec.fx && skin.effect && <Effect spec={spec} />}
    </group>
  );
}

function Scene() {
  const theme = ARENA_THEMES[SHOT.arena];
  const l = theme.lighting ?? {
    hemisphere: { sky: '#eef2fa', ground: '#8f877b', intensity: 1.0 },
    key: { position: [4, 12, 6] as [number, number, number], intensity: 2.4, color: '#ffffff' },
    fill: { position: [-6, 8, -4] as [number, number, number], intensity: 0.7, color: '#f2f4f8' },
  };
  return (
    <>
      <hemisphereLight args={[l.hemisphere.sky, l.hemisphere.ground, l.hemisphere.intensity * 1.15]} />
      <directionalLight position={l.key.position} intensity={l.key.intensity * 1.15} color={l.key.color} />
      <directionalLight position={l.fill.position} intensity={l.fill.intensity} color={l.fill.color} />
      <ThemedArena theme={theme} id={SHOT.arena} />
      <Prisoners units={lineup()} />
      {/* Mid-roll, caught by the camera — the moment the game is about. */}
      {(SHOT.dice ?? []).map((d, i) => (
        <Die key={i} spec={d} />
      ))}
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
    dpr={1}
    onCreated={({ gl }) => {
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.setClearColor(0x000000, 0);
    }}
  >
    <Rig />
    <Scene />
  </Canvas>,
);
setTimeout(() => { (window as any).__ready = true; }, 2500);
