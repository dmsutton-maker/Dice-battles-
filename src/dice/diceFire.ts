import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { GroundMarks, Touchdown } from './groundMarks';
import type { ObstaclePlacement } from '../game/obstacles';
import { Kind, ParticlePool, radialFalloff, rand, WATER_Y } from './particles';
import type { DieEffect, DieSample } from './dieEffect';

export type { DieSample } from './dieEffect';
export { PARTICLE_KIND } from './particles';

/**
 * The Fire dice: flames while they roll, and steam when one goes under.
 *
 * David, 29 Sep 2026, after seeing a preview page: "make a pair of dice
 * that are on fire where it shows flames coming up from the dice while
 * they're doing it. And if it lands in the water, then it shows the fire
 * going out and you know smoke coming up." Then: "do an over the air
 * update to add the flaming dice so we could see it in the real game."
 *
 * LOOKS ONLY. Nothing here has a body in the physics world, and nothing
 * in settle.ts can see it. The dice are read exactly as every other skin
 * is read, and the fire cannot hide a face: flames are born on the SHELL
 * and pulled upward, the faces are unlit stickers drawn at full colour,
 * and the burning stops the moment a die is doused.
 *
 * PURE JAVASCRIPT AND THREE.JS. No native module, no new package — a
 * point cloud and a small shader, which is why this can go out over the
 * air to the binary already on the phone. See AGENTS.md on why that
 * distinction matters.
 *
 * NOT REACT. DiceScene owns the frame loop and already knows where every
 * die is, when a throw starts and when one sinks, so it hands those
 * facts in and this does the drawing. Keeping it a plain class also lets
 * tests/fire.test.ts drive it in node.
 */


const HALF = TUNING.dieSize / 2;


interface Burner {
  /** 0 is out, 1 is a die in full flight. */
  heat: number;
  /** Burning at all. False from a dousing until the next throw. */
  lit: boolean;
  /** Under the water right now, between the splash and being fished out. */
  underwater: boolean;
  /** Seconds of steam still to come off the pool. */
  steam: number;
  /** Seconds of smoke still to come off a doused die back on the board. */
  smoulder: number;
  /** Where it went in, so the steam comes off the water, not the die. */
  splashX: number;
  splashZ: number;
  flameDebt: number;
  smokeDebt: number;
  steamDebt: number;
}

const F = TUNING.fire;

export class DiceFire implements DieEffect {
  /** Add this to the scene. Everything the fire draws is inside it. */
  readonly group = new THREE.Group();
  readonly hot: ParticlePool;
  readonly soft: ParticlePool;
  readonly burners: Burner[];
  private readonly glows: THREE.Mesh[];
  private readonly glowMaterials: THREE.MeshBasicMaterial[];
  private readonly glowGeometry: THREE.CircleGeometry;
  private readonly glowTexture: THREE.DataTexture;
  private readonly spot = new THREE.Vector3();

  /** Scorch where a burning die comes down. */
  readonly marks: GroundMarks;
  private readonly touchdown: Touchdown;

  constructor(dice: number, moat: ObstaclePlacement | null = null) {
    this.soft = new ParticlePool(F.softParticles);
    this.hot = new ParticlePool(F.hotParticles);
    // Smoke first, so the flames sit on top of it.
    this.soft.points.renderOrder = 10;
    this.hot.points.renderOrder = 11;
    this.marks = new GroundMarks('scorch', moat);
    this.touchdown = new Touchdown(dice);
    this.group.add(this.marks.group, this.soft.points, this.hot.points);

    /*
      FIRELIGHT WITHOUT A LIGHT.

      A real point light per die would light the floor properly, and it
      would also change the light count every material in the scene is
      compiled for — so equipping the skin, or opening its preview, would
      recompile the whole arena mid-frame. A warm additive disc on the
      floor under each die reads as the same glow and costs nothing.
    */
    this.glowGeometry = new THREE.CircleGeometry(TUNING.dieSize * 1.1, 28);
    const falloff = radialFalloff();
    this.glowTexture = falloff;
    this.glowMaterials = [];
    this.glows = [];
    this.burners = [];
    for (let i = 0; i < dice; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: '#ff6a1a',
        alphaMap: falloff,
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
      this.burners.push({
        heat: F.stillHeat,
        lit: true,
        underwater: false,
        steam: 0,
        smoulder: 0,
        splashX: 0,
        splashZ: 0,
        flameDebt: 0,
        smokeDebt: 0,
        steamDebt: 0,
      });
    }
  }

