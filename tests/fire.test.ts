import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { assert, assertEqual, note, suite, test } from './harness';
import { DiceFire, DieSample, PARTICLE_KIND } from '../src/dice/diceFire';
import { DICE_SKINS, STORE_SKINS, skinById } from '../src/game/diceSkins';
import { TUNING } from '../src/game/tuning';

/**
 * The Fire dice.
 *
 * David, 29 Sep 2026: "make a pair of dice that are on fire where it
 * shows flames coming up from the dice while they're doing it. And if it
 * lands in the water, then it shows the fire going out and you know
 * smoke coming up." Then asked for it in the real game, over the air,
 * so Marc and AJ could see it and decide what it costs.
 */

const HALF = TUNING.dieSize / 2;
const FRAME = 1 / 60;

function die(x = 0, z = 0, moving = false): DieSample {
  return { x, y: HALF, z, vx: 0, vy: 0, vz: 0, quaternion: new THREE.Quaternion(), moving };
}

function run(fire: DiceFire, dice: DieSample[], seconds: number, from = 0): number {
  let t = from;
  for (; t < from + seconds; t += FRAME) fire.update(FRAME, t, dice, 1000);
  return t;
}

/** Live flames as [x, y, z] — read straight out of the pool. */
function flames(fire: DiceFire): [number, number, number][] {
  const pool = fire.hot as unknown as {
    capacity: number;
    life: Float32Array;
    kind: Uint8Array;
    pos: Float32Array;
  };
  const out: [number, number, number][] = [];
  for (let i = 0; i < pool.capacity; i++) {
    if (pool.life[i] >= 0 && pool.kind[i] === PARTICLE_KIND.flame) {
      out.push([pool.pos[i * 3], pool.pos[i * 3 + 1], pool.pos[i * 3 + 2]]);
    }
  }
  return out;
}

suite('fire dice · the skin', () => {
  test('it is on the Store shelf, with a price and its fire', () => {
    const fire = skinById('fire');
    assertEqual(fire.id, 'fire', 'the Fire dice exist');
    assertEqual(fire.effect, 'fire', 'the skin is the one that burns');
    assert(typeof fire.price === 'number' && fire.price > 0, 'it can be bought');
    assert(STORE_SKINS.some((s) => s.id === 'fire'), 'it is on the shelf');
    note(`placeholder price ${fire.price} — the boys are voting on it`);
  });

  test('no other skin catches fire', () => {
    const burning = DICE_SKINS.filter((s) => s.effect !== undefined).map((s) => s.id);
    assertEqual(burning.join(','), 'fire', 'only the Fire dice have an effect');
  });

  test('the scene builds the fire only for a skin that asks for it', () => {
    // The flames cost a frame loop and two particle pools. Every other
    // skin — every die anybody has equipped today — must pay nothing.
    const scene = readFileSync('src/demo/DiceScene.tsx', 'utf8');
    assert(
      /dieEffect === 'fire' \? new DiceFire/.test(scene),
      'DiceScene builds the fire unconditionally',
    );
    const screen = readFileSync('src/demo/DiceDemoScreen.tsx', 'utf8');
    assert(
      /dieEffect=\{sceneSkin\.effect\}/.test(screen),
      'the equipped (or previewed) skin never reaches the scene, so no die would ever burn',
    );
  });
});

