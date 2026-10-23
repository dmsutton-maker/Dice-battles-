import * as THREE from 'three';
import { cachedTexture } from '../arena/textureCache';
import type { SceneryTick } from '../arena/sceneryClock';
import { FISH_FIN, FishPlace, goldfishAt } from './goldfish';
import { DIE_FACE_SLOTS, dieFaceSampler, fishWaterAt, sheetToCube } from './patterns';

/**
 * The Fish dice, with the fish swimming.
 *
 * David, 18 Oct 2026: "On the fish dice, can you make the fish look like
 * they're swimming around on the dice?"
 *
 * A die's sides are painted once, pixel by pixel in JavaScript, and
 * painting them again every frame would cost more than everything else
 * on the board together. So the sides are painted as WATER only, and the
 * goldfish go on see-through layers on top which the GPU slides across
 * each side as the clock runs. Moving a picture costs a GPU nothing;
 * repainting it is what is expensive.
 *
 * ROUND THE WHOLE DIE since 21 Oct 2026 (David: "Make sure EVERY DICE
 * has a continuous pattern that flows on every side of it"). Each side
 * used to carry its own copy of one school at its own moment, so a fish
 * leaving a side simply vanished at the edge. Now:
 *
 *   - The four sides are one strip of water four sides long, painted
 *     from the die itself (patterns.ts), and the two schools swim round
 *     that strip: one layer four sides wide, each side showing its own
 *     quarter, every side on the same clock — so a fish swimming off the
 *     right of one side comes on at the left of the next, nose first.
 *     The top school goes one way round the die and the bottom school
 *     the other.
 *   - The top and bottom have nowhere to swim off to, so their fish
 *     circle: three goldfish on a ring round the colour sticker, nose to
 *     tail, the layer turning about the middle of the cap.
 *
 * Each school bobs and surges, the way a goldfish kicks rather than
 * glides. The colour stickers are separate pieces on top (DieMesh), so
 * the fish pass under them and the game's colours are untouched.
 *
 * Looks only. The shop card still shows the still picture
 * (patterns.ts's `fish` painter), drawn from the same goldfish.ts.
 */

const SIZE = 64;
/** The strip of four sides, in texels. */
const RING = SIZE * 4;

/**
 * How far the fish swim per second, in side-widths: one crossing about
 * every four and a half seconds. It was 0.065 — a crossing every
 * fifteen seconds — and David, 19 Oct 2026: "The fish on the fish dice
 * move too slow. Hard to see they are moving." Much faster than this
 * and a fish is gone before anyone sees it is a fish.
 */
export const FISH_SWIM_SPEED = 0.22;

/** How fast the fish on the top and bottom go round, in turns per second. */
export const FISH_CIRCLE_SPEED = 0.07;

/** The clock every swimming fish reads, shared by both dice. */
const FISH_TIME = { value: 0 };

/** Advances FISH_TIME. Registered by DieMesh while a Fish die is out. */
export const FISH_TICK: SceneryTick = (seconds) => {
  FISH_TIME.value = seconds;
};

/**
 * Where the fish swim round the four sides: centre x along the strip
 * (0..RING), centre y up the side, direction, tilt. The top row swims
 * right round the die and the bottom row left, spaced so no two fish
 * ever overlap and no side is ever empty for long.
 */
export const STRIP_SCHOOL: readonly FishPlace[] = [
  [12, 55, 1, -0.1],
  [58, 56, 1, 0.08],
  [101, 54, 1, 0.05],
  [150, 56, 1, -0.07],
  [196, 55, 1, 0.1],
  [236, 54, 1, -0.04],
  [30, 9, -1, 0.1],
  [84, 8, -1, -0.07],
  [126, 10, -1, 0.06],
  [170, 8, -1, -0.09],
  [214, 9, -1, 0.04],
  [250, 10, -1, -0.05],
];

/** The ring the top and bottom fish swim on, in texels from the cap's centre. */
export const CAP_RING = 25.5;

/**
 * Three fish on that ring, nose along it, so turning the layer about
 * the middle moves each one nose first. A goldfish's `tilt` turns it
 * clockwise (its nose points along minus the tilt — see goldfishAt), so
 * a nose a right angle on from the fish's bearing is minus that angle.
 */
export const CAP_SCHOOL: readonly FishPlace[] = [0, 1, 2].map((i) => {
  const a = (i / 3) * Math.PI * 2 + 0.4;
  return [SIZE / 2 + Math.cos(a) * CAP_RING, SIZE / 2 + Math.sin(a) * CAP_RING, 1, -(a + Math.PI / 2)] as const;
});

/**
 * The water of one side of the die, with no fish in it: the same water
 * the still picture is painted from, cut from the die exactly as every
 * other pattern's sides are (dieFaceSampler), so it runs over every edge.
 */
export function fishWaterTexture(face = 4): THREE.Texture {
  return cachedTexture(`die:fish-swim:water:${face}`, () => {
    const data = new Uint8Array(SIZE * SIZE * 4);
    const N = 3;
    const at = dieFaceSampler((sx, sy) => fishWaterAt(sheetToCube(sx, sy)), face);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        let sr = 0;
        let sg = 0;
        let sb = 0;
        // Supersampled, so the bubbles' rims are smooth.
        for (let sy = 0; sy < N; sy++) {
          for (let sx = 0; sx < N; sx++) {
            const c = at(x + (sx + 0.5) / N - 0.5, y + (sy + 0.5) / N - 0.5);
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
    return finish(data, SIZE, THREE.ClampToEdgeWrapping);
  });
}

/** Paint a school on a clear layer `width` texels wide, wrapping sideways. */
function schoolLayer(width: number, school: readonly FishPlace[], wrap: boolean): Uint8Array {
  const data = new Uint8Array(width * SIZE * 4);
  const N = 3;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < width; x++) {
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
            (wrap ? goldfishAt(fx - width, fy, school) ?? goldfishAt(fx + width, fy, school) : null);
          if (c) {
            hits += 1;
            sr += c[0];
            sg += c[1];
            sb += c[2];
          }
        }
      }
      const i = (y * width + x) * 4;
      // Open water keeps a fin colour under zero alpha, so a filtered
      // edge darkens toward the fish's own outline rather than to black.
      const c = hits ? [sr / hits, sg / hits, sb / hits] : FISH_FIN;
      data[i] = Math.round(c[0]);
      data[i + 1] = Math.round(c[1]);
      data[i + 2] = Math.round(c[2]);
      data[i + 3] = Math.round((hits / (N * N)) * 255);
    }
  }
  return data;
}

