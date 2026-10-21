import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { assert, assertEqual, suite, test } from './harness';
import {
  CAP_RING,
  CAP_SCHOOL,
  fishCapTexture,
  fishSchoolTexture,
  fishWaterTexture,
  STRIP_SCHOOL,
  swimmingFishMaterials,
} from '../src/dice/fishSwim';
import { DIE_FACE_SLOTS } from '../src/dice/patterns';

/*
  David, 18 Oct 2026: "On the fish dice, can you make the fish look like
  they're swimming around on the dice?" The die on the board is water
  with the schools slid over it by the GPU (fishSwim.ts) — and since
  21 Oct 2026 they swim right round the die: one strip of water four
  sides long, the fish crossing from side to side, and a ring of fish
  circling on the top and the bottom.
*/
const SIZE = 64;
const image = (t: THREE.Texture) => (t as THREE.DataTexture).image as { data: Uint8Array; width: number };
const alphaAt = (img: { data: Uint8Array; width: number }, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3];

suite('fish dice · the fish swim', () => {
  test('the water has no fish in it, on any side', () => {
    for (let face = 0; face < 6; face++) {
      const d = image(fishWaterTexture(face)).data;
      for (let i = 0; i < d.length; i += 4) {
        // Goldfish orange has far more red than blue; the water never does.
        assert(!(d[i] > 180 && d[i + 2] < 120), `a fish is painted into the water of side ${face}`);
      }
    }
  });

  test('the strip of water is four sides long, and every side is a different stretch of it', () => {
    const sides = DIE_FACE_SLOTS.map((_, f) => image(fishWaterTexture(f)).data.join(','));
    assertEqual(new Set(sides).size, 6, 'two sides of the Fish die carry the same water');
  });

  test('each school is only its own fish, on a clear layer four sides wide', () => {
    for (const dir of [1, -1] as const) {
      const img = image(fishSchoolTexture(dir));
      assertEqual(img.width, SIZE * 4, 'a school layer is not the whole strip');
      const rows = STRIP_SCHOOL.filter((f) => f[2] === dir).map((f) => f[1]);
      let painted = 0;
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < img.width; x++) {
          if (alphaAt(img, x, y) === 0) continue;
          painted += 1;
          assert(
            rows.some((r) => Math.abs(y - r) <= 9),
            `the ${dir > 0 ? 'right' : 'left'} school has paint at row ${y}, away from its fish`,
          );
        }
      }
      assert(painted > 800, 'a school layer is empty');
      assert(painted < img.width * SIZE * 0.3, 'a school layer is not see-through');
      // Every quarter of the strip — every side — has a fish on it.
      for (let k = 0; k < 4; k++) {
        let any = 0;
        for (let y = 0; y < SIZE; y++) for (let x = k * SIZE; x < (k + 1) * SIZE; x++) if (alphaAt(img, x, y) > 0) any++;
        assert(any > 150, `side ${k} of the strip has no ${dir > 0 ? 'right' : 'left'}-swimming fish on it`);
      }
    }
  });

  test('a school wraps round the strip without a seam', () => {
    for (const dir of [1, -1] as const) {
      const t = fishSchoolTexture(dir);
      const img = image(t);
      assert(t.wrapS === THREE.RepeatWrapping, 'a school does not repeat round the strip');
      for (let y = 0; y < SIZE; y++) {
        const jump = Math.abs(alphaAt(img, 0, y) - alphaAt(img, img.width - 1, y));
        assert(jump < 200, `row ${y} has a hard edge where the strip closes`);
      }
    }
  });

  test('the top and bottom carry a ring of fish round the sticker', () => {
    const img = image(fishCapTexture());
    assertEqual(img.width, SIZE, 'the cap layer is not one side wide');
    assertEqual(CAP_SCHOOL.length, 3, 'the ring is not three fish');
    let painted = 0;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (alphaAt(img, x, y) === 0) continue;
        painted++;
        const r = Math.hypot(x + 0.5 - SIZE / 2, y + 0.5 - SIZE / 2);
        assert(Math.abs(r - CAP_RING) < 11, `a cap fish has paint ${r.toFixed(1)} from the middle, off the ring`);
      }
    }
    assert(painted > 300, 'the cap layer is empty');
    // Nose along the ring, every fish the same way round: a goldfish's
    // nose points along minus its tilt (goldfishAt turns clockwise), and
    // that must be a right angle on from the fish's bearing.
    for (const [cx, cy, , tilt] of CAP_SCHOOL) {
      const bearing = Math.atan2(cy - SIZE / 2, cx - SIZE / 2);
      const want = bearing + Math.PI / 2;
      const off = Math.abs(Math.atan2(Math.sin(-tilt - want), Math.cos(-tilt - want)));
      assert(off < 1e-6, 'a cap fish is not facing along the ring');
    }
  });

  test("three still has the hooks the swimming is spliced into", () => {
    const frag = THREE.ShaderLib.basic.fragmentShader;
    assert(frag.includes('#include <map_fragment>'), 'MeshBasicMaterial lost its map chunk');
    assert(frag.includes('void main() {'), 'MeshBasicMaterial main() changed shape');
    const materials = swimmingFishMaterials({});
    for (let face = 0; face < 6; face++) {
      const shader = {
        uniforms: {} as Record<string, { value: unknown }>,
        fragmentShader: frag,
        vertexShader: '',
      };
      materials[face].onBeforeCompile(shader as never, undefined as never);
      assert(/uniform sampler2D uFishRight;/.test(shader.fragmentShader), 'the fish layers are not declared');
      assert('uFishTime' in shader.uniforms, 'the fish have no clock');
      const slot = DIE_FACE_SLOTS[face];
      if (slot !== null) {
        assert(/texture2D\(uFishLeft,/.test(shader.fragmentShader), 'the fish are not drawn on a side');
        // One strip, one clock, one phase: a fish can only cross from
        // one side to the next if every side is at the same moment and
        // shows its own quarter of the strip.
        assertEqual(shader.uniforms.uFishSlot.value, slot, `side ${face} shows the wrong quarter of the strip`);
        assertEqual(shader.uniforms.uFishPhase.value, 0, `side ${face} runs on its own phase`);
      } else {
        assert(/texture2D\(uFishCap,/.test(shader.fragmentShader), 'the ring of fish is not drawn on a cap');
      }
    }
  });

  test('the die on the board swims, and the shop card stays a still picture', () => {
    const mesh = readFileSync(join(__dirname, '..', 'src', 'dice', 'DieMesh.tsx'), 'utf8');
    assert(/pattern === 'fish'\) return swimmingFishMaterials\(shade\)/.test(mesh), 'the Fish die does not swim');
    assert(/useSceneryTick\(pattern === 'fish' \? FISH_TICK : null\)/.test(mesh), 'nothing moves the fish');
  });
});
