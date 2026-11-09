import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { Touchdown } from './groundMarks';
import { Kind, ParticlePool, radialFalloff, rand, WATER_Y } from './particles';
import type { DieEffect, DieSample } from './dieEffect';

/**
 * The Ocean dice: a splash when one lands.
 *
 * Marc, 4 Nov 2026: "do option c with the flowing water and splash."
 * The water itself flows on the shell (oceanFlow.ts); this is what comes
 * off it. A die that comes to rest throws a ring of droplets out from
 * its base that fall back, and leaves a wet sheen on the board round it
 * that dries in half a second; a bounce on the way down is a smaller
 * spray; both dice spray as they leave the hand; and one that goes under
 * in the moat makes the biggest splash of all, off the water.
 *
 * LOOKS ONLY, as every effect is. Nothing here has a body in the physics
 * world and nothing in settle.ts can see it. Every droplet is born on the
 * shell's BOTTOM edge and thrown outward and down, so none ever crosses
 * the face on top: the stickers are the game's signal and the splash
 * cannot hide one.
 *
 * Pure JavaScript and three.js, like the fire, so it ships over the air.
 * NOT REACT: DiceScene hands in where the dice are and the moments that
 * matter, and tests/oceanSplash.test.ts drives it the same way in node.
 */

const O = TUNING.ocean;
const HALF = TUNING.dieSize / 2;

interface Wet {
  /** Seconds since the sheen was laid; negative is dry. */
  sheen: number;
  /** The board's clock when the last full splash was, so a wobble is not a second one. */
  splashedAt: number;
  /** Under the moat right now: no splash on the board from a die that is under water. */
  sunk: boolean;
}

export class DiceOcean implements DieEffect {
  readonly group = new THREE.Group();
  readonly pool: ParticlePool;
  readonly wets: Wet[] = [];
  private readonly touchdown: Touchdown;
  private readonly sheens: THREE.Mesh[] = [];
  readonly sheenMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly sheenGeometry: THREE.CircleGeometry;
  private readonly sheenTexture: THREE.DataTexture;

