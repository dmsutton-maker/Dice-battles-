import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { Touchdown } from './groundMarks';
import { Kind, ParticlePool, radialFalloff, rand, WATER_Y } from './particles';
import type { DieEffect, DieSample } from './dieEffect';

/**
 * The Sun dice: motes of light rising off them as they roll, a sunburst
 * of light where one lands, and a warm pool of light on the floor under
 * one at rest. Season 2 of the pass, "Sun & Moon", 21 Oct 2026.
 *
 * David, on the pass rotating monthly: "Make 2 new dice and 2 new
 * arenas every month normally going on with a theme like how this one
 * is fire and ice." The Fire dice burn; these SHINE. The shell is the
 * sun itself (patterns.ts `sunburst`); this is the part that moves.
 *
 * LOOKS ONLY, exactly as the fire is. Nothing here has a body in the
 * physics world and nothing in settle.ts can see it. In the moat a sun
 * hisses — a puff of steam and a few sparkles off the water — and sinks
 * as any die does, on the same clock, and shines again on the next
 * throw.
 *
 * NEVER OVER THE TOP FACE AT REST. The face on top is the roll, and the
 * game's camera looks almost straight down at it. So once a die is still
 * its motes are born just outside its silhouette, all the way round, and
 * lean outward as they rise — the lesson the fire learned in its first
 * render of the real arena.
 *
 * Pure JavaScript and three.js, so it ships over the air.
 */

const S = TUNING.sun;
const HALF = TUNING.dieSize / 2;

interface Shine {
  moteDebt: number;
  /** Under the water: no light until it is fished out. */
  sunk: boolean;
}

export class DiceSun implements DieEffect {
  readonly group = new THREE.Group();
  readonly pool: ParticlePool;
  readonly shines: Shine[] = [];
  private readonly touchdown: Touchdown;
  private readonly glows: THREE.Mesh[] = [];
  private readonly glowMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly glowGeometry: THREE.CircleGeometry;
  private readonly glowTexture: THREE.DataTexture;
  private readonly spot = new THREE.Vector3();

