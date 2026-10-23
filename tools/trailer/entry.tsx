import React, { useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useThree } from '@react-three/fiber';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { ARENAS, ArenaId } from '../../src/arena/arenas';
import { LIVE, troughOf, WaterSurface } from '../../src/arena/water';
import { DieMesh } from '../../src/dice/DieMesh';
import { createDieEffect, DieEffect, DieSample } from '../../src/dice/dieEffect';
import { createDieBody } from '../../src/dice/die';
import { DICE_SKINS, skinById } from '../../src/game/diceSkins';
import { MOAT } from '../../src/game/obstacles';
import { TUNING } from '../../src/game/tuning';
import { createPhysicsWorld } from '../../src/physics/world';
import logo from '../../assets/logo/logo.png';

/**
 * The website trailer.
 *
 * David, 13 Oct 2026: "make a video to showcase the game on the website.
 * But make it with big action sequences. Not just game play."
 *
 * Every shot is the REAL game: the real battlefields, the real dice skins
 * painted by the real painters, the real cannon-es physics and the real
 * Fire and Ice effects. What is not the game is the direction — the
 * camera flies, time slows down on the big moments, and far more dice are
 * thrown than a round ever uses.
 *
 * Rendered one frame at a time (frameloop="never"), so the video is as
 * smooth as the frame rate asked for however slow the machine is. See
 * shoot.js, which drives it, and README.md.
 */

export const FPS = 30;
const W = 1280;
const H = 720;

type V3 = [number, number, number];
interface Key { t: number; pos: V3; look: V3; fov?: number }
interface Throw {
  skin: string;
  at: number;
  pos: V3;
  vel: V3;
  spin: V3;
}
interface Caption { text: string; from: number; to: number; big?: boolean }
interface Shot {
  arena?: ArenaId;
  seconds: number;
  /** Paper title cards instead of a battlefield. */
  card?: 'open' | 'end';
  effect?: 'fire' | 'ice';
  /** A pond in the floor at this spot, for the Ice shot. */
  pond?: [number, number];
  throws: Throw[];
  camera: Key[];
  /** Simulation speed over the shot: [time, speed] pairs. */
  speed?: [number, number][];
  /** Moments to shake the camera, in shot seconds. */
  shakes?: number[];
  captions: Caption[];
}

/* A seeded random, so a re-render of the trailer is the same trailer. */
let seed = 7;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const between = (a: number, b: number) => a + rnd() * (b - a);
const spin = (s = 14): V3 => [between(-s, s), between(-s, s), between(-s, s)];

/** Skins worth showing off: bright, patterned, varied. */
const SHOWCASE = [
  'galaxy', 'rainbow', 'ruby', 'gold', 'amethyst', 'fire', 'ice',
].filter((id) => DICE_SKINS.some((s) => s.id === id));
const pickSkins = (n: number): string[] => {
  const pool = [...SHOWCASE, ...DICE_SKINS.map((s) => s.id).filter((id) => !SHOWCASE.includes(id))];
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(pool[(i * 7 + Math.floor(rnd() * 3)) % pool.length]);
  return out;
};

/** Many dice falling from the sky onto the tray. */
function storm(n: number, skins: string[], from: number, over: number, height: [number, number]): Throw[] {
  return Array.from({ length: n }, (_, i) => ({
    skin: skins[i % skins.length],
    at: from + (over * i) / n,
    pos: [between(-1.8, 1.8), between(height[0], height[1]), between(-3.8, 3.8)] as V3,
    vel: [between(-2, 2), between(-6, -2), between(-2, 2)] as V3,
    spin: spin(16),
  }));
}

const DIE_COUNT_TEXT = `${DICE_SKINS.length} dice sets`;
const ARENA_COUNT_TEXT = `${Object.keys(ARENAS).length} battlefields`;

