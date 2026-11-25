import * as THREE from 'three';
import { assert, assertAtMost, note, suite, test } from './harness';
import { ARENAS, ArenaId } from '../src/arena/arenas';
import { MoundKind, OBSTACLE_LOOKS, obstacleLook, PitKind } from '../src/arena/obstacleLooks';
import {
  BUMP_SECONDS,
  bumpSquash,
  buildMound,
  buildPit,
  BuiltHazard,
  GULP_SECONDS,
  gulpScale,
  isWaterPit,
  MOUND_TOP,
  PieceFlags,
} from '../src/arena/hazardShapes';
import { MOAT, MOUND, obstacleHint } from '../src/game/obstacles';

/**
 * The traps, board by board (docs/board-redesign.md, 18 Oct 2026: "make
 * sure each trap matches its board name").
 *
 * Every bump and pit is now its own model, which is exactly how a trap
 * could start lying about its physics: a sandcastle tower a die seems to
 * pass straight through, or a crater rim hanging over the hole so a die
 * vanishes into the floor beside it. So these build all forty, headless,
 * and measure the real vertices against the real collision shapes.
 */

const IDS = Object.keys(ARENAS) as ArenaId[];
const R = MOUND.radius;
const C = -MOUND.buried;
const H = MOAT.size / 2;

/** Every vertex of every piece, in the trap's own space, with its flags. */
function pieces(built: BuiltHazard): { flags: PieceFlags; points: THREE.Vector3[]; name: string }[] {
  built.group.updateMatrixWorld(true);
  const out: { flags: PieceFlags; points: THREE.Vector3[]; name: string }[] = [];
  const m = new THREE.Matrix4();
  built.group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const pos = o.geometry.getAttribute('position');
    const flags = (o.userData.hazard ?? {}) as PieceFlags;
    const name = `${o.geometry.type}${o instanceof THREE.InstancedMesh ? ` x${o.count}` : ''}`;
    const instances = o instanceof THREE.InstancedMesh ? o.count : 1;
    for (let k = 0; k < instances; k++) {
      const world = o.matrixWorld.clone();
      if (o instanceof THREE.InstancedMesh) {
        o.getMatrixAt(k, m);
        world.multiply(m);
      }
      const points: THREE.Vector3[] = [];
      for (let i = 0; i < pos.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(world));
      out.push({ flags, points, name });
    }
  });
  return out;
}

/** Draw calls: one per mesh, an instanced set counting once. */
function drawCalls(built: BuiltHazard): number {
  let n = 0;
  built.group.traverse((o) => {
    if (o instanceof THREE.Mesh) n++;
  });
  return n;
}

suite('hazards · every board has its own traps', () => {
  test('every arena names what its bump and its pit are', () => {
    const moundKinds = new Set<MoundKind>();
    const pitKinds = new Set<PitKind>();
    for (const id of IDS) {
      const look = obstacleLook(id);
      assert(typeof look.mound.kind === 'string' && look.mound.kind.length > 0, `${id} has no bump kind`);
      assert(typeof look.pit.kind === 'string' && look.pit.kind.length > 0, `${id} has no pit kind`);
      moundKinds.add(look.mound.kind);
      pitKinds.add(look.pit.kind);
    }
    note(`${moundKinds.size} different bumps and ${pitKinds.size} different pits on ${IDS.length} boards`);
    // The whole point of the redesign: no two boards share a trap.
    assert(moundKinds.size === IDS.length, 'two boards draw the same bump');
    assert(pitKinds.size === IDS.length, 'two boards draw the same pit');
  });

  test('every arena has words for its pit, its bump and the splash, and they read', () => {
    for (const id of IDS) {
      const { words } = OBSTACLE_LOOKS[id];
      for (const [k, w] of Object.entries(words)) {
        assert(typeof w === 'string' && w.trim().length > 0, `${id} has no ${k} word`);
      }
      // The hints say "A <bump> in a new spot" and "a <pit> that
      // swallows dice", so neither may start with a vowel sound.
      assert(!/^[aeiou]/i.test(words.mound), `${id}: "A ${words.mound}" — the hint would read wrong`);
      assert(!/^[aeiou]/i.test(words.pit), `${id}: "a ${words.pit}" — the hint would read wrong`);
      const hard = obstacleHint('hard', words);
      assert(hard.includes(words.pit) && hard.includes(words.mound), `${id}: the Hard hint loses a word`);
    }
  });

  test('the words name what is drawn, not the old placeholders', () => {
    // Spot checks against the table in docs/board-redesign.md.
    const expect: [ArenaId, RegExp, RegExp][] = [
      ['volcano', /lava/, /smoking rock/],
      ['space', /hatch/, /bulkhead/],
      ['moon', /crater/, /boulder/],
      ['sky', /cloud/, /cloud/],
      ['farm', /mud/, /haystack/],
      ['candy', /chocolate/, /gumdrop/],
      ['toybox', /toy box/, /beach ball/],
      ['snow', /frozen pond/, /snowman/],
      ['city', /skylight/, /air conditioner/],
    ];
    for (const [id, pit, mound] of expect) {
      const { words } = OBSTACLE_LOOKS[id];
      assert(pit.test(words.pit), `${id}'s pit is called "${words.pit}"`);
      assert(mound.test(words.mound), `${id}'s bump is called "${words.mound}"`);
    }
  });

  test('no board paints a trap in a pure primary', () => {
    const pure = /#(ff0000|00ff00|0000ff|ffff00)\b/i;
    for (const id of IDS) {
      assert(!pure.test(JSON.stringify(OBSTACLE_LOOKS[id])), `${id} uses a pure primary`);
    }
  });
});

