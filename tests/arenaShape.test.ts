import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { palisadeLogs } from '../src/arena/palisade';
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
    // Four planks is a fence; a wall is one box. A palisade is many.
    assert(logs.length > 60, `only ${logs.length} logs — that is a fence, not a palisade`);
  });

  test('the palisade is a stockade: ragged on top, but not a heap of sticks', () => {
    const logs = palisadeLogs();
    const heights = logs.map((l) => l.height);
    const spread = Math.max(...heights) - Math.min(...heights);
    const { wallHeight } = TUNING.tray;
    note(
      `log heights ${Math.min(...heights).toFixed(2)}-${Math.max(...heights).toFixed(2)} ` +
        `against a ${wallHeight} wall, spread ${(spread / wallHeight * 100).toFixed(0)}% of it`,
    );
    // BOTH ends matter, which is what this test was missing. It only had
    // the lower bound, so the posts varied by half the wall height and the
    // boundary read as a pile of sticks rather than a wall of logs.
    assert(
      spread > wallHeight * 0.12,
      `the tops only vary by ${spread.toFixed(2)} — that is a level picket fence`,
    );
    assert(
      spread < wallHeight * 0.35,
      `the tops vary by ${spread.toFixed(2)} — that is a heap, not a stockade`,
    );
  });

  test('no log stands shorter than the wall the dice bounce off', () => {
    // A post below the invisible collision wall makes a die look like it
    // stopped against thin air.
    const { wallHeight } = TUNING.tray;
    for (const log of palisadeLogs()) {
      assert(
        log.height >= wallHeight,
        `a log only ${log.height.toFixed(2)} tall against a ${wallHeight} wall`,
      );
    }
  });

  test('there is no daylight between the logs', () => {
    // A palisade with gaps is a picket fence. Neighbours have to overlap,
    // which means the spacing must be under the sum of the two radii.
    const { innerWidth, innerDepth, wallThickness } = TUNING.tray;
    const logs = palisadeLogs();
    // Which run a log belongs to, by whichever coordinate is pinned to the
    // boundary. Deliberately not "whichever is bigger" — that misfiles
    // every log near a corner and was quietly comparing posts on
    // different walls to each other.
    const zRun = innerDepth / 2 + wallThickness / 2;
    const xRun = innerWidth / 2 + wallThickness / 2;
    const runs = new Map<string, typeof logs>();
    for (const log of logs) {
      const [x, , z] = log.position;
      const key =
        Math.abs(Math.abs(z) - zRun) < 1e-6
          ? `alongX${z > 0 ? '+' : '-'}`
          : `alongZ${x > 0 ? '+' : '-'}`;
      if (!runs.has(key)) runs.set(key, []);
      runs.get(key)!.push(log);
    }
    assertEqual(runs.size, 4, 'the palisade is not four runs of logs');

    let worst = -Infinity;
    for (const [key, run] of runs) {
      const alongX = key.startsWith('alongX');
      run.sort((a, b) => (alongX ? a.position[0] - b.position[0] : a.position[2] - b.position[2]));
      for (let i = 1; i < run.length; i++) {
        const a = run[i - 1];
        const b = run[i];
        const apart = Math.hypot(
          a.position[0] - b.position[0],
          a.position[2] - b.position[2],
        );
        worst = Math.max(worst, apart - a.radius - b.radius);
      }
    }
    note(`palisade: worst neighbour gap ${worst.toFixed(3)} (negative means overlapping)`);
    assert(worst < 0, `${worst.toFixed(2)} of daylight between two logs — that is a fence`);
  });

  test('the rank leans together rather than every post its own way', () => {
    // Independent random leans made neighbouring posts fall against each
    // other, which is most of what made this look like a heap.
    const logs = palisadeLogs();
    const leans = logs.map((l) => Math.max(Math.abs(l.rotation[0]), Math.abs(l.rotation[2])));
    const worstDeg = (Math.max(...leans) * 180) / Math.PI;
    note(`palisade: steepest lean ${worstDeg.toFixed(1)} degrees`);
    assert(worstDeg < 4, `a log leaning ${worstDeg.toFixed(1)} degrees looks fallen, not driven`);
  });

  test('the logs are timber, not the temple stone', () => {
    // They were drawn in the two mossy-stone greens the ruins are built
    // from, so the whole boundary was grey-green posts. That is most of
    // why it did not read as a wall of logs at all.
    const source = readFileSync(join('src', 'arena', 'JungleArena.tsx'), 'utf8');
    const at = source.indexOf('{/* The palisade itself */}');
    assert(at > 0, 'the palisade is gone');
    const block = source.slice(at, at + 900);
    for (const stone of ['MOSS_STONE', 'wallMaterial', 'slabMaterial']) {
      assert(
        !block.includes(stone),
        `the palisade is still being painted with ${stone} — that is the temple's stone`,
      );
    }
    assert(block.includes('logMaterials'), 'the palisade is not using timber shades');
  });

  test('no two neighbouring logs are the same', () => {
    // Repeating pairs would read as a manufactured panel rather than
    // something somebody cut and drove into the ground.
    const logs = palisadeLogs();
    let identical = 0;
    for (let i = 1; i < logs.length; i++) {
      if (Math.abs(logs[i].height - logs[i - 1].height) < 0.001) identical++;
    }
    assert(identical === 0, `${identical} neighbouring logs are exactly the same height`);
  });

  test('the palisade is stable between builds', () => {
    // Hashed, not random. A boundary that reshuffled every launch would
    // make the arena feel like it was flickering.
    const a = palisadeLogs();
    const b = palisadeLogs();
    assert(
      a.every((log, i) => log.height === b[i].height && log.position[0] === b[i].position[0]),
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