const SHOTS: Record<string, Shot> = {
  open: {
    card: 'open',
    seconds: 3,
    throws: [],
    camera: [],
    captions: [],
  },

  /* 1. Dice rain onto the Castle in slow motion; the camera cranes down. */
  storm: {
    arena: 'castle',
    seconds: 5.5,
    throws: storm(14, pickSkins(14), 0.0, 1.4, [7, 11]),
    camera: [
      { t: 0, pos: [3, 17, 9], look: [0, 0, 0], fov: 42 },
      { t: 2.6, pos: [9, 7.5, 5], look: [0, 0.6, 0], fov: 40 },
      { t: 5.5, pos: [8, 6.2, -3], look: [0, 0.3, 0], fov: 38 },
    ],
    speed: [[0, 0.32], [2.4, 0.32], [3.4, 1], [5.5, 1]],
    shakes: [2.2],
    captions: [{ text: 'Every roll is a battle.', from: 0.6, to: 3.2 }],
  },

  /* 2. Fire dice hurled the length of Volcano Rim. */
  fire: {
    arena: 'volcano',
    effect: 'fire',
    seconds: 5.5,
    throws: [
      { skin: 'fire', at: 0.2, pos: [-0.9, 1.5, 4.0], vel: [0.6, 7, -15], spin: [18, 4, -9] },
      { skin: 'fire', at: 0.3, pos: [0.9, 1.6, 4.2], vel: [-0.8, 8, -14], spin: [-12, 9, 15] },
      { skin: 'fire', at: 0.4, pos: [-0.2, 1.8, 4.1], vel: [0.2, 9, -16], spin: [9, -14, 6] },
      { skin: 'fire', at: 0.5, pos: [0.4, 1.4, 3.9], vel: [-0.3, 6, -13], spin: [-7, 6, -16] },
    ],
    camera: [
      { t: 0, pos: [2.5, 6.5, 8.5], look: [0, 0.6, 1.5], fov: 44 },
      { t: 2.2, pos: [5.5, 6.2, 1.5], look: [0, 0.3, -2.2], fov: 40 },
      { t: 5.5, pos: [5.5, 5.4, -6.5], look: [0, 0.2, -2.6], fov: 38 },
    ],
    speed: [[0, 1], [0.7, 0.3], [2.6, 0.3], [3.3, 0.7], [5.5, 0.7]],
    shakes: [0.9, 1.6],
    captions: [{ text: 'Throw fire.', from: 0.5, to: 3.4, big: true }],
  },

  /* 3. Ice dice dive into a pond, which freezes around them. */
  ice: {
    arena: 'snow',
    effect: 'ice',
    pond: [0, -0.5],
    seconds: 6,
    throws: [
      { skin: 'ice', at: 0.1, pos: [-1.2, 5.5, 3.2], vel: [1.3, 2, -5.6], spin: [10, -6, 8] },
      { skin: 'ice', at: 0.3, pos: [1.3, 6, 3.5], vel: [-1.4, 1, -6.2], spin: [-9, 12, 5] },
    ],
    camera: [
      { t: 0, pos: [6.5, 5.5, 5.5], look: [0, 0.6, 0.5], fov: 42 },
      { t: 3, pos: [3.6, 2.4, 2.6], look: [0, 0, -0.5], fov: 38 },
      { t: 6, pos: [-3.2, 2.2, 2.4], look: [0, 0, -0.5], fov: 34 },
    ],
    speed: [[0, 0.8], [0.9, 0.3], [3.2, 0.5], [6, 1]],
    captions: [{ text: 'Freeze the pond.', from: 1.4, to: 4.6, big: true }],
  },

  /* 4. A montage: four battlefields, a whip of the camera each. */
  space: montage('space', 0),
  jungle: montage('jungle', 1),
  candy: montage('candy', 2),
  reef: montage('reef', 3),

  /* 5. The finale: a downpour of dice at sunset. */
  finale: {
    arena: 'castleSunset',
    seconds: 6.5,
    throws: storm(26, pickSkins(26), 0.0, 2.2, [8, 14]),
    camera: [
      { t: 0, pos: [3, 15, 10], look: [0, 0.5, 0], fov: 44 },
      { t: 3.2, pos: [7.5, 8, 7.5], look: [0, 0.5, 0], fov: 42 },
      { t: 6.5, pos: [10, 4.8, -1], look: [0, 0.6, 0], fov: 40 },
    ],
    speed: [[0, 0.45], [2.8, 0.45], [3.8, 1], [6.5, 1]],
    shakes: [2.6, 3.1],
    captions: [
      { text: DIE_COUNT_TEXT + '.', from: 0.6, to: 3.0 },
      { text: 'Race to free your prisoners.', from: 3.4, to: 6.3 },
    ],
  },

  end: {
    card: 'end',
    seconds: 4.5,
    throws: [],
    camera: [],
    captions: [],
  },
};

