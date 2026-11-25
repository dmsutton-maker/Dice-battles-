import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { assert, assertEqual, note, suite, test } from './harness';
import * as templeLife from '../src/arena/templeLife';
import { PHOENIX, PhoenixBird, phoenixFlight, TRAY_FOOTPRINT } from '../src/arena/phoenix';
import { TUNING } from '../src/game/tuning';

/*
  David, 1 Nov 2026: "Change the birds in the sun arena to one Phoenix
  and make it look like it has a fire aura coming off it."

  The Sun Temple had two ibises circling it (templeLife.tsx). Now it has
  one phoenix (phoenix.ts): a gold-to-red firebird with flames off its
  wings, crest and tail, a glow round it and embers drifting behind.
*/

const LAP = 1 / PHOENIX.pace;

suite('sun temple · one phoenix instead of two ibises', () => {
  test('templeLife exports a Phoenix and no longer an Ibis', () => {
    assertEqual(typeof templeLife.Phoenix, 'function', 'templeLife.tsx exports no Phoenix');
    assert(!('Ibis' in templeLife), 'templeLife.tsx still exports an Ibis');
    const source = readFileSync('src/arena/templeLife.tsx', 'utf8');
    assert(!/function Ibis\b|<Ibis\b/.test(source), 'templeLife.tsx still draws an ibis');
  });

  test('exactly ONE phoenix, and the three priests are still there', () => {
    const source = readFileSync('src/arena/templeLife.tsx', 'utf8');
    const life = source.slice(source.indexOf('export function TempleLife'), source.indexOf('function Priest'));
    assertEqual((life.match(/<Phoenix\b/g) ?? []).length, 1, 'the temple should have one phoenix');
    assertEqual((life.match(/<Priest\b/g) ?? []).length, 3, 'the procession lost a priest');
  });
});

suite('sun temple · where the phoenix flies', () => {
  const at = new THREE.Vector3();
  // The highest thing it must clear: a prisoner's head in the jail.
  const prisonerHead = TUNING.prison.platformHeight + 0.95 + 0.5;

  test('never over the tray, always above everything', () => {
    let lowest = Infinity;
    for (let t = 0; t < LAP; t += 0.02) {
      phoenixFlight(t, at);
      lowest = Math.min(lowest, at.y);
      const besideTray = Math.abs(at.z) < TRAY_FOOTPRINT.halfZ;
      const acrossTray = Math.abs(at.x) < TRAY_FOOTPRINT.halfX;
      assert(!(besideTray && acrossTray), `at ${t.toFixed(2)}s the phoenix is over the tray (${at.x.toFixed(2)}, ${at.z.toFixed(2)})`);
      // Alongside the floor its body keeps out over the side wall.
      if (Math.abs(at.z) < TRAY_FOOTPRINT.floorHalfZ) {
        assert(Math.abs(at.x) >= TRAY_FOOTPRINT.halfX + 0.3, `at ${t.toFixed(2)}s it drifts in over the floor`);
      }
    }
    note(`lowest point ${lowest.toFixed(2)}; prisoners' heads reach ${prisonerHead.toFixed(2)}`);
    assert(lowest > prisonerHead, 'the phoenix flies low enough to hit the jail');
  });

  test('it spends most of its time over the far half, where the camera sees it best', () => {
    let far = 0;
    let n = 0;
    for (let t = 0; t < LAP; t += 0.05) {
      phoenixFlight(t, at);
      n++;
      if (at.z < 0) far++;
    }
    note(`${((far / n) * 100).toFixed(0)}% of a ${LAP.toFixed(0)}s lap over the far half`);
    assert(far / n > 0.6, 'the phoenix no longer lingers over the far end');
  });

  test('it flies smoothly: no jumps from one frame to the next', () => {
    const prev = new THREE.Vector3();
    phoenixFlight(0, prev);
    let fastest = 0;
    for (let t = 1 / 60; t < LAP; t += 1 / 60) {
      phoenixFlight(t, at);
      fastest = Math.max(fastest, at.distanceTo(prev) * 60);
      prev.copy(at);
    }
    note(`top speed ${fastest.toFixed(2)} units a second`);
    assert(fastest < 3, 'the phoenix teleports');
  });
});