  constructor(dice: number) {
    this.pool = new ParticlePool(S.particles);
    this.pool.points.renderOrder = 11;
    this.group.add(this.pool.points);
    this.touchdown = new Touchdown(dice);
    /*
      SUNLIGHT WITHOUT A LIGHT, the way the fire does it: a warm disc on
      the floor under each die rather than a point light, which would
      change the light count every material in the scene is compiled for
      and recompile the whole arena mid-frame.
    */
    this.glowGeometry = new THREE.CircleGeometry(TUNING.dieSize * 1.25, 28);
    this.glowTexture = radialFalloff();
    for (let i = 0; i < dice; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: '#ffc24a',
        alphaMap: this.glowTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      });
      const glow = new THREE.Mesh(this.glowGeometry, material);
      glow.rotation.x = -Math.PI / 2;
      glow.renderOrder = 9;
      this.group.add(glow);
      this.glows.push(glow);
      this.glowMaterials.push(material);
      this.shines.push({ moteDebt: 0, sunk: false });
    }
  }

  /** A throw: every die shines again as it leaves the hand. */
  thrown(): void {
    this.touchdown.reset();
    for (const s of this.shines) s.sunk = false;
  }

  /** Into the moat: a hiss of steam, sparkles off the water, and dark. */
  sank(i: number, x: number, z: number): void {
    const s = this.shines[i];
    if (!s || s.sunk) return;
    s.sunk = true;
    for (let n = 0; n < 16; n++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.4;
      this.pool.spawn(
        Kind.Steam,
        x + Math.cos(a) * r, WATER_Y + rand(0.1, 0.3), z + Math.sin(a) * r,
        Math.cos(a) * rand(0.4, 1.2), rand(1.5, 3.2), Math.sin(a) * rand(0.4, 1.2),
        rand(1.0, 1.8), 0.45, rand(1.4, 2.0), 1.0, 1.4,
      );
    }
    for (let n = 0; n < 14; n++) {
      this.pool.spawn(
        Kind.Mote,
        x + rand(-0.7, 0.7), WATER_Y + 0.08, z + rand(-0.7, 0.7),
        0, rand(0.3, 0.9), 0,
        rand(0.4, 0.9), 0.16, 0.04, 0.4, 1.2,
      );
    }
  }

  fishedOut(i: number): void {
    const s = this.shines[i];
    if (s) s.sunk = false;
  }

  /** A sun sinks like any other die — it is the ice that holds one. */
  heldAt(): number | null {
    return null;
  }

  update(dt: number, time: number, dice: readonly DieSample[], pointScale: number): void {
    this.pool.material.uniforms.uScale.value = pointScale;
    for (let i = 0; i < this.shines.length; i++) {
      const s = this.shines[i];
      const d = dice[i];
      if (!d) continue;
      this.motes(s, d, dt);
      this.burst(i, s, d);
      this.paintGlow(i, s, d, time);
    }
    this.pool.update(dt, time);
  }

  /** Motes of light off the die itself, tumbling or still. */
  private motes(s: Shine, d: DieSample, dt: number): void {
    if (s.sunk) {
      s.moteDebt = 0;
      return;
    }
    s.moteDebt += (d.moving ? S.moteRateMoving : S.moteRateStill) * dt;
    while (s.moteDebt >= 1) {
      s.moteDebt -= 1;
      const p = this.spot;
      if (d.moving) {
        // In flight: anywhere on the shell, so the whole die shines and
        // the light trails behind it.
        p.set(rand(-1, 1) * HALF, rand(-1, 1) * HALF, rand(-1, 1) * HALF);
        p.setComponent(Math.floor(Math.random() * 3), (Math.random() < 0.5 ? -1 : 1) * HALF * 1.05);
        p.applyQuaternion(d.quaternion);
        p.x += d.x; p.y += d.y; p.z += d.z;
        if (p.y < 0.04) p.y = 0.04;
      } else {
        // At rest: a ring just outside the silhouette, never over the top.
        const a = Math.random() * Math.PI * 2;
        const r = HALF * rand(1.08, 1.3);
        p.set(d.x + Math.cos(a) * r, d.y + rand(-0.7, 0.5) * HALF, d.z + Math.sin(a) * r);
      }
      // Still motes lean outward and get no sideways push, so none can
      // drift back in over the face on top.
      const out = d.moving ? 0 : 0.5;
      const jitter = d.moving ? 0.2 : 0;
      this.pool.spawn(
        Kind.Mote,
        p.x, p.y, p.z,
        d.vx * 0.1 + rand(-jitter, jitter) + (p.x - d.x) * out,
        d.vy * 0.06 + rand(0.25, 0.7),
        d.vz * 0.1 + rand(-jitter, jitter) + (p.z - d.z) * out,
        rand(0.8, 1.5), rand(0.1, 0.17), 0.03, 0.35, 1.3,
      );
    }
  }

  /** The sunburst: a flash and a ring of rays where a shining die lands. */
  private burst(i: number, s: Shine, d: DieSample): void {
    const event = this.touchdown.check(i, d);
    if (!event || s.sunk) return;
    const strength = event === 'landed' ? 1 : 0.55;
    const rays = Math.round(S.burstRays * strength);
    for (let n = 0; n < rays; n++) {
      const a = (n / rays) * Math.PI * 2 + rand(-0.1, 0.1);
      this.pool.spawn(
        Kind.Flash,
        d.x + Math.cos(a) * HALF, 0.06, d.z + Math.sin(a) * HALF,
        Math.cos(a) * S.burstSpeed * strength, 0, Math.sin(a) * S.burstSpeed * strength,
        rand(0.3, 0.45), 0.32 * strength, 0.06, 0, 2.5,
      );
    }
    // The flash itself, low round the foot of the die so it never sits
    // on the face on top.
    for (let n = 0; n < 4; n++) {
      const a = (n / 4) * Math.PI * 2 + 0.4;
      this.pool.spawn(
        Kind.Flash,
        d.x + Math.cos(a) * HALF * 0.9, 0.12, d.z + Math.sin(a) * HALF * 0.9,
        Math.cos(a) * 0.6, 0.2, Math.sin(a) * 0.6,
        0.28, 1.1 * strength, 0.2, 0, 2,
      );
    }
    if (event !== 'landed') return;
    for (let n = 0; n < 10; n++) {
      const a = Math.random() * Math.PI * 2;
      this.pool.spawn(
        Kind.Mote,
        d.x + Math.cos(a) * HALF * 1.1, 0.1, d.z + Math.sin(a) * HALF * 1.1,
        Math.cos(a) * rand(0.6, 1.4), rand(1.2, 2.6), Math.sin(a) * rand(0.6, 1.4),
        rand(0.6, 1.1), 0.14, 0.03, -1.5, 1.2,
      );
    }
  }

  private paintGlow(i: number, s: Shine, d: DieSample, time: number): void {
    const glow = this.glows[i];
    const pulse = 0.9 + 0.1 * Math.sin(time * 2.1 + i * 2);
    // Fades as the die rises, the way its shadow does.
    const height = Math.max(0, d.y - HALF);
    const near = Math.max(0, 1 - height * 0.3);
    const on = s.sunk ? 0 : near;
    glow.visible = on > 0.01;
    glow.position.set(d.x, 0.025, d.z);
    this.glowMaterials[i].opacity = S.glowOpacity * on * pulse;
  }

  dispose(): void {
    this.pool.dispose();
    this.glowGeometry.dispose();
    this.glowTexture.dispose();
    this.glowMaterials.forEach((m) => m.dispose());
  }
}
