import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { MOAT, type ObstaclePlacement } from '../game/obstacles';
import type { DieSample } from './dieEffect';

/**
 * Marks a die leaves on the ground: scorch from the Fire dice, frost
 * from the Ice dice.
 *
 * David, 30 Sep 2026: "can the fire when it's rolling show signs of
 * charring the ground around it after it hits the ground and then you
 * could just remove the char after a few seconds", and for ice, "when it
 * touches the ground, it freezes the ground around it a little bit".
 *
 * A fixed handful of flat squares lying on the floor, each with a
 * painted splotch, that hold for a moment and then fade. Nothing is
 * allocated after construction: a mark past the limit reuses the oldest.
 */

export type MarkKind = 'scorch' | 'frost';

const M = TUNING.marks;
const SIZE = 64;

/** A cheap repeatable noise, so the splotch edge is ragged, not a circle. */
function hash(n: number): number {
  return Math.abs((Math.sin(n * 127.1) * 43758.5453) % 1);
}

function angularNoise(a: number, seed: number, lobes: number): number {
  // Sum of a few wrapped sines round the circle: smooth, and it closes.
  let v = 0;
  for (let k = 1; k <= 3; k++) {
    v += Math.sin(a * lobes * k + hash(seed + k) * 6.28) / (k * 1.6);
  }
  return v;
}

/*
  Painted in code because React Native has no canvas, the same way the
  dice patterns are. RGBA, with the shape in the alpha.
*/
function paintMark(kind: MarkKind): THREE.DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (x + 0.5) / (SIZE / 2) - 1;
      const dy = (y + 0.5) / (SIZE / 2) - 1;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const i = (y * SIZE + x) * 4;
      let R: number, G: number, B: number, A: number;
      if (kind === 'scorch') {
        // Soot: a ragged dark blot, darkest in the middle, with streaks
        // thrown outward the way a burn splashes.
        const edge = 0.62 + angularNoise(a, 3, 3) * 0.12;
        const streak = Math.pow(Math.max(0, Math.sin(a * 9 + 1.3)), 6) * 0.25;
        const reach = edge + streak;
        const t = r / reach;
        A = t >= 1 ? 0 : Math.pow(1 - t, 0.7) * 0.88;
        const v = 12 + t * 38;
        R = v + 8; G = v + 2; B = v - 2;
      } else {
        // Frost: a pale patch with crystal spikes reaching out of it.
        const spikes = Math.pow(Math.abs(Math.cos(a * 4 + angularNoise(a, 9, 2) * 0.3)), 18) * 0.34;
        const fine = Math.pow(Math.abs(Math.cos(a * 11 + 0.7)), 30) * 0.18;
        const reach = 0.5 + angularNoise(a, 11, 3) * 0.06 + spikes + fine;
        const t = r / reach;
        A = t >= 1 ? 0 : (0.55 + 0.4 * (1 - t)) * Math.min(1, (1 - t) / 0.15);
        const v = 232 + (1 - t) * 20;
        R = v - 18; G = v - 4; B = 255;
      }
      data[i] = Math.max(0, Math.min(255, Math.round(R)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(G)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(B)));
      data[i + 3] = Math.max(0, Math.min(255, Math.round(A * 255)));
    }
  }
  const texture = new THREE.DataTexture(data, SIZE, SIZE);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export class GroundMarks {
  readonly group = new THREE.Group();
  private readonly meshes: THREE.Mesh[] = [];
  private readonly materials: THREE.MeshBasicMaterial[] = [];
  /** Seconds since each mark was left; negative means unused. */
  readonly ages: number[];
  private readonly texture: THREE.DataTexture;
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private next = 0;

  constructor(readonly kind: MarkKind, readonly moat: ObstaclePlacement | null) {
    this.texture = paintMark(kind);
    this.ages = new Array(M.capacity).fill(-1);
    for (let i = 0; i < M.capacity; i++) {
      const material = new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        // The floor is a flat plane at the same height: pull the mark
        // toward the camera in depth rather than in space, so it never
        // flickers through the stone.
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.012;
      mesh.visible = false;
      // Under the dice's blob shadows (renderOrder 0, drawn later as
      // transparent) and everything else on the floor.
      mesh.renderOrder = 1;
      this.group.add(mesh);
      this.meshes.push(mesh);
      this.materials.push(material);
    }
  }

  /** Leave a mark at (x, z), unless that is over the moat. */
  stamp(x: number, z: number, size: number): boolean {
    if (overMoat(this.moat, x, z)) return false;
    const i = this.next;
    this.next = (this.next + 1) % M.capacity;
    const mesh = this.meshes[i];
    mesh.position.x = x;
    mesh.position.z = z;
    mesh.rotation.z = (x * 7.3 + z * 3.1) % (Math.PI * 2);
    mesh.scale.set(size, size, 1);
    mesh.visible = true;
    this.ages[i] = 0;
    this.materials[i].opacity = 1;
    return true;
  }

  /** How many marks are on the ground right now — for the tests. */
  showing(): number {
    return this.ages.filter((a) => a >= 0).length;
  }

  update(dt: number): void {
    for (let i = 0; i < M.capacity; i++) {
      if (this.ages[i] < 0) continue;
      this.ages[i] += dt;
      const age = this.ages[i];
      if (age >= M.holdSeconds + M.fadeSeconds) {
        this.ages[i] = -1;
        this.meshes[i].visible = false;
        continue;
      }
      const fade = age <= M.holdSeconds ? 1 : 1 - (age - M.holdSeconds) / M.fadeSeconds;
      this.materials[i].opacity = fade;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.texture.dispose();
    this.materials.forEach((m) => m.dispose());
  }
}

const HALF = TUNING.dieSize / 2;

/**
 * Notices the moment a die comes down on the ground, and the moment it
 * comes to rest — the two times it leaves a mark.
 *
 * Height rather than collision events, because the effect has no body:
 * a die whose bottom was well clear of the floor and is now touching it
 * has landed. The margins are generous enough that a die skidding along
 * the floor does not count as landing over and over.
 */
export class Touchdown {
  private airborne: boolean[];
  private resting: boolean[];

  constructor(dice: number) {
    this.airborne = new Array(dice).fill(false);
    this.resting = new Array(dice).fill(true);
  }

  /** 'landed', 'rested', or null, for die `i` this frame. */
  check(i: number, d: DieSample): 'landed' | 'rested' | null {
    const clearance = d.y - HALF;
    if (clearance > 0.25) this.airborne[i] = true;
    if (this.airborne[i] && clearance < 0.08 && d.y > -0.1) {
      this.airborne[i] = false;
      this.resting[i] = false;
      return 'landed';
    }
    if (!d.moving && !this.resting[i] && clearance < 0.08) {
      this.resting[i] = true;
      return 'rested';
    }
    if (d.moving) this.resting[i] = false;
    return null;
  }

  /** A throw: nothing has landed yet. */
  reset(): void {
    this.airborne.fill(false);
    this.resting.fill(false);
  }
}

/** Is (x, z) over this round's moat, where no mark can be left? */
export function overMoat(moat: ObstaclePlacement | null, x: number, z: number, margin = 0.2): boolean {
  if (!moat) return false;
  const reach = MOAT.size / 2 + margin;
  return Math.abs(x - moat.x) < reach && Math.abs(z - moat.z) < reach;
}
