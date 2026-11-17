import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { Touchdown } from './groundMarks';
import { Kind, ParticlePool, rand, WATER_Y } from './particles';
import type { DieEffect, DieSample } from './dieEffect';

/**
 * The Snow Globe dice: snow swirling round the glass while a die
 * tumbles, as if the globe had just been shaken; a flurry that rises
 * and settles where one lands; a few flakes drifting down the sides of
 * one at rest; and bubbles off the glass when one goes under in the
 * moat. Season 1 of the pass, "Sugar & Snow", the free-row die at
 * level 20 (9 Nov 2026, David's pick in place of the deleted Bauble).
 *
 * The shell is the globe itself, village and all (patterns.ts
 * `snowglobe`); this is the part that moves. The snow is drawn just
 * outside the shell rather than inside it, because a die is opaque:
 * flakes an inch off the glass, swirling with the die, read as snow in
 * the globe from the game's camera.
 *
 * LOOKS ONLY, exactly as the fire is. Nothing here has a body in the
 * physics world and nothing in settle.ts can see it.
 *
 * NEVER OVER THE TOP FACE AT REST. Flakes swirl only while a die is
 * tumbling; the flurry is born low round the foot of a landed die and
 * drifts outward; and the settling flakes of a die at rest are born
 * beside the die, below the top face, falling. Nothing lies over the
 * face that is the roll.
 *
 * Pure JavaScript and three.js, so it ships over the air.
 */

const S = TUNING.snowglobe;
const HALF = TUNING.dieSize / 2;

interface Globe {
  swirlDebt: number;
  settleDebt: number;
  /** Under the water: no snow until fished out. */
  sunk: boolean;
}

export class DiceSnowGlobe implements DieEffect {
  readonly group = new THREE.Group();
  readonly pool: ParticlePool;
  readonly globes: Globe[] = [];
  private readonly touchdown: Touchdown;
  private readonly spot = new THREE.Vector3();

  constructor(dice: number) {
    this.pool = new ParticlePool(S.particles);
    this.pool.points.renderOrder = 11;
    this.group.add(this.pool.points);
    this.touchdown = new Touchdown(dice);
    for (let i = 0; i < dice; i++) this.globes.push({ swirlDebt: 0, settleDebt: 0, sunk: false });
  }

  /** A throw: the globe is shaken, and dry again as it leaves the hand. */
  thrown(): void {
    this.touchdown.reset();
    for (const g of this.globes) g.sunk = false;
  }

  /** Into the moat: bubbles off the glass, and no snow until fished out. */
  sank(i: number, x: number, z: number): void {
    const g = this.globes[i];
    if (!g || g.sunk) return;
    g.sunk = true;
    for (let n = 0; n < S.bubbles; n++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(0.05, 0.35);
      this.pool.spawn(
        Kind.Glint,
        x + Math.cos(a) * r, WATER_Y + 0.02, z + Math.sin(a) * r,
        Math.cos(a) * rand(0.05, 0.2), rand(0.3, 0.7), Math.sin(a) * rand(0.05, 0.2),
        rand(0.5, 0.9), 0.04, 0.02, 0.0, 1.5,
      );
    }
  }

  fishedOut(i: number): void {
    const g = this.globes[i];
    if (g) g.sunk = false;
  }

  /** A globe sinks like any other die; it is the ice that holds one. */
  heldAt(): number | null {
    return null;
  }

  update(dt: number, time: number, dice: readonly DieSample[], pointScale: number): void {
    this.pool.material.uniforms.uScale.value = pointScale;
    for (let i = 0; i < this.globes.length; i++) {
      const g = this.globes[i];
      const d = dice[i];
      if (!d) continue;
      this.swirl(g, d, dt);
      this.flurry(i, g, d);
      this.settle(g, d, dt);
    }
    this.pool.update(dt, time);
  }

  /**
   * Snow round a tumbling die: born just off the shell, carried round
   * with the die's spin and drift, so it swirls the way shaken snow does.
   */
  private swirl(g: Globe, d: DieSample, dt: number): void {
    if (g.sunk || !d.moving) {
      g.swirlDebt = 0;
      return;
    }
    g.swirlDebt += S.swirlRate * dt;
    while (g.swirlDebt >= 1) {
      g.swirlDebt -= 1;
      // A point just outside the shell, anywhere round the die.
      const p = this.spot;
      p.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(HALF * rand(1.05, S.swirlReach));
      p.applyQuaternion(d.quaternion);
      // Swirl: a push sideways round the die's centre, plus a share of its motion.
      const sx = -p.z * rand(1.5, 3);
      const sz = p.x * rand(1.5, 3);
      p.x += d.x; p.y += d.y; p.z += d.z;
      if (p.y < 0.05) p.y = 0.05;
      this.pool.spawn(
        Kind.Flake,
        p.x, p.y, p.z,
        d.vx * 0.4 + sx, d.vy * 0.2 + rand(-0.3, 0.5), d.vz * 0.4 + sz,
        rand(0.35, 0.7), rand(0.03, 0.05), 0.02, -1.5, 1.6,
      );
    }
  }

  /** Where a die lands: a flurry that rises round its foot and settles outward. */
  private flurry(i: number, g: Globe, d: DieSample): void {
    const event = this.touchdown.check(i, d);
    if (!event || g.sunk) return;
    const strength = event === 'landed' ? 1 : 0.5;
    const flakes = Math.round(S.flurryCount * strength);
    for (let n = 0; n < flakes; n++) {
      const a = Math.random() * Math.PI * 2;
      const r = HALF * rand(0.95, 1.25);
      this.pool.spawn(
        Kind.Flake,
        d.x + Math.cos(a) * r, rand(0.05, HALF * 0.9), d.z + Math.sin(a) * r,
        Math.cos(a) * rand(0.4, 1.2) * strength, rand(0.4, 1.1) * strength, Math.sin(a) * rand(0.4, 1.2) * strength,
        rand(0.9, 1.6), rand(0.035, 0.06), 0.03, -0.9, 1.4,
      );
    }
  }

  /** A die at rest: a few flakes still settling down its sides. */
  private settle(g: Globe, d: DieSample, dt: number): void {
    if (g.sunk || d.moving) {
      g.settleDebt = 0;
      return;
    }
    g.settleDebt += S.settleRate * dt;
    while (g.settleDebt >= 1) {
      g.settleDebt -= 1;
      const a = Math.random() * Math.PI * 2;
      const r = HALF * rand(1.1, 1.3);
      this.pool.spawn(
        Kind.Flake,
        d.x + Math.cos(a) * r, d.y + HALF * rand(0.2, 0.8), d.z + Math.sin(a) * r,
        Math.cos(a) * 0.05, -0.15, Math.sin(a) * 0.05,
        rand(0.8, 1.4), rand(0.03, 0.045), 0.02, -0.6, 1.2,
      );
    }
  }

  dispose(): void {
    this.pool.dispose();
  }
}
