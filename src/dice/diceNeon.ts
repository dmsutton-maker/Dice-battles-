import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { Kind, ParticlePool, rand, WATER_Y } from './particles';
import type { DieEffect, DieSample } from './dieEffect';

/**
 * The Neon die's light: a glowing trail behind it as it rolls, and a
 * ring of light that spreads across the floor where it comes to rest.
 *
 * David, 20 Oct 2026: "make a new cool dice that is worth one or two
 * dollars", and of three designs, "I like the neon." The shell is black
 * glass with a pink tube round every side (patterns.ts `neon`); this is
 * the part that moves.
 *
 * The trail is laid by DISTANCE, not by time: a dot every
 * `trailSpacing` units the die travels, alternating pink and cyan. So a
 * fast throw draws a long bright streak, a die that is barely moving
 * leaves nothing, and a die at rest costs nothing at all.
 *
 * LOOKS ONLY, like Fire and Ice: nothing here has a body in the physics
 * world. In the moat the die fizzes a few cyan sparks and sinks as any
 * die does, on the same clock.
 *
 * Pure JavaScript and three.js, so it ships over the air.
 */

const N = TUNING.neon;
const HALF = TUNING.dieSize / 2;

interface Trail {
  /** Where the last dot was laid, or NaN before the first. */
  lx: number;
  ly: number;
  lz: number;
  /** Which colour the next dot is. */
  pink: boolean;
  /** Was rolling last frame, so coming to rest can be noticed. */
  wasMoving: boolean;
  /** Sunk this round: no landing ring when the picture comes to rest under water. */
  sunk: boolean;
}

export class DiceNeon implements DieEffect {
  readonly group = new THREE.Group();
  readonly pool: ParticlePool;
  private readonly trails: Trail[] = [];

  constructor(dice: number) {
    this.pool = new ParticlePool(N.particles);
    this.pool.points.renderOrder = 11;
    this.group.add(this.pool.points);
    for (let i = 0; i < dice; i++) {
      this.trails.push({ lx: NaN, ly: NaN, lz: NaN, pink: true, wasMoving: false, sunk: false });
    }
  }

  thrown(): void {
    for (const t of this.trails) {
      t.lx = NaN;
      t.sunk = false;
      t.wasMoving = true;
    }
  }

  sank(i: number, x: number, z: number): void {
    const t = this.trails[i];
    if (t) t.sunk = true;
    for (let n = 0; n < 18; n++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(0.6, 1.8);
      this.pool.spawn(
        Kind.NeonCyan,
        x, WATER_Y + 0.08, z,
        Math.cos(a) * s, rand(0.6, 1.6), Math.sin(a) * s,
        rand(0.3, 0.6), 0.22, 0.04, -3, 1.5,
      );
    }
  }

  fishedOut(i: number): void {
    const t = this.trails[i];
    if (t) {
      t.sunk = false;
      t.lx = NaN;
    }
  }

  heldAt(): number | null {
    return null;
  }

  update(dt: number, time: number, dice: readonly DieSample[], pointScale: number): void {
    this.pool.material.uniforms.uScale.value = pointScale;
    for (let i = 0; i < this.trails.length; i++) {
      const t = this.trails[i];
      const d = dice[i];
      if (!d) continue;
      if (d.moving && !t.sunk) this.lay(t, d);
      if (t.wasMoving && !d.moving && !t.sunk) this.land(d);
      if (!d.moving) t.lx = NaN;
      t.wasMoving = d.moving;
    }
    this.pool.update(dt, time);
  }

  /** Dots along the path since the last one, one per `trailSpacing`. */
  private lay(t: Trail, d: DieSample): void {
    if (Number.isNaN(t.lx)) {
      t.lx = d.x;
      t.ly = d.y;
      t.lz = d.z;
      return;
    }
    const dx = d.x - t.lx;
    const dy = d.y - t.ly;
    const dz = d.z - t.lz;
    const dist = Math.hypot(dx, dy, dz);
    // A teleport (the die put back after the moat) is not a streak.
    if (dist > 2) {
      t.lx = d.x;
      t.ly = d.y;
      t.lz = d.z;
      return;
    }
    const steps = Math.floor(dist / N.trailSpacing);
    for (let k = 1; k <= steps; k++) {
      const f = (k * N.trailSpacing) / dist;
      this.pool.spawn(
        t.pink ? Kind.NeonPink : Kind.NeonCyan,
        t.lx + dx * f, t.ly + dy * f, t.lz + dz * f,
        0, 0, 0,
        N.trailLife, HALF * 1.1, HALF * 0.25, 0, 0,
        0.85,
      );
      t.pink = !t.pink;
    }
    if (steps > 0) {
      const f = (steps * N.trailSpacing) / dist;
      t.lx += dx * f;
      t.ly += dy * f;
      t.lz += dz * f;
    }
  }

  /** A ring of light that spreads out across the floor from a die at rest. */
  private land(d: DieSample): void {
    for (let n = 0; n < N.landingRing; n++) {
      const a = (n / N.landingRing) * Math.PI * 2;
      const pink = n % 2 === 0;
      this.pool.spawn(
        pink ? Kind.NeonPink : Kind.NeonCyan,
        d.x + Math.cos(a) * HALF, 0.04, d.z + Math.sin(a) * HALF,
        Math.cos(a) * N.landingSpeed, 0, Math.sin(a) * N.landingSpeed,
        0.6, 0.22, 0.1, 0, 2.2,
      );
    }
  }

  dispose(): void {
    this.pool.dispose();
  }
}