suite('fire dice · it burns, and water puts it out', () => {
  test('a die burns from the start', () => {
    const fire = new DiceFire(2);
    run(fire, [die(-1), die(1)], 1);
    const n = flames(fire).length;
    assert(n > 20, `only ${n} flames on two burning dice`);
    note(`${n} flames alive on two resting dice`);
  });

  test('going under puts the fire out, with steam and a splash', () => {
    const fire = new DiceFire(2);
    const dice = [die(-1), die(1, 0, true)];
    let t = run(fire, dice, 0.5);
    fire.douse(1, 1, 0);
    // Straight after: the pool is full of steam and flying water.
    assert(fire.soft.aliveOf(PARTICLE_KIND.steam) > 15, 'no steam when the fire hit the water');
    assert(fire.soft.aliveOf(PARTICLE_KIND.drop) > 10, 'no splash');
    // Sinking.
    dice[1].y = -0.6;
    t = run(fire, dice, 0.8, t);
    assert(fire.burners[1].heat === 0, `still burning at heat ${fire.burners[1].heat} under water`);
    assert(fire.burners[0].heat > 0.5, 'the OTHER die went out too');
    // The flames left are the dry die's: none anywhere near the pool.
    const near = flames(fire).filter(([x]) => x > 0.2).length;
    assertEqual(near, 0, 'flames are still burning over the doused die');
  });

  test('fished out, it stays out and smokes until the next throw', () => {
    const fire = new DiceFire(2);
    const dice = [die(-1), die(1)];
    let t = run(fire, dice, 0.3);
    fire.douse(1, 1, 0);
    t = run(fire, dice, 0.9, t);
    fire.surface(1);
    dice[1].x = 0.9; dice[1].z = 2.4;
    t = run(fire, dice, 1, t);
    assertEqual(fire.burners[1].heat, 0, 'a doused die relit itself on the board');
    assert(fire.soft.aliveOf(PARTICLE_KIND.smoke) > 0, 'a doused die does not smoke');

    // The next throw lights it again.
    dice.forEach((d) => (d.moving = true));
    fire.relight(dice);
    run(fire, dice, 0.4, t);
    assert(fire.burners[1].heat > 0.9, 'the next throw did not relight it');
  });

  test('the pool keeps steaming for a while after, then stops', () => {
    const fire = new DiceFire(1);
    const dice = [die(1)];
    fire.douse(0, 1, 0);
    let t = run(fire, dice, 2);
    assert(fire.soft.aliveOf(PARTICLE_KIND.steam) > 0, 'the steam stopped at once');
    t = run(fire, dice, TUNING.fire.steamSeconds + 4, t);
    assertEqual(fire.soft.aliveOf(PARTICLE_KIND.steam), 0, 'the pool steams forever');
  });
});

suite('fire dice · it never hides the roll', () => {
  test('at rest, no flame sits over the top face', () => {
    /*
      The face on top IS the roll, and the game's camera looks almost
      straight down at it. The first version burned from every face at
      rest, and the first render in the real arena showed a flame
      sitting on the top sticker. A resting die's flames are born in a
      ring outside its silhouette.
    */
    const fire = new DiceFire(1);
    const dice = [die(0, 0, false)];
    run(fire, dice, 1.5);
    const over = flames(fire).filter(([x, , z]) => Math.hypot(x, z) < HALF * 0.9);
    const all = flames(fire).length;
    assert(all > 10, `only ${all} flames to judge`);
    assertEqual(over.length, 0, `${over.length} of ${all} flames are over the top face`);
  });

  test('the fire is looks only: it touches neither physics nor the settle rule', () => {
    const source = readFileSync('src/dice/diceFire.ts', 'utf8');
    const imports = [...source.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
    assertEqual(
      imports.sort().join(', '),
      '../game/tuning, three',
      'diceFire.ts reaches for something other than three.js and the tuning numbers',
    );
  });

  test('nothing native, so it can ship over the air', () => {
    // A particle pool and a shader are JavaScript. A new package would
    // not be, and see AGENTS.md for what that costs.
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    assert(!('expo-notifications' in (pkg.dependencies ?? {})), 'push crept in alongside the fire');
    const source = readFileSync('src/dice/diceFire.ts', 'utf8');
    assert(!/require\(/.test(source), 'diceFire.ts requires a module at runtime');
  });
});

suite('fire dice · it fits on a phone', () => {
  test('the particle pools never grow, however much is asked of them', () => {
    const fire = new DiceFire(2);
    const dice = [die(-1, 0, true), die(1, 0, true)];
    let t = 0;
    for (let n = 0; n < 30; n++) {
      fire.douse(0, -1, 0);
      fire.douse(1, 1, 0);
      fire.relight(dice);
      t = run(fire, dice, 0.1, t);
    }
    assert(fire.hot.alive() <= TUNING.fire.hotParticles, 'the flame pool grew');
    assert(fire.soft.alive() <= TUNING.fire.softParticles, 'the smoke pool grew');
    assertEqual(fire.hot.capacity, TUNING.fire.hotParticles, 'capacity changed');
  });

  test('the scene wires the moat to the fire at the moments that matter', () => {
    const scene = readFileSync('src/demo/DiceScene.tsx', 'utf8');
    assert(/splashT\.current = 0;[^]*?fireRef\.current\?\.douse\(i/.test(scene), 'a sink does not douse');
    assert(/fireRef\.current\?\.surface\(i\);\s*respawn\(\);/.test(scene), 'being fished out does not leave it out');
    assert(/throwDie\(body, \{ flick \}\)\);\s*fireRef\.current\?\.relight/.test(scene), 'a throw does not relight');
  });
});
