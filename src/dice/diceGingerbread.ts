import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { Touchdown } from './groundMarks';
import { Kind, ParticlePool, rand, WATER_Y } from './particles';
import type { DieEffect, DieSample } from './dieEffect';

/**
 * The Gingerbread dice: crumbs falling off them as they roll, a puff
 * of icing sugar where one lands, and three crumbs that bounce away.
 * Season 2 of the pass, "Sugar & Snow", December 2026 (built 8 Nov).
 *
 * The shell is the biscuit itself (patterns.ts `gingerbread`); this is
 * the part that moves. A biscuit does not shine, so unlike the Sun and
 * Moon there is no light on the floor under it: a crumb is a solid
 * brown speck that falls and is gone when it reaches the floor, and
 * the sugar is a white puff that covers rather than glows.
 *
 * LOOKS ONLY, exactly as the fire is. Nothing here has a body in the
 * physics world and nothing in settle.ts can see it. In the moat a
 * biscuit goes soggy: a few crumbs float off on the water and it sheds
 * nothing more until it is fished out, dry again on the next throw.
 *
 * NEVER OVER THE TOP FACE AT REST. Crumbs are shed only while a die is
 * tumbling, and the puff and the bouncing crumbs are born low round the
 * foot of a landed die, so nothing can lie over the face that is the
 * roll.
 *
 * Pure JavaScript and three.js, so it ships over the air.
 */

const G = TUNING.gingerbread;
const HALF = TUNING.dieSize / 2;

interface Biscuit {
  crumbDebt: number;
  /** Under the water: soggy, shedding nothing until fished out. */
  sunk: boolean;
}

export class DiceGingerbread implements DieEffect {
  readonly group = new THREE.Group();
  readonly pool: ParticlePool;
  readonly biscuits: Biscuit[] = [];
  private readonly touchdown: Touchdown;
  private readonly spot = new THREE.Vector3();

  constructor(dice: number) {
    this.pool = new ParticlePool(G.particles);
    this.pool.points.renderOrder = 11;
    this.group.add(this.pool.points);
    this.touchdown = new Touchdown(dice);
    for (let i = 0; i < dice; i++) this.biscuits.push({ crumbDebt: 0, sunk: false });
  }

  /** A throw: every biscuit is dry again as it leaves the hand. */
  thrown(): void {
    this.touchdown.reset();
    for (const b of this.biscuits) b.sunk = false;
  }

  /** Into the moat: soggy. A few crumbs float off on the water. */
  sank(i: number, x: number, z: number): void {
    const b = this.biscuits[i];
    if (!b || b.sunk) return;
    b.sunk = true;
    for (let n = 0; n < 10; n++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(0.1, 0.5);
      this.pool.spawn(
        Kind.Crumb,
        x + Math.cos(a) * r, WATER_Y + 0.04, z + Math.sin(a) * r,
        Math.cos(a) * rand(0.1, 0.3), 0.02, Math.sin(a) * rand(0.1, 0.3),
        rand(0.8, 1.4), 0.05, 0.03, 0.0, 2.0,
      );
    }
  }

  fishedOut(i: number): void {
    const b = this.biscuits[i];
    if (b) b.sunk = false;
  }

  /** A biscuit sinks like any other die — it is the ice that holds one. */
  heldAt(): number | null {
    return null;
  }

  update(dt: number, time: number, dice: readonly DieSample[], pointScale: number): void {
    this.pool.material.uniforms.uScale.value = pointScale;
    for (let i = 0; i < this.biscuits.length; i++) {
      const b = this.biscuits[i];
      const d = dice[i];
      if (!d) continue;
      this.crumbs(b, d, dt);
      this.puff(i, b, d);
    }
    this.pool.update(dt, time);
  }

  /** Crumbs off a tumbling die: born on the shell, falling under gravity. */
  private crumbs(b: Biscuit, d: DieSample, dt: number): void {
    if (b.sunk || !d.moving) {
      b.crumbDebt = 0;
      return;
    }
    b.crumbDebt += G.crumbRate * dt;
    while (b.crumbDebt >= 1) {
      b.crumbDebt -= 1;
      // A point on the shell, on one of the six sides, in the die's frame.
      const p = this.spot;
      p.set(rand(-1, 1) * HALF, rand(-1, 1) * HALF, rand(-1, 1) * HALF);
      p.setComponent(Math.floor(Math.random() * 3), (Math.random() < 0.5 ? -1 : 1) * HALF * 1.02);
      p.applyQuaternion(d.quaternion);
      p.x += d.x; p.y += d.y; p.z += d.z;
      if (p.y < 0.04) p.y = 0.04;
      this.pool.spawn(
        Kind.Crumb,
        p.x, p.y, p.z,
        d.vx * 0.3 + rand(-0.4, 0.4), d.vy * 0.2 + rand(-0.2, 0.6), d.vz * 0.3 + rand(-0.4, 0.4),
        rand(0.5, 0.9), rand(0.035, 0.06), 0.03, -7, 0.4,
      );
    }
  }

  /** Where a die lands: a puff of icing sugar, and crumbs bouncing away. */
  private puff(i: number, b: Biscuit, d: DieSample): void {
    const event = this.touchdown.check(i, d);
    if (!event || b.sunk) return;
    const strength = event === 'landed' ? 1 : 0.5;
    const grains = Math.round(G.puffCount * strength);
    for (let n = 0; n < grains; n++) {
      const a = Math.random() * Math.PI * 2;
      const r = HALF * rand(0.9, 1.2);
      this.pool.spawn(
        Kind.Sugar,
        d.x + Math.cos(a) * r, 0.06, d.z + Math.sin(a) * r,
        Math.cos(a) * rand(0.8, 1.8) * strength, rand(0.3, 0.9), Math.sin(a) * rand(0.8, 1.8) * strength,
        rand(0.5, 0.9), 0.12, 0.3 * strength, 0.2, 2.2,
      );
    }
    if (event !== 'landed') return;
    for (let n = 0; n < G.bounceCrumbs; n++) {
      const a = (n / G.bounceCrumbs) * Math.PI * 2 + rand(-0.4, 0.4);
      this.pool.spawn(
        Kind.Crumb,
        d.x + Math.cos(a) * HALF * 1.05, 0.1, d.z + Math.sin(a) * HALF * 1.05,
        Math.cos(a) * rand(1.2, 2.2), rand(1.6, 2.6), Math.sin(a) * rand(1.2, 2.2),
        1.2, 0.06, 0.045, -8, 0.3,
      );
    }
  }

  dispose(): void {
    this.pool.dispose();
  }
}