function montage(arena: ArenaId, k: number): Shot {
  const a = (k % 2 === 0 ? 1 : -1);
  return {
    arena,
    seconds: 1.6,
    throws: [0, 1, 2].map((i) => ({
      skin: pickSkins(3)[i],
      at: 0,
      pos: [(i - 1) * 1.2, between(2.2, 3.2), between(-0.6, 0.6)] as V3,
      vel: [between(-1, 1), between(4, 7), between(-1, 1)] as V3,
      spin: spin(18),
    })),
    camera: [
      { t: 0, pos: [7 * a, 6.5, 6], look: [0, 0.8, 0], fov: 40 },
      { t: 1.6, pos: [7.5 * a, 5.6, -4.5], look: [0, 0.8, 0], fov: 38 },
    ],
    speed: [[0, 0.55], [1.6, 0.55]],
    // One caption across all four shots: it fades in on the first and out
    // on the last, and simply stays up across the cuts in between.
    captions: [
      {
        text: ARENA_COUNT_TEXT + '.',
        from: k === 0 ? 0.15 : -1,
        to: k === 3 ? 1.35 : 99,
      },
    ],
  };
}

/** The order the trailer plays in. shoot.js reads it from here. */
export const ORDER = ['open', 'storm', 'fire', 'ice', 'space', 'jungle', 'candy', 'reef', 'finale', 'end'];

/* ------------------------------------------------------------------ */

const ease = (x: number) => x * x * (3 - 2 * x);
function along(keys: Key[], t: number): Key {
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (t <= b.t) {
      const u = ease((t - a.t) / (b.t - a.t));
      const mix = (p: V3, q: V3) => p.map((v, j) => v + (q[j] - v) * u) as V3;
      return {
        t,
        pos: mix(a.pos, b.pos),
        look: mix(a.look, b.look),
        fov: (a.fov ?? 40) + ((b.fov ?? 40) - (a.fov ?? 40)) * u,
      };
    }
  }
  return keys[keys.length - 1];
}
function speedAt(curve: [number, number][] | undefined, t: number): number {
  if (!curve) return 1;
  if (t <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    if (t <= curve[i][0]) {
      const [t0, s0] = curve[i - 1];
      const [t1, s1] = curve[i];
      return s0 + (s1 - s0) * ease((t - t0) / (t1 - t0));
    }
  }
  return curve[curve.length - 1][1];
}

/**
 * The tray, without the game's invisible ceiling: the trailer drops dice
 * from far higher than a throw ever reaches, and the ceiling would catch
 * them in mid-air.
 */
