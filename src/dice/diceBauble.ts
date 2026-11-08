import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { Touchdown } from './groundMarks';
import { Kind, ParticlePool, radialFalloff, rand, WATER_Y } from './particles';
import type { DieEffect, DieSample } from './dieEffect';

/**
 * The Bauble dice: a trail of gold glitter behind them as they roll, a
 * ring of glitter rising where one lands with one bright twinkle on its
 * top corner, a sheen of light sliding over the glass as it turns, and
 * a faint pool of gold light on the floor under one at rest. Season 2
 * of the pass, "Sugar & Snow", December 2026 (built 8 Nov).
 *
 * THE SHEEN is the Moon dice's trick: a short-lived sprite spawned at
 * the die's centre each frame while it tumbles. The die hides all of it
 * but the rim, so what shows is a soft white edge of light that slides
 * round the glass as the die turns. It is spawned only while the die
 * moves, so a die at rest shows its faces plainly.
 *
 * THE GLITTER is laid by distance, as the Moon's stardust is: a fleck
 * every `trailSpacing` units the die travels, twinkling as it fades. A
 * die at rest sheds a few flecks a second from just outside its
 * silhouette, drifting outward.
 *
 * THE TWINKLE is one bright fleck on a top corner of the landed die — a
 * corner, which lies outside the face's own circle, never the face.
 *
 * LOOKS ONLY, like the rest. In the moat the die sinks as any die does,
 * with a few glints off the water, and glitters again on the next throw.
 *
 * Pure JavaScript and three.js, so it ships over the air.
 */

const B = TUNING.bauble;
const HALF = TUNING.dieSize / 2;

interface Glass {
  /** Where the last fleck was laid, or NaN before the first. */
  lx: number;
  ly: number;
  lz: number;
  driftDebt: number;
  /** Under the water: dark until fished out. */
  sunk: boolean;
}

export class DiceBauble implements DieEffect {
  readonly group = new THREE.Group();
  readonly pool: ParticlePool;
  readonly glasses: Glass[] = [];
  private readonly touchdown: Touchdown;
  private readonly pools: THREE.Mesh[] = [];
  private readonly poolMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly poolGeometry: THREE.CircleGeometry;
  private readonly poolTexture: THREE.DataTexture;
  private readonly spot = new THREE.Vector3();

  constructor(dice: number) {
    this.pool = new ParticlePool(B.particles);
    this.pool.points.renderOrder = 11;
    this.group.add(this.pool.points);
    this.touchdown = new Touchdown(dice);
    // Gold light on the floor under each die: a disc, never a real light.
    this.poolGeometry = new THREE.CircleGeometry(TUNING.dieSize * 1.2, 28);
    this.poolTexture = radialFalloff();
    for (let i = 0; i < dice; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: '#ffd27a',
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
      this.glasses.push({ lx: NaN, ly: NaN, lz: NaN, driftDebt: 0, sunk: false });
    }
  }

  thrown(): void {
    this.touchdown.reset();
    for (const g of this.glasses) {
      g.lx = NaN;
      g.sunk = false;
    }
  }

  /** Into the moat: a few glints off the water, and dark. */
  sank(i: number, x: number, z: number): void {
    const g = this.glasses[i];
    if (!g || g.sunk) return;
    g.sunk = true;
    for (let n = 0; n < 14; n++) {
      this.pool.spawn(
        Kind.Glint,
        x + rand(-0.8, 0.8), WATER_Y + 0.08, z + rand(-0.8, 0.8),
        0, 0, 0,
        rand(0.3, 0.8), 0.16, 0.05, 0, 0,
      );
    }
    for (let n = 0; n < 10; n++) {
      this.pool.spawn(
        Kind.Glitter,
        x + rand(-0.5, 0.5), WATER_Y + 0.1, z + rand(-0.5, 0.5),
        rand(-0.2, 0.2), rand(0.4, 0.9), rand(-0.2, 0.2),
        rand(0.6, 1.1), 0.09, 0.02, 0.3, 1.2,
      );
    }
  }

  fishedOut(i: number): void {
    const g = this.glasses[i];
    if (g) {
      g.sunk = false;
      g.lx = NaN;
    }
  }

  /** A bauble sinks like any other die — it is the ice that holds one. */
  heldAt(): number | null {
    return null;
  }

  update(dt: number, time: number, dice: readonly DieSample[], pointScale: number): void {
    this.pool.material.uniforms.uScale.value = pointScale;
    for (let i = 0; i < this.glasses.length; i++) {
      const g = this.glasses[i];
      const d = dice[i];
      if (!d) continue;
      if (!g.sunk) {
        if (d.moving) {
          this.sheen(d);
          this.lay(g, d);
        } else {
          this.drift(g, d, dt);
        }
      } else {
        g.driftDebt = 0;
      }
      this.ring(i, g, d);
      this.paintPool(i, g, d, time);
      if (!d.moving) g.lx = NaN;
    }
    this.pool.update(dt, time);
  }

