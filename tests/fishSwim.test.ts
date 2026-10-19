import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { assert, suite, test } from './harness';
import { fishSchoolTexture, fishWaterTexture, swimmingFishMaterials } from '../src/dice/fishSwim';
import { SCHOOL } from '../src/dice/goldfish';

/*
  David, 18 Oct 2026: "On the fish dice, can you make the fish look like
  they're swimming around on the dice?" The die on the board is water
  with two schools slid over it by the GPU (fishSwim.ts).
*/
const SIZE = 64;
const data = (t: THREE.Texture) => (t as THREE.DataTexture).image.data as Uint8Array;
const alphaAt = (d: Uint8Array, x: number, y: number) => d[(y * SIZE + x) * 4 + 3];

suite('fish dice · the fish swim', () => {
  test('the water has no fish in it', () => {
    const d = data(fishWaterTexture());
    for (let i = 0; i < d.length; i += 4) {
      // Goldfish orange has far more red than blue; the water never does.
      assert(!(d[i] > 180 && d[i + 2] < 120), 'a fish is painted into the water');
    }
  });

  test('each school is only its own fish, on a clear layer', () => {
    for (const dir of [1, -1] as const) {
      const d = data(fishSchoolTexture(dir));
      const rows = SCHOOL.filter((f) => f[2] === dir).map((f) => f[1]);
      let painted = 0;
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          if (alphaAt(d, x, y) === 0) continue;
          painted += 1;
          assert(
            rows.some((r) => Math.abs(y - r) <= 9),
            `the ${dir > 0 ? 'right' : 'left'} school has paint at row ${y}, away from its fish`,
          );
        }
      }
      assert(painted > 200, 'a school layer is empty');
      assert(painted < SIZE * SIZE * 0.3, 'a school layer is not see-through');
    }
  });

  test('a school wraps sideways without a seam', () => {
    for (const dir of [1, -1] as const) {
      const d = data(fishSchoolTexture(dir));
      const t = fishSchoolTexture(dir);
      assert(t.wrapS === THREE.RepeatWrapping, 'a school does not repeat sideways');
      for (let y = 0; y < SIZE; y++) {
        const jump = Math.abs(alphaAt(d, 0, y) - alphaAt(d, SIZE - 1, y));
        assert(jump < 200, `row ${y} has a hard edge where the layer wraps`);
      }
    }
  });

  test("three still has the hooks the swimming is spliced into", () => {
    const frag = THREE.ShaderLib.basic.fragmentShader;
    assert(frag.includes('#include <map_fragment>'), 'MeshBasicMaterial lost its map chunk');
    assert(frag.includes('void main() {'), 'MeshBasicMaterial main() changed shape');
    const m = swimmingFishMaterials({})[0];
    const shader = {
      uniforms: {} as Record<string, unknown>,
      fragmentShader: frag,
      vertexShader: '',
    };
    m.onBeforeCompile(shader as never, undefined as never);
    assert(/uniform sampler2D uFishRight;/.test(shader.fragmentShader), 'the fish layers are not declared');
    assert(/texture2D\(uFishLeft, vMapUv/.test(shader.fragmentShader), 'the fish are not drawn');
    assert('uFishTime' in shader.uniforms, 'the fish have no clock');
  });

  test('the die on the board swims, and the shop card stays a still picture', () => {
    const mesh = readFileSync(join(__dirname, '..', 'src', 'dice', 'DieMesh.tsx'), 'utf8');
    assert(/pattern === 'fish'\) return swimmingFishMaterials\(shade\)/.test(mesh), 'the Fish die does not swim');
    assert(/useSceneryTick\(pattern === 'fish' \? FISH_TICK : null\)/.test(mesh), 'nothing moves the fish');
  });
});
