import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  glowingNeonMaterials,
  NEON_FLARE,
  NEON_GLOW,
  NEON_PULSE,
  NEON_TICK,
  neonBreathAt,
  neonDriftAt,
  neonFlickerAt,
  neonGlowAt,
  neonGlowTexture,
  neonLanded,
  neonMaskAt,
  neonPulseAt,
} from '../src/dice/neonGlow';
import { FACE_FRAMES, neonTubesAt, STICKER_FRACTION } from '../src/dice/patterns';
import { TUNING } from '../src/game/tuning';

/*
  David, 1 Nov 2026: "make it more interactive with moving details and
  stuff." The Neon die's tubes are painted once; a glow map says how far
  round each tube every texel is, and the GPU lights the part of each
  tube the clock has reached (neonGlow.ts), plus a breath, a colour
  drift, a stutter, a sparkle at the bends and a flare on landing. For
  the light to run right round the die the map has to agree on both
  sides of every edge, and nothing may ever reach a colour sticker.
*/
const H = 32;
const IN = 0.6;
const N = TUNING.neon;
const root = join(__dirname, '..');

suite('neon dice · the light runs round the tubes', () => {
  test('the head of light advances with time and wraps once a lap', () => {
    assertEqual(neonPulseAt(0), 0, 'the lap starts at 0');
    const quarter = neonPulseAt(N.pulseLapSeconds / 4);
    assert(Math.abs(quarter - 0.25) < 1e-9, `a quarter lap in is at ${quarter}`);
    let last = neonPulseAt(0);
    let wraps = 0;
    for (let t = 1 / 60; t < N.pulseLapSeconds * 3 + 0.05; t += 1 / 60) {
      const now = neonPulseAt(t);
      assert(now >= 0 && now < 1, `the head is at ${now}, off the tube`);
      if (now < last) wraps++;
      else assert(now > last, `the head stood still at ${t.toFixed(3)}s`);
      last = now;
    }
    assertEqual(wraps, 3, 'three laps in three lap-times');
  });

  test('a tube is measured the same from both sides of every edge it crosses', () => {
    let checked = 0;
    let worst = 0;
    // Walk every edge of the die; where a tube crosses it, compare the
    // map a hair inside each of the two sides that meet there.
    for (let a = 0; a < 3; a++) {
      for (const s1 of [-1, 1]) {
        for (const s2 of [-1, 1]) {
          const b = (a + 1) % 3;
          const c = (a + 2) % 3;
          for (let t = -H + 0.5; t < H; t += 0.5) {
            const P = [0, 0, 0];
            P[a] = t;
            P[b] = s1 * (H - IN);
            P[c] = s2 * H;
            const Q = [0, 0, 0];
            Q[a] = t;
            Q[b] = s1 * H;
            Q[c] = s2 * (H - IN);
            const p = neonTubesAt(P);
            const q = neonTubesAt(Q);
            for (const tube of ['pink', 'cyan'] as const) {
              const offP = tube === 'pink' ? p.pinkOff : p.cyanOff;
              if (offP > 1.5) continue;
              const offQ = tube === 'pink' ? q.pinkOff : q.cyanOff;
              assert(offQ < 3, `the ${tube} tube is ${offQ.toFixed(2)} texels away on the other side of the edge`);
              const raw = Math.abs((tube === 'pink' ? p.pinkAlong : p.cyanAlong) - (tube === 'pink' ? q.pinkAlong : q.cyanAlong));
              // A tube closes on itself, so 0 and 1 are the same place on it.
              const gap = Math.min(raw, 1 - raw);
              worst = Math.max(worst, gap);
              assert(gap < 0.01, `the ${tube} tube's count jumps ${gap.toFixed(4)} of a lap at the edge`);
              checked++;
            }
          }
        }
      }
    }
    assert(checked >= 12, `only ${checked} edge crossings found`);
    note(`${checked} edge points; the worst step is ${worst.toFixed(4)} of a lap for points ${2 * IN} texels apart`);
  });

  test('the count restarts where a tube bends over an edge, not in the open', () => {
    // Find where each tube's `along` wraps, and check it is on an edge
    // of the die, where the bend sparkles and the restart cannot show.
    for (const tube of ['pink', 'cyan'] as const) {
      let found = false;
      for (let f = 0; f < 6 && !found; f++) {
        const F = FACE_FRAMES[f];
        for (let u = -H + 0.25; u < H && !found; u += 0.5) {
          for (let v = -H + 0.25; v < H; v += 0.5) {
            const P = [0, 1, 2].map((i) => H * F.n[i] + u * F.u[i] + v * F.v[i]);
            const T = neonTubesAt(P);
            const off = tube === 'pink' ? T.pinkOff : T.cyanOff;
            const along = tube === 'pink' ? T.pinkAlong : T.cyanAlong;
            if (off > 1 || (along > 0.002 && along < 0.998)) continue;
            const toEdge = Math.min(H - Math.abs(u), H - Math.abs(v));
            assert(toEdge < 1.5, `the ${tube} tube's count restarts ${toEdge.toFixed(1)} texels from an edge, on side ${f}`);
            found = true;
            break;
          }
        }
      }
      assert(found, `the ${tube} tube's restart was not found`);
    }
  });

  test('nothing in the map under a sticker, and both tubes on every side', () => {
    const sticker = STICKER_FRACTION * 64;
    for (let face = 0; face < 6; face++) {
      const t = neonGlowTexture(face) as THREE.DataTexture;
      const img = t.image as { data: Uint8Array; width: number; height: number };
      assertEqual(img.width, 64, `side ${face} map width`);
      let pink = 0;
      let cyan = 0;
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const i = (y * 64 + x) * 4;
          const r = Math.hypot(x + 0.5 - 32, y + 0.5 - 32);
          if (r <= sticker + 1) {
            assertEqual(img.data[i + 2], 0, `side ${face}: the pink light reaches the sticker at (${x}, ${y})`);
            assertEqual(img.data[i + 3], 0, `side ${face}: the cyan light reaches the sticker at (${x}, ${y})`);
          }
          if (img.data[i + 2] > 0) pink++;
          if (img.data[i + 3] > 0) cyan++;
        }
      }
      const share = (pink + cyan) / (64 * 64);
      assert(pink > 60 && cyan > 60, `side ${face}: ${pink} pink and ${cyan} cyan texels`);
      assert(share > 0.03 && share < 0.4, `side ${face}: ${(share * 100).toFixed(0)}% of the map is tube`);
      assertEqual(t.generateMipmaps, false, `side ${face}: the map has mipmaps`);
      assertEqual(t.colorSpace, THREE.NoColorSpace, `side ${face}: the map is treated as colour`);
    }
    // The mask is 1 on the tube and gone by `pulseReach`.
    assertEqual(neonMaskAt(0), 1, 'on the tube');
    assertEqual(neonMaskAt(N.pulseReach), 0, 'at the reach');
    assert(neonMaskAt(N.pulseReach / 2) > 0 && neonMaskAt(N.pulseReach / 2) < 1, 'soft in between');
  });

  test('the tube breathes and stutters but is never dark, and never a strobe', () => {
    let min = Infinity;
    let max = 0;
    let dim = 0;
    let stutters = 0;
    let wasDim = false;
    const STEP = 1 / 120;
    const SPAN = 600;
    for (let t = 0; t < SPAN; t += STEP) {
      const g = neonGlowAt(t);
      min = Math.min(min, g);
      max = Math.max(max, g);
      const flicker = neonFlickerAt(t);
      assert(flicker > 0.5 && flicker <= 1, `the stutter takes the tube to ${flicker} at ${t.toFixed(3)}s`);
      if (flicker < 1) dim += STEP;
      if (flicker < 1 && !wasDim) stutters++;
      wasDim = flicker < 1;
      const breath = neonBreathAt(t);
      assert(breath >= 1 - N.breathDepth - 1e-9 && breath <= 1 + N.breathDepth + 1e-9, `the breath is ${breath}`);
    }
    assert(min > 0.4, `the tube goes down to ${min.toFixed(2)} of its brightness`);
    assert(max > 1.1, `the tube only ever reaches ${max.toFixed(2)} of its brightness`);
    assert(stutters > 0, 'the sign never stutters');
    // A stutter is three quick dips, so dips come in threes; and it is
    // dim for only a few per cent of the time.
    assertEqual(stutters % 3, 0, `${stutters} dips, not a multiple of three`);
    const perMinute = (stutters / 3) / (SPAN / 60);
    assert(perMinute > 1 && perMinute < 10, `${perMinute.toFixed(1)} stutters a minute`);
    assert(dim / SPAN < 0.06, `dim ${((dim / SPAN) * 100).toFixed(1)}% of the time`);
    note(`${(stutters / 3).toFixed(0)} stutters in ${SPAN}s; brightness ${min.toFixed(2)}..${max.toFixed(2)}`);
  });

  test('the colour drifts slowly there and back', () => {
    assertEqual(neonDriftAt(0), 0, 'starts pink');
    assert(Math.abs(neonDriftAt(N.driftSeconds / 2) - 1) < 1e-9, 'fully drifted half way through');
    assert(Math.abs(neonDriftAt(N.driftSeconds)) < 1e-9, 'back again at the end');
    for (let t = 0; t < 60; t += 0.1) {
      const d = neonDriftAt(t);
      assert(d >= 0 && d <= 1, `the drift is ${d}`);
    }
  });

  test('the tick writes the frame\'s numbers and the landing flare fades', () => {
    // Another suite may have landed a die (diceNeon.ts flares on
    // landing); two seconds of frames puts any flare out first.
    for (let t = -2; t < 1.0; t += 1 / 60) NEON_TICK(t);
    NEON_TICK(1.0);
    assert(Math.abs(NEON_PULSE.value - neonPulseAt(1.0)) < 1e-12, 'the tick does not move the head');
    assert(Math.abs(NEON_GLOW.value - neonGlowAt(1.0)) < 1e-12, 'the tick does not set the glow');
    assertEqual(NEON_FLARE.value, 0, 'still flaring two seconds after a landing');
    neonLanded();
    assertEqual(NEON_FLARE.value, 1, 'landing does not flare');
    const frames = Math.round((N.flareSeconds / 2) * 60);
    for (let k = 1; k <= frames; k++) NEON_TICK(1.0 + k / 60);
    assert(Math.abs(NEON_FLARE.value - 0.5) < 1e-6, `half way through the flare it is ${NEON_FLARE.value}`);
    // A long gap on the clock (the board stopped for a menu) is not a
    // flare that jumps to nothing: a frame counts for a tenth of a
    // second at most.
    neonLanded();
    NEON_TICK(100);
    assert(NEON_FLARE.value > 0.5, `one frame after landing the flare is ${NEON_FLARE.value}`);
    for (let t = 100; t < 102; t += 1 / 60) NEON_TICK(t);
    assertEqual(NEON_FLARE.value, 0, 'the flare never fades out');
  });

  test('three still has the hooks the glow is spliced into', () => {
    const frag = THREE.ShaderLib.basic.fragmentShader;
    assert(frag.includes('#include <map_fragment>'), 'MeshBasicMaterial lost its map chunk');
    const materials = glowingNeonMaterials({}, '#0c0a18', '#ff2fb4');
    assertEqual(materials.length, 6, 'six sides');
    for (let face = 0; face < 6; face++) {
      const shader = {
        uniforms: {} as Record<string, { value: unknown }>,
        fragmentShader: frag,
        vertexShader: '',
      };
      materials[face].onBeforeCompile(shader as never, undefined as never);
      assert(/uniform sampler2D uNeonMap;/.test(shader.fragmentShader), 'the glow map is not declared');
      assert(/texture2D\(uNeonMap, vMapUv\)/.test(shader.fragmentShader), 'the glow map is not read');
      assert(/fract\(uNeonPulse - nm\.r\)/.test(shader.fragmentShader), 'the clock does not move the pink head');
      assert(/fract\(uNeonPulse - nm\.g\)/.test(shader.fragmentShader), 'the clock does not move the cyan head');
      assert(/uNeonFlare/.test(shader.fragmentShader), 'landing does not flare');
      assert(/mix\(1\.0, uNeonGlow, onTube\)/.test(shader.fragmentShader), 'the breath does not reach the tube');
      // No glow where the map is empty: the sparkle at the bends is
      // scaled by the map like everything else.
      assert(/float bend = smoothstep\([^;]*\* onTube;/.test(shader.fragmentShader), 'the bends sparkle off the tube');
      for (const u of ['uNeonPulse', 'uNeonGlow', 'uNeonDrift', 'uNeonFlare']) {
        assert(u in shader.uniforms, `${u} is not a uniform`);
      }
      assert(shader.uniforms.uNeonPulse === NEON_PULSE, 'the sides run on different clocks');
    }
  });

  test('the paint, the glow map and the card are supersampled, not stair-stepped', () => {
    /*
      Marc, 4 Nov 2026: "make the neon dice less pixelated." The tube
      cores and the grid are under a texel wide, so each is averaged over
      the texel: the paint 3x3, the glow map's edge of light 4x4, the
      card's 2x2. The design itself is unchanged, and the price is not
      touched here (tests/neonDice.test.ts pins $0.99).
    */
    const patterns = readFileSync(join(root, 'src/dice/patterns.ts'), 'utf8');
    const neon = patterns.slice(patterns.indexOf('  neon: (() => {'), patterns.indexOf('  supporterCompass:'));
    assert(/const N = 3;[\s\S]*neonAt\(u, v,/.test(neon), 'the Neon paint is not supersampled 3x3');
    assert(/mod\(dot3\(P, F\.u\), 8\)/.test(neon) && /- 24\.5\)/.test(neon), 'the grid or the halo changed');
    const glow = readFileSync(join(root, 'src/dice/neonGlow.ts'), 'utf8');
    assert(/const SS = 4;/.test(glow), 'the glow map is not supersampled 4x4');
    const preview = readFileSync(join(root, 'src/dice/preview.ts'), 'utf8');
    const card = preview.slice(preview.indexOf('export function paintNeon'));
    assert(/const SS = 2;/.test(card), 'the card is not supersampled 2x2');
    // "How far round" is still read once, at the texel's centre.
    assert(/data\[i\] = Math\.round\(centre\.pinkAlong \* 255\)/.test(glow), 'the glow map no longer reads the count at the centre');
    assert(/NEON_PINK_HEAD_AT - t\.pinkAlong/.test(card), 'the card no longer reads the count at the centre');
  });

  test('the die on the board glows, the shelf card shows it, and nothing is painted on a sticker', () => {
    const mesh = readFileSync(join(root, 'src/dice/DieMesh.tsx'), 'utf8');
    assert(/pattern === 'neon'\) return glowingNeonMaterials\(/.test(mesh), 'the Neon die does not glow');
    assert(/pattern === 'neon' \? NEON_TICK/.test(mesh), 'nothing moves the light');
    const warm = readFileSync(join(root, 'src/dice/warmPreviews.ts'), 'utf8');
    // neonGlowJob since 3 Nov 2026: the same map, painted a row per step
    // (David's family: "it all has to be lightning fast").
    assert(/neonGlowJob\b/.test(warm), 'the glow map is not warmed with the rest');
    const preview = readFileSync(join(root, 'src/dice/preview.ts'), 'utf8');
    assert(/paintNeon\(rgb\)/.test(preview), 'the shop card does not show the light');
    assert(!/from '\.\/neonGlow'/.test(preview), 'the shop card imports the GPU side');
    const effect = readFileSync(join(root, 'src/dice/diceNeon.ts'), 'utf8');
    assert(/neonLanded\(\)/.test(effect), 'landing does not tell the tubes to flare');
    // Every number lives in tuning.ts's neon block.
    const glow = readFileSync(join(root, 'src/dice/neonGlow.ts'), 'utf8');
    for (const key of [
      'pulseLapSeconds', 'pulseTail', 'pulseGain', 'pulseReach', 'breathSeconds', 'breathDepth',
      'flickerEvery', 'flickerChance', 'flickerSeconds', 'flickerDepth', 'driftSeconds', 'driftAmount',
      'bendReach', 'bendGain', 'flareGain', 'flareSeconds',
    ] as const) {
      assert(key in N, `tuning.neon has no ${key}`);
      assert(glow.includes(`N.${key}`), `neonGlow.ts does not read N.${key}`);
    }
  });
});