suite('hazards · the physics does not change', () => {
  test('nothing on a bump a die can touch sticks out of the sphere', () => {
    let worst = -Infinity;
    for (const id of IDS) {
      const built = buildMound(obstacleLook(id).mound);
      for (const { flags, points, name } of pieces(built)) {
        for (const v of points) {
          const across = Math.hypot(v.x, v.z);
          if (flags.crown) {
            // Near the middle of the top, or well above it (a flag on a
            // pole): places a die skidding off the dome never reaches.
            assert(
              across <= 0.45 || v.y >= MOUND_TOP + 0.45,
              `${id}: a ${name} on top reaches ${across.toFixed(2)} from the middle at height ${v.y.toFixed(2)}`,
            );
            continue;
          }
          if (v.y <= 0.005) continue;
          const out = Math.hypot(across, v.y - C) - R;
          worst = Math.max(worst, out);
          assert(out <= 0.01, `${id}: a ${name} sticks ${out.toFixed(3)} out of the bump at height ${v.y.toFixed(2)}`);
        }
      }
      built.dispose();
    }
    note(`closest any piece comes to the sphere's surface: ${worst.toFixed(3)}`);
  });

  test('every bump still LOOKS like the bump: it fills the dome', () => {
    // The other half of the rule. A bump drawn much smaller than the
    // sphere has dice bouncing off thin air. Something must reach the
    // dome's top and its foot.
    for (const id of IDS) {
      const built = buildMound(obstacleLook(id).mound);
      let top = 0;
      let foot = 0;
      for (const { points } of pieces(built)) {
        for (const v of points) {
          if (Math.hypot(v.x, v.z) < 0.3) top = Math.max(top, v.y);
          // Corners just under the floor count (a rock's faces run on
          // down past it), and so does a toadstool's lip just above it.
          if (v.y > -0.3 && v.y < 0.16) foot = Math.max(foot, Math.hypot(v.x, v.z));
        }
      }
      assert(top >= MOUND_TOP - 0.16, `${id}'s bump only reaches ${top.toFixed(2)} of ${MOUND_TOP.toFixed(2)}`);
      assert(foot >= 0.72, `${id}'s bump only spreads ${foot.toFixed(2)} across the floor`);
      built.dispose();
    }
  });

  test('nothing hangs over the hole where a die falls in', () => {
    for (const id of IDS) {
      const built = buildPit(obstacleLook(id).pit);
      for (const { flags, points, name } of pieces(built)) {
        if (flags.surface) {
          // The pit's own inside lies exactly over the hole, flat.
          for (const v of points) {
            assert(Math.abs(Math.abs(v.x) - H) < 1e-6 || Math.abs(v.x) < H, `${id}: the pit surface is wider than the hole`);
            assert(Math.abs(v.y - 0.035) < 1e-6, `${id}: the pit surface is not flat on the floor`);
          }
          continue;
        }
        for (const v of points) {
          if (Math.abs(v.x) >= H - 0.005 || Math.abs(v.z) >= H - 0.005) continue;
          const limit = flags.float ? 0.16 : 0.06;
          assert(
            v.y <= limit || v.y >= 0.3,
            `${id}: a ${name} sits ${v.y.toFixed(2)} high over the hole`,
          );
        }
      }
      built.dispose();
    }
  });

  test('a shader pit covers exactly the hole', () => {
    for (const id of IDS) {
      const look = obstacleLook(id).pit;
      const built = buildPit(look);
      const surfaces = pieces(built).filter((p) => p.flags.surface);
      if (isWaterPit(look.kind)) {
        assert(surfaces.length === 0, `${id}: a water pit also has a shader surface`);
      } else {
        assert(surfaces.length === 1, `${id}: ${surfaces.length} pit surfaces`);
        const xs = surfaces[0].points.map((v) => v.x);
        const zs = surfaces[0].points.map((v) => v.z);
        assert(Math.min(...xs) === -H && Math.max(...xs) === H, `${id}: surface is not the hole's width`);
        assert(Math.min(...zs) === -H && Math.max(...zs) === H, `${id}: surface is not the hole's depth`);
      }
      built.dispose();
    }
  });
});

