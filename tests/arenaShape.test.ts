import * as THREE from 'three';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { palisadeLogs, palisadeTopHeight } from '../src/arena/palisade';
import { TUNING } from '../src/game/tuning';
import { assert, assertEqual, note, suite, test } from './harness';

/**
 * Every battlefield used to be the same building.
 *
 * Four full-height box walls at the tray edge, an ornament along the top,
 * and a round tower at each corner — merlons on one, light strips on
 * another, cracked slabs on a third. The props between them differed
 * (palms, solar panels, tiki parasols) but the SKYLINE did not, and a
 * skyline is what you actually recognise a place by. So all three read as
 * the castle in a different colour, which is exactly what David said.
 *
 * These measure the shape vocabulary each arena builds its boundary from.
 * They cannot tell whether it looks GOOD — nothing here can render, so
 * that judgement needs eyes on a device — but they can tell whether two
 * arenas are the same shape, which is the thing that went wrong.
 */

const ARENA_FILES = readdirSync('src/arena').filter(
  (f) => f.endsWith('Arena.tsx'),
);

suite('arenas · no two battlefields are the same building', () => {
  test('there is more than one arena to compare', () => {
    assert(ARENA_FILES.length >= 3, `only ${ARENA_FILES.length} arenas found`);
    note(ARENA_FILES.join(', '));
  });

  /*
   * There were two tests here that compared which three.js primitives each
   * arena file uses, on the theory that two arenas sharing a vocabulary
   * are one model repainted.
   *
   * They were wrong, and usefully so: the castle and the jungle both use
   * boxes, cylinders, cones, spheres, circles and planes, because those
   * are the only shapes there ARE. What separates a palisade from a
   * battlement is not which primitives but how many, how tall, and where —
   * so the palisade moved out into ./palisade.ts as data and is measured
   * properly below. Counting primitive types was a measure that happened
   * to be easy rather than one that meant anything.
   */

  test('the jungle boundary is a palisade, not a wall', () => {
    const logs = palisadeLogs();
    note(`${logs.length} logs around the jungle boundary`);
    // One box is a wall. A palisade is many separate pieces of timber.
    assert(logs.length >= 16, `only ${logs.length} logs — that is not a built wall`);
  });

  test('the logs lie down, because the camera looks down', () => {
    // The whole reason the boundary was rebuilt. An upright log presents
    // its TOP to a camera above, so eighty-eight of them read as a ring of
    // sawn stumps — which is what the screenshot showed. A log on its side
    // presents its length.
    const logs = palisadeLogs();
    const upright = logs.filter((l) => l.upright);
    const rails = logs.filter((l) => !l.upright);
    note(`${rails.length} rails lying down, ${upright.length} upright corner posts`);
    assert(rails.length > upright.length * 2, 'most of the boundary is still standing on end');
    // The corners are the exception, and there are exactly four of them.
    assertEqual(upright.length, 4, 'the corner posts are not four');
  });

  test('every log actually points the way it is meant to', () => {
    // A cylinder's axis is +Y, so a rail has to be TURNED onto its side —
    // and the Euler order that does it is easy to get wrong in a way
    // nothing else would catch. A rail rotated wrongly lies across the
    // middle of the arena instead of along its edge, and no other test
    // here looks at rotation at all.
    for (const log of palisadeLogs()) {
      const axis = new THREE.Vector3(0, 1, 0)
        .applyEuler(new THREE.Euler(...log.rotation))
        .round();
      const [x, , z] = log.position;
      if (log.upright) {
        assertEqual(Math.abs(axis.y), 1, 'a corner post is not standing up');
      } else if (x === 0) {
        // A rail on the front or back run: it must lie along X.
        assertEqual(Math.abs(axis.x), 1, `a rail at z ${z} does not lie along its run`);
      } else {
        assertEqual(Math.abs(axis.z), 1, `a rail at x ${x} does not lie along its run`);
      }
    }
  });

  test('the timber stands proud of the wall the dice bounce off', () => {
    // A boundary drawn shorter than the invisible collision wall makes a
    // die look like it stopped against nothing.
    const { wallHeight } = TUNING.tray;
    const top = palisadeTopHeight();
    note(`palisade stands ${top.toFixed(2)} against a ${wallHeight} wall`);
    assert(top >= wallHeight, `timber only reaches ${top.toFixed(2)} of a ${wallHeight} wall`);
    // But not so tall it walls the player out of their own arena.
    assert(top < wallHeight * 1.6, `timber towers ${top.toFixed(2)} over a ${wallHeight} wall`);
  });

  test('the courses stack without daylight between them', () => {
    // Gaps between the rails would show the dark ground straight through
    // the wall, which is worse than a fence.
    const rails = palisadeLogs().filter((l) => !l.upright);
    const bySide = new Map<string, typeof rails>();
    for (const rail of rails) {
      const [x, , z] = rail.position;
      const key = rail.rotation[0] === 0 ? `alongX${z > 0 ? '+' : '-'}` : `alongZ${x > 0 ? '+' : '-'}`;
      if (!bySide.has(key)) bySide.set(key, []);
      bySide.get(key)!.push(rail);
    }
    assertEqual(bySide.size, 4, 'the boundary is not four runs of rails');
    let worst = -Infinity;
    for (const run of bySide.values()) {
      run.sort((a, b) => a.position[1] - b.position[1]);
      for (let i = 1; i < run.length; i++) {
        worst = Math.max(
          worst,
          run[i].position[1] - run[i - 1].position[1] - run[i].radius - run[i - 1].radius,
        );
      }
    }
    note(`palisade: worst gap between courses ${worst.toFixed(3)} (negative means overlapping)`);
    assert(worst < 0, `${worst.toFixed(2)} of daylight between two courses`);
  });

  test('every run reaches its corner posts', () => {
    // A rail short of the corner leaves a notch of daylight at each end.
    const { innerWidth, innerDepth, wallThickness } = TUNING.tray;
    for (const rail of palisadeLogs().filter((l) => !l.upright)) {
      const alongX = rail.rotation[0] === 0;
      const span = alongX ? innerWidth + wallThickness * 2 : innerDepth + wallThickness * 2;
      assert(
        rail.length >= span,
        `a rail spans ${rail.length.toFixed(2)} of a ${span.toFixed(2)} run`,
      );
    }
  });

  test('the logs are timber, not the temple stone', () => {
    // They were drawn in the two mossy-stone greens the ruins are built
    // from, so the whole boundary was grey-green posts. That is most of
    // why it did not read as a wall of logs at all.
    const source = readFileSync(join('src', 'arena', 'JungleArena.tsx'), 'utf8');
    const at = source.indexOf('The palisade: rails lying along each run');
    assert(at > 0, 'the palisade is gone');
    const block = source.slice(at, at + 1200);
    for (const stone of ['MOSS_STONE', 'wallMaterial', 'slabMaterial']) {
      assert(
        !block.includes(stone),
        `the palisade is still being painted with ${stone} — that is the temple's stone`,
      );
    }
    assert(block.includes('logMaterials'), 'the palisade is not using timber shades');
  });

  test('no two neighbouring rails are identical', () => {
    // Repeating pairs would read as a manufactured panel rather than
    // something somebody cut and stacked.
    //
    // Rails only. The four corner posts are deliberately the same as each
    // other — matching posts at the corners is what a built structure
    // looks like, and this test failed on them until it said so.
    const rails = palisadeLogs().filter((l) => !l.upright);
    let identical = 0;
    for (let i = 1; i < rails.length; i++) {
      if (Math.abs(rails[i].radius - rails[i - 1].radius) < 1e-6) identical++;
    }
    assert(identical === 0, `${identical} neighbouring rails are exactly the same thickness`);
  });

  test('the palisade is stable between builds', () => {
    // Hashed, not random. A boundary that reshuffled every launch would
    // make the arena feel like it was flickering.
    const a = palisadeLogs();
    const b = palisadeLogs();
    assert(
      a.every(
        (log, i) =>
          log.length === b[i].length &&
          log.radius === b[i].radius &&
          log.position[0] === b[i].position[0],
      ),
      'the palisade is different every time it is built',
    );
  });

  test('the space station is mostly open, not walled', () => {
    const source = readFileSync('src/arena/SpaceArena.tsx', 'utf8');
    assert(
      source.includes('RIM_HEIGHT'),
      'the station has gone back to full-height hull walls',
    );
    assert(
      /transparent:\s*true/.test(source),
      'the containment field is no longer see-through, so the deck is walled in again',
    );
  });

  test('every arena still reaches the physics boundary', () => {
    /*
     * Whatever shape an arena's edge takes, SOMETHING has to be drawn up
     * to the tray wall height, or a die bouncing high stops dead against
     * an invisible wall with nothing there to explain it. The space
     * station is the one at risk — its hull is knee-high now — which is
     * why the field panel spans the rest rather than the rim being the
     * whole of it.
     */
    for (const file of ARENA_FILES) {
      const source = readFileSync(join('src/arena', file), 'utf8');
      assert(
        source.includes('wallHeight'),
        `${file} never references the tray wall height — dice will stop at nothing`,
      );
    }
  });
});
