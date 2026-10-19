import * as THREE from 'three';
import { cachedTexture } from '../arena/textureCache';
import type { SceneryTick } from '../arena/sceneryClock';
import { bubbleAt, FISH_FIN, FishPlace, goldfishAt, SCHOOL, waterAt } from './goldfish';
import { wrappedNoise } from './patterns';

/**
 * The Fish dice, with the fish swimming.
 *
 * David, 18 Oct 2026: "On the fish dice, can you make the fish look like
 * they're swimming around on the dice?"
 *
 * A die's sides are painted once, pixel by pixel in JavaScript, and
 * painting them again every frame would cost more than everything else
 * on the board together. So the sides are painted as WATER only, and the
 * goldfish go on two see-through layers on top — one for the school
 * swimming right, one for the school swimming left — which the GPU
 * slides across each side as the clock runs. Moving a picture costs a
 * GPU nothing; repainting it is what is expensive.
 *
 * The fish swim nose-first: a layer moves the way its fish face, so the
 * top row goes one way and the bottom row the other, each with a slow
 * bob and a little surge, the way a goldfish kicks rather than glides.
 * A fish leaving one edge of a side comes back in at the other. The
 * colour stickers are separate pieces on top (DieMesh), so the fish pass
 * under them and the game's colours are untouched.
 *
 * Looks only. The shop card still shows the still picture
 * (patterns.ts's `fish` painter), drawn from the same goldfish.ts.
 */

const SIZE = 64;

/**
 * How far the fish swim per second, in side-widths: one crossing about
 * every fifteen seconds. Slower reads as drifting; much faster and a fish
 * is gone before anyone sees it is a fish.
 */
export const FISH_SWIM_SPEED = 0.065;

/** The clock every swimming fish reads, shared by both dice. */
const FISH_TIME = { value: 0 };

/** Advances FISH_TIME. Registered by DieMesh while a Fish die is out. */
export const FISH_TICK: SceneryTick = (seconds) => {
  FISH_TIME.value = seconds;
};

/** The water, bubbles and ripple, with no fish in it. */
export function fishWaterTexture(): THREE.Texture {
  return cachedTexture('die:fish-swim:water', () => {
    const data = new Uint8Array(SIZE * SIZE * 4);
    const N = 3;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const ground = waterAt(wrappedNoise(x, y, 16));
        let sr = 0;
        let sg = 0;
        let sb = 0;
        for (let sy = 0; sy < N; sy++) {
          for (let sx = 0; sx < N; sx++) {
            const c = bubbleAt(x + (sx + 0.5) / N, y + (sy + 0.5) / N) ?? ground;
            sr += c[0];
            sg += c[1];
            sb += c[2];
          }
        }
        const i = (y * SIZE + x) * 4;
        data[i] = Math.round(sr / (N * N));
        data[i + 1] = Math.round(sg / (N * N));
        data[i + 2] = Math.round(sb / (N * N));
        data[i + 3] = 255;
      }
    }
    return finish(data, THREE.ClampToEdgeWrapping);
  });
}

/**
 * One school on a clear layer: the fish swimming `dir`, nothing else.
 *
 * Wraps sideways, so it is painted as a ring: a fish near one edge is
 * also looked for a tile to either side, and a tail cut off at the right
 * edge carries on at the left.
 */
export function fishSchoolTexture(dir: 1 | -1): THREE.Texture {
  return cachedTexture(`die:fish-swim:school:${dir}`, () => {
    const school: FishPlace[] = SCHOOL.filter((f) => f[2] === dir);
    const data = new Uint8Array(SIZE * SIZE * 4);
    const N = 3;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        let hits = 0;
        let sr = 0;
        let sg = 0;
        let sb = 0;
        for (let sy = 0; sy < N; sy++) {
          for (let sx = 0; sx < N; sx++) {
            const fx = x + (sx + 0.5) / N;
            const fy = y + (sy + 0.5) / N;
            const c =
              goldfishAt(fx, fy, school) ??
              goldfishAt(fx - SIZE, fy, school) ??
              goldfishAt(fx + SIZE, fy, school);
            if (c) {
              hits += 1;
              sr += c[0];
              sg += c[1];
              sb += c[2];
            }
          }
        }
        const i = (y * SIZE + x) * 4;
        // Open water keeps a fin colour under zero alpha, so a filtered
        // edge darkens toward the fish's own outline rather than to black.
        const c = hits ? [sr / hits, sg / hits, sb / hits] : FISH_FIN;
        data[i] = Math.round(c[0]);
        data[i + 1] = Math.round(c[1]);
        data[i + 2] = Math.round(c[2]);
        data[i + 3] = Math.round((hits / (N * N)) * 255);
      }
    }
    return finish(data, THREE.RepeatWrapping);
  });
}

function finish(data: Uint8Array, wrapS: THREE.Wrapping): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, SIZE, SIZE);
  // The same colour handling as every other die face (patterns.ts), so
  // the water matches the shop card exactly.
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = wrapS;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Six side materials for a Fish die: water as the map, both schools
 * sliding over it. Each side starts its fish at a different point, so no
 * two sides show the same moment.
 */
export function swimmingFishMaterials(
  shade: THREE.MeshBasicMaterialParameters,
): THREE.MeshBasicMaterial[] {
  const right = fishSchoolTexture(1);
  const left = fishSchoolTexture(-1);
  const water = fishWaterTexture();
  return Array.from({ length: 6 }, (_, face) => {
    const material = new THREE.MeshBasicMaterial({ map: water, ...shade });
    const phase = { value: face * 0.37 };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uFishTime = FISH_TIME;
      shader.uniforms.uFishPhase = phase;
      shader.uniforms.uFishRight = { value: right };
      shader.uniforms.uFishLeft = { value: left };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          'void main() {',
          `uniform float uFishTime;
uniform float uFishPhase;
uniform sampler2D uFishRight;
uniform sampler2D uFishLeft;
void main() {`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
#ifdef USE_MAP
{
  float ft = uFishTime;
  // Nose-first: a layer drawn facing +u slides toward +u. A slow bob,
  // and a surge in the swim so it reads as kicking, not gliding.
  float surge = sin(ft * 2.1 + uFishPhase * 11.0) * 0.012;
  float go = ft * ${FISH_SWIM_SPEED.toFixed(4)} + uFishPhase;
  vec2 bobR = vec2(0.0, sin(ft * 1.3 + uFishPhase * 7.0) * 0.018);
  vec2 bobL = vec2(0.0, sin(ft * 1.1 + uFishPhase * 5.0 + 1.7) * 0.018);
  vec4 fr = texture2D(uFishRight, vMapUv - vec2(go + surge, 0.0) - bobR);
  vec4 fl = texture2D(uFishLeft, vMapUv + vec2(go * 0.85 - surge, 0.0) - bobL);
  diffuseColor.rgb = mix(diffuseColor.rgb, fr.rgb, fr.a);
  diffuseColor.rgb = mix(diffuseColor.rgb, fl.rgb, fl.a);
}
#endif`,
        );
    };
    // Every Fish side compiles to the same program; the phase is a uniform.
    material.customProgramCacheKey = () => 'die-fish-swim';
    return material;
  });
}
