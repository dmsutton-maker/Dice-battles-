import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { assert, assertEqual, note, suite, test } from './harness';
import { DiceFire } from '../src/dice/diceFire';
import { DiceIce } from '../src/dice/diceIce';
import type { DieSample } from '../src/dice/dieEffect';
import { PARTICLE_KIND } from '../src/dice/particles';
import { patternPixels } from '../src/dice/patterns';
import { paintIce } from '../src/dice/preview';
import { skinById, STORE_SKINS } from '../src/game/diceSkins';
import { TUNING } from '../src/game/tuning';

/**
 * Scorch from the Fire dice, and the Ice dice.
 *
 * David, 30 Sep 2026: "can the fire when it's rolling show signs of
 * charring the ground around it after it hits the ground and then you
 * could just remove the char after a few seconds and then also can we do
 * the same concept with ice like dice made of ice and when it touches
 * the ground, it freezes the ground around it a little bit and maybe
 * freezes the pond and you see it like half sticking out of the pond
 * frozen."
 */

const HALF = TUNING.dieSize / 2;
const FRAME = 1 / 60;
const MOAT = { x: 1, z: -1 };

function die(x = 0, z = 0): DieSample {
  return { x, y: HALF, z, vx: 0, vy: 0, vz: 0, quaternion: new THREE.Quaternion(), moving: false };
}

type Effect = DiceFire | DiceIce;

function run(fx: Effect, dice: DieSample[], seconds: number): void {
  for (let t = 0; t < seconds; t += FRAME) fx.update(FRAME, t, dice, 1000);
}

/** Drop die 0 from a height onto (x, z), one frame at a time. */
function dropOnto(fx: Effect, dice: DieSample[], x: number, z: number): void {
  const d = dice[0];
  d.x = x; d.z = z; d.moving = true;
  for (let y = 2.5; y > HALF; y -= 0.15) {
    d.y = y; d.vy = -8;
    fx.update(FRAME, 0, dice, 1000);
  }
  d.y = HALF; d.vy = 0;
  fx.update(FRAME, 0, dice, 1000);
}

suite('fire dice · charring the ground', () => {
  test('a burning die that lands leaves scorch', () => {
    const fire = new DiceFire(1, MOAT);
    const dice = [die(-1, 2)];
    fire.thrown(dice);
    dropOnto(fire, dice, -1, 2);
    assert(fire.marks.showing() >= 1, 'no scorch where the burning die came down');
  });

  test('the char is gone a few seconds later', () => {
    const fire = new DiceFire(1, MOAT);
    const dice = [die(-1, 2)];
    fire.thrown(dice);
    dropOnto(fire, dice, -1, 2);
    run(fire, dice, TUNING.marks.holdSeconds * 0.8);
    assert(fire.marks.showing() >= 1, 'the scorch vanished at once');
    dice[0].moving = true; // so resting does not leave a fresh one
    run(fire, dice, TUNING.marks.holdSeconds + TUNING.marks.fadeSeconds + 0.2);
    assertEqual(fire.marks.showing(), 0, 'the scorch never goes away');
  });

  test('no scorch on the water', () => {
    const fire = new DiceFire(1, MOAT);
    const dice = [die(MOAT.x, MOAT.z)];
    fire.thrown(dice);
    dropOnto(fire, dice, MOAT.x, MOAT.z);
    assertEqual(fire.marks.showing(), 0, 'a scorch mark was left floating on the moat');
  });

  test('a die that has been put out leaves no scorch', () => {
    const fire = new DiceFire(1, MOAT);
    const dice = [die(-1, 2)];
    fire.douse(0, MOAT.x, MOAT.z);
    fire.surface(0);
    dropOnto(fire, dice, -1, 2);
    assertEqual(fire.marks.showing(), 0, 'a cold, doused die scorched the ground');
  });

  test('marks are a fixed handful, however many landings', () => {
    const fire = new DiceFire(1, MOAT);
    const dice = [die(-1, 2)];
    for (let n = 0; n < 40; n++) {
      fire.thrown(dice);
      dropOnto(fire, dice, -2 + (n % 5) * 0.2, 2);
    }
    assert(fire.marks.showing() <= TUNING.marks.capacity, 'the marks grew past their limit');
  });
});

suite('ice dice · the skin', () => {
  test('it is on the Store shelf, with a price and its ice', () => {
    const ice = skinById('ice');
    assertEqual(ice.id, 'ice', 'the Ice dice exist');
    assertEqual(ice.effect, 'ice', 'the skin is the one that freezes');
    assert(STORE_SKINS.some((s) => s.id === 'ice'), 'it is on the shelf');
    note(`placeholder price ${ice.price}`);
  });

  test('the Store picture shows ice, not just the shell', () => {
    const skin = skinById('ice');
    const shell = patternPixels(skin.pattern as never, skin.body, skin.body);
    const card = shell.slice();
    paintIce(card);
    const white = (px: number[]) => {
      let n = 0;
      for (let i = 0; i < px.length; i += 3) if (px[i] > 235 && px[i + 1] > 240) n++;
      return n / (px.length / 3);
    };
    note(`${(white(shell) * 100).toFixed(0)}% frost-white before, ${(white(card) * 100).toFixed(0)}% after`);
    assert(white(card) > white(shell) + 0.1, 'the Ice dice card shows no frost or icicles');
    const source = readFileSync('src/dice/preview.ts', 'utf8');
    assert(/if \(skin\.effect === 'ice'\) paintIce\(rgb\);/.test(source), 'the ice is not painted on the card');
  });
});

