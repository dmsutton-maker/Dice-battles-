import * as THREE from 'three';
import { cachedTexture, paintNow, RowPainting, rowJob } from '../arena/textureCache';
import type { SceneryTick } from '../arena/sceneryClock';
import { TUNING } from '../game/tuning';
import { dieFaceSampler, OCEAN_PAINT, oceanWaveAt } from './patterns';

/**
 * The Ocean die, alive: the sea on its shell flows.
 *
 * Marc, 4 Nov 2026: "do option c with the flowing water and splash." And
 * of an earlier try on the design board: "once the water starts flowing,
 * it's going off sync so fix that."
 *
 * The shell is painted once (patterns.ts, `ocean`): long swells, shorter
 * chop riding them at an angle, and foam breaking in patches along the
 * crests, continuous round the die. Repainting that every frame to move
 * the sea would cost more than the rest of the board together, so this
 * is the Neon die's trick (neonGlow.ts): paint once, let the GPU do the
 * moving.
 *
 * What is painted once, per side, is WHERE EACH TEXEL IS ON THE WAVES:
 * the sine and cosine of its place along the swell in one map, with the
 * grain the painter stirs in (which does not move), and along the chop
 * in a second (oceanWaveAt). Sine and cosine rather than the phase
 * itself, so the GPU can slide a wave along by any amount with two
 * multiplies and the map has no seam where a phase wraps. Each frame the
 * shader adds the clock to both phases and colours the water exactly as
 * the painter does (oceanColorAt, line for line, from the same
 * OCEAN_PAINT), so the crests, the foam and the colour bands under them
 * all drift along the swell together, and the picture at the start of
 * the clock IS the still picture on the shop card.
 *
 * ONE CLOCK. The sync Marc saw go wrong is impossible here by
 * construction: every side of both dice reads the one uniform OCEAN_TIME,
 * the board's own clock wrapped to `flowSeconds`, and the swell and the
 * chop each move exactly one wave along per period, so the whole sea
 * repeats exactly every 1.8 seconds and no side can drift from another.
 *
 * The six colour stickers are separate pieces floating above the shell
 * (DieMesh), so none of this can reach them. Looks only: nothing here
 * reaches the physics or the settle rule, and the splash when a die
 * lands is diceOcean.ts.
 */

const O = TUNING.ocean;
const SIZE = 64;

/** The board's clock wrapped to one period, in seconds. Shared by every side of both dice. */
export const OCEAN_TIME = { value: 0 };

/** Where in the period the clock is: 0 at the start, back to 0 every `flowSeconds`. */
export function oceanTimeAt(seconds: number): number {
  return seconds - Math.floor(seconds / O.flowSeconds) * O.flowSeconds;
}

/** Writes the frame's one number. Registered by DieMesh while an Ocean die is out. Allocates nothing. */
export const OCEAN_TICK: SceneryTick = (seconds) => {
  OCEAN_TIME.value = oceanTimeAt(seconds);
};

/**
 * The swell map of one side, as a texture: the sine and cosine of the
 * swell's phase in red and green, -1..1 stored as 0..255, and the grain
 * in blue, 0..1 as 0..255. Cut from the die exactly as the paint is
 * (dieFaceSampler), so it lines up with the still picture texel for
 * texel and runs over every edge the way the paint does. On the top and
 * bottom the mitre blends the two sides a texel carries on from; two
 * sines and cosines blended leave the wave a little lower on that one
 * diagonal, where the paint blends two colours too.
 */
export function oceanSwellTexture(face: number): THREE.Texture {
  return cachedTexture(oceanSwellKey(face), () => paintNow(oceanMapPainting(face, swellAt)));
}

/** The chop map of one side: the sine and cosine of the chop's phase in red and green. */
export function oceanChopTexture(face: number): THREE.Texture {
  return cachedTexture(oceanChopKey(face), () => paintNow(oceanMapPainting(face, chopAt)));
}

const oceanSwellKey = (face: number) => `die:ocean-swell:${face}`;
const oceanChopKey = (face: number) => `die:ocean-chop:${face}`;

/** The same maps a row at a time, for the warm-up (warmPreviews.ts). */
export function oceanSwellJob(face: number): { step(): boolean } | null {
  return rowJob(oceanSwellKey(face), () => oceanMapPainting(face, swellAt));
}
export function oceanChopJob(face: number): { step(): boolean } | null {
  return rowJob(oceanChopKey(face), () => oceanMapPainting(face, chopAt));
}

/** The three numbers of each map at a point of the sheet, each 0..1 as the texture stores it. */
type MapSampler = (sx: number, sy: number) => [number, number, number];
const unit = (v: number) => (v + 1) / 2;
const swellAt: MapSampler = (sx, sy) => {
  const w = oceanWaveAt(sx, sy);
  return [unit(Math.sin(w.roll)), unit(Math.cos(w.roll)), w.grain];
};
const chopAt: MapSampler = (sx, sy) => {
  const w = oceanWaveAt(sx, sy);
  return [unit(Math.sin(w.rip)), unit(Math.cos(w.rip)), 0];
};