  constructor(dice: number) {
    this.pool = new ParticlePool(O.particles);
    this.pool.points.renderOrder = 11;
    this.group.add(this.pool.points);
    this.touchdown = new Touchdown(dice);
    // The wet patch: a pale disc on the floor, the way the fire's glow
    // is, that fades as it dries.
    this.sheenGeometry = new THREE.CircleGeometry(O.sheenSize / 2, 28);
    this.sheenTexture = radialFalloff();
    for (let i = 0; i < dice; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: '#dff3fb',
        alphaMap: this.sheenTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      });
      const sheen = new THREE.Mesh(this.sheenGeometry, material);
      sheen.rotation.x = -Math.PI / 2;
      sheen.renderOrder = 9;
      sheen.visible = false;
      this.group.add(sheen);
      this.sheens.push(sheen);
      this.sheenMaterials.push(material);
      this.wets.push({ sheen: -1, splashedAt: -Infinity, sunk: false });
    }
  }

  /** A throw: a light spray off each die as it leaves the hand. */
  thrown(dice: readonly DieSample[]): void {
    this.touchdown.reset();
    this.wets.forEach((w, i) => {
      w.sunk = false;
      const d = dice[i];
      if (d) this.spray(d, O.throwDrops, 0.6);
    });
  }

  /** Into the moat: the big one, off the water. */
  sank(i: number, x: number, z: number): void {
    const w = this.wets[i];
    if (!w || w.sunk) return;
    w.sunk = true;
    for (let n = 0; n < O.sinkDrops; n++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(1.5, 4);
      this.pool.spawn(
        Kind.Drop,
        x + Math.cos(a) * 0.3, WATER_Y + 0.05, z + Math.sin(a) * 0.3,
        Math.cos(a) * s, rand(3, 7.5), Math.sin(a) * s,
        rand(0.5, 0.9), 0.1, 0.05, -26, 0.3,
      );
    }
    // Fine spray hanging over the water for a moment.
    for (let n = 0; n < O.sinkMist; n++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.4;
      this.pool.spawn(
        Kind.Mist,
        x + Math.cos(a) * r, WATER_Y + rand(0.1, 0.3), z + Math.sin(a) * r,
        Math.cos(a) * rand(0.3, 0.9), rand(1, 2), Math.sin(a) * rand(0.3, 0.9),
        rand(0.6, 1.1), 0.3, 0.6, -1.5, 1.4,
      );
    }
  }

  fishedOut(i: number): void {
    const w = this.wets[i];
    if (w) w.sunk = false;
  }

  /** An Ocean die sinks like any other — it is the ice that holds one. */
  heldAt(): number | null {
    return null;
  }

  update(dt: number, time: number, dice: readonly DieSample[], pointScale: number): void {
    this.pool.material.uniforms.uScale.value = pointScale;
    for (let i = 0; i < this.wets.length; i++) {
      const w = this.wets[i];
      const d = dice[i];
      if (!d) continue;
      /*
        'rested' is the `moving` flag going true to false on the floor:
        the full splash — unless it is a wobble, a die that settled,
        rocked and settled again within `splashAgainSeconds`, which only
        sprays. 'landed' is a bounce on the way down: a spray.
      */
      const event = this.touchdown.check(i, d);
      if (event && !w.sunk) {
        if (event === 'rested' && time - w.splashedAt >= O.splashAgainSeconds) this.splash(i, d, time);
        else this.spray(d, O.sprayDrops, 1);
      }
      this.dry(i, w, dt);
    }
    this.pool.update(dt, time);
  }

  /** The ring of droplets out from the base, and the sheen under it. */
  private splash(i: number, d: DieSample, time: number): void {
    const w = this.wets[i];
    w.splashedAt = time;
    for (let n = 0; n < O.splashDrops; n++) {
      const a = ((n + Math.random() * 0.6) / O.splashDrops) * Math.PI * 2;
      const r = HALF * rand(1.05, 1.2);
      const s = rand(1.6, 3);
      this.pool.spawn(
        Kind.Drop,
        d.x + Math.cos(a) * r, d.y - HALF + 0.05, d.z + Math.sin(a) * r,
        Math.cos(a) * s, rand(2.2, 4), Math.sin(a) * s,
        rand(0.45, 0.7), 0.12, 0.05, -26, 0.3,
      );
    }
    w.sheen = 0;
    const sheen = this.sheens[i];
    sheen.position.set(d.x, 0.025, d.z);
    sheen.visible = true;
  }

  /** A few droplets off the bottom edge, outward and down. */
  private spray(d: DieSample, count: number, strength: number): void {
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2;
      const r = HALF * rand(1, 1.15);
      const s = rand(0.8, 2) * strength;
      this.pool.spawn(
        Kind.Drop,
        d.x + Math.cos(a) * r, d.y - HALF * rand(0.5, 0.85), d.z + Math.sin(a) * r,
        Math.cos(a) * s + d.vx * 0.3, rand(1, 2.2) * strength, Math.sin(a) * s + d.vz * 0.3,
        rand(0.3, 0.5), 0.09, 0.04, -26, 0.3,
      );
    }
  }

  private dry(i: number, w: Wet, dt: number): void {
    if (w.sheen < 0) return;
    w.sheen += dt;
    const sheen = this.sheens[i];
    if (w.sheen >= O.sheenSeconds) {
      w.sheen = -1;
      sheen.visible = false;
      this.sheenMaterials[i].opacity = 0;
      return;
    }
    const left = 1 - w.sheen / O.sheenSeconds;
    // Spreads a little as it dries, the way a wet ring does.
    const spread = 1 + 0.3 * (1 - left);
    sheen.scale.set(spread, spread, 1);
    this.sheenMaterials[i].opacity = O.sheenOpacity * left;
  }

  dispose(): void {
    this.pool.dispose();
    this.sheenGeometry.dispose();
    this.sheenTexture.dispose();
    this.sheenMaterials.forEach((m) => m.dispose());
  }
}
