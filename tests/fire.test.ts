import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { assert, assertEqual, note, suite, test } from './harness';
import { DiceFire, DieSample, PARTICLE_KIND } from '../src/dice/diceFire';
import { DICE_SKINS, STORE_SKINS, skinById } from '../src/game/diceSkins';
import { patternPixels, STICKER_FRACTION } from '../src/dice/patterns';
import { paintFlames } from '../src/dice/preview';
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
  test('it is won on the season pass, not sold', () => {
    /*
      On the Store shelf for a day at a placeholder price, then moved to
      the season pass on 30 Sep 2026 — David: "make this season pass have
      the fire and ice dice as the way to obtain them."
    */
    const fire = skinById('fire');
    assertEqual(fire.id, 'fire', 'the Fire dice exist');
    assertEqual(fire.effect, 'fire', 'the skin is the one that burns');
    assertEqual(fire.price, undefined, 'the Fire dice are still for sale');
    assert(!STORE_SKINS.some((s) => s.id === 'fire'), 'the Fire dice are still on the shelf');
    assert(fire.pass === true, 'the Fire dice are not a season pass die');
  });

  test('only the Fire and Ice dice have an effect', () => {
    const moving = DICE_SKINS.filter((s) => s.effect !== undefined).map((s) => `${s.id}:${s.effect}`);
    assertEqual(moving.sort().join(','), 'fire:fire,ice:ice', 'an unexpected skin has an effect');
  });

  test('the scene builds the fire only for a skin that asks for it', () => {
    // The flames cost a frame loop and two particle pools. Every other
    // skin — every die anybody has equipped today — must pay nothing.
    const scene = readFileSync('src/demo/DiceScene.tsx', 'utf8');
    assert(
      /dieEffect !== undefined\s*\?\s*createDieEffect\(/.test(scene),
      'DiceScene builds an effect for every skin',
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

  test('the effects are looks only: they touch neither physics nor the settle rule', () => {
    /*
      Every file an effect is built from, and everything each of them
      imports. None may reach cannon, the dice bodies or the settle rule —
      a skin that could change a roll would be a skin you could buy to win.
    */
    const allowed = new Set([
      'three',
      '../game/tuning',
      '../game/obstacles',
      './dieEffect',
      './groundMarks',
      './particles',
      './diceFire',
      './diceIce',
    ]);
    for (const file of ['diceFire', 'diceIce', 'dieEffect', 'groundMarks', 'particles']) {
      const source = readFileSync(`src/dice/${file}.ts`, 'utf8');
      const imports = [...source.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
      const stray = imports.filter((m) => !allowed.has(m));
      assertEqual(stray.join(', '), '', `${file}.ts reaches outside the effect's own files`);
    }
    // obstacles.ts is only read for where the moat IS; it must stay a
    // plain table of numbers with no physics in it.
    const obstacles = readFileSync('src/game/obstacles.ts', 'utf8');
    assert(!/cannon/.test(obstacles), 'obstacles.ts now pulls in the physics engine');
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
    assert(/splashT\.current = 0;[^]*?fireRef\.current\?\.sank\(i/.test(scene), 'a sink does not douse');
    assert(/fireRef\.current\?\.fishedOut\(i\);\s*respawn\(\);/.test(scene), 'being fished out does not leave it out');
    assert(/throwDie\(body, \{ flick \}\)\);\s*fireRef\.current\?\.thrown/.test(scene), 'a throw does not relight');
  });
});

suite('fire dice · what the shelf and the battle show', () => {
  test('the Store picture is fire, with no black hole in it', () => {
    /*
      David, 30 Sep 2026: "the picture of it when you're looking at it
      just shows a black die with a red line on it, it doesn't show
      fire" — and later the same day, "more fire colors". The shell is
      now fire itself, and it keeps a dark ring where each colour sticker
      sits; the card has no sticker, so the card paints its own ember
      ground under the flames rather than showing that ring as a black
      disc.
    */
    const skin = skinById('fire');
    const card = patternPixels(skin.pattern as never, skin.body, skin.body);
    paintFlames(card);
    let flame = 0;
    let black = 0;
    const n = card.length / 3;
    for (let i = 0; i < card.length; i += 3) {
      if (card[i] > 200 && card[i] - card[i + 2] > 60) flame++;
      if (card[i] + card[i + 1] + card[i + 2] < 120) black++;
    }
    note(`${Math.round((flame / n) * 100)}% flame-coloured, ${Math.round((black / n) * 100)}% near-black`);
    assert(flame / n > 0.35, 'the Store picture of the Fire dice shows too little fire');
    assert(black / n < 0.03, 'the Store picture has a black hole in it');
  });

  test('the shell burns in fire colours, and every sticker keeps its dark ring', () => {
    const skin = skinById('fire');
    const SIZE = 64;
    const px = patternPixels(skin.pattern as never, skin.body, skin.body);
    const at = (x: number, y: number) => {
      const i = (y * SIZE + x) * 3;
      return [px[i], px[i + 1], px[i + 2]];
    };
    // Fire: most of the lower half is bright and warm.
    let warm = 0;
    let total = 0;
    for (let y = 40; y < SIZE; y++) {
      for (const x of [2, 6, 10, 54, 58, 61]) {
        const [r, g, b] = at(x, y);
        total++;
        if (r > 190 && r - b > 80) warm++;
      }
    }
    assert(warm / total > 0.6, `only ${Math.round((warm / total) * 100)}% of the fire is fire-coloured`);
    // The ring: just outside the sticker's edge, all the way round, dark.
    const r = STICKER_FRACTION * SIZE;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const x = Math.round(SIZE / 2 + Math.cos(a) * r * 1.06 - 0.5);
      const y = Math.round(SIZE / 2 + Math.sin(a) * r * 1.06 - 0.5);
      const [R, G, B] = at(x, y);
      assert(R + G + B < 200, `the ring round the sticker is not dark at ${Math.round((a * 180) / Math.PI)}°`);
    }
  });

  test('only the Fire dice get flames on their picture', () => {
    const source = readFileSync('src/dice/preview.ts', 'utf8');
    assert(
      /if \(skin\.effect === 'fire'\) paintFlames\(rgb\);/.test(source),
      'the flames are painted on every card, or on none',
    );
  });

  test('a battle with the Fire dice keeps drawing between rolls', () => {
    /*
      Between rolls the board stops drawing to save battery, and a board
      that is not drawing is a photograph: the flames would hang frozen
      in mid-air. The skin whose whole point is that it moves keeps the
      board moving.
    */
    const screen = readFileSync('src/demo/DiceDemoScreen.tsx', 'utf8');
    const expr = screen.slice(screen.indexOf('frameloop={'), screen.indexOf('camera={{ position'));
    assert(/phase === 'battle' && \([^)]*burning/.test(expr), 'the flames freeze between rolls');
    assert(/const burning = sceneSkin\.effect !== undefined;/.test(screen), 'the board is not kept moving for a skin with an effect');
  });
});
