import * as THREE from 'three';
import { cachedTexture, paintNow, RowPainting, rowJob } from '../arena/textureCache';
import type { SceneryTick } from '../arena/sceneryClock';
import { TUNING } from '../game/tuning';
import { createDieFaceTextures, dieFaceSampler, neonTubesAt, sheetToCube } from './patterns';

/**
 * The Neon die, alive: light chasing round its tubes while it sits and
 * while it rolls.
 *
 * David, 1 Nov 2026: "Change the neon dice to $0.99 and make it more
 * interactive with moving details and stuff."
 *
 * The shell is painted once (patterns.ts, `neon`): black glass with a
 * pink tube and a cyan tube, each one closed curve of glass wound right
 * round the die. Repainting that every frame to move a light would cost
 * more than the rest of the board together, so this is the Circuit
 * Board's trick (circuitPulse.ts): paint once, let the GPU do the moving.
 *
 * What is painted once is a GLOW MAP of each side — for every texel near
 * a tube, how far round the die that tube is at that point (0 at one
 * point, 1 back at the same point) and how much of the texel the tube
 * covers. Each frame the shader lights the part of each tube whose "how
 * far round" matches the clock, with a tail fading behind it, so a head
 * of light runs right round the die on the pink tube one way and on the
 * cyan tube the other, over every edge, because both sides of an edge
 * measure the same tube from the same point. On top of that the whole
 * tube breathes, drifts in colour, stutters now and then the way a real
 * sign does, sparkles where it bends over an edge, and flares the moment
 * the die lands. Four numbers a frame, worked out here in JavaScript
 * where tests/neonGlow.test.ts can check them, and read by the shader.
 *
 * The six colour stickers are separate pieces floating above the shell
 * (DieMesh), so none of this can reach them, and the map is empty under
 * them besides: the tubes keep clear of the middle of every side.
 *
 * Looks only. Nothing here reaches the physics or the settle rule, and
 * the trail and the landing ring on the floor are still diceNeon.ts.
 */

const N = TUNING.neon;
const SIZE = 64;

/** What the shader reads each frame. Shared by both dice. */
export const NEON_PULSE = { value: 0 };
export const NEON_GLOW = { value: 1 };
export const NEON_DRIFT = { value: 0 };
export const NEON_FLARE = { value: 0 };

/** Where the head of light is round each tube, 0..1, once a lap. */
export function neonPulseAt(seconds: number): number {
  const lap = seconds / N.pulseLapSeconds;
  return lap - Math.floor(lap);
}

/** The slow breath: the tube at 1 - depth .. 1 + depth of its painted brightness. */
export function neonBreathAt(seconds: number): number {
  return 1 + N.breathDepth * Math.sin((2 * Math.PI * seconds) / N.breathSeconds);
}

const hash1 = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * A real sign's stutter. Time is cut into `flickerEvery`-second slots;
 * a hash of the slot number decides whether it stutters at all and
 * where in the slot, so it is irregular but the same on every phone.
 * A stutter is three quick dips to (1 - flickerDepth), never to dark.
 */
export function neonFlickerAt(seconds: number): number {
  const slot = Math.floor(seconds / N.flickerEvery);
  if (hash1(slot) >= N.flickerChance) return 1;
  const start = hash1(slot + 0.37) * (N.flickerEvery - N.flickerSeconds);
  const t = seconds - slot * N.flickerEvery - start;
  if (t < 0 || t >= N.flickerSeconds) return 1;
  const k = Math.floor((t / N.flickerSeconds) * 6);
  return k % 2 === 0 ? 1 - N.flickerDepth : 1;
}

/** How bright the tube is right now: the breath and the stutter together. */
export function neonGlowAt(seconds: number): number {
  return neonBreathAt(seconds) * neonFlickerAt(seconds);
}

/** How far the colours have drifted, 0..1 and back, once every `driftSeconds`. */
export function neonDriftAt(seconds: number): number {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * seconds) / N.driftSeconds);
}

let lastSeconds = NaN;

/**
 * Works out the frame's four numbers. Registered by DieMesh while a
 * Neon die is out. Allocates nothing: it only writes numbers.
 */
export const NEON_TICK: SceneryTick = (seconds) => {
  NEON_PULSE.value = neonPulseAt(seconds);
  NEON_GLOW.value = neonGlowAt(seconds);
  NEON_DRIFT.value = neonDriftAt(seconds);
  // The flare fades on this clock. A jump (the first frame, the board
  // starting again after a menu) counts as no time at all.
  const dt = Number.isNaN(lastSeconds) ? 0 : Math.min(0.1, Math.max(0, seconds - lastSeconds));
  lastSeconds = seconds;
  if (NEON_FLARE.value > 0) NEON_FLARE.value = Math.max(0, NEON_FLARE.value - dt / N.flareSeconds);
};

/** A die has just come to rest: the tubes flare, then fade over `flareSeconds`. */
export function neonLanded(): void {
  NEON_FLARE.value = 1;
}

/** How much of a texel `off` texels from a tube's middle the light covers: 1 on it, 0 at `pulseReach`. */
export function neonMaskAt(off: number): number {
  if (off <= 1) return 1;
  return Math.max(0, 1 - (off - 1) / (N.pulseReach - 1));
}

/**
 * The glow map of one side, as a texture: how far round the pink tube in
 * red, round the cyan tube in green, on the pink tube in blue, on the
 * cyan tube in alpha. Cut from the die exactly as the paint is
 * (dieFaceSampler), so it lines up with the paint texel for texel.
 */
export function neonGlowTexture(face: number): THREE.Texture {
  return cachedTexture(`die:neon-glow:${face}`, () => paintNow(neonGlowPainting(face)));
}