/**
 * One school on a clear layer four sides wide: the fish swimming `dir`
 * round the strip, nothing else. It wraps sideways, so a tail cut off
 * where the strip closes carries on at its start.
 */
export function fishSchoolTexture(dir: 1 | -1): THREE.Texture {
  return cachedTexture(`die:fish-swim:school:${dir}`, () =>
    finish(schoolLayer(RING, STRIP_SCHOOL.filter((f) => f[2] === dir), true), RING, THREE.RepeatWrapping),
  );
}

/** The three fish that circle a cap, on a clear layer one side wide. */
export function fishCapTexture(): THREE.Texture {
  return cachedTexture('die:fish-swim:cap', () =>
    finish(schoolLayer(SIZE, CAP_SCHOOL, false), SIZE, THREE.ClampToEdgeWrapping),
  );
}

function finish(data: Uint8Array, width: number, wrapS: THREE.Wrapping): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, width, SIZE);
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

const DECLARE = `uniform float uFishTime;
uniform float uFishPhase;
uniform float uFishSlot;
uniform sampler2D uFishRight;
uniform sampler2D uFishLeft;
uniform sampler2D uFishCap;
void main() {`;

/**
 * A side: its quarter of the strip, both schools sliding round it on the
 * shared clock. Nose-first: the right school's layer slides toward +u,
 * the left school's toward -u. A slow bob, and a surge in the swim so
 * it reads as kicking, not gliding.
 */
const SIDE_SWIM = `#include <map_fragment>
#ifdef USE_MAP
{
  float ft = uFishTime;
  float surge = sin(ft * 2.6) * 0.022;
  float go = (ft * ${FISH_SWIM_SPEED.toFixed(4)} + surge) * 0.25;
  float along = (uFishSlot + vMapUv.x) * 0.25;
  vec2 bobR = vec2(0.0, sin(ft * 1.6) * 0.028);
  vec2 bobL = vec2(0.0, sin(ft * 1.4 + 1.7) * 0.028);
  vec4 fr = texture2D(uFishRight, vec2(along - go, vMapUv.y) - bobR);
  vec4 fl = texture2D(uFishLeft, vec2(along + go * 0.85, vMapUv.y) - bobL);
  diffuseColor.rgb = mix(diffuseColor.rgb, fr.rgb, fr.a);
  diffuseColor.rgb = mix(diffuseColor.rgb, fl.rgb, fl.a);
}
#endif`;

/**
 * A cap: the ring of fish turning about the middle, nose first, with a
 * little in-and-out breathing of the ring so it is not a wheel.
 */
const CAP_SWIM = `#include <map_fragment>
#ifdef USE_MAP
{
  float ft = uFishTime;
  float turn = ft * ${(FISH_CIRCLE_SPEED * Math.PI * 2).toFixed(4)} + uFishPhase + sin(ft * 2.2 + uFishPhase) * 0.03;
  float grow = 1.0 + sin(ft * 1.5 + uFishPhase * 3.0) * 0.025;
  vec2 d = (vMapUv - 0.5) * grow;
  vec2 r = vec2(d.x * cos(turn) + d.y * sin(turn), -d.x * sin(turn) + d.y * cos(turn)) + 0.5;
  vec4 fc = texture2D(uFishCap, r);
  diffuseColor.rgb = mix(diffuseColor.rgb, fc.rgb, fc.a);
}
#endif`;

/**
 * Six materials for a Fish die: each side's own water as the map, with
 * the schools sliding round the sides and circling on the top and bottom.
 */
export function swimmingFishMaterials(
  shade: THREE.MeshBasicMaterialParameters,
): THREE.MeshBasicMaterial[] {
  const right = fishSchoolTexture(1);
  const left = fishSchoolTexture(-1);
  const cap = fishCapTexture();
  return DIE_FACE_SLOTS.map((slot, face) => {
    const material = new THREE.MeshBasicMaterial({ map: fishWaterTexture(face), ...shade });
    const side = slot !== null;
    // The four sides share one clock and one phase — that is what lets
    // a fish cross from one to the next. The top and bottom each start
    // their ring at a different point.
    const phase = { value: side ? 0 : face === 2 ? 0 : 1.3 };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uFishTime = FISH_TIME;
      shader.uniforms.uFishPhase = phase;
      shader.uniforms.uFishSlot = { value: slot ?? 0 };
      shader.uniforms.uFishRight = { value: right };
      shader.uniforms.uFishLeft = { value: left };
      shader.uniforms.uFishCap = { value: cap };
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', DECLARE)
        .replace('#include <map_fragment>', side ? SIDE_SWIM : CAP_SWIM);
    };
    // Every side compiles to one program and every cap to another; the
    // slot and the phase are uniforms.
    material.customProgramCacheKey = () => (side ? 'die-fish-swim-side' : 'die-fish-swim-cap');
    return material;
  });
}