function oceanMapPainting(face: number, sample: MapSampler): RowPainting {
  const data = new Uint8Array(SIZE * SIZE * 4);
  const at = dieFaceSampler(sample, face);
  return {
    rows: SIZE,
    row(y) {
      for (let x = 0; x < SIZE; x++) {
        const v = at(x, y);
        const i = (y * SIZE + x) * 4;
        data[i] = Math.round(v[0] * 255);
        data[i + 1] = Math.round(v[1] * 255);
        data[i + 2] = Math.round(v[2] * 255);
        data[i + 3] = 255;
      }
    },
    done: () => dataTexture(data),
  };
}

function dataTexture(data: Uint8Array): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, SIZE, SIZE);
  // Data, not colour: read back exactly as written. No mipmaps, which
  // would average a sine with a cosine.
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

const DECLARE = `uniform float uOceanTime;
uniform sampler2D uOceanChop;
void main() {`;

const f = (n: number) => n.toFixed(4);
const vec3 = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `vec3(${f(((n >> 16) & 255) / 255)}, ${f(((n >> 8) & 255) / 255)}, ${f((n & 255) / 255)})`;
};

/**
 * Colour the sea. oceanColorAt (patterns.ts) with the clock added: the
 * swell is sin(roll - a) and the chop sin(rip + lift), each opened out
 * so the map's sines and cosines can be used as they are. The mixing is
 * in the painter's own space (sRGB bytes), then turned to linear light
 * for the material, which is what the painted texture would have been.
 * The painter's smoothstep runs either way; GLSL's must run upward, so
 * the one downward ramp is written as one minus the upward one.
 *
 * This REPLACES map_fragment rather than following it, as Neon's does:
 * the map here is data, not paint, and must not be multiplied in.
 */
const FLOW = `#ifdef USE_MAP
{
  vec3 swell = texture2D(map, vMapUv).rgb;
  vec2 chop = texture2D(uOceanChop, vMapUv).rg * 2.0 - 1.0;
  float grain = swell.b;
  swell = swell * 2.0 - 1.0;
  float a = uOceanTime * ${f((2 * Math.PI) / O.flowSeconds)};
  float roll = swell.r * cos(a) - swell.g * sin(a);
  float lift = roll * 0.75 - a;
  float rip = chop.r * cos(lift) + chop.g * sin(lift);
  float water = roll * 0.6 + rip * 0.4;
  vec3 sea = mix(${vec3(OCEAN_PAINT.trough)}, ${vec3(OCEAN_PAINT.deep)}, smoothstep(-1.0, -0.1, water));
  sea = mix(sea, ${vec3(OCEAN_PAINT.shallow)}, smoothstep(-0.15, 0.55, water));
  sea = mix(sea, ${vec3(OCEAN_PAINT.glass)}, smoothstep(0.5, 0.95, water));
  sea = mix(sea, ${vec3(OCEAN_PAINT.weed)}, (1.0 - smoothstep(-0.95, -0.45, water)) * 0.42);
  float ripple = grain - 0.5;
  sea = mix(sea, ripple > 0.0 ? ${vec3(OCEAN_PAINT.rippleLight)} : ${vec3(OCEAN_PAINT.rippleDark)}, abs(ripple) * 0.45);
  float breaking = smoothstep(0.3, 0.9, rip) * smoothstep(-0.15, 0.75, roll);
  float froth = min(1.0, 0.5 + grain * 0.8);
  sea = mix(sea, ${vec3(OCEAN_PAINT.foam)}, breaking * froth * 0.95);
  sea = mix(sea, ${vec3(OCEAN_PAINT.spray)}, breaking * smoothstep(0.72, 0.99, rip) * 0.8);
  diffuseColor.rgb *= sRGBTransferEOTF(vec4(sea, 1.0)).rgb;
}
#endif`;

/**
 * Six materials for an Ocean die: the swell map as the map, the chop
 * map beside it, and the sea coloured by the shader on the shared clock.
 */
export function flowingOceanMaterials(shade: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial[] {
  return [0, 1, 2, 3, 4, 5].map((face) => {
    const material = new THREE.MeshBasicMaterial({ map: oceanSwellTexture(face), ...shade });
    const chop = oceanChopTexture(face);
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uOceanTime = OCEAN_TIME;
      shader.uniforms.uOceanChop = { value: chop };
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', DECLARE)
        .replace('#include <map_fragment>', FLOW);
    };
    // Every side compiles to the one program; the maps are uniforms.
    material.customProgramCacheKey = () => 'die-ocean-flow';
    return material;
  });
}