  /** One sheen a frame at the die's centre; the die hides all but the rim. */
  private sheen(d: DieSample): void {
    this.pool.spawn(
      Kind.Halo,
      d.x, d.y, d.z,
      d.vx * 0.5, d.vy * 0.5, d.vz * 0.5,
      0.22, HALF * 3.1, HALF * 2.8, 0, 3,
      0.7,
    );
  }

  /** Flecks of glitter along the path since the last one. */
  private lay(g: Glass, d: DieSample): void {
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
    const steps = Math.floor(dist / B.trailSpacing);
    for (let k = 1; k <= steps; k++) {
      const f = (k * B.trailSpacing) / dist;
      const p = this.spot.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(HALF * rand(0.9, 1.15));
      this.pool.spawn(
        Kind.Glitter,
        g.lx + dx * f + p.x, Math.max(0.04, g.ly + dy * f + p.y), g.lz + dz * f + p.z,
        rand(-0.15, 0.15), rand(0.05, 0.3), rand(-0.15, 0.15),
        B.trailLife * rand(0.7, 1.1), rand(0.07, 0.12), 0.02, 0.1, 1.5,
      );
    }
    if (steps > 0) {
      const f = (steps * B.trailSpacing) / dist;
      g.lx += dx * f;
      g.ly += dy * f;
      g.lz += dz * f;
    }
  }

  /** At rest: a few flecks a second, born outside the silhouette, drifting out. */
  private drift(g: Glass, d: DieSample, dt: number): void {
    g.driftDebt += B.driftRate * dt;
    while (g.driftDebt >= 1) {
      g.driftDebt -= 1;
      const a = Math.random() * Math.PI * 2;
      const r = HALF * rand(1.1, 1.35);
      const x = d.x + Math.cos(a) * r;
      const z = d.z + Math.sin(a) * r;
      this.pool.spawn(
        Kind.Glitter,
        x, d.y + rand(-0.6, 0.5) * HALF, z,
        (x - d.x) * 0.4, rand(0.1, 0.35), (z - d.z) * 0.4,
        rand(0.9, 1.5), rand(0.06, 0.1), 0.02, 0.15, 1.4,
      );
    }
  }

  /**
   * Where a die lands: a ring of glitter rising round it, and one bright
   * twinkle on a top corner. The corner is found from the die's own
   * rotation: of its eight corners, the one highest up and furthest out.
   */
  private ring(i: number, g: Glass, d: DieSample): void {
    const event = this.touchdown.check(i, d);
    if (!event || g.sunk) return;
    const strength = event === 'landed' ? 1 : 0.6;
    const dots = Math.round(B.ringDots * strength);
    for (let n = 0; n < dots; n++) {
      const a = (n / dots) * Math.PI * 2 + rand(-0.08, 0.08);
      this.pool.spawn(
        Kind.Glitter,
        d.x + Math.cos(a) * HALF * 1.1, 0.06, d.z + Math.sin(a) * HALF * 1.1,
        Math.cos(a) * 0.9 * strength, B.ringSpeed * strength, Math.sin(a) * 0.9 * strength,
        rand(0.6, 0.9), 0.14 * strength, 0.03, 0.4, 1.8,
        1.3,
      );
    }
    if (event !== 'landed') return;
    // The top corner: the highest of the eight, which at rest is one of
    // four at the same height, so the one toward the light (+x, +z).
    let best = -Infinity;
    let bx = 0;
    let by = 0;
    let bz = 0;
    for (let c = 0; c < 8; c++) {
      const p = this.spot.set(c & 1 ? HALF : -HALF, c & 2 ? HALF : -HALF, c & 4 ? HALF : -HALF).applyQuaternion(d.quaternion);
      const score = p.y * 4 + p.x + p.z;
      if (score > best) {
        best = score;
        bx = p.x;
        by = p.y;
        bz = p.z;
      }
    }
    this.pool.spawn(
      Kind.Flash,
      d.x + bx * 1.04, d.y + by * 1.04, d.z + bz * 1.04,
      0, 0.05, 0,
      0.55, 0.42, 0.1, 0, 2,
      1.6,
    );
  }

  private paintPool(i: number, g: Glass, d: DieSample, time: number): void {
    const mesh = this.pools[i];
    const breathe = 0.85 + 0.15 * Math.sin(time * 1.7 + i * 2.3);
    const height = Math.max(0, d.y - HALF);
    const near = Math.max(0, 1 - height * 0.3);
    const on = g.sunk ? 0 : near;
    mesh.visible = on > 0.01;
    mesh.position.set(d.x, 0.025, d.z);
    this.poolMaterials[i].opacity = B.glowOpacity * on * breathe;
  }

  dispose(): void {
    this.pool.dispose();
    this.poolGeometry.dispose();
    this.poolTexture.dispose();
    this.poolMaterials.forEach((m) => m.dispose());
  }
}
