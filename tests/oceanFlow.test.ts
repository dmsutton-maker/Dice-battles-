import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  flowingOceanMaterials,
  OCEAN_TICK,
  OCEAN_TIME,
  oceanChopTexture,
  oceanSwellTexture,
  oceanTimeAt,
} from '../src/dice/oceanFlow';
import { dieFacePixels, OCEAN_PAINT, oceanColorAt, oceanWaveAt } from '../src/dice/patterns';
import { skinById } from '../src/game/diceSkins';
import { DIE_BLURBS } from '../src/game/itemBlurbs';
import { TUNING } from '../src/game/tuning';
import { equippedDieKeys } from '../src/dice/warmPreviews';

/*
  Marc, 4 Nov 2026: "do option c with the flowing water and splash", and
  of an earlier try, "once the water starts flowing, it's going off sync
  so fix that." The sea on the Ocean die's shell flows (oceanFlow.ts):
  where every texel is on the swell and on the chop is painted once, and
  the GPU colours the water with the clock added, exactly as the painter
  does. Every side of both dice reads one clock, wrapped to one period,
  and the picture repeats exactly once a period.
*/
const O = TUNING.ocean;
const root = join(__dirname, '..');
const SKIN = skinById('ocean');

/** Decode a texel of the two maps back into the wave the painter saw. */
function waveAt(face: number, x: number, y: number) {
  const swell = (oceanSwellTexture(face) as THREE.DataTexture).image.data as Uint8Array;
  const chop = (oceanChopTexture(face) as THREE.DataTexture).image.data as Uint8Array;
  const i = (y * 64 + x) * 4;
  const s = (v: number) => v / 127.5 - 1;
  return {
    swell: [s(swell[i]), s(swell[i + 1])] as const,
    chop: [s(chop[i]), s(chop[i + 1])] as const,
    grain: swell[i + 2] / 255,
    wave: { roll: Math.atan2(s(swell[i]), s(swell[i + 1])), rip: Math.atan2(s(chop[i]), s(chop[i + 1])), grain: swell[i + 2] / 255 },
  };
}

/** The top and bottom blend two sides along their diagonals (MITRE); the map blends sines there. */
const onMitre = (face: number, x: number, y: number) =>
  (face === 2 || face === 3) && (Math.abs(x - y) < 1.5 || Math.abs(x + y - 63) < 1.5);

