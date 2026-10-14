import * as THREE from 'three';

/**
 * The particle pool the Fire and Ice dice draw with.
 *
 * Moved out of diceFire.ts on 30 Sep 2026 when the Ice dice arrived:
 * one pool, one shader, one set of rules about how each kind of particle
 * moves and fades, so the two skins cannot drift apart in how they cost
 * a phone. See diceFire.ts for why the blending is what it is.
 */

/** The moat's surface, where DiceScene draws it. */
export const WATER_Y = 0.03;

// A plain object rather than a `const enum`: Metro compiles TypeScript
// file by file, and a const enum only works when the compiler can see
// every file at once.
export const Kind = {
  Flame: 0,
  Spark: 1,
  Smoke: 2,
  Steam: 3,
  Drop: 4,
  // The Ice dice's three, 30 Sep 2026.
  Mist: 5,
  Glint: 6,
  Shard: 7,
} as const;
export type Kind = (typeof Kind)[keyof typeof Kind];

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

export function rand(lo: number, hi: number): number {
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
      const wanders = k === Kind.Flame || k === Kind.Smoke || k === Kind.Steam || k === Kind.Mist;
      const wx = wanders ? Math.sin(time * 7 + this.seed[i]) * 0.9 * dt : 0;
      const wz = wanders ? Math.cos(time * 5 + this.seed[i]) * 0.5 * dt : 0;
      this.vel[p] = this.vel[p] * damp + wx;
      this.vel[p + 1] = this.vel[p + 1] * damp + this.lift[i] * dt;
      this.vel[p + 2] = this.vel[p + 2] * damp + wz;
      this.pos[p] += this.vel[p] * dt;
      this.pos[p + 1] += this.vel[p + 1] * dt;
      this.pos[p + 2] += this.vel[p + 2] * dt;
      if (
        (k === Kind.Drop && this.pos[p + 1] < WATER_Y) ||
        (k === Kind.Shard && this.pos[p + 1] < 0.02)
      ) {
        // Back into the pool it came out of, or melted on the stone.
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
      } else if (k === Kind.Mist) {
        // Cold air: pale blue-white, thin, and it sinks and spreads.
        r = 0.86; g = 0.94; b = 1;
        a = Math.min(1, t / 0.2) * (1 - t) * 0.5;
        glow = 0;
      } else if (k === Kind.Glint) {
        // A sparkle catching the light: in and out, never a smear.
        r = 0.92; g = 0.98; b = 1;
        a = Math.sin(Math.PI * t);
        glow = 0.85;
      } else if (k === Kind.Shard) {
        r = 0.8; g = 0.93; b = 1;
        a = 1 - t * t;
        glow = 0.2;
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

/**
 * A soft round spot, bright in the middle and gone at the rim, for
 * firelight on the floor and the marks a die leaves on it. Built in code because React Native has no
 * canvas, the same way the dice patterns are.
 */
export function radialFalloff(): THREE.DataTexture {
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
  mist: Kind.Mist,
  glint: Kind.Glint,
  shard: Kind.Shard,
} as const;