suite('sun temple · the phoenix and its fire', () => {
  test('the whole bird and its aura cost at most nine draw calls', () => {
    const bird = new PhoenixBird();
    let draws = 0;
    bird.group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) draws++;
    });
    note(`${draws} draw calls (the two ibises were 14)`);
    assert(draws <= 9, `the phoenix costs ${draws} draw calls`);
    bird.dispose();
  });

  test('the flames flicker, the tail streams and the embers drift', () => {
    const bird = new PhoenixBird();
    const snap = () => ({
      flames: Array.from(bird.flames.wingL.mesh.geometry.getAttribute('position').array),
      tail: Array.from(bird.tail.geometry.getAttribute('position').array),
      embers: Array.from(bird.embers.geometry.getAttribute('position').array),
    });
    bird.tick(10);
    const a = snap();
    bird.tick(10.15);
    const b = snap();
    const moved = (x: number[], y: number[]) => x.some((v, i) => Math.abs(v - y[i]) > 1e-3);
    assert(moved(a.flames, b.flames), 'the wing flames are frozen');
    assert(moved(a.tail, b.tail), 'the tail feathers are frozen');
    assert(moved(a.embers, b.embers), 'the embers are frozen');
    bird.dispose();
  });

  test('the embers trail behind the bird, not ahead of it', () => {
    const bird = new PhoenixBird();
    for (const t of [3, 12, 21, 30]) {
      bird.tick(t);
      const heading = bird.bird.rotation.y;
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const p = bird.embers.geometry.getAttribute('position');
      let ahead = 0;
      for (let i = 0; i < p.count; i++) {
        const along = (p.getX(i) - bird.bird.position.x) * fx + (p.getZ(i) - bird.bird.position.z) * fz;
        if (along > 0.2) ahead++;
      }
      assert(ahead <= 1, `at ${t}s ${ahead} embers are ahead of the phoenix`);
    }
    bird.dispose();
  });

  test('the flames fade out at their tips, so they read as fire, not spikes', () => {
    const bird = new PhoenixBird();
    const colour = bird.flames.body.mesh.geometry.getAttribute('color');
    assertEqual(colour.itemSize, 4, 'the flames have no alpha to fade with');
    for (let k = 0; k < bird.flames.body.count; k++) {
      assert(colour.getW(k * 5) > 0.8, 'a flame root is faint');
      assertEqual(colour.getW(k * 5 + 4), 0, 'a flame tip does not fade out');
      // Warm: red over green over blue at the root.
      assert(colour.getX(k * 5) >= colour.getY(k * 5) && colour.getY(k * 5) > colour.getZ(k * 5), 'a flame is not a fire colour');
    }
    bird.dispose();
  });

  test('a tick allocates nothing', () => {
    /*
      The tick runs every drawn frame on a phone. It must only write
      numbers into what the constructor built: the same arrays, the same
      objects, before and after a thousand frames, and nothing in the
      per-frame code that constructs anything.
    */
    const bird = new PhoenixBird();
    const objects: unknown[] = [];
    bird.group.traverse((o) => {
      objects.push(o);
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        objects.push(o.geometry, o.material);
        for (const name of Object.keys(o.geometry.attributes)) {
          const attr = o.geometry.getAttribute(name);
          objects.push(attr, attr.array);
        }
      }
    });
    for (let f = 0; f < 1000; f++) bird.tick(f / 60);
    const after: unknown[] = [];
    bird.group.traverse((o) => {
      after.push(o);
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        after.push(o.geometry, o.material);
        for (const name of Object.keys(o.geometry.attributes)) {
          const attr = o.geometry.getAttribute(name);
          after.push(attr, attr.array);
        }
      }
    });
    assertEqual(after.length, objects.length, 'the tick added or removed something');
    assert(after.every((o, i) => o === objects[i]), 'the tick replaced an object or an array');

    const source = readFileSync('src/arena/phoenix.ts', 'utf8');
    const start = source.indexOf('/* ── Every frame: numbers only, nothing new');
    const end = source.indexOf('/* ── end of the per-frame code');
    assert(start > 0 && end > start, 'the per-frame section markers in phoenix.ts have moved');
    const frame = source.slice(start, end);
    for (const [pattern, what] of [
      [/\bnew \w/, 'constructs an object'],
      [/\.clone\(|\.map\(|\.filter\(|\.slice\(|\.concat\(|Array\.from|\.\.\.\w/, 'copies an array'],
      [/=\s*\[|\(\s*\[/, 'builds an array literal'],
    ] as const) {
      assert(!pattern.test(frame), `the phoenix's per-frame code ${what}`);
    }
    // The flame fringe's update runs every frame too.
    const update = source.slice(source.indexOf('  update(t: number, seed: number): void {'), source.indexOf('/** Flames off a wing'));
    assert(update.length > 100, 'FlameFringe.update has moved');
    assert(!/\bnew \w|=\s*\[|\.map\(/.test(update), 'the flame fringe allocates every frame');
    bird.dispose();
  });
});