suite('ice dice · frost and the frozen pond', () => {
  test('where it lands, the ground frosts over — and thaws', () => {
    const ice = new DiceIce(1, MOAT);
    const dice = [die(-1, 2)];
    ice.thrown();
    dropOnto(ice, dice, -1, 2);
    assert(ice.marks.showing() >= 1, 'no frost where the ice die came down');
    dice[0].moving = true;
    run(ice, dice, TUNING.marks.holdSeconds + TUNING.marks.fadeSeconds + 0.2);
    assertEqual(ice.marks.showing(), 0, 'the frost never thaws');
  });

  test('it breathes cold mist, and none of it over the top face at rest', () => {
    const ice = new DiceIce(1, MOAT);
    const dice = [die(0, 0)];
    run(ice, dice, 1.5);
    const pool = ice.soft as unknown as { capacity: number; life: Float32Array; kind: Uint8Array; pos: Float32Array };
    let mist = 0;
    let over = 0;
    for (let i = 0; i < pool.capacity; i++) {
      if (pool.life[i] < 0 || pool.kind[i] !== PARTICLE_KIND.mist) continue;
      mist++;
      const x = pool.pos[i * 3];
      const y = pool.pos[i * 3 + 1];
      const z = pool.pos[i * 3 + 2];
      if (Math.hypot(x, z) < HALF * 0.9 && y > HALF) over++;
    }
    assert(mist > 10, `only ${mist} wisps of mist`);
    assertEqual(over, 0, `${over} wisps are drifting over the face on top, which is the roll`);
  });

  test('going into the moat freezes the pond, and the die is caught half out', () => {
    const ice = new DiceIce(1, MOAT);
    const dice = [die(MOAT.x, MOAT.z)];
    assertEqual(ice.heldAt(0), null, 'held before it ever went in');
    ice.sank(0, MOAT.x, MOAT.z);
    run(ice, dice, TUNING.ice.freezeSeconds + 0.1);
    assert(ice.pondFrozen(), 'the pond did not freeze');
    const held = ice.heldAt(0);
    assert(held !== null, 'the die was not caught in the ice');
    // Half out: its centre is at the ice, give or take, so the top half
    // shows above it.
    assert(Math.abs(held!) < HALF * 0.5, `held at ${held}, which is not half out of the ice`);
  });

  test('fished out, it is let go — and the pond thaws on its own', () => {
    const ice = new DiceIce(1, MOAT);
    const dice = [die(MOAT.x, MOAT.z)];
    ice.sank(0, MOAT.x, MOAT.z);
    run(ice, dice, 0.9);
    ice.fishedOut(0);
    assertEqual(ice.heldAt(0), null, 'the die stayed frozen after it was fished out');
    assert(ice.pondFrozen(), 'the pond thawed the moment the die left');
    run(ice, dice, TUNING.ice.frozenSeconds + TUNING.ice.thawSeconds + 0.5);
    assert(!ice.pondFrozen(), 'the pond stays frozen forever');
  });

  test('a round with no moat has no pond to freeze', () => {
    const ice = new DiceIce(1, null);
    assertEqual(ice.sheet, null, 'an ice sheet was built for a moat that is not there');
    ice.sank(0, 0, 0); // must not throw
    run(ice, [die()], 0.5);
  });
});

suite('ice dice · the ice changes the picture, never the roll', () => {
  test('only the picture is held; the body sinks on the usual clock', () => {
    /*
      The frozen pond must not make the moat safe to land in: that would
      be a skin you could buy to win. The sink timer and the respawn are
      the same for every skin; heldAt is read only where the MESH is
      placed, and never where the body is.
    */
    const scene = readFileSync('src/demo/DiceScene.tsx', 'utf8');
    assert(/sinkUntil\.current\[i\] = now \+ 900;/.test(scene), 'the sink time changed');
    const uses = [...scene.matchAll(/heldAt\(/g)].length;
    assertEqual(uses, 1, 'heldAt is read in more than one place');
    assert(
      /const held = sinkUntil\.current\[i\] > 0 \? fireRef\.current\?\.heldAt\(i\) \?\? null : null;\s*if \(mesh && held !== null\) \{\s*mesh\.position\.y = held;/.test(scene),
      'heldAt no longer only moves the picture',
    );
    const ice = readFileSync('src/dice/diceIce.ts', 'utf8');
    assert(!/cannon|body\.|velocity\.set/.test(ice.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')), 'the ice reaches for a physics body');
  });
});