function buildWorld(pond: [number, number] | undefined) {
  const physics = createPhysicsWorld();
  const { world, trayMaterial } = physics;
  const { innerWidth, innerDepth, wallThickness } = TUNING.tray;
  const halfW = innerWidth / 2;
  const halfD = innerDepth / 2;
  const box = (he: V3, p: V3) =>
    world.addBody(
      new CANNON.Body({
        type: CANNON.Body.STATIC,
        material: trayMaterial,
        shape: new CANNON.Box(new CANNON.Vec3(...he)),
        position: new CANNON.Vec3(...p),
      }),
    );
  const fw = halfW + wallThickness;
  const fd = halfD + wallThickness;
  if (!pond) {
    box([fw, 0.5, fd], [0, -0.5, 0]);
  } else {
    const h = MOAT.size / 2;
    const [mx, mz] = pond;
    const strip = (x0: number, x1: number, z0: number, z1: number) =>
      box([(x1 - x0) / 2, 0.5, (z1 - z0) / 2], [(x0 + x1) / 2, -0.5, (z0 + z1) / 2]);
    strip(-fw, mx - h, -fd, fd);
    strip(mx + h, fw, -fd, fd);
    strip(mx - h, mx + h, -fd, mz - h);
    strip(mx - h, mx + h, mz + h, fd);
  }
  const tall = 20;
  const t = wallThickness / 2;
  box([t, tall, fd], [-(halfW + t), tall, 0]);
  box([t, tall, fd], [halfW + t, tall, 0]);
  box([fw, tall, t], [0, tall, -(halfD + t)]);
  box([fw, tall, t], [0, tall, halfD + t]);
  return physics;
}

function Battle({ shot }: { shot: Shot }) {
  const arena = ARENAS[shot.arena!];
  const Arena = arena.Component;
  const l = arena.lighting;
  const meshes = useRef<(THREE.Group | null)[]>([]);
  const { camera, advance, size, viewport } = useThree();

  const effect = useMemo<DieEffect | null>(
    () =>
      shot.effect
        ? createDieEffect(
            shot.effect,
            shot.throws.length,
            shot.pond ? { x: shot.pond[0], z: shot.pond[1] } : null,
          )
        : null,
    [shot],
  );

  useEffect(() => {
    const physics = buildWorld(shot.pond);
    const bodies: (CANNON.Body | null)[] = shot.throws.map(() => null);
    const sunk: boolean[] = shot.throws.map(() => false);
    const samples: DieSample[] = shot.throws.map(() => ({
      x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0, quaternion: new THREE.Quaternion(), moving: false,
    }));
    let simTime = 0;
    let threw = false;
    const cam = camera as THREE.PerspectiveCamera;

    (window as any).__frames = () => Math.round(shot.seconds * FPS);
    (window as any).__frame = (i: number) => {
      const t = i / FPS;
      const dt = (1 / FPS) * speedAt(shot.speed, t);

      // Launch whatever is due.
      shot.throws.forEach((th, k) => {
        if (!bodies[k] && t >= th.at) {
          const body = createDieBody(physics.dieMaterial, th.pos);
          body.velocity.set(...th.vel);
          body.angularVelocity.set(...th.spin);
          body.allowSleep = false;
          physics.world.addBody(body);
          bodies[k] = body;
        }
      });

      physics.world.step(1 / 240, dt, 40);
      simTime += dt;

      bodies.forEach((body, k) => {
        const s = samples[k];
        const g = meshes.current[k];
        if (!body) {
          if (g) g.visible = false;
          return;
        }
        // Into the pond: the Ice effect holds the picture half-frozen in.
        if (shot.pond && !sunk[k] && body.position.y < -0.25) {
          sunk[k] = true;
          effect?.sank(k, body.position.x, body.position.z);
          body.type = CANNON.Body.STATIC;
          body.velocity.set(0, 0, 0);
          body.angularVelocity.set(0, 0, 0);
          body.updateMassProperties();
        }
        s.x = body.position.x; s.y = body.position.y; s.z = body.position.z;
        s.vx = body.velocity.x; s.vy = body.velocity.y; s.vz = body.velocity.z;
        s.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
        s.moving = body.velocity.length() > TUNING.settle.speedThreshold;
        if (g) {
          g.visible = true;
          const held = sunk[k] ? effect?.heldAt(k) ?? null : null;
          g.position.set(s.x, held ?? s.y, s.z);
          g.quaternion.copy(s.quaternion);
        }
      });

      if (effect) {
        if (!threw && bodies.some(Boolean)) {
          threw = true;
          effect.thrown(samples);
        }
        const pointScale = (size.height * viewport.dpr) / (2 * Math.tan((cam.fov * Math.PI) / 360));
        effect.update(dt, simTime, samples, pointScale);
      }
      for (const m of LIVE) m.uniforms.uTime.value = simTime;

      // The camera, with a jolt on the big impacts.
      const k = along(shot.camera, t);
      let jolt = 0;
      for (const at of shot.shakes ?? []) {
        const d = t - at;
        if (d >= 0 && d < 0.5) jolt += 0.12 * (1 - d / 0.5) * Math.sin(d * 70);
      }
      cam.fov = k.fov ?? 40;
      cam.aspect = W / H;
      cam.updateProjectionMatrix();
      cam.position.set(k.pos[0] + jolt, k.pos[1] + jolt * 0.6, k.pos[2]);
      cam.lookAt(k.look[0], k.look[1], k.look[2]);

      drawCaptions(shot, t);
      advance(performance.now());
    };
    (window as any).__ready = true;
    return () => effect?.dispose();
  }, [shot, effect, camera, advance, size, viewport]);

  return (
    <>
      <color attach="background" args={[arena.skyColor]} />
      <hemisphereLight args={[l.hemisphere.sky, l.hemisphere.ground, l.hemisphere.intensity]} />
      <directionalLight position={l.key.position} intensity={l.key.intensity} color={l.key.color} />
      <directionalLight position={l.fill.position} intensity={l.fill.intensity} color={l.fill.color} />
      <Arena />
      {shot.pond && (
        <WaterSurface
          look={{ shallow: '#5fb3d8', deep: troughOf('#5fb3d8'), foam: '#ffffff', opacity: 0.94 }}
          shape="square"
          size={[MOAT.size + 0.1, MOAT.size + 0.1]}
          flow={[0.14, 0.08]}
          position={[shot.pond[0], 0.03, shot.pond[1]]}
        />
      )}
      {shot.throws.map((th, i) => {
        const skin = skinById(th.skin);
        return (
          <DieMesh
            key={i}
            bodyColor={skin.body}
            pattern={skin.pattern}
            patternInk={skin.ink}
            ref={(g: THREE.Group | null) => {
              meshes.current[i] = g;
              if (g) g.visible = false;
            }}
          />
        );
      })}
      {effect && <primitive object={effect.group} />}
    </>
  );
}

