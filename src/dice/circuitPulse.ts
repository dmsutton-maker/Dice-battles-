import * as THREE from 'three';
import { cachedTexture } from '../arena/textureCache';
import type { SceneryTick } from '../arena/sceneryClock';
import {
  CIRCUIT_ROUTES,
  createDieFaceTextures,
  cubeFace,
  dieFaceSampler,
  FACE_FRAMES,
  segDist,
  sheetToCube,
} from './patterns';

/**
 * The Circuit Board dice, with pulses running along the wires.
 *
 * David, 21 Oct 2026: "Show electrical pulses going through the circuit
 * board dice."
 *
 * The board is painted once (patterns.ts, `circuit`): the colour
 * stickers are chips, every chip's pins are wired to an edge of the die
 * where they meet the next chip's wires, and a loop runs round every
 * corner. Repainting that every frame to move a pulse would cost more
 * than the rest of the board together, so the same trick as the Fish
 * dice (fishSwim.ts): paint once, let the GPU do the moving.
 *
 * What is painted once is a WIRING MAP of each side — for every texel on
 * a wire, how far along that wire it is (0 at one chip's pin, 1 at the
 * other's), a phase so the wires are not all in step, and whether it is
 * a chip-to-chip wire or a corner loop. Each frame the shader lights the
 * part of every wire whose "how far along" matches the clock, with a
 * tail fading behind it, so a bright pulse runs from chip to chip, over
 * the edge of the die, and round the corners. The map is continuous
 * over every edge for the same reason the paint is: both sides of an
 * edge measure the same wire from the same two chips.
 *
 * Looks only. The shop card keeps the still picture, and nothing here
 * reaches the physics or the settle rule.
 */

const SIZE = 64;
const H = SIZE / 2;

/** How far along a wire a pulse travels each second, in wires. */
export const WIRE_PULSES_PER_SECOND = 0.6;
/** The same for the corner loops, which are nearly twice as long. */
export const LOOP_PULSES_PER_SECOND = 0.33;
/** How far a pulse lights the wire beyond the pulse itself, in texels. */
export const PULSE_GLOW = 2.4;

/** The clock every pulse reads, shared by both dice. */
const PULSE_TIME = { value: 0 };

/** Advances PULSE_TIME. Registered by DieMesh while a Circuit die is out. */
export const PULSE_TICK: SceneryTick = (seconds) => {
  PULSE_TIME.value = seconds;
};

/** The wiring map at one point on the die, or null when off the wires. */
export interface PulsePoint {
  /** 0 at the start of the wire, 1 at its end; the pulse runs this way. */
  along: number;
  /** 0..1, the same along the whole wire, different from the next wire's. */
  phase: number;
  /** 0 for a chip-to-chip wire, 1 for a corner loop. */
  kind: 0 | 1;
  /** 1 on the wire, fading to 0 PULSE_GLOW texels out. */
  on: number;
}

const dot3 = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const axisOf = (n: readonly number[]) => (n[0] !== 0 ? 0 : n[1] !== 0 ? 1 : 2);
const faceOf = (n: readonly number[]) => FACE_FRAMES.findIndex((F) => dot3(F.n, n) > 0.5);
const hash3 = (ix: number, iy: number, iz: number) =>
  Math.abs((Math.sin(ix * 127.1 + iy * 311.7 + iz * 74.7) * 43758.5453) % 1);

/** Arc length of a polyline. */
function routeLength(points: readonly (readonly [number, number])[]): number {
  let L = 0;
  for (let i = 1; i < points.length; i++) L += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return L;
}

const PIN_LENGTH = routeLength(CIRCUIT_ROUTES.find((r) => r.kind === 'pin')!.points);
const CORNER_LENGTH = routeLength(CIRCUIT_ROUTES.find((r) => r.kind === 'corner')!.points);
/** A chip-to-chip wire is a pin run on each of two sides. */
export const WIRE_LENGTH = PIN_LENGTH * 2;
/** A corner loop is a corner run on each of three sides. */
export const LOOP_LENGTH = CORNER_LENGTH * 3;

/** Distance from (u, v) to a polyline, and the arc length at the nearest point. */
function nearestOnRoute(u: number, v: number, points: readonly (readonly [number, number])[]): [number, number] {
  let best = Infinity;
  let at = 0;
  let sofar = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const len = Math.hypot(bx - ax, by - ay);
    const d = segDist(u, v, ax, ay, bx, by);
    if (d < best) {
      best = d;
      const t = Math.max(0, Math.min(1, ((u - ax) * (bx - ax) + (v - ay) * (by - ay)) / (len * len)));
      at = sofar + t * len;
    }
    sofar += len;
  }
  return [best, at];
}

/**
 * The wiring map at a point on the cube.
 *
 * A pin run on side `f` reaches an edge; the side over that edge, `g`,
 * has the matching run coming back to its own chip, so the two are one
 * wire of length WIRE_LENGTH. The wire runs from the lower-numbered side's
 * chip to the higher-numbered one's, and both sides measure it that way,
 * so the map agrees at the edge. The phase comes from where the wire
 * crosses the edge, a point both sides share.
 *
 * A corner run is one third of the loop round that corner, and the loop
 * is measured from the X side through the Y side to the Z side and back;
 * each side's piece is measured from the edge it shares with the side
 * before it in that order, so the thirds join up.
 */
