import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  circuitPulseTexture,
  LOOP_LENGTH,
  pulseAt,
  pulsingCircuitMaterials,
  WIRE_LENGTH,
} from '../src/dice/circuitPulse';
import { CIRCUIT_ROUTES, FACE_FRAMES } from '../src/dice/patterns';

/*
  David, 21 Oct 2026: "Show electrical pulses going through the circuit
  board dice." The board is painted once; a wiring map says how far along
  its wire every texel is, and the GPU lights the part of each wire the
  clock has reached (circuitPulse.ts). For a pulse to run from one chip,
  over an edge, to the next chip — and round a corner — the map has to
  agree on both sides of every edge.
*/
const H = 32;
const IN = 0.6;
const root = join(__dirname, '..');

suite('circuit dice · the pulses', () => {
  test('a wire is measured the same from both sides of every edge it crosses', () => {
    let checked = 0;
    let worst = 0;
    for (let f = 0; f < 6; f++) {
      const F = FACE_FRAMES[f];
      for (const r of CIRCUIT_ROUTES) {
        const ends = r.kind === 'pin' ? [r.points[r.points.length - 1]] : [r.points[0], r.points[r.points.length - 1]];
        for (const [eu, ev] of ends) {
          // A point just inside this side, on the wire where it meets the
          // edge, and the same point just inside the side over the edge.
          const onV = Math.abs(ev) === H;
          const iu = onV ? eu : Math.sign(eu) * (H - IN);
          const iv = onV ? Math.sign(ev) * (H - IN) : ev;
          const P = [0, 1, 2].map((i) => H * F.n[i] + iu * F.u[i] + iv * F.v[i]);
          const nrm = onV ? F.v.map((c) => c * Math.sign(ev)) : F.u.map((c) => c * Math.sign(eu));
          const Q = [0, 1, 2].map((i) => H * nrm[i] + (onV ? eu * F.u[i] : ev * F.v[i]) + (H - IN) * F.n[i]);
          const a = pulseAt(P);
          const b = pulseAt(Q);
          if (a === null || b === null) throw new Error(`side ${f}: the wire at (${eu}, ${ev}) is not on the map`);
          assertEqual(a.kind, r.kind === 'pin' ? 0 : 1, `side ${f}: wrong kind of wire at (${eu}, ${ev})`);
          assertEqual(a.kind, b.kind, `side ${f}: the wire changes kind over the edge at (${eu}, ${ev})`);
          assertEqual(a.phase, b.phase, `side ${f}: the wire changes phase over the edge at (${eu}, ${ev})`);
          assertEqual(a.on, 1, `side ${f}: the wire is dim at (${eu}, ${ev})`);
          const len = a.kind ? LOOP_LENGTH : WIRE_LENGTH;
          // A loop closes on itself, so 0 and 1 are the same place on it.
          const raw = Math.abs(a.along - b.along);
          const gap = Math.min(raw, 1 - raw) * len;
          worst = Math.max(worst, gap);
          assert(gap <= 2 * IN + 0.01, `side ${f}: the wire jumps ${gap.toFixed(2)} texels at the edge at (${eu}, ${ev})`);
          checked++;
        }
      }
    }
    note(`${checked} edge crossings; the worst step is ${worst.toFixed(2)} texels for points ${2 * IN} apart`);
  });

  test('a wire runs from one chip to the other, and a loop right round its corner', () => {
    assertEqual(WIRE_LENGTH, 26, 'a chip-to-chip wire');
    assertEqual(LOOP_LENGTH, 48, 'a corner loop');
    // The pin of a chip on the +X side is one end of its wire.
    const pin = pulseAt([H, 9, 23]);
    assert(pin !== null && pin.on === 1 && (pin.along === 0 || pin.along === 1), 'a chip pin is not the end of a wire');
    // Nothing in the middle of a side, where the sticker is.
    assertEqual(pulseAt([H, 0, 0]), null, 'the map lights the middle of a side');
    assertEqual(pulseAt([H, 5, -4]), null, 'the map lights the sticker');
  });

  test('every side has a map, written as data and never averaged across wires', () => {
    for (let face = 0; face < 6; face++) {
      const t = circuitPulseTexture(face) as THREE.DataTexture;
      const img = t.image as { data: Uint8Array; width: number; height: number };
      assertEqual(img.width, 64, `side ${face} map width`);
      let lit = 0;
      for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 0) lit++;
      const share = lit / (img.width * img.height);
      assert(share > 0.12 && share < 0.5, `side ${face}: ${(share * 100).toFixed(0)}% of the map is wire`);
      assertEqual(t.generateMipmaps, false, `side ${face}: the map has mipmaps`);
      assertEqual(t.colorSpace, THREE.NoColorSpace, `side ${face}: the map is treated as colour`);
    }
  });

  test('three still has the hooks the pulses are spliced into', () => {
    const frag = THREE.ShaderLib.basic.fragmentShader;
    assert(frag.includes('#include <map_fragment>'), 'MeshBasicMaterial lost its map chunk');
    const materials = pulsingCircuitMaterials({}, '#143a2a', '#57d0c9');
    assertEqual(materials.length, 6, 'six sides');
    for (let face = 0; face < 6; face++) {
      const shader = {
        uniforms: {} as Record<string, { value: unknown }>,
        fragmentShader: frag,
        vertexShader: '',
      };
      materials[face].onBeforeCompile(shader as never, undefined as never);
      assert(/uniform sampler2D uPulseMap;/.test(shader.fragmentShader), 'the wiring map is not declared');
      assert('uPulseTime' in shader.uniforms, 'the pulses have no clock');
      assert(/texture2D\(uPulseMap, vMapUv\)/.test(shader.fragmentShader), 'the wiring map is not read');
      assert(/fract\(uPulseTime/.test(shader.fragmentShader), 'the clock does not move the pulse');
    }
    // One clock, shared: a pulse crosses an edge only if both sides agree what time it is.
    const a = { uniforms: {} as Record<string, { value: unknown }>, fragmentShader: frag, vertexShader: '' };
    const b = { uniforms: {} as Record<string, { value: unknown }>, fragmentShader: frag, vertexShader: '' };
    materials[0].onBeforeCompile(a as never, undefined as never);
    materials[4].onBeforeCompile(b as never, undefined as never);
    assert(a.uniforms.uPulseTime === b.uniforms.uPulseTime, 'the sides run on different clocks');
  });

  test('the die on the board pulses, and the shop card stays a still picture', () => {
    const mesh = readFileSync(join(root, 'src/dice/DieMesh.tsx'), 'utf8');
    assert(/pattern === 'circuit'\) return pulsingCircuitMaterials\(/.test(mesh), 'the Circuit die does not pulse');
    assert(/pattern === 'circuit' \? PULSE_TICK/.test(mesh), 'nothing moves the pulses');
    const warm = readFileSync(join(root, 'src/dice/warmPreviews.ts'), 'utf8');
    assert(/circuitPulseTexture\(face\)/.test(warm), 'the wiring map is not warmed with the rest');
    const preview = readFileSync(join(root, 'src/dice/preview.ts'), 'utf8');
    assert(!/circuitPulse/.test(preview), 'the shop card has started pulsing');
  });
});