  /**
   * A throw. Every die is burning again as it leaves the hand, including
   * one that was put out last roll — a whoosh as it catches.
   */
  // The DieEffect names. The fire's own words for the same three moments
  // are below, and are what the tests read.
  thrown(dice: readonly DieSample[]): void {
    this.relight(dice);
  }
  sank(i: number, x: number, z: number): void {
    this.douse(i, x, z);
  }
  fishedOut(i: number): void {
    this.surface(i);
  }
  /** A burning die sinks like any other — it is the ice that holds one. */
  heldAt(): number | null {
    return null;
  }

  relight(dice: readonly DieSample[]): void {
    this.touchdown.reset();
    this.burners.forEach((b, i) => {
      const caught = !b.lit;
      b.lit = true;
      b.underwater = false;
      b.smoulder = 0;
      b.heat = 1;
      const d = dice[i];
      if (caught && d) {
        for (let n = 0; n < 30; n++) {
          this.hot.spawn(
            Kind.Flame,
            d.x + rand(-HALF, HALF), d.y + rand(-HALF, HALF), d.z + rand(-HALF, HALF),
            rand(-1.2, 1.2), rand(1.5, 3.5), rand(-1.2, 1.2),
            rand(0.3, 0.55), 0.55, 0.12, F.flameLift, 1.4,
          );
        }
      }
    });
  }

  /** A die has just gone under in the moat. The fire goes out. */
  douse(i: number, x: number, z: number): void {
    const b = this.burners[i];
    if (!b || b.underwater) return;
    b.underwater = true;
    b.lit = false;
    b.steam = F.steamSeconds;
    b.splashX = x;
    b.splashZ = z;

    // The splash.
    for (let n = 0; n < 34; n++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(1.5, 4);
      this.soft.spawn(
        Kind.Drop,
        x + Math.cos(a) * 0.3, WATER_Y + 0.05, z + Math.sin(a) * 0.3,
        Math.cos(a) * s, rand(3, 7.5), Math.sin(a) * s,
        rand(0.5, 0.9), 0.1, 0.05, -26, 0.3,
      );
    }
    // A big white whoosh of steam — only as hot as the fire was.
    const burst = Math.round(20 + 40 * b.heat);
    for (let n = 0; n < burst; n++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.5;
      this.soft.spawn(
        Kind.Steam,
        x + Math.cos(a) * r, WATER_Y + rand(0.1, 0.4), z + Math.sin(a) * r,
        Math.cos(a) * rand(0.6, 1.6), rand(2, 4.5), Math.sin(a) * rand(0.6, 1.6),
        rand(1.4, 2.6), 0.55, rand(1.9, 2.7), 1.2, 1.4,
      );
    }
    // A dark puff as the flames die.
    for (let n = 0; n < 12; n++) {
      this.soft.spawn(
        Kind.Smoke,
        x + rand(-0.3, 0.3), WATER_Y + rand(0.3, 0.8), z + rand(-0.3, 0.3),
        rand(-0.4, 0.4), rand(1.6, 3), rand(-0.4, 0.4),
        rand(1.2, 2), 0.45, 1.5, 0.9, 1.2, 0.8,
      );
    }
    // The last sparks thrown off.
    for (let n = 0; n < 20; n++) {
      this.hot.spawn(
        Kind.Spark,
        x, WATER_Y + 0.3, z,
        rand(-2.5, 2.5), rand(2, 6), rand(-2.5, 2.5),
        rand(0.3, 0.7), 0.08, 0.03, -14, 0.6,
      );
    }
  }

  /**
   * Fished out of the moat and back on the board. Out, and smoking,
   * until the next throw lights it again.
   */
  surface(i: number): void {
    const b = this.burners[i];
    if (!b) return;
    b.underwater = false;
    b.lit = false;
    b.heat = 0;
    b.smoulder = F.smoulderSeconds;
  }

