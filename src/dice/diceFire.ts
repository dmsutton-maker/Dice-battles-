import * as THREE from 'three';
import { TUNING } from '../game/tuning';

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

/** What the fire needs to know about one die, each frame. */
export interface DieSample {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  quaternion: THREE.Quaternion;
  /** Still tumbling, as opposed to at rest on the board. */
  moving: boolean;
}

const HALF = TUNING.dieSize / 2;
/** The moat's surface, where DiceScene draws it. */
const WATER_Y = 0.03;

// A plain object rather than a `const enum`: Metro compiles TypeScript
// file by file, and a const enum only works when the compiler can see
// every file at once.
const Kind = { Flame: 0, Spark: 1, Smoke: 2, Steam: 3, Drop: 4 } as const;
type Kind = (typeof Kind)[keyof typeof Kind];

/*
  One soft round sprite per particle. The blending is premultiplied, so
  `aGlow` slides a particle between ordinary (smoke, steam: it covers
  what is behind it) and additive (the hot middle of a flame: it lights
  what is behind it). All-additive fire washes out to white over a pale
  floor, and all-ordinary fire looks like orange paper.
*/
const VERTEX = `
  attribute float aSize;
  attribute vec4 aColor;
  attribute float aGlow;
  uniform float uScale;
  varying vec4 vColor;
  varying float vGlow;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
    vColor = aColor;
    vGlow = aGlow;
  }
`;
const FRAGMENT = `
  varying vec4 vColor;
  varying float vGlow;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = 1.0 - d * d;
    a *= a;
    float alpha = vColor.a * a;
    gl_FragColor = vec4(vColor.rgb * alpha, alpha * (1.0 - vGlow));
  }
`;

