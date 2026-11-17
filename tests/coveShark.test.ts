import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, suite, test } from './harness';
import {
  COVE_HULLS,
  DIVE_DEPTH,
  DIVE_RUN,
  diveDepthAt,
  HULL_HALF_BEAM,
  HULL_HALF_LENGTH,
  HULL_MARGIN,
  SHARK_LAP,
  SHARK_SPEED,
  sharkPath,
  sharkPose,
  type PathPoint,
  type SharkPose,
} from '../src/arena/coveShark';
import { ARENA_THEMES } from '../src/arena/themeData';

/*
  David, 1 Nov 2026: "In the pirates cove the shark goes over the boats
  and overlaps with them, make it swim under them." The sea is painted
  on an opaque ground, so under a boat the shark is simply below it. But
  it must dive and surface smoothly, only where a boat is: on 20 Oct
  2026 a shark that vanished for a couple of seconds drew a complaint.
*/

const STEPS = 20000;
/** Metres of path between two samples: the lap is ~42 long. */
const STEP_LEN = SHARK_LAP / STEPS;
/** How far the shark's body reaches ahead of and behind its middle. */
const BODY_FRONT = 0.7;
const BODY_BACK = 0.6;
const P: PathPoint = { x: 0, y: 0, z: 0 };
const POSE: SharkPose = { dive: 0, pitch: 0 };

/** Is (x, z) inside a boat's footprint, margin included? */
const insideHull = (x: number, z: number) =>
  COVE_HULLS.some((h) => ((x - h.x) / h.rx) ** 2 + ((z - h.z) / h.rz) ** 2 <= 1);
/** Is (x, z) farther than the dive's run from every footprint? */
const clearOfHulls = (x: number, z: number, extra: number) =>
  COVE_HULLS.every((h) => ((x - h.x) / (h.rx + DIVE_RUN + extra)) ** 2 + ((z - h.z) / (h.rz + DIVE_RUN + extra)) ** 2 > 1);

suite('cove shark · the footprints match the boats that are drawn', () => {
  test('the hull is the half-sphere ThemedArena draws', () => {
    const src = readFileSync(join(__dirname, '..', 'src', 'arena', 'ThemedArena.tsx'), 'utf8');
    const ship = src.slice(src.indexOf('function ShipMast()'), src.indexOf('function Barn()'));
    assert(ship.includes('scale={[1, 0.55, 0.5]}'), 'the hull is no longer squashed 1 : 0.55 : 0.5');
    assert(ship.includes('<sphereGeometry args={[1.4, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />'), 'the hull is no longer a half-sphere of radius 1.4');
    assert(HULL_HALF_LENGTH === 1.4 && HULL_HALF_BEAM === 0.7, 'the footprint is not 1.4 x 0.7');
  });

  test('every shipMast prop in the cove has a footprint, a little wider than the hull', () => {
    const masts = ARENA_THEMES.cove.props.filter((p) => p.kind === 'shipMast');
    assert(masts.length === 3 && COVE_HULLS.length === masts.length, 'the cove should have its three boats');
    masts.forEach((m, i) => {
      const h = COVE_HULLS[i];
      assert(h.x === m.x && h.z === m.z, 'a footprint is not where its boat is');
      assert(Math.abs(h.rx - (1.4 * m.scale! + HULL_MARGIN)) < 1e-9, 'a footprint is the wrong length');
      assert(HULL_MARGIN > 0 && HULL_MARGIN <= 0.25, 'the margin round a hull should be small');
    });
  });
});

