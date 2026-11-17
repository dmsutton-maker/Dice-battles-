import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { assert, assertEqual, note, suite, test } from './harness';
import { DiceOcean } from '../src/dice/diceOcean';
import { createDieEffect, DieSample } from '../src/dice/dieEffect';
import { PARTICLE_KIND } from '../src/dice/particles';
import { TUNING } from '../src/game/tuning';

/*
  Marc, 4 Nov 2026: "do option c with the flowing water and splash." The
  flowing is tests/oceanFlow.test.ts; this is the splash (diceOcean.ts):
  a ring of droplets out from the base when a die comes to rest and a
  wet sheen that dries, a spray off a bounce and off the throw, and the
  big one when a die goes under in the moat. Looks only, and nothing
  ever over a sticker.
*/
const O = TUNING.ocean;
const HALF = TUNING.dieSize / 2;
const FRAME = 1 / 60;
const DROP = PARTICLE_KIND.drop;

function die(x = 0, z = 0, moving = false): DieSample {
  return { x, y: HALF, z, vx: 0, vy: 0, vz: 0, quaternion: new THREE.Quaternion(), moving };
}

function run(ocean: DiceOcean, dice: DieSample[], seconds: number, from = 0): number {
  let t = from;
  for (; t < from + seconds; t += FRAME) ocean.update(FRAME, t, dice, 1000);
  return t;
}

/** Drop die `i` from a height onto where it is, one frame at a time, still moving at the end. */
function dropOnto(ocean: DiceOcean, dice: DieSample[], i: number, t: number): number {
  const d = dice[i];
  d.moving = true;
  for (let y = 2.5; y > HALF; y -= 0.15) {
    d.y = y;
    d.vy = -8;
    ocean.update(FRAME, (t += FRAME), dice, 1000);
  }
  d.y = HALF;
  d.vy = 0;
  ocean.update(FRAME, (t += FRAME), dice, 1000);
  return t;
}

/** Live droplets as [x, y, z], read straight out of the pool. */
function drops(ocean: DiceOcean): [number, number, number][] {
  const pool = ocean.pool as unknown as { capacity: number; life: Float32Array; kind: Uint8Array; pos: Float32Array };
  const out: [number, number, number][] = [];
  for (let i = 0; i < pool.capacity; i++) {
    if (pool.life[i] >= 0 && pool.kind[i] === DROP) out.push([pool.pos[i * 3], pool.pos[i * 3 + 1], pool.pos[i * 3 + 2]]);
  }
  return out;
}