/* ---------------------------- the words ---------------------------- */

const INK = '#1d1a2e';
const PAPER = '#fdf6ec';
const ACCENT = '#e04e1f';

const captionBox = document.createElement('div');
Object.assign(captionBox.style, {
  position: 'absolute', left: '0', right: '0', bottom: '64px',
  display: 'flex', justifyContent: 'center', pointerEvents: 'none',
});
const captionTag = document.createElement('div');
Object.assign(captionTag.style, {
  background: PAPER, color: INK, border: `4px solid ${INK}`, borderRadius: '18px',
  boxShadow: `8px 8px 0 ${INK}`, padding: '14px 30px',
  font: `900 46px/1.1 "Arial Black", "Helvetica Neue", Arial, sans-serif`,
  letterSpacing: '-0.5px', opacity: '0',
});
captionBox.appendChild(captionTag);

function drawCaptions(shot: Shot, t: number) {
  const now = shot.captions.find((c) => t >= c.from && t <= c.to);
  if (!now) {
    captionTag.style.opacity = '0';
    return;
  }
  const inT = Math.min(1, (t - now.from) / 0.22);
  const outT = Math.min(1, (now.to - t) / 0.22);
  const k = Math.min(inT, outT);
  captionTag.textContent = now.text;
  captionTag.style.fontSize = now.big ? '72px' : '46px';
  captionTag.style.opacity = String(k);
  captionTag.style.transform = `translateY(${(1 - ease(inT)) * 40}px) scale(${0.9 + 0.1 * ease(k)}) rotate(-1.5deg)`;
}

