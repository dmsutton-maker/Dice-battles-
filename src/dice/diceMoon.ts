import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { Touchdown } from './groundMarks';
import { Kind, ParticlePool, radialFalloff, rand, WATER_Y } from './particles';
import type { DieEffect, DieSample } from './dieEffect';

/**
 * The Moon dice: a soft halo of moonlight round them, stardust trailing
 * behind as they roll, and a ripple of moonlight across the floor where
 * one comes to rest. Season 2 of the pass, "Sun & Moon", 21 Oct 2026 —
 * the Sun dice's opposite number (diceSun.ts).
 *
 * THE HALO is a short-lived sprite spawned at the die's centre every
 * frame. A sprite inside the die is hidden by the die itself (the pool
 * tests depth), so only the part outside its silhouette shows: a soft
 * silver edge of light round the die, from every angle, that can never
 * lie over the face on top. As the die moves the halos it leaves fade
 * behind it, which is the trail's glow.
 *
 * THE STARDUST is laid by distance, as the Neon die's trail is: a grain
 * every `trailSpacing` units the die travels, twinkling as it drifts up
 * and fades. A die at rest sheds a few grains a second from just outside
 * its silhouette, drifting outward.
 *
 * LOOKS ONLY, like the rest. Nothing here has a body in the physics
 * world. In the moat the die sinks as any die does, with a few silver
 * glints off the water, and glows again on the next throw.
 *
 * Pure JavaScript and three.js, so it ships over the air.
 */

const M = TUNING.moon;
const HALF = TUNING.dieSize / 2;

interface Glow {
  /** Where the last grain was laid, or NaN before the first. */
  lx: number;
  ly: number;
  lz: number;
  driftDebt: number;
  /** Under the water: no light until it is fished out. */
  sunk: boolean;
}

export class DiceMoon implements DieEffect {
  readonly group = new THREE.Group();
  readonly pool: ParticlePool;
  readonly glows: Glow[] = [];
  private readonly touchdown: Touchdown;
  private readonly pools: THREE.Mesh[] = [];
  private readonly poolMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly poolGeometry: THREE.CircleGeometry;
  private readonly poolTexture: THREE.DataTexture;
  private readonly spot = new THREE.Vector3();