/** The same map a row at a time, for the warm-up (warmPreviews.ts). */
export function neonGlowJob(face: number): { step(): boolean } | null {
  return rowJob(`die:neon-glow:${face}`, () => neonGlowPainting(face));
}

function neonGlowPainting(face: number): RowPainting {
  const data = new Uint8Array(SIZE * SIZE * 4);
  const at = dieFaceSampler((sx, sy) => sheetToCube(sx, sy), face);
  // 4x4 since 4 Nov 2026 (Marc: "make the neon dice less pixelated");
  // at 2x2 the head of light had a stepped edge where the tube bends.
  const SS = 4;
  return {
    rows: SIZE,
    row(y) {
      for (let x = 0; x < SIZE; x++) {
        const centre = neonTubesAt(at(x, y));
        // The edge of the light is supersampled so it is soft; "how far
        // round" is read at the texel's centre, where it is exact. A
        // texel whose middle is past the reach by more than the
        // sub-samples spread has no light at any of them, so they are
        // not measured.
        let pink = 0;
        let cyan = 0;
        const dark = Math.min(centre.pinkOff, centre.cyanOff) > N.pulseReach + 1;
        for (let sy = 0; sy < SS && !dark; sy++) {
          for (let sx = 0; sx < SS; sx++) {
            const t = neonTubesAt(at(x + (sx + 0.5) / SS - 0.5, y + (sy + 0.5) / SS - 0.5));
            pink += neonMaskAt(t.pinkOff);
            cyan += neonMaskAt(t.cyanOff);
          }
        }
        const i = (y * SIZE + x) * 4;
        data[i] = Math.round(centre.pinkAlong * 255);
        data[i + 1] = Math.round(centre.cyanAlong * 255);
        data[i + 2] = Math.round((pink / (SS * SS)) * 255);
        data[i + 3] = Math.round((cyan / (SS * SS)) * 255);
      }
    },
    done: () => {
      const texture = new THREE.DataTexture(data, SIZE, SIZE);
      // Data, not colour: read back exactly as written. No mipmaps, which
      // would average "how far round" across texels that are not on a tube.
      texture.colorSpace = THREE.NoColorSpace;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      return texture;
    },
  };
}

const DECLARE = `uniform float uNeonPulse;
uniform float uNeonGlow;
uniform float uNeonDrift;
uniform float uNeonFlare;
uniform sampler2D uNeonMap;
void main() {`;

const f = (n: number) => n.toFixed(4);

/**
 * Light the tubes. The paint under a tube is tinted by the drift and
 * scaled by the breath and the stutter; then the head of light is added
 * where the clock has reached on each tube, white-hot at the very head
 * and the tube's own colour down the tail fading behind it;
 * then the sparkle at the bends and the landing flare, which lift
 * everything the map says is tube.
 */
const GLOW = `#include <map_fragment>
#ifdef USE_MAP
{
  vec4 nm = texture2D(uNeonMap, vMapUv);
  float onTube = max(nm.b, nm.a);
  vec3 tint = mix(vec3(1.0), vec3(0.6, 0.75, 1.25), nm.b * uNeonDrift * ${f(N.driftAmount)});
  tint = mix(tint, vec3(0.75, 0.85, 1.15), nm.a * uNeonDrift * ${f(N.driftAmount)});
  diffuseColor.rgb *= tint * mix(1.0, uNeonGlow, onTube);
  float pinkBehind = fract(uNeonPulse - nm.r);
  float cyanBehind = fract(uNeonPulse - nm.g);
  float pinkHead = nm.b * exp(-pinkBehind * ${f(N.pulseTail)});
  float cyanHead = nm.a * exp(-cyanBehind * ${f(N.pulseTail)});
  vec3 pink = vec3(1.0, 0.25, 0.7);
  vec3 cyan = vec3(0.25, 0.9, 1.0);
  float lit = uNeonGlow * (1.0 + uNeonFlare * ${f(N.flareGain)});
  diffuseColor.rgb += ((pink + 0.8 * pinkHead) * pinkHead + (cyan + 0.8 * cyanHead) * cyanHead) * ${f(N.pulseGain)} * lit;
  float toEdge = min(min(vMapUv.x, 1.0 - vMapUv.x), min(vMapUv.y, 1.0 - vMapUv.y));
  float bend = smoothstep(${f(N.bendReach)}, 0.0, toEdge) * onTube;
  diffuseColor.rgb += vec3(1.0, 0.95, 1.0) * bend * ${f(N.bendGain)} * lit;
  diffuseColor.rgb += (pink * nm.b + cyan * nm.a) * uNeonFlare * ${f(N.flareGain * 0.5)};
}
#endif`;

/**
 * Six materials for a Neon die: the painted glass as the map, with the
 * light running round its tubes on the shared clock.
 */
export function glowingNeonMaterials(
  shade: THREE.MeshBasicMaterialParameters,
  body: string,
  ink: string,
): THREE.MeshBasicMaterial[] {
  return createDieFaceTextures('neon', body, ink).map((map, face) => {
    const material = new THREE.MeshBasicMaterial({ map, ...shade });
    const glowMap = neonGlowTexture(face);
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uNeonPulse = NEON_PULSE;
      shader.uniforms.uNeonGlow = NEON_GLOW;
      shader.uniforms.uNeonDrift = NEON_DRIFT;
      shader.uniforms.uNeonFlare = NEON_FLARE;
      shader.uniforms.uNeonMap = { value: glowMap };
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', DECLARE)
        .replace('#include <map_fragment>', GLOW);
    };
    // Every side compiles to the one program; the map is a uniform.
    material.customProgramCacheKey = () => 'die-neon-glow';
    return material;
  });
}