/** Flame colour over its life: white-hot, yellow, orange, red, soot. */
const FLAME_RAMP: readonly (readonly [number, number, number, number])[] = [
  [0, 1, 0.97, 0.8],
  [0.18, 1, 0.8, 0.28],
  [0.45, 1, 0.44, 0.07],
  [0.75, 0.82, 0.17, 0.04],
  [1, 0.3, 0.07, 0.03],
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rand(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

/**
 * A fixed pool of particles, recycled oldest-first.
 *
 * Fixed because it runs every frame on a phone: nothing is allocated
 * after construction, and a burst that asks for more than the pool holds
 * simply reuses the oldest slots rather than growing.
 */
export class ParticlePool {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
  private next = 0;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly age: Float32Array;
  /** Seconds to live; negative means the slot is free. */
  readonly life: Float32Array;
  private readonly s0: Float32Array;
  private readonly s1: Float32Array;
  private readonly lift: Float32Array;
  private readonly drag: Float32Array;
  private readonly kind: Uint8Array;
  private readonly strength: Float32Array;
  private readonly seed: Float32Array;
  private readonly color: Float32Array;
  private readonly size: Float32Array;
  private readonly glow: Float32Array;
  private readonly attrs: THREE.BufferAttribute[];

  constructor(readonly capacity: number) {
    const n = capacity;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.age = new Float32Array(n);
    this.life = new Float32Array(n).fill(-1);
    this.s0 = new Float32Array(n);
    this.s1 = new Float32Array(n);
    this.lift = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.kind = new Uint8Array(n);
    this.strength = new Float32Array(n);
    this.seed = new Float32Array(n);
    this.color = new Float32Array(n * 4);
    this.size = new Float32Array(n);
    this.glow = new Float32Array(n);

    const geometry = new THREE.BufferGeometry();
    const position = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    const color = new THREE.BufferAttribute(this.color, 4).setUsage(THREE.DynamicDrawUsage);
    const size = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    const glow = new THREE.BufferAttribute(this.glow, 1).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', position);
    geometry.setAttribute('aColor', color);
    geometry.setAttribute('aSize', size);
    geometry.setAttribute('aGlow', glow);
    this.attrs = [position, color, size, glow];

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uScale: { value: 400 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.points = new THREE.Points(geometry, this.material);
    // Particles wander far from where the geometry was built; culling
    // them by its bounding sphere would blink the fire out at random.
    this.points.frustumCulled = false;
  }

  spawn(
    kind: Kind,
    x: number, y: number, z: number,
    vx: number, vy: number, vz: number,
    life: number,
    sizeFrom: number, sizeTo: number,
    lift: number, drag: number,
    strength = 1,
  ): void {
    const i = this.next;
    this.next = (this.next + 1) % this.capacity;
    const p = i * 3;
    this.pos[p] = x; this.pos[p + 1] = y; this.pos[p + 2] = z;
    this.vel[p] = vx; this.vel[p + 1] = vy; this.vel[p + 2] = vz;
    this.age[i] = 0;
    this.life[i] = life;
    this.s0[i] = sizeFrom;
    this.s1[i] = sizeTo;
    this.lift[i] = lift;
    this.drag[i] = drag;
    this.kind[i] = kind;
    this.strength[i] = strength;
    this.seed[i] = Math.random() * 100;
  }

  /** How many slots are in use — for the tests. */
  alive(): number {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) if (this.life[i] >= 0) n++;
    return n;
  }

  /** Count live particles of one kind — for the tests. */
  aliveOf(kind: Kind): number {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) if (this.life[i] >= 0 && this.kind[i] === kind) n++;
    return n;
  }

  update(dt: number, time: number): void {
    for (let i = 0; i < this.capacity; i++) {
      const c = i * 4;
      if (this.life[i] < 0) {
        this.size[i] = 0;
        this.color[c + 3] = 0;
        continue;
      }
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      if (t >= 1) {
        this.life[i] = -1;
        this.size[i] = 0;
        this.color[c + 3] = 0;
        continue;
      }
      const k = this.kind[i];
      const p = i * 3;
      const damp = Math.exp(-this.drag[i] * dt);
      // A little sideways wander, so flames lick rather than rise in a
      // column and smoke curls rather than climbing a pole.
      const wanders = k === Kind.Flame || k === Kind.Smoke || k === Kind.Steam;
      const wx = wanders ? Math.sin(time * 7 + this.seed[i]) * 0.9 * dt : 0;
      const wz = wanders ? Math.cos(time * 5 + this.seed[i]) * 0.5 * dt : 0;
      this.vel[p] = this.vel[p] * damp + wx;
      this.vel[p + 1] = this.vel[p + 1] * damp + this.lift[i] * dt;
      this.vel[p + 2] = this.vel[p + 2] * damp + wz;
      this.pos[p] += this.vel[p] * dt;
      this.pos[p + 1] += this.vel[p + 1] * dt;
      this.pos[p + 2] += this.vel[p + 2] * dt;
      if (k === Kind.Drop && this.pos[p + 1] < WATER_Y) {
        // Back into the pool it came out of.
        this.life[i] = -1;
        this.size[i] = 0;
        this.color[c + 3] = 0;
        continue;
      }

      let r: number, g: number, b: number, a: number, glow: number;
      if (k === Kind.Flame) {
        let s = 1;
        while (s < FLAME_RAMP.length - 1 && t > FLAME_RAMP[s][0]) s++;
        const lo = FLAME_RAMP[s - 1];
        const hi = FLAME_RAMP[s];
        const u = Math.min(1, Math.max(0, (t - lo[0]) / (hi[0] - lo[0])));
        r = lerp(lo[1], hi[1], u); g = lerp(lo[2], hi[2], u); b = lerp(lo[3], hi[3], u);
        a = Math.min(1, t / 0.08) * Math.pow(1 - t, 1.1);
        /*
          Mostly COVERING, only a little additive, and only while young.
          The first version was two-thirds additive, as the preview page
          was — and the preview page had dark stone. On the castle's pale
          flagstones orange added to cream is white, and the fire all but
          vanished in the first render of the real arena.
        */
        glow = lerp(0.3, 0, t);
      } else if (k === Kind.Spark) {
        r = 1; g = lerp(0.85, 0.4, t); b = lerp(0.45, 0.1, t);
        a = 1 - t;
        glow = 0.9;
      } else if (k === Kind.Smoke) {
        const v = lerp(0.42, 0.62, t);
        r = v; g = v * 0.97; b = v * 0.95;
        a = Math.min(1, t / 0.15) * (1 - t) * 0.55;
        glow = 0;
      } else if (k === Kind.Steam) {
        const v = lerp(0.98, 0.86, t);
        r = v; g = v; b = Math.min(1, v * 1.02);
        a = Math.min(1, t / 0.1) * Math.pow(1 - t, 1.4) * 0.62;
        glow = 0;
      } else {
        r = 0.78; g = 0.92; b = 1;
        a = (1 - t) * 0.9;
        glow = 0.1;
      }
      this.color[c] = r;
      this.color[c + 1] = g;
      this.color[c + 2] = b;
      this.color[c + 3] = a * this.strength[i];
      this.glow[i] = glow;
      this.size[i] = lerp(this.s0[i], this.s1[i], t);
    }
    for (const attr of this.attrs) attr.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

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

export class DiceFire {
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

  constructor(dice: number) {
    this.soft = new ParticlePool(F.softParticles);
    this.hot = new ParticlePool(F.hotParticles);
    // Smoke first, so the flames sit on top of it.
    this.soft.points.renderOrder = 10;
    this.hot.points.renderOrder = 11;
    this.group.add(this.soft.points, this.hot.points);

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
  relight(dice: readonly DieSample[]): void {
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
    });

    this.hot.update(dt, time);
    this.soft.update(dt, time);
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
      // Still flames lean a little outward, away from the top face.
      const out = d.moving ? 0 : 0.35;
      this.hot.spawn(
        Kind.Flame,
        s.x, s.y, s.z,
        d.vx * F.inherit + rand(-0.25, 0.25) + (s.x - d.x) * out,
        d.vy * F.inherit * 0.6 + rand(F.flameRise[0], F.flameRise[1]),
        d.vz * F.inherit + rand(-0.25, 0.25) + (s.z - d.z) * out,
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
    this.soft.dispose();
    this.glowGeometry.dispose();
    this.glowTexture.dispose();
    this.glowMaterials.forEach((m) => m.dispose());
  }
}

/**
 * A soft round spot, bright in the middle and gone at the rim, for the
 * firelight on the floor. Built in code because React Native has no
 * canvas, the same way the dice patterns are.
 */
function radialFalloff(): THREE.DataTexture {
  const n = 32;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
      const v = Math.round(255 * Math.pow(Math.max(0, 1 - d), 2));
      const i = (y * n + x) * 4;
      // An alphaMap is read from the green channel.
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, n, n);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Exposed for the tests, which check each kind separately. */
export const PARTICLE_KIND = {
  flame: Kind.Flame,
  spark: Kind.Spark,
  smoke: Kind.Smoke,
  steam: Kind.Steam,
  drop: Kind.Drop,
} as const;