  constructor(dice: number) {
    this.pool = new ParticlePool(M.particles);
    this.pool.points.renderOrder = 11;
    this.group.add(this.pool.points);
    this.touchdown = new Touchdown(dice);
    // Moonlight on the floor under each die: a cool disc, faint, the
    // same trick as the fire's and the sun's — never a real light.
    this.poolGeometry = new THREE.CircleGeometry(TUNING.dieSize * 1.3, 28);
    this.poolTexture = radialFalloff();
    for (let i = 0; i < dice; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: '#a8bcff',
        alphaMap: this.poolTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(this.poolGeometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 9;
      this.group.add(mesh);
      this.pools.push(mesh);
      this.poolMaterials.push(material);
      this.glows.push({ lx: NaN, ly: NaN, lz: NaN, driftDebt: 0, sunk: false });
    }
  }

  thrown(): void {
    this.touchdown.reset();
    for (const g of this.glows) {
      g.lx = NaN;
      g.sunk = false;
    }
  }

  /** Into the moat: a few silver glints off the water, and dark. */
  sank(i: number, x: number, z: number): void {
    const g = this.glows[i];
    if (!g || g.sunk) return;
    g.sunk = true;
    for (let n = 0; n < 16; n++) {
      this.pool.spawn(
        Kind.Glint,
        x + rand(-0.8, 0.8), WATER_Y + 0.08, z + rand(-0.8, 0.8),
        0, 0, 0,
        rand(0.3, 0.8), 0.16, 0.05, 0, 0,
      );
    }
    for (let n = 0; n < 10; n++) {
      this.pool.spawn(
        Kind.Stardust,
        x + rand(-0.5, 0.5), WATER_Y + 0.1, z + rand(-0.5, 0.5),
        rand(-0.2, 0.2), rand(0.4, 0.9), rand(-0.2, 0.2),
        rand(0.6, 1.1), 0.1, 0.02, 0.3, 1.2,
      );
    }
  }

  fishedOut(i: number): void {
    const g = this.glows[i];
    if (g) {
      g.sunk = false;
      g.lx = NaN;
    }
  }

  /** A moon sinks like any other die — it is the ice that holds one. */
  heldAt(): number | null {
    return null;
  }

  update(dt: number, time: number, dice: readonly DieSample[], pointScale: number): void {
    this.pool.material.uniforms.uScale.value = pointScale;
    for (let i = 0; i < this.glows.length; i++) {
      const g = this.glows[i];
      const d = dice[i];
      if (!d) continue;
      if (!g.sunk) {
        this.halo(d);
        if (d.moving) this.lay(g, d);
        else this.drift(g, d, dt);
      } else {
        g.driftDebt = 0;
      }
      this.ripple(i, g, d);
      this.paintPool(i, g, d, time);
      if (!d.moving) g.lx = NaN;
    }
    this.pool.update(dt, time);
  }

  /** One halo a frame at the die's centre; the die hides the middle of it. */
  private halo(d: DieSample): void {
    this.pool.spawn(
      Kind.Halo,
      d.x, d.y, d.z,
      d.vx * 0.5, d.vy * 0.5, d.vz * 0.5,
      0.26, HALF * 3.4, HALF * 3.0, 0, 3,
      0.9,
    );
  }

  /** Grains of stardust along the path since the last one. */
  private lay(g: Glow, d: DieSample): void {
    if (Number.isNaN(g.lx)) {
      g.lx = d.x;
      g.ly = d.y;
      g.lz = d.z;
      return;
    }
    const dx = d.x - g.lx;
    const dy = d.y - g.ly;
    const dz = d.z - g.lz;
    const dist = Math.hypot(dx, dy, dz);
    // A teleport (the die put back after the moat) is not a trail.
    if (dist > 2) {
      g.lx = d.x;
      g.ly = d.y;
      g.lz = d.z;
      return;
    }
    const steps = Math.floor(dist / M.trailSpacing);
    for (let k = 1; k <= steps; k++) {
      const f = (k * M.trailSpacing) / dist;
      const p = this.spot.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(HALF * rand(0.9, 1.15));
      this.pool.spawn(
        Kind.Stardust,
        g.lx + dx * f + p.x, Math.max(0.04, g.ly + dy * f + p.y), g.lz + dz * f + p.z,
        rand(-0.15, 0.15), rand(0.1, 0.35), rand(-0.15, 0.15),
        M.trailLife * rand(0.7, 1.1), rand(0.08, 0.13), 0.02, 0.15, 1.5,
      );
    }
    if (steps > 0) {
      const f = (steps * M.trailSpacing) / dist;
      g.lx += dx * f;
      g.ly += dy * f;
      g.lz += dz * f;
    }
  }

  /** At rest: a few grains a second, born outside the silhouette, drifting out. */
  private drift(g: Glow, d: DieSample, dt: number): void {
    g.driftDebt += M.driftRate * dt;
    while (g.driftDebt >= 1) {
      g.driftDebt -= 1;
      const a = Math.random() * Math.PI * 2;
      const r = HALF * rand(1.1, 1.35);
      const x = d.x + Math.cos(a) * r;
      const z = d.z + Math.sin(a) * r;
      this.pool.spawn(
        Kind.Stardust,
        x, d.y + rand(-0.6, 0.5) * HALF, z,
        (x - d.x) * 0.4, rand(0.15, 0.4), (z - d.z) * 0.4,
        rand(1.0, 1.6), rand(0.07, 0.12), 0.02, 0.2, 1.4,
      );
    }
  }

  /** A ring of moonlight spreading across the floor where a die comes down. */
  private ripple(i: number, g: Glow, d: DieSample): void {
    const event = this.touchdown.check(i, d);
    if (!event || g.sunk) return;
    const strength = event === 'landed' ? 1 : 0.7;
    const dots = Math.round(M.rippleDots * strength);
    for (let n = 0; n < dots; n++) {
      const a = (n / dots) * Math.PI * 2;
      this.pool.spawn(
        Kind.Halo,
        d.x + Math.cos(a) * HALF, 0.05, d.z + Math.sin(a) * HALF,
        Math.cos(a) * M.rippleSpeed, 0, Math.sin(a) * M.rippleSpeed,
        0.7, 0.26 * strength, 0.08, 0, 1.6,
        1.4,
      );
    }
  }

  private paintPool(i: number, g: Glow, d: DieSample, time: number): void {
    const mesh = this.pools[i];
    const breathe = 0.85 + 0.15 * Math.sin(time * 1.3 + i * 1.7);
    const height = Math.max(0, d.y - HALF);
    const near = Math.max(0, 1 - height * 0.3);
    const on = g.sunk ? 0 : near;
    mesh.visible = on > 0.01;
    mesh.position.set(d.x, 0.025, d.z);
    this.poolMaterials[i].opacity = M.glowOpacity * on * breathe;
  }

  dispose(): void {
    this.pool.dispose();
    this.poolGeometry.dispose();
    this.poolTexture.dispose();
    this.poolMaterials.forEach((m) => m.dispose());
  }
}
