import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { palisadeLogs } from '../src/arena/palisade';
import { TUNING } from '../src/game/tuning';
import { assert, note, suite, test } from './harness';

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

  test('the palisade has a ragged top, not a level one', () => {
    const logs = palisadeLogs();
    const heights = logs.map((l) => l.height);
    const spread = Math.max(...heights) - Math.min(...heights);
    const { wallHeight } = TUNING.tray;
    note(
      `log heights ${Math.min(...heights).toFixed(2)}-${Math.max(...heights).toFixed(2)} ` +
        `against a ${wallHeight} wall`,
    );
    // An even row of posts reads as a picket fence and would put the flat
    // castle skyline straight back.
    assert(
      spread > wallHeight * 0.3,
      `the tops only vary by ${spread.toFixed(2)} — that is a level fence`,
    );
    // And some must clear the wall, or the boundary reads as lower than it
    // physically is and dice appear to stop against nothing.
    assert(
      Math.max(...heights) > wallHeight,
      'no log stands above the wall the dice actually bounce off',
    );
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