  /**
   * One frame.
   *
   * `pointScale` turns a sprite's size in world units into pixels at
   * one unit from the camera: the drawing buffer's height over twice
   * the tangent of half the field of view.
   */
  update(dt: number, time: number, dice: readonly DieSample[], pointScale: number): void {
    this.hot.material.uniforms.uScale.value = pointScale;
    this.soft.material.uniforms.uScale.value = pointScale;

    this.burners.forEach((b, i) => {
      const d = dice[i];
      if (!d) return;

      if (b.underwater) {
        b.heat = Math.max(0, b.heat - F.quenchRate * dt);
      } else if (b.lit) {
        const target = d.moving ? 1 : F.stillHeat;
        b.heat += (target - b.heat) * Math.min(1, dt * 1.5);
      }

      this.burnFlames(b, d, dt);
      this.burnSmoke(b, d, dt);
      this.steamPool(b, dt);
      this.paintGlow(i, b, d, time);
      this.scorch(i, b, d);
    });

    this.hot.update(dt, time);
    this.soft.update(dt, time);
    this.marks.update(dt);
  }

  private burnFlames(b: Burner, d: DieSample, dt: number): void {
    if (b.heat <= 0.01) {
      b.flameDebt = 0;
      return;
    }
    b.flameDebt += b.heat * (d.moving ? F.flameRateMoving : F.flameRateStill) * dt;
    const hotter = 0.7 + 0.3 * b.heat;
    while (b.flameDebt >= 1) {
      b.flameDebt -= 1;
      const s = this.spot;
      if (d.moving) {
        // In flight: anywhere on the shell — pick a face, then a spot on
        // it — so the whole die burns and the fire trails behind it.
        s.set(rand(-1, 1) * HALF, rand(-1, 1) * HALF, rand(-1, 1) * HALF);
        s.setComponent(Math.floor(Math.random() * 3), (Math.random() < 0.5 ? -1 : 1) * HALF);
        s.applyQuaternion(d.quaternion);
        s.x += d.x; s.y += d.y; s.z += d.z;
        // The underside cannot burn into the floor, so it licks up the sides.
        if (s.y < d.y - HALF * 0.3) s.y = d.y + rand(-0.1, 0.4) * HALF;
      } else {
        /*
          AT REST: A RING ROUND THE SIDES, NEVER OVER THE TOP.

          The face on top is the roll, and the game's camera looks almost
          straight down at it. The first version burned from every face
          at rest as well, and in the first render of the real arena the
          top sticker had a yellow flame sitting on it — the one thing
          this skin must never do. So once a die is still its flames are
          born just outside its silhouette, all the way round, and rise
          from there.
        */
        const a = Math.random() * Math.PI * 2;
        const r = HALF * rand(1.05, 1.3);
        s.set(d.x + Math.cos(a) * r, d.y + rand(-0.6, 0.4) * HALF, d.z + Math.sin(a) * r);
      }
      if (b.underwater && s.y < WATER_Y + 0.02) continue;
      /*
        Still flames lean outward, away from the top face, and get NO
        random sideways push. They used to get the same ±0.25 jitter as
        a flame in flight, which is bigger than the lean — so now and
        then one drifted back in over the face on top. Found by the
        suite, one flame in forty-five, on an unlucky run.
      */
      const out = d.moving ? 0 : 0.45;
      const jitter = d.moving ? 0.25 : 0;
      this.hot.spawn(
        Kind.Flame,
        s.x, s.y, s.z,
        d.vx * F.inherit + rand(-jitter, jitter) + (s.x - d.x) * out,
        d.vy * F.inherit * 0.6 + rand(F.flameRise[0], F.flameRise[1]),
        d.vz * F.inherit + rand(-jitter, jitter) + (s.z - d.z) * out,
        rand(F.flameLife[0], F.flameLife[1]) * hotter,
        rand(F.flameSize[0], F.flameSize[0] + 0.3) * hotter,
        F.flameSize[1], F.flameLift, 2.2,
      );
    }
    if (Math.random() < dt * 6 * b.heat) {
      this.hot.spawn(
        Kind.Spark,
        d.x, d.y + 0.3, d.z,
        rand(-0.75, 0.75), rand(2, 4.5), rand(-0.75, 0.75),
        rand(0.5, 1), 0.07, 0.02, 1.5, 0.8,
      );
    }
  }

