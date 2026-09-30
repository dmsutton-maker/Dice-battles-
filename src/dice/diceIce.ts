import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { MOAT, type ObstaclePlacement } from '../game/obstacles';
import { GroundMarks, Touchdown } from './groundMarks';
import { Kind, ParticlePool, rand, WATER_Y } from './particles';
import type { DieEffect, DieSample } from './dieEffect';

/**
 * The Ice dice: cold mist while they roll, frost where they land, and a
 * moat that freezes over with the die stuck half out of it.
 *
 * David, 30 Sep 2026: "can we do the same concept with ice like dice made
 * of ice and when it touches the ground, it freezes the ground around it
 * a little bit and maybe freezes the pond and you see it like half
 * sticking out of the pond frozen."
 *
 * LOOKS ONLY, exactly as the fire is. The frozen pond is a picture laid
 * over the water: the die's body still sinks through it and is fished
 * out on the same clock as any other die, and only its PICTURE is held
 * in the ice while that happens — see `heldAt`. A skin that made the
 * moat safe to land in would be a skin you could buy to win.
 *
 * Pure JavaScript and three.js, like the fire, so it ships over the air.
 */

const HALF = TUNING.dieSize / 2;
const I = TUNING.ice;

/*
  The pond's ice sheet. A shader rather than a texture swap because the
  freeze SPREADS: it starts where the die went in and races out across
  the water in a ring, with a bright front, and a picture that simply
  faded in would read as the water changing colour rather than freezing.
*/
const SHEET_VERTEX = `
  varying vec2 vLocal;
  varying vec2 vUv;
  void main() {
    vLocal = position.xy;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SHEET_FRAGMENT = `
  uniform vec2 uCenter;
  uniform float uRadius;
  uniform float uAlpha;
  uniform sampler2D uCracks;
  varying vec2 vLocal;
  varying vec2 vUv;
  void main() {
    float d = distance(vLocal, uCenter);
    float inside = 1.0 - smoothstep(uRadius - 0.12, uRadius, d);
    if (inside <= 0.0) discard;
    vec3 ice = vec3(0.80, 0.92, 0.98);
    float crack = texture2D(uCracks, vUv).r;
    vec3 color = mix(ice, vec3(1.0), crack * 0.85);
    // The freezing front runs white as it spreads.
    float front = smoothstep(uRadius - 0.3, uRadius - 0.04, d) * inside;
    color = mix(color, vec3(1.0), front * 0.7);
    gl_FragColor = vec4(color, inside * uAlpha * 0.9);
  }