suite('ocean dice · the sea flows on one clock', () => {
  test('the picture comes round exactly once a period, and moves in between', () => {
    assertEqual(O.flowSeconds, 1.8, 'the period is not 1.8 seconds');
    assertEqual(oceanTimeAt(0), 0, 'the clock does not start at 0');
    assert(Math.abs(oceanTimeAt(O.flowSeconds) - 0) < 1e-9, `at one period the clock reads ${oceanTimeAt(O.flowSeconds)}`);
    assert(Math.abs(oceanTimeAt(O.flowSeconds * 7 + 0.4) - 0.4) < 1e-9, 'the clock does not wrap');
    let moved = 0;
    for (let k = 0; k < 400; k++) {
      const w = oceanWaveAt((k * 37) % 256, (k * 11) % 64);
      const start = oceanColorAt(w, 0);
      const end = oceanColorAt(w, 1);
      assertEqual(start.join(','), end.join(','), `the sea at the end of the period is not the sea at the start, at ${k}`);
      if (oceanColorAt(w, 0.5).join(',') !== start.join(',')) moved++;
    }
    assert(moved > 300, `only ${moved} of 400 points change colour half way through the period`);
  });

  test('the tick writes the board\'s clock wrapped to the period, the same number for every side', () => {
    OCEAN_TICK(O.flowSeconds * 3 + 0.7);
    assert(Math.abs(OCEAN_TIME.value - 0.7) < 1e-9, `the tick wrote ${OCEAN_TIME.value}`);
    const materials = flowingOceanMaterials({});
    assertEqual(materials.length, 6, 'six sides');
    const frag = THREE.ShaderLib.basic.fragmentShader;
    for (let face = 0; face < 6; face++) {
      const shader = { uniforms: {} as Record<string, { value: unknown }>, fragmentShader: frag, vertexShader: '' };
      materials[face].onBeforeCompile(shader as never, undefined as never);
      assert(shader.uniforms.uOceanTime === OCEAN_TIME, `side ${face} runs on its own clock`);
    }
  });

  test('the first frame is the still picture: the maps give back the painter\'s sea', () => {
    let worst = 0;
    let checked = 0;
    for (let face = 0; face < 6; face++) {
      const still = dieFacePixels('ocean', SKIN.body, SKIN.body, face);
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          if (onMitre(face, x, y)) continue;
          const c = oceanColorAt(waveAt(face, x, y).wave, 0);
          for (let k = 0; k < 3; k++) {
            const d = Math.abs(c[k] - still[(y * 64 + x) * 3 + k]);
            worst = Math.max(worst, d);
            assert(d <= 6, `side ${face} (${x}, ${y}): the map's sea is ${d}/255 from the painted one`);
          }
          checked++;
        }
      }
    }
    note(`${checked} texels; the worst channel is ${worst}/255 from the still (8-bit sines)`);
    // The maps hold unit sines and cosines everywhere off the mitre.
    for (let face = 0; face < 6; face++) {
      for (let k = 0; k < 64; k++) {
        const x = (k * 7) % 64;
        const y = (k * 13) % 64;
        if (onMitre(face, x, y)) continue;
        const { swell, chop } = waveAt(face, x, y);
        assert(Math.abs(Math.hypot(swell[0], swell[1]) - 1) < 0.02, `side ${face}: the swell at (${x}, ${y}) is not a sine and a cosine`);
        assert(Math.abs(Math.hypot(chop[0], chop[1]) - 1) < 0.02, `side ${face}: the chop at (${x}, ${y}) is not a sine and a cosine`);
      }
    }
  });

  test('the shader is the painter with the clock added', () => {
    /*
      The GLSL, line for line in JavaScript, fed the maps' own bytes:
      the sea it makes at any moment is oceanColorAt's. Not a proof of
      the GPU, but of the sums the pinned text below carries.
    */
    const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
    const smoothstep = (e0: number, e1: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    };
    const shader = (face: number, x: number, y: number, seconds: number) => {
      const { swell, chop, grain } = waveAt(face, x, y);
      const a = seconds * ((2 * Math.PI) / O.flowSeconds);
      const roll = swell[0] * Math.cos(a) - swell[1] * Math.sin(a);
      const lift = roll * 0.75 - a;
      const rip = chop[0] * Math.cos(lift) + chop[1] * Math.sin(lift);
      const water = roll * 0.6 + rip * 0.4;
      let sea = mix(hex(OCEAN_PAINT.trough), hex(OCEAN_PAINT.deep), smoothstep(-1, -0.1, water));
      sea = mix(sea, hex(OCEAN_PAINT.shallow), smoothstep(-0.15, 0.55, water));
      sea = mix(sea, hex(OCEAN_PAINT.glass), smoothstep(0.5, 0.95, water));
      sea = mix(sea, hex(OCEAN_PAINT.weed), (1 - smoothstep(-0.95, -0.45, water)) * 0.42);
      const ripple = grain - 0.5;
      sea = mix(sea, hex(ripple > 0 ? OCEAN_PAINT.rippleLight : OCEAN_PAINT.rippleDark), Math.abs(ripple) * 0.45);
      const breaking = smoothstep(0.3, 0.9, rip) * smoothstep(-0.15, 0.75, roll);
      const froth = Math.min(1, 0.5 + grain * 0.8);
      sea = mix(sea, hex(OCEAN_PAINT.foam), breaking * froth * 0.95);
      sea = mix(sea, hex(OCEAN_PAINT.spray), breaking * smoothstep(0.72, 0.99, rip) * 0.8);
      return sea.map((v) => v * 255);
    };
    let worst = 0;
    for (let face = 0; face < 6; face++) {
      for (let k = 0; k < 300; k++) {
        const x = (k * 17 + face) % 64;
        const y = (k * 29 + face * 5) % 64;
        if (onMitre(face, x, y)) continue;
        for (const seconds of [0, 0.45, 1.1, 1.79]) {
          const gpu = shader(face, x, y, seconds);
          const js = oceanColorAt(waveAt(face, x, y).wave, seconds / O.flowSeconds);
          for (let c = 0; c < 3; c++) {
            const d = Math.abs(gpu[c] - js[c]);
            worst = Math.max(worst, d);
            assert(d <= 4, `side ${face} (${x}, ${y}) at ${seconds}s: the shader's sea is ${d.toFixed(1)}/255 from the painter's`);
          }
        }
      }
    }
    note(`the shader's sums and the painter's agree to ${worst.toFixed(1)}/255 (the painter rounds at every mix)`);
  });

  test('three still has the hooks the flow is spliced into, and the text is as pinned', () => {
    const frag = THREE.ShaderLib.basic.fragmentShader;
    assert(frag.includes('#include <map_fragment>'), 'MeshBasicMaterial lost its map chunk');
    assert(/sRGBTransferEOTF/.test(readFileSync(join(root, 'node_modules/three/src/renderers/shaders/ShaderChunk/colorspace_pars_fragment.glsl.js'), 'utf8')), 'three no longer defines sRGBTransferEOTF');
    const materials = flowingOceanMaterials({});
    for (let face = 0; face < 6; face++) {
      const shader = { uniforms: {} as Record<string, { value: unknown }>, fragmentShader: frag, vertexShader: '' };
      materials[face].onBeforeCompile(shader as never, undefined as never);
      const text = shader.fragmentShader;
      assert(/uniform sampler2D uOceanChop;/.test(text), 'the chop map is not declared');
      // The map is data: it must not be multiplied in as paint.
      assert(!text.includes('#include <map_fragment>'), 'the swell map is multiplied in as if it were paint');
      assert(/vec3 swell = texture2D\(map, vMapUv\)\.rgb;/.test(text), 'the swell map is not read');
      assert(/vec2 chop = texture2D\(uOceanChop, vMapUv\)\.rg \* 2\.0 - 1\.0;/.test(text), 'the chop map is not read');
      assert(text.includes(`float a = uOceanTime * ${((2 * Math.PI) / O.flowSeconds).toFixed(4)};`), 'the clock is not turned into one wave per period');
      assert(/float roll = swell\.r \* cos\(a\) - swell\.g \* sin\(a\);/.test(text), 'the swell does not move with the clock');
      assert(/float lift = roll \* 0\.75 - a;/.test(text), 'the chop does not ride the swell, or does not move');
      assert(/float rip = chop\.r \* cos\(lift\) \+ chop\.g \* sin\(lift\);/.test(text), 'the chop is not opened out from its sine and cosine');
      assert(/float water = roll \* 0\.6 \+ rip \* 0\.4;/.test(text), 'the water is not the painter\'s mix of swell and chop');
      assert(/\(1\.0 - smoothstep\(-0\.95, -0\.45, water\)\) \* 0\.42/.test(text), 'the weed ramp runs downward, which GLSL leaves undefined');
      assert(/float breaking = smoothstep\(0\.3, 0\.9, rip\) \* smoothstep\(-0\.15, 0\.75, roll\);/.test(text), 'the foam is not where the painter breaks it');
      assert(/diffuseColor\.rgb \*= sRGBTransferEOTF\(vec4\(sea, 1\.0\)\)\.rgb;/.test(text), 'the sea is not turned to linear light');
      for (const colour of Object.values(OCEAN_PAINT)) {
        const n = parseInt(colour.slice(1), 16);
        const v = `vec3(${(((n >> 16) & 255) / 255).toFixed(4)}, ${(((n >> 8) & 255) / 255).toFixed(4)}, ${((n & 255) / 255).toFixed(4)})`;
        assert(text.includes(v), `the shader does not carry the painter's ${colour}`);
      }
      assert('uOceanChop' in shader.uniforms && 'uOceanTime' in shader.uniforms, 'a uniform is missing');
    }
  });

  test('the maps are data: no colour space, no mipmaps, clamped, and every side has both', () => {
    for (let face = 0; face < 6; face++) {
      for (const t of [oceanSwellTexture(face), oceanChopTexture(face)] as THREE.DataTexture[]) {
        const img = t.image as { width: number; height: number };
        assertEqual(img.width, 64, `side ${face} map width`);
        assertEqual(t.generateMipmaps, false, `side ${face}: the map has mipmaps`);
        assertEqual(t.colorSpace, THREE.NoColorSpace, `side ${face}: the map is treated as colour`);
        assertEqual(t.wrapS, THREE.ClampToEdgeWrapping, `side ${face}: the map repeats`);
      }
    }
  });

  test('the die on the board flows, the warm-up paints its maps and keeps them, and the card keeps the still', () => {
    assertEqual(SKIN.effect, 'ocean', 'the Ocean dice have no effect');
    assertEqual(SKIN.pattern, 'ocean', 'the Ocean dice lost their painter');
    assertEqual(DIE_BLURBS.ocean, 'Waves that roll, and a splash when it lands.', 'the blurb does not say what the die does now');
    const mesh = readFileSync(join(root, 'src/dice/DieMesh.tsx'), 'utf8');
    assert(/pattern === 'ocean'\) return flowingOceanMaterials\(/.test(mesh), 'the Ocean die does not flow');
    assert(/pattern === 'ocean' \? OCEAN_TICK/.test(mesh), 'nothing moves the sea');
    const warm = readFileSync(join(root, 'src/dice/warmPreviews.ts'), 'utf8');
    assert(/oceanSwellJob\b/.test(warm) && /oceanChopJob\b/.test(warm), 'the maps are not warmed with the rest');
    const keys = equippedDieKeys(SKIN);
    for (let face = 0; face < 6; face++) {
      assert(keys.includes(`die:ocean-swell:${face}`), `the swell map of side ${face} is not kept between launches`);
      assert(keys.includes(`die:ocean-chop:${face}`), `the chop map of side ${face} is not kept between launches`);
    }
    // The shop card and the inventory show the painter's still, untouched
    // and unanimated: nothing of the GPU side reaches preview.ts.
    const preview = readFileSync(join(root, 'src/dice/preview.ts'), 'utf8');
    assert(!/oceanFlow/.test(preview), 'the shop card imports the GPU side');
    assert(!/effect === 'ocean'/.test(preview), 'the shop card paints something over the still');
    const flow = readFileSync(join(root, 'src/dice/oceanFlow.ts'), 'utf8');
    assert(!/Math\.random/.test(flow), 'the maps are painted from chance');
    assert(flow.includes('O.flowSeconds'), 'the period does not come from tuning.ts');
  });
});