  private burnSmoke(b: Burner, d: DieSample, dt: number): void {
    // Thin smoke off the flame tips while it burns, and off the charred
    // shell for a while after it has been put out.
    const smouldering = !b.lit && !b.underwater && b.smoulder > 0;
    if (smouldering) b.smoulder = Math.max(0, b.smoulder - dt);
    const rate = b.heat * 7 + (smouldering ? 10 * (b.smoulder / F.smoulderSeconds) : 0);
    b.smokeDebt += rate * dt;
    while (b.smokeDebt >= 1) {
      b.smokeDebt -= 1;
      const from = smouldering ? d.y + HALF : d.y + 0.9;
      this.soft.spawn(
        Kind.Smoke,
        d.x + rand(-0.2, 0.2), from + rand(0, 0.4), d.z + rand(-0.2, 0.2),
        rand(-0.15, 0.15), rand(1.1, 1.7), rand(-0.15, 0.15),
        rand(1.6, 2.4), 0.35, 1.3, 0.5, 0.9, smouldering ? 0.7 : 0.5,
      );
    }
  }

  private steamPool(b: Burner, dt: number): void {
    // Steam keeps curling off the water for a few seconds after, even
    // once the die has been fished out — the pool is still hot.
    if (b.steam <= 0) return;
    b.steam = Math.max(0, b.steam - dt);
    b.steamDebt += 26 * Math.pow(b.steam / F.steamSeconds, 1.5) * dt;
    while (b.steamDebt >= 1) {
      b.steamDebt -= 1;
      this.soft.spawn(
        Kind.Steam,
        b.splashX + rand(-0.4, 0.4), WATER_Y + 0.08, b.splashZ + rand(-0.4, 0.4),
        rand(-0.18, 0.18), rand(0.9, 1.8), rand(-0.18, 0.18),
        rand(1.8, 3), 0.4, rand(1.6, 2.2), 0.6, 1, 0.9,
      );
    }
  }

  /*
    CHARRING THE GROUND. David, 30 Sep 2026: "can the fire when it's
    rolling show signs of charring the ground around it after it hits
    the ground and then you could just remove the char after a few
    seconds." A burning die that comes down leaves soot, with a puff of
    sparks and smoke off the impact; so does one that comes to rest,
    under where it stops. The marks fade on their own — see GroundMarks.
  */
  private scorch(i: number, b: Burner, d: DieSample): void {
    const event = this.touchdown.check(i, d);
    if (!event || b.heat < 0.3 || b.underwater) return;
    const size = F.scorchSize * (event === 'landed' ? 1 : 0.85) * (0.7 + 0.3 * b.heat);
    if (!this.marks.stamp(d.x, d.z, size)) return;
    if (event !== 'landed') return;
    for (let n = 0; n < 12; n++) {
      const a = Math.random() * Math.PI * 2;
      this.hot.spawn(
        Kind.Spark,
        d.x + Math.cos(a) * HALF, 0.1, d.z + Math.sin(a) * HALF,
        Math.cos(a) * rand(1.5, 3), rand(1.5, 3.5), Math.sin(a) * rand(1.5, 3),
        rand(0.25, 0.5), 0.07, 0.02, -12, 0.8,
      );
    }
    for (let n = 0; n < 5; n++) {
      const a = Math.random() * Math.PI * 2;
      this.soft.spawn(
        Kind.Smoke,
        d.x + Math.cos(a) * HALF * 1.2, 0.15, d.z + Math.sin(a) * HALF * 1.2,
        Math.cos(a) * 0.8, rand(0.4, 0.9), Math.sin(a) * 0.8,
        rand(1, 1.6), 0.4, 1.2, 0.3, 1.2, 0.6,
      );
    }
  }

  private paintGlow(i: number, b: Burner, d: DieSample, time: number): void {
    const glow = this.glows[i];
    const flicker = 0.85 + 0.15 * Math.sin(time * 23 + i * 7) * Math.sin(time * 13.7 + i);
    // Fades as the die rises, the way its shadow does.
    const height = Math.max(0, d.y - HALF);
    const near = Math.max(0, 1 - height * 0.3);
    const on = b.underwater ? 0 : b.heat * near;
    glow.visible = on > 0.01;
    glow.position.set(d.x, 0.025, d.z);
    this.glowMaterials[i].opacity = 0.55 * on * flicker;
  }

  dispose(): void {
    this.hot.dispose();
    this.marks.dispose();
    this.soft.dispose();
    this.glowGeometry.dispose();
    this.glowTexture.dispose();
    this.glowMaterials.forEach((m) => m.dispose());
  }
}