`;

/** Cracks and trapped bubbles in the pond ice, painted in code. */
function paintCracks(): THREE.DataTexture {
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  const hash = (k: number) => Math.abs((Math.sin(k * 91.7) * 43758.5453) % 1);
  // Straight crack segments from a few impact points outward.
  const segments: [number, number, number, number][] = [];
  for (let c = 0; c < 4; c++) {
    const cx = hash(c * 3 + 1) * n;
    const cy = hash(c * 3 + 2) * n;
    for (let k = 0; k < 5; k++) {
      const a = hash(c * 17 + k) * Math.PI * 2;
      const len = 10 + hash(c * 29 + k) * 22;
      segments.push([cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len]);
    }
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let v = 0;
      for (const [x0, y0, x1, y1] of segments) {
        const dx = x1 - x0;
        const dy = y1 - y0;
        const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy)));
        const d = Math.hypot(x - (x0 + dx * t), y - (y0 + dy * t));
        v = Math.max(v, Math.max(0, 1 - d / 0.9) * (1 - t * 0.5));
      }
      // Bubbles frozen in the ice.
      if (hash(x * 131 + y * 7) > 0.985) v = Math.max(v, 0.7);
      const i = (y * n + x) * 4;
      const b = Math.round(v * 255);
      data[i] = b; data[i + 1] = b; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, n, n);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

interface Chill {
  /** Frozen into the pond: its picture is held at the ice. */
  held: boolean;
  mistDebt: number;
  glintDebt: number;
}

export class DiceIce implements DieEffect {
  readonly group = new THREE.Group();
  readonly hot: ParticlePool;
  readonly soft: ParticlePool;
  readonly marks: GroundMarks;
  readonly chills: Chill[];
  private readonly touchdown: Touchdown;
  private readonly spot = new THREE.Vector3();

  /** The pond's ice, or null on a round with no moat. */
  readonly sheet: THREE.Mesh | null = null;
  private readonly sheetMaterial: THREE.ShaderMaterial | null = null;
  private readonly cracks: THREE.DataTexture | null = null;
  /** Seconds since the pond froze; negative while it is water. */
  pondAge = -1;

  constructor(dice: number, readonly moat: ObstaclePlacement | null = null) {
    this.soft = new ParticlePool(I.softParticles);
    this.hot = new ParticlePool(I.hotParticles);
    this.soft.points.renderOrder = 10;
    this.hot.points.renderOrder = 11;
    this.marks = new GroundMarks('frost', moat);
    this.touchdown = new Touchdown(dice);
    this.group.add(this.marks.group, this.soft.points, this.hot.points);
    this.chills = [];
    for (let i = 0; i < dice; i++) this.chills.push({ held: false, mistDebt: 0, glintDebt: 0 });

    if (moat) {
      this.cracks = paintCracks();
      this.sheetMaterial = new THREE.ShaderMaterial({
        vertexShader: SHEET_VERTEX,
        fragmentShader: SHEET_FRAGMENT,
        uniforms: {
          uCenter: { value: new THREE.Vector2() },
          uRadius: { value: 0 },
          uAlpha: { value: 0 },
          uCracks: { value: this.cracks },
        },
        transparent: true,
        depthWrite: false,
      });
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(MOAT.size, MOAT.size), this.sheetMaterial);
      sheet.rotation.x = -Math.PI / 2;
      // Just over the water (0.03) and its foam edge (0.045).
      sheet.position.set(moat.x, WATER_Y + 0.02, moat.z);
      sheet.renderOrder = 8;
      sheet.visible = false;
      this.sheet = sheet;
      this.group.add(sheet);
    }
  }

  thrown(): void {
    this.touchdown.reset();
    this.chills.forEach((c) => (c.held = false));
  }

  /**
   * A die has gone into the moat. The pond freezes outward from where it
   * went in, and the die is caught in it.
   */
  sank(i: number, x: number, z: number): void {
    const chill = this.chills[i];
    if (!chill) return;
    chill.held = true;
    if (this.moat && this.sheetMaterial && this.sheet) {
      // Already frozen: stays frozen, and the clock starts again.
      const alreadyIce = this.pondAge >= 0 && this.pondAge < I.freezeSeconds + I.frozenSeconds;
      if (!alreadyIce) {
        // The sheet lies flat, so its local y runs along world -z.
        this.sheetMaterial.uniforms.uCenter.value.set(x - this.moat.x, -(z - this.moat.z));
        this.pondAge = 0;
      } else {
        this.pondAge = Math.min(this.pondAge, I.freezeSeconds);
      }
      this.sheet.visible = true;
    }
    // A crack of cold: a burst of mist, sparkle and chips of ice.
    for (let n = 0; n < 26; n++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(0.6, 1.8);
      this.soft.spawn(
        Kind.Mist,
        x + Math.cos(a) * 0.3, WATER_Y + rand(0.05, 0.3), z + Math.sin(a) * 0.3,
        Math.cos(a) * s, rand(0.4, 1.2), Math.sin(a) * s,
        rand(1, 1.8), 0.4, 1.3, -0.3, 1.6,
      );
    }
    for (let n = 0; n < 24; n++) {
      this.hot.spawn(
        Kind.Glint,
        x + rand(-0.9, 0.9), WATER_Y + 0.08, z + rand(-0.9, 0.9),
        0, 0, 0,
        rand(0.3, 0.8), 0.18, 0.06, 0, 0,
      );
    }
    for (let n = 0; n < 14; n++) {
      const a = Math.random() * Math.PI * 2;
      this.hot.spawn(
        Kind.Shard,
        x, WATER_Y + 0.2, z,
        Math.cos(a) * rand(1, 2.6), rand(2, 4.5), Math.sin(a) * rand(1, 2.6),
        rand(0.4, 0.7), 0.1, 0.06, -20, 0.3,
      );
    }
  }

  fishedOut(i: number): void {
    const chill = this.chills[i];
    if (chill) chill.held = false;
  }

  heldAt(i: number): number | null {
    return this.chills[i]?.held ? WATER_Y - I.heldDepth : null;
  }

  update(dt: number, time: number, dice: readonly DieSample[], pointScale: number): void {
    this.hot.material.uniforms.uScale.value = pointScale;
    this.soft.material.uniforms.uScale.value = pointScale;

    this.chills.forEach((c, i) => {
      const d = dice[i];
      if (!d) return;
      this.breathe(c, d, dt);
      this.frost(i, c, d);
    });
    this.freezePond(dt);

    this.hot.update(dt, time);
    this.soft.update(dt, time);
    this.marks.update(dt);
  }

  /** Cold mist and sparkle, off the die itself. */
  private breathe(c: Chill, d: DieSample, dt: number): void {
    if (c.held) return; // In the ice: the pond is doing the showing.
    c.mistDebt += (d.moving ? I.mistRateMoving : I.mistRateStill) * dt;
    while (c.mistDebt >= 1) {
      c.mistDebt -= 1;
      const s = this.spot;
      if (d.moving) {
        s.set(rand(-1, 1) * HALF, rand(-1, 1) * HALF, rand(-1, 1) * HALF).applyQuaternion(d.quaternion);
        s.x += d.x; s.y += d.y; s.z += d.z;
      } else {
        /*
          At rest the cold spills DOWN the sides and spreads across the
          floor — cold air sinks — born just outside the die's outline so
          nothing drifts across the face on top, which is the roll.
        */
        const a = Math.random() * Math.PI * 2;
        const r = HALF * rand(1.05, 1.25);
        s.set(d.x + Math.cos(a) * r, d.y + rand(0, 0.6) * HALF, d.z + Math.sin(a) * r);
      }
      const out = d.moving ? 0 : 0.5;
      this.soft.spawn(
        Kind.Mist,
        s.x, s.y, s.z,
        d.vx * 0.08 + rand(-0.15, 0.15) + (s.x - d.x) * out,
        d.vy * 0.05 - rand(0.05, 0.3),
        d.vz * 0.08 + rand(-0.15, 0.15) + (s.z - d.z) * out,
        rand(0.9, 1.5), 0.3, 0.95, -0.35, 1.5,
      );
    }
    c.glintDebt += I.glintRate * dt;
    while (c.glintDebt >= 1) {
      c.glintDebt -= 1;
      const s = this.spot.set(rand(-1, 1) * HALF, rand(-1, 1) * HALF, rand(-1, 1) * HALF);
      s.setComponent(Math.floor(Math.random() * 3), (Math.random() < 0.5 ? -1 : 1) * HALF * 1.02);
      s.applyQuaternion(d.quaternion);
      this.hot.spawn(
        Kind.Glint,
        d.x + s.x, d.y + s.y, d.z + s.z,
        d.vx, d.vy, d.vz,
        rand(0.25, 0.45), 0.16, 0.05, 0, 6,
      );
    }
  }

  /**
   * Frost on the ground. David: "when it touches the ground, it freezes
   * the ground around it a little bit." Where a die lands, and where it
   * comes to rest; the patches fade away on their own.
   */
  private frost(i: number, c: Chill, d: DieSample): void {
    const event = this.touchdown.check(i, d);
    if (!event || c.held) return;
    const size = I.frostSize * (event === 'landed' ? 1 : 0.85);
    if (!this.marks.stamp(d.x, d.z, size)) return;
    if (event !== 'landed') return;
    for (let n = 0; n < 8; n++) {
      const a = Math.random() * Math.PI * 2;
      this.hot.spawn(
        Kind.Shard,
        d.x + Math.cos(a) * HALF, 0.08, d.z + Math.sin(a) * HALF,
        Math.cos(a) * rand(1, 2.2), rand(1.2, 2.8), Math.sin(a) * rand(1, 2.2),
        rand(0.3, 0.5), 0.08, 0.05, -18, 0.3,
      );
    }
  }

  private freezePond(dt: number): void {
    if (!this.sheet || !this.sheetMaterial || this.pondAge < 0) return;
    this.pondAge += dt;
    const age = this.pondAge;
    const u = this.sheetMaterial.uniforms;
    // Far enough to reach every corner from anywhere in the pond.
    const across = MOAT.size * 1.5;
    const spread = Math.min(1, age / I.freezeSeconds);
    u.uRadius.value = across * (1 - Math.pow(1 - spread, 2));
    const thawFrom = I.freezeSeconds + I.frozenSeconds;
    u.uAlpha.value = age < thawFrom ? 1 : Math.max(0, 1 - (age - thawFrom) / I.thawSeconds);
    if (age >= thawFrom + I.thawSeconds) {
      this.pondAge = -1;
      this.sheet.visible = false;
    }
  }

  /** Is the pond showing ice right now — for the tests. */
  pondFrozen(): boolean {
    return this.sheet !== null && this.sheet.visible && (this.sheetMaterial?.uniforms.uAlpha.value ?? 0) > 0;
  }

  dispose(): void {
    this.hot.dispose();
    this.soft.dispose();
    this.marks.dispose();
    this.sheet?.geometry.dispose();
    this.sheetMaterial?.dispose();
    this.cracks?.dispose();
  }
}