export function pulseAt(P: readonly number[]): PulsePoint | null {
  const f = cubeFace(P);
  const F = FACE_FRAMES[f];
  const u = dot3(P, F.u);
  const v = dot3(P, F.v);
  let best = Infinity;
  let route = CIRCUIT_ROUTES[0];
  let s = 0;
  for (const r of CIRCUIT_ROUTES) {
    const [d, at] = nearestOnRoute(u, v, r.points);
    if (d < best) {
      best = d;
      route = r;
      s = at;
    }
  }
  if (best >= PULSE_GLOW) return null;
  const on = best <= 1 ? 1 : 1 - (best - 1) / (PULSE_GLOW - 1);
  const { su, sv } = route;
  const edgeNormal = route.edge === 'v' ? F.v.map((c) => c * sv) : F.u.map((c) => c * su);
  if (route.kind === 'pin') {
    const g = faceOf(edgeNormal);
    const along = f < g ? s : WIRE_LENGTH - s;
    // Where the wire crosses the edge, in whole texels: the same point
    // seen from either side.
    const [eu, ev] = route.points[route.points.length - 1];
    const E = [0, 1, 2].map((i) => H * F.n[i] + eu * F.u[i] + ev * F.v[i]);
    return { along: along / WIRE_LENGTH, phase: hash3(E[0], E[1], E[2]), kind: 0, on };
  }
  const a = axisOf(F.n);
  const prev = (a + 2) % 3;
  // The run is written from the v edge to the u edge; measure it from
  // whichever of those edges leads to the side before this one.
  const fromV = axisOf(F.v) === prev;
  const along = CORNER_LENGTH * a + (fromV ? s : CORNER_LENGTH - s);
  const C = [0, 1, 2].map((i) => H * (F.n[i] + su * F.u[i] + sv * F.v[i]));
  return { along: along / LOOP_LENGTH, phase: hash3(C[0], C[1], C[2]), kind: 1, on };
}

/**
 * The wiring map of one side, as a texture: how far along in red, the
 * phase in green, wire or loop in blue, on-the-wire in alpha. Cut from
 * the die exactly as the paint is (dieFaceSampler), so it lines up with
 * the paint texel for texel.
 */
export function circuitPulseTexture(face: number): THREE.Texture {
  return cachedTexture(`die:circuit-pulse:${face}`, () => {
    const data = new Uint8Array(SIZE * SIZE * 4);
    const at = dieFaceSampler((sx, sy) => sheetToCube(sx, sy), face);
    const N = 2;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const centre = pulseAt(at(x, y));
        // The edge of the glow is supersampled so it is soft; the map
        // itself is read at the texel's centre, where it is exact.
        let on = 0;
        for (let sy = 0; sy < N; sy++) {
          for (let sx = 0; sx < N; sx++) {
            on += pulseAt(at(x + (sx + 0.5) / N - 0.5, y + (sy + 0.5) / N - 0.5))?.on ?? 0;
          }
        }
        const i = (y * SIZE + x) * 4;
        data[i] = Math.round((centre?.along ?? 0) * 255);
        data[i + 1] = Math.round((centre?.phase ?? 0) * 255);
        data[i + 2] = (centre?.kind ?? 0) * 255;
        data[i + 3] = Math.round((on / (N * N)) * 255);
      }
    }
    const texture = new THREE.DataTexture(data, SIZE, SIZE);
    // Data, not colour: read back exactly as written. No mipmaps, which
    // would average "how far along" across wires that are not joined.
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  });
}

const DECLARE = `uniform float uPulseTime;
uniform sampler2D uPulseMap;
void main() {`;

/**
 * Light the wires: for every texel on one, how far behind the pulse it
 * is right now, a bright head fading to nothing a third of a wire back.
 * The phase spreads the wires out so they do not all fire together.
 */
const PULSE = `#include <map_fragment>
#ifdef USE_MAP
{
  vec4 pm = texture2D(uPulseMap, vMapUv);
  float speed = pm.b > 0.5 ? ${LOOP_PULSES_PER_SECOND.toFixed(4)} : ${WIRE_PULSES_PER_SECOND.toFixed(4)};
  float behind = fract(uPulseTime * speed + pm.g * 7.0 - pm.r);
  float glow = pm.a * exp(-behind * 11.0);
  diffuseColor.rgb += vec3(0.55, 1.0, 0.95) * glow * 1.7;
}
#endif`;

/**
 * Six materials for a Circuit Board die: the painted board as the map,
 * with the pulses running along its wires on the shared clock.
 */
export function pulsingCircuitMaterials(
  shade: THREE.MeshBasicMaterialParameters,
  body: string,
  ink: string,
): THREE.MeshBasicMaterial[] {
  return createDieFaceTextures('circuit', body, ink).map((map, face) => {
    const material = new THREE.MeshBasicMaterial({ map, ...shade });
    const pulseMap = circuitPulseTexture(face);
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uPulseTime = PULSE_TIME;
      shader.uniforms.uPulseMap = { value: pulseMap };
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', DECLARE)
        .replace('#include <map_fragment>', PULSE);
    };
    // Every side compiles to the one program; the map is a uniform.
    material.customProgramCacheKey = () => 'die-circuit-pulse';
    return material;
  });
}