suite('ocean dice · a splash when it lands', () => {
  test('the scene builds the splash for the Ocean skin', () => {
    const effect = createDieEffect('ocean', 2, null);
    assert(effect instanceof DiceOcean, 'the Ocean effect is not DiceOcean');
    assertEqual(effect.heldAt(0), null, 'an Ocean die is held in the moat');
    effect.dispose();
  });

  test('a throw sprays off both dice', () => {
    const ocean = new DiceOcean(2);
    const dice = [die(-1), die(1)];
    assertEqual(ocean.pool.aliveOf(DROP), 0, 'droplets before anything happened');
    ocean.thrown(dice);
    assertEqual(ocean.pool.aliveOf(DROP), 2 * O.throwDrops, 'the throw did not spray off each die');
  });

  test('coming to rest throws a ring of droplets from the base, and a sheen that dries', () => {
    const ocean = new DiceOcean(2);
    const dice = [die(-1, 0, true), die(1, 0, true)];
    ocean.thrown(dice);
    let t = run(ocean, dice, 0.8);
    assertEqual(ocean.pool.aliveOf(DROP), 0, 'the throw\'s spray never falls back');
    dice[0].moving = false;
    t = run(ocean, dice, FRAME, t);
    const n = ocean.pool.aliveOf(DROP);
    assertEqual(n, O.splashDrops, `${n} droplets on landing, not the ring of ${O.splashDrops}`);
    // Born outside the die's base, below its middle: nothing over the top face.
    for (const [x, y, z] of drops(ocean)) {
      assert(Math.hypot(x + 1, z) >= HALF, `a droplet was born inside the die's footprint at (${x.toFixed(2)}, ${z.toFixed(2)})`);
      assert(y < HALF, `a droplet was born ${y.toFixed(2)} up, above the die's middle`);
    }
    assert(ocean.sheenMaterials[0].opacity > 0, 'no sheen on the board where it landed');
    assertEqual(ocean.sheenMaterials[1].opacity, 0, 'the OTHER die got a sheen');
    t = run(ocean, dice, O.sheenSeconds / 2, t);
    const half = ocean.sheenMaterials[0].opacity;
    assert(half > 0 && half < O.sheenOpacity, `half way through drying the sheen is at ${half}`);
    t = run(ocean, dice, O.sheenSeconds, t);
    assertEqual(ocean.sheenMaterials[0].opacity, 0, 'the sheen never dries');
    // The droplets fell back by then too: the splash is over in a moment.
    run(ocean, dice, 0.5, t);
    assertEqual(ocean.pool.aliveOf(DROP), 0, 'droplets hang in the air');
    note(`${n} droplets in the ring, the sheen dry after ${O.sheenSeconds}s`);
  });

  test('the droplets never rise over the top face', () => {
    /*
      The face on top IS the roll, and the camera looks almost straight
      down at it. Every droplet is thrown outward from the base, so
      through the whole splash none is ever over the die's footprint
      above its middle.
    */
    const ocean = new DiceOcean(1);
    const dice = [die(0, 0, true)];
    ocean.thrown(dice);
    let t = run(ocean, dice, 0.6);
    dice[0].moving = false;
    let seen = 0;
    for (let k = 0; k < 60; k++) {
      t = run(ocean, dice, FRAME, t);
      for (const [x, y, z] of drops(ocean)) {
        seen++;
        assert(!(Math.hypot(x, z) < HALF * 0.9 && y > HALF * 0.5), `a droplet is over the top face at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
      }
    }
    assert(seen > 50, `only ${seen} droplet-frames to judge`);
  });

  test('a bounce on the way down is a spray, a wobble is a spray, the final rest is the splash', () => {
    const ocean = new DiceOcean(1);
    const dice = [die(0, 0, true)];
    ocean.thrown(dice);
    let t = run(ocean, dice, 0.6);
    assertEqual(ocean.pool.aliveOf(DROP), 0, 'the throw\'s spray is still up');
    t = dropOnto(ocean, dice, 0, t);
    assertEqual(ocean.pool.aliveOf(DROP), O.sprayDrops, 'a bounce did not give a small spray');
    assertEqual(ocean.sheenMaterials[0].opacity, 0, 'a bounce left a sheen');
    t = run(ocean, dice, 0.6, t);
    // Comes to rest: the full splash.
    dice[0].moving = false;
    t = run(ocean, dice, FRAME, t);
    assertEqual(ocean.pool.aliveOf(DROP), O.splashDrops, 'the final rest did not splash');
    t = run(ocean, dice, 0.3, t);
    assertEqual(ocean.pool.aliveOf(DROP), 0, 'the ring is still up');
    // Rocks once more and settles within the debounce: only a spray.
    dice[0].moving = true;
    t = run(ocean, dice, FRAME, t);
    dice[0].moving = false;
    t = run(ocean, dice, FRAME, t);
    assertEqual(ocean.pool.aliveOf(DROP), O.sprayDrops, 'a wobble splashed all over again');
    // Settles again well after: a landing in its own right.
    t = run(ocean, dice, O.splashAgainSeconds + 0.2, t);
    dice[0].moving = true;
    t = run(ocean, dice, FRAME, t);
    dice[0].moving = false;
    t = run(ocean, dice, FRAME, t);
    assertEqual(ocean.pool.aliveOf(DROP), O.splashDrops, 'a second landing did not splash');
  });

  test('a die at rest from the start does not splash until it is thrown', () => {
    const ocean = new DiceOcean(2);
    run(ocean, [die(-1), die(1)], 1);
    assertEqual(ocean.pool.alive(), 0, 'the dice splashed without being thrown');
  });

  test('going under in the moat is the biggest splash, off the water, and nothing on the board while under', () => {
    const ocean = new DiceOcean(2);
    const dice = [die(-1, 0, true), die(1, 0, true)];
    ocean.thrown(dice);
    let t = run(ocean, dice, 0.6);
    ocean.sank(1, 1, 0);
    assertEqual(ocean.pool.aliveOf(DROP), O.sinkDrops, 'no splash when the die went under');
    assertEqual(ocean.pool.aliveOf(PARTICLE_KIND.mist), O.sinkMist, 'no spray hanging over the water');
    assert(O.sinkDrops > O.splashDrops, 'the moat splash is not the bigger one');
    ocean.sank(1, 1, 0);
    assertEqual(ocean.pool.aliveOf(DROP), O.sinkDrops, 'going under twice splashed twice');
    t = run(ocean, dice, 0.8, t);
    assertEqual(ocean.pool.aliveOf(DROP), 0, 'the moat\'s droplets never fall back');
    // Under the water the picture comes to rest: no ring on the board.
    dice[1].y = -0.3;
    dice[1].moving = false;
    t = run(ocean, dice, 0.2, t);
    assertEqual(ocean.pool.aliveOf(DROP), 0, 'a die under the water splashed on the board');
    assertEqual(ocean.sheenMaterials[1].opacity, 0, 'a die under the water left a sheen');
    // Fished out and put back: it settles, wet, and splashes.
    ocean.fishedOut(1);
    dice[1].x = 0.9;
    dice[1].z = 2.4;
    dice[1].y = HALF + 0.15;
    dice[1].moving = true;
    t = run(ocean, dice, 0.2, t);
    dice[1].y = HALF;
    dice[1].moving = false;
    run(ocean, dice, FRAME, t);
    assertEqual(ocean.pool.aliveOf(DROP), O.splashDrops, 'a die put back on the board did not splash as it settled');
  });

  test('the pool never grows, however much is asked of it', () => {
    const ocean = new DiceOcean(2);
    const dice = [die(-1, 0, true), die(1, 0, true)];
    let t = 0;
    for (let n = 0; n < 40; n++) {
      ocean.thrown(dice);
      ocean.sank(0, -1, 0);
      ocean.sank(1, 1, 0);
      ocean.fishedOut(0);
      ocean.fishedOut(1);
      dice.forEach((d) => (d.moving = false));
      t = run(ocean, dice, 0.05, t);
      dice.forEach((d) => (d.moving = true));
    }
    assert(ocean.pool.alive() <= O.particles, 'the pool grew');
    assertEqual(ocean.pool.capacity, O.particles, 'capacity changed');
  });

  test('every number is in tuning.ts, and the effect reaches nothing but its own files', () => {
    const source = readFileSync(join(__dirname, '..', 'src/dice/diceOcean.ts'), 'utf8');
    for (const key of ['particles', 'splashDrops', 'sprayDrops', 'throwDrops', 'sinkDrops', 'sinkMist', 'splashAgainSeconds', 'sheenOpacity', 'sheenSize', 'sheenSeconds'] as const) {
      assert(key in O, `tuning.ocean has no ${key}`);
      assert(source.includes(`O.${key}`), `diceOcean.ts does not read O.${key}`);
    }
    // The imports are held to the effect's own files by tests/fire.test.ts.
    assert(!/require\(/.test(source), 'diceOcean.ts requires a module at runtime');
    // The scene keeps drawing between rolls for any skin with an effect
    // (DiceDemoScreen's `burning`), which the splash and the sea need.
    const screen = readFileSync(join(__dirname, '..', 'src/demo/DiceDemoScreen.tsx'), 'utf8');
    assert(/const burning = sceneSkin\.effect !== undefined;/.test(screen), 'the board is not kept moving for a skin with an effect');
  });
});