suite('cove shark · it swims under the boats', () => {
  test('the path crosses at least one hull footprint', () => {
    let crossings = 0;
    const boats = new Set<number>();
    for (let i = 0; i < STEPS; i++) {
      sharkPath(i / STEPS, P);
      COVE_HULLS.forEach((h, k) => {
        if (((P.x - h.x) / h.rx) ** 2 + ((P.z - h.z) / h.rz) ** 2 <= 1) boats.add(k);
      });
      if (insideHull(P.x, P.z)) crossings++;
    }
    assert(crossings > 0 && boats.size >= 2, `the lap only enters ${boats.size} footprints; it should cross the boats it was overlapping`);
  });

  test('the dive depth is at the surface in open water and well below it inside a footprint', () => {
    let inside = 0;
    let open = 0;
    for (let i = 0; i < STEPS; i++) {
      sharkPath(i / STEPS, P);
      const d = diveDepthAt(P.x, P.z);
      assert(d <= 0 && d >= -DIVE_DEPTH - 1e-9, `the depth ${d} is outside 0..-${DIVE_DEPTH}`);
      if (insideHull(P.x, P.z)) {
        inside++;
        assert(Math.abs(d + DIVE_DEPTH) < 1e-9, `inside a footprint at (${P.x.toFixed(2)}, ${P.z.toFixed(2)}) the depth is ${d}, not ${-DIVE_DEPTH}`);
      }
      if (clearOfHulls(P.x, P.z, 0)) {
        open++;
        assert(d === 0, `in open water at (${P.x.toFixed(2)}, ${P.z.toFixed(2)}) the depth is ${d}, not 0`);
      }
    }
    assert(inside > 0 && open > 0, 'the lap should have both open water and boats in it');
  });

  test('no part of the shark is above the water where a hull is', () => {
    // The shark's back is about 0.27 above the line down its middle, so
    // a body point inside a footprint is hidden by the ground when the
    // line is lower than that.
    let worst = -Infinity;
    for (let i = 0; i < STEPS; i++) {
      const heading = sharkPath(i / STEPS, P);
      sharkPose(P.x, P.z, heading, POSE);
      for (let r = -BODY_BACK; r <= BODY_FRONT; r += 0.05) {
        if (!insideHull(P.x + Math.sin(heading) * r, P.z + Math.cos(heading) * r)) continue;
        // Nose-down (positive pitch) lowers the nose, r > 0.
        worst = Math.max(worst, POSE.dive - r * Math.tan(POSE.pitch));
      }
    }
    assert(worst <= -0.3, `a part of the shark inside a footprint is only ${worst.toFixed(2)} down; it would show over the hull`);
  });

  test('the pose is smooth: no jump between two samples a hair apart', () => {
    // The steepest the depth changes is DIVE_DEPTH over DIVE_RUN, 1.5
    // times at the middle of the smoothstep, and the nose, middle and
    // tail can each change at once.
    const maxDive = (DIVE_DEPTH / DIVE_RUN) * 1.6 * STEP_LEN * 1.1;
    let prev: SharkPose | null = null;
    let worstDive = 0;
    let worstPitch = 0;
    for (let i = 0; i <= STEPS; i++) {
      const heading = sharkPath(i / STEPS, P);
      sharkPose(P.x, P.z, heading, POSE);
      if (prev) {
        worstDive = Math.max(worstDive, Math.abs(POSE.dive - prev.dive));
        worstPitch = Math.max(worstPitch, Math.abs(POSE.pitch - prev.pitch));
      }
      prev = { dive: POSE.dive, pitch: POSE.pitch };
    }
    assert(worstDive < maxDive, `the depth jumped ${worstDive.toFixed(4)} between two samples ${STEP_LEN.toFixed(4)} apart (limit ${maxDive.toFixed(4)})`);
    assert(worstPitch < 0.02, `the tilt jumped ${worstPitch.toFixed(4)} between two samples`);
  });

  test('each pass under a boat is brief: a second to go down and a second to come up at most', () => {
    // Time every stretch where the shark is below the surface at all.
    let longest = 0;
    let run = 0;
    for (let i = 0; i <= STEPS; i++) {
      const heading = sharkPath(i / STEPS, P);
      sharkPose(P.x, P.z, heading, POSE);
      run = POSE.dive < -0.05 ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    const seconds = (longest * STEP_LEN) / SHARK_SPEED;
    assert(seconds <= 2, `one pass under a boat takes ${seconds.toFixed(2)} s from the first dip to the last`);
  });

  test('the nose dips going in and rises coming out', () => {
    // Nose-down (positive pitch) happens, and so does nose-up.
    let down = 0;
    let up = 0;
    for (let i = 0; i < STEPS; i++) {
      const heading = sharkPath(i / STEPS, P);
      sharkPose(P.x, P.z, heading, POSE);
      if (POSE.pitch > 0.1) down++;
      if (POSE.pitch < -0.1) up++;
    }
    assert(down > 0 && up > 0, 'the shark never tips its nose down going in and up coming out');
  });

  test('it is above the surface for most of the lap, and in view everywhere but under a hull', () => {
    let above = 0;
    let hidden = 0;
    for (let i = 0; i < STEPS; i++) {
      const heading = sharkPath(i / STEPS, P);
      sharkPose(P.x, P.z, heading, POSE);
      // Its back, about 0.27 above its middle, is out of the water.
      if (POSE.dive > -0.27) above++;
      if (POSE.dive > -DIVE_DEPTH + 1e-6) continue;
      hidden++;
      // Wholly hidden only when some part of it really is under a boat.
      const under = [BODY_FRONT, 0, -BODY_BACK].some((r) => insideHull(P.x + Math.sin(heading) * r, P.z + Math.cos(heading) * r));
      assert(under, `at lap ${(i / STEPS).toFixed(3)} the shark is hidden but nothing of it is under a boat`);
    }
    const fraction = above / STEPS;
    assert(fraction >= 0.75, `the shark is above the surface for only ${(fraction * 100).toFixed(0)} % of the lap`);
    const hiddenSeconds = (hidden / STEPS) * (SHARK_LAP / SHARK_SPEED);
    assert(hiddenSeconds < 8, `the shark is hidden for ${hiddenSeconds.toFixed(1)} s of a lap`);
  });
});