suite('hazards · they cost little and clean up after themselves', () => {
  test('each trap stays inside its draw-call budget', () => {
    let most = 0;
    for (const id of IDS) {
      const look = obstacleLook(id);
      const mound = buildMound(look.mound);
      const pit = buildPit(look.pit);
      // A water pit also draws its WaterSurface and the depths below.
      const pitCalls = drawCalls(pit) + (isWaterPit(look.pit.kind) ? 2 : 0);
      most = Math.max(most, drawCalls(mound), pitCalls);
      assert(drawCalls(mound) <= 25, `${id}'s bump is ${drawCalls(mound)} draw calls`);
      assert(pitCalls <= 25, `${id}'s pit is ${pitCalls} draw calls`);
      mound.dispose();
      pit.dispose();
    }
    assertAtMost(most, 25, 'draw calls for the busiest trap');
  });

  test('everything a trap builds is freed when it goes', () => {
    for (const id of IDS) {
      const look = obstacleLook(id);
      for (const built of [buildMound(look.mound), buildPit(look.pit)]) {
        const owed = new Set<THREE.EventDispatcher<any>>();
        built.group.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const thing of [o.geometry, ...mats]) {
            if (owed.has(thing)) continue;
            owed.add(thing);
            thing.addEventListener('dispose', () => owed.delete(thing));
          }
        });
        built.dispose();
        assert(owed.size === 0, `${id}: ${owed.size} geometries or materials left behind`);
      }
    }
  });

  test('anything that moves is on the shared clock', () => {
    for (const id of IDS) {
      const look = obstacleLook(id);
      for (const built of [buildMound(look.mound), buildPit(look.pit)]) {
        built.group.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const m = o.material as THREE.Material;
          if (m instanceof THREE.ShaderMaterial && 'uTime' in m.uniforms) {
            assert(built.live.includes(m), `${id}: an animated material is not on the clock`);
          }
        });
        built.dispose();
      }
    }
  });
});

suite('hazards · the springs', () => {
  test('the gulp pulls in, springs back, and comes to rest', () => {
    assert(gulpScale(0) === 1 && gulpScale(GULP_SECONDS) === 1 && gulpScale(5) === 1, 'the pit is not at rest');
    assert(gulpScale(0.05) < 0.97, 'the gulp does not pull inward first');
    let lo = 1;
    let hi = 1;
    for (let t = 0; t <= GULP_SECONDS; t += 0.005) {
      lo = Math.min(lo, gulpScale(t));
      hi = Math.max(hi, gulpScale(t));
    }
    assert(lo > 0.92 && hi < 1.04, `the gulp is too big (${lo.toFixed(3)}..${hi.toFixed(3)})`);
    assert(hi > 1.001, 'the gulp does not spring back past rest');
    assert(Math.abs(gulpScale(GULP_SECONDS - 0.001) - 1) < 0.01, 'the gulp snaps at the end');
  });

  test('the bump squash is small and settles', () => {
    assert(bumpSquash(0) === 1 && bumpSquash(BUMP_SECONDS) === 1, 'the bump is not at rest');
    for (let t = 0; t <= BUMP_SECONDS; t += 0.005) {
      const s = bumpSquash(t);
      assert(s > 0.94 && s < 1.03, `the squash reaches ${s.toFixed(3)}`);
    }
    assert(Math.abs(bumpSquash(BUMP_SECONDS - 0.001) - 1) < 0.01, 'the squash snaps at the end');
  });
});