function Card({ shot, kind }: { shot: Shot; kind: 'open' | 'end' }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (window as any).__frames = () => Math.round(shot.seconds * FPS);
    (window as any).__frame = (i: number) => {
      const t = i / FPS;
      const el = root.current!;
      const pop = (from: number, dur = 0.45) => {
        const u = Math.max(0, Math.min(1, (t - from) / dur));
        // A little overshoot, like a card slapped down on the table.
        const s = u < 1 ? 0.6 + 0.5 * ease(u) - 0.1 * Math.sin(u * Math.PI) : 1;
        return { opacity: String(Math.min(1, u * 2)), transform: `scale(${s})` };
      };
      el.querySelectorAll<HTMLElement>('[data-at]').forEach((n) => {
        Object.assign(n.style, pop(Number(n.dataset.at)));
      });
      // Fade to and from black at the edges of the trailer.
      const fadeIn = kind === 'open' ? Math.min(1, t / 0.4) : 1;
      const fadeOut = kind === 'end' ? Math.min(1, (shot.seconds - t) / 0.6) : 1;
      el.style.opacity = String(Math.min(fadeIn, fadeOut));
    };
    (window as any).__ready = true;
  }, [shot, kind]);

  const line = (at: number, text: string, style: React.CSSProperties) => (
    <div data-at={at} style={{ opacity: 0, ...style }}>{text}</div>
  );
  return (
    <div ref={root} style={{
      position: 'absolute', inset: 0, background: PAPER, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18,
      font: `900 40px/1.15 "Arial Black", "Helvetica Neue", Arial, sans-serif`, color: INK,
    }}>
      {kind === 'open' ? (
        <>
          {line(0.2, 'PAPER SHIP STUDIO PRESENTS', { font: '800 30px/1 Arial, sans-serif', letterSpacing: '6px', color: ACCENT })}
          <img data-at="0.7" src={logo} style={{ opacity: 0, width: 300 }} />
        </>
      ) : (
        <>
          <img data-at="0.1" src={logo} style={{ opacity: 0, width: 240 }} />
          {line(0.5, 'Dice Battles: Color Rush', { fontSize: 64 })}
          {line(1.1, 'A dice game for the whole family', { font: '700 30px/1.2 Arial, sans-serif', color: '#5b5670' })}
          {line(1.8, 'Coming soon to iPhone and iPad', {
            font: '900 30px/1 Arial, sans-serif', color: PAPER, background: ACCENT,
            border: `4px solid ${INK}`, borderRadius: 16, boxShadow: `6px 6px 0 ${INK}`, padding: '14px 26px', marginTop: 12,
          })}
        </>
      )}
    </div>
  );
}

/* ----------------------------- mounting ----------------------------- */

const which = new URLSearchParams(location.search).get('shot') ?? 'storm';
const shot = SHOTS[which];

document.body.style.margin = '0';
document.body.style.background = '#000';
const host = document.createElement('div');
Object.assign(host.style, { position: 'relative', width: `${W}px`, height: `${H}px`, overflow: 'hidden' });
document.body.appendChild(host);
const mount = document.createElement('div');
Object.assign(mount.style, { position: 'absolute', inset: '0' });
host.appendChild(mount);
host.appendChild(captionBox);

createRoot(mount).render(
  shot.card ? (
    <Card shot={shot} kind={shot.card} />
  ) : (
    <Canvas
      frameloop="never"
      style={{ width: W, height: H }}
      camera={{ fov: 40, near: 0.1, far: 400, position: [8, 8, 8] }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
      }}
    >
      <Battle shot={shot} />
    </Canvas>
  ),
);
