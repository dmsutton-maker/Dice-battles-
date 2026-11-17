import './storageMock';
import * as THREE from 'three';
import { assert, assertEqual, note, suite, test } from './harness';
import { DICE_SKINS, LADDER_SKINS, PASS_SKINS, skinById, STORE_SKINS } from '../src/game/diceSkins';
import { ARENA_PRICES, ARENA_UNLOCKS, PASS_ARENAS, STORE_ARENAS } from '../src/game/loadout';
import { ARENA_JAILS } from '../src/arena/jailKinds';
import { ARENA_THEMES, THEMED_ARENA_META } from '../src/arena/themeData';
import { DiceSun } from '../src/dice/diceSun';
import { DiceMoon } from '../src/dice/diceMoon';
import type { DieEffect, DieSample } from '../src/dice/dieEffect';
import { Kind, ParticlePool } from '../src/dice/particles';
import { patternPixels } from '../src/dice/patterns';
import { paintMoon, paintSun } from '../src/dice/preview';
import { TUNING } from '../src/game/tuning';

/*
  Season 2 of the pass, "Sun & Moon", 21 Oct 2026. David, on the pass
  rotating monthly: "Make 2 new dice and 2 new arenas every month
  normally going on with a theme like how this one is fire and ice."
  Two dice with effects of their own and two battlefields with their
  own kits, to the standard of Fire & Ice and Dino Valley. Which rows
  of the pass they sit on is seasonPass.ts's business and
  seasonPass.test.ts's.
*/

const HALF = TUNING.dieSize / 2;
const FRAME = 1 / 60;

function die(x = 0, z = 0, moving = false): DieSample {
  return { x, y: HALF, z, vx: 0, vy: 0, vz: 0, quaternion: new THREE.Quaternion(), moving };
}

type Effect = DiceSun | DiceMoon;

function run(fx: Effect, dice: DieSample[], seconds: number, from = 0): void {
  for (let t = from; t < from + seconds; t += FRAME) fx.update(FRAME, t, dice, 1000);
}

/** Drop die 0 from a height onto (x, z), one frame at a time. */
function dropOnto(fx: Effect, dice: DieSample[], x: number, z: number): void {
  const d = dice[0];
  d.x = x;
  d.z = z;
  d.moving = true;
  for (let y = 2.5; y > HALF; y -= 0.15) {
    d.y = y;
    d.vy = -8;
    fx.update(FRAME, 0, dice, 1000);
  }
  d.y = HALF;
  d.vy = 0;
  fx.update(FRAME, 0, dice, 1000);
}

/** Live particles of one kind as [x, y, z], read straight out of the pool. */
function live(pool: ParticlePool, kind: Kind): [number, number, number][] {
  const p = pool as unknown as { capacity: number; life: Float32Array; kind: Uint8Array; pos: Float32Array };
  const out: [number, number, number][] = [];
  for (let i = 0; i < p.capacity; i++) {
    if (p.life[i] >= 0 && p.kind[i] === kind) out.push([p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]]);
  }
  return out;
}

/** Anything sitting over the face on top of a die at rest at the origin. */
function overTheTop(points: [number, number, number][]): number {
  return points.filter(([x, y, z]) => Math.hypot(x, z) < HALF * 0.9 && y > HALF + 0.02).length;
}

suite('season 2 · the Sun and Moon dice', () => {
  test('both are pass dice, with their own effects, and nowhere else', () => {
    for (const [id, effect] of [
      ['sun', 'sun'],
      ['moon', 'moon'],
    ] as const) {
      const skin = skinById(id);
      assertEqual(skin.id, id, `the ${id} dice exist`);
      assertEqual(skin.effect, effect, `the ${id} dice have the wrong effect`);
      assert(skin.pass === true, `${id} is not a pass die`);
      assertEqual(skin.price, undefined, `${id} is for sale`);
      assert(PASS_SKINS.includes(skin), `${id} is not listed with the pass dice`);
      assert(!STORE_SKINS.includes(skin), `${id} is on the Store shelf`);
      assert(!LADDER_SKINS.includes(skin), `${id} is on the trophy ladder`);
    }
    assertEqual(DICE_SKINS.filter((s) => s.pattern === 'sunburst' || s.pattern === 'moonlit').length, 2, 'the two patterns belong to the two dice');
  });

  test('the Sun card shows the sun, and the Moon card moonlight, not a ring round nothing', () => {
    /*
      Both shells keep a ring round each colour sticker — dark on the
      Sun, silver on the Moon — and the card shows no sticker, so with
      nothing painted over it the middle of each card was a ring round
      nothing. The same fault the Fire card had, fixed the same way.
    */
    const middle = (px: number[]) => {
      let sum = 0;
      let n = 0;
      for (let y = 24; y < 40; y++) {
        for (let x = 24; x < 40; x++) {
          const i = (y * 64 + x) * 3;
          sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
          n++;
        }
      }
      return sum / n;
    };
    const sun = skinById('sun');
    const sunShell = patternPixels(sun.pattern as never, sun.body, sun.body);
    const sunCard = sunShell.slice();
    paintSun(sunCard);
    note(`the Sun card's middle: ${middle(sunShell).toFixed(0)} before, ${middle(sunCard).toFixed(0)} after`);
    assert(middle(sunCard) > middle(sunShell) + 60, 'the Sun card still has a dark disc in the middle');
    const moon = skinById('moon');
    const moonShell = patternPixels(moon.pattern as never, moon.body, moon.body);
    const moonCard = moonShell.slice();
    paintMoon(moonCard);
    note(`the Moon card's middle: ${middle(moonShell).toFixed(0)} before, ${middle(moonCard).toFixed(0)} after`);
    assert(middle(moonCard) > middle(moonShell) + 40, 'the Moon card has no moonlight in the middle');
  });
});

suite('season 2 · the Sun dice shine', () => {
  test('motes rise off a rolling die, and none sit over the top face at rest', () => {
    const sun = new DiceSun(1);
    const dice = [die(0, 0, true)];
    run(sun, dice, 1);
    assert(live(sun.pool, Kind.Mote).length > 10, 'a rolling Sun die sheds no light');
    const still = new DiceSun(1);
    const rest = [die(0, 0, false)];
    run(still, rest, 2);
    const motes = live(still.pool, Kind.Mote);
    assert(motes.length > 5, 'a Sun die at rest has gone dark');
    assertEqual(overTheTop(motes), 0, 'a mote is sitting over the face on top, which is the roll');
  });

  test('a sunburst where it lands', () => {
    const sun = new DiceSun(1);
    const dice = [die(-1, 2)];
    sun.thrown();
    dropOnto(sun, dice, -1, 2);
    assert(live(sun.pool, Kind.Flash).length >= TUNING.sun.burstRays, 'no sunburst where the die came down');
  });

  test('under the water it goes dark, and shines again on the next throw', () => {
    const sun = new DiceSun(1);
    sun.sank(0, 1, -1);
    assert(sun.shines[0].sunk, 'the sun is still lit under water');
    assert(live(sun.pool, Kind.Steam).length > 0, 'no hiss of steam off the water');
    run(sun, [die(1, -1)], 1.5);
    assertEqual(live(sun.pool, Kind.Mote).length, 0, 'a sunk Sun die is still shedding light');
    sun.fishedOut(0);
    assert(!sun.shines[0].sunk, 'fished out, it stays dark');
    sun.sank(0, 1, -1);
    sun.thrown();
    assert(!sun.shines[0].sunk, 'thrown again, it stays dark');
    assertEqual((sun as DieEffect).heldAt(0), null, 'a Sun die is being held in the moat — only the ice does that');
    sun.dispose();
  });
});

suite('season 2 · the Moon dice glow', () => {
  test('a halo rides with the die and stardust trails behind it', () => {
    const moon = new DiceMoon(1);
    const d = die(-2, 0, true);
    moon.thrown();
    // Rolling across the board at a steady pace.
    for (let t = 0; t < 1; t += FRAME) {
      d.x += 2 * FRAME;
      d.vx = 2;
      moon.update(FRAME, t, [d], 1000);
    }
    assert(live(moon.pool, Kind.Halo).length > 3, 'no halo round a rolling Moon die');
    assert(live(moon.pool, Kind.Stardust).length > 8, 'no stardust behind a rolling Moon die');
  });

  test('a ripple of moonlight where it comes to rest, and nothing over the top face', () => {
    const moon = new DiceMoon(1);
    const dice = [die(0, 0)];
    moon.thrown();
    dropOnto(moon, dice, 0, 0);
    const halos = live(moon.pool, Kind.Halo);
    assert(halos.length >= TUNING.moon.rippleDots, 'no ripple where the die came down');
    dice[0].moving = false;
    run(moon, dice, 2);
    const dust = live(moon.pool, Kind.Stardust);
    assert(dust.length > 3, 'a Moon die at rest sheds no stardust');
    assertEqual(overTheTop(dust), 0, 'stardust is sitting over the face on top, which is the roll');
    assertEqual(overTheTop(live(moon.pool, Kind.Halo)), 0, 'a halo is sitting over the face on top');
  });

  test('under the water it goes dark, and glows again on the next throw', () => {
    const moon = new DiceMoon(1);
    moon.sank(0, 1, -1);
    assert(moon.glows[0].sunk, 'the moon is still lit under water');
    assert(live(moon.pool, Kind.Glint).length > 0, 'no glints off the water');
    run(moon, [die(1, -1)], 1.5);
    assertEqual(live(moon.pool, Kind.Halo).length, 0, 'a sunk Moon die still has a halo');
    moon.thrown();
    assert(!moon.glows[0].sunk, 'thrown again, it stays dark');
    assertEqual((moon as DieEffect).heldAt(0), null, 'a Moon die is being held in the moat — only the ice does that');
    moon.dispose();
  });
});

suite('season 2 · Sun Temple and Moon Garden', () => {
  test('both are pass battlefields, each with a kit of its own', () => {
    for (const [id, jail, mound, pit] of [
      ['suntemple', 'sunShrine', 'sunAltar', 'sunWell'],
      ['moongarden', 'toriiGate', 'moonLantern', 'moonPond'],
    ] as const) {
      assert(THEMED_ARENA_META[id].pass === true, `${id} is not a pass battlefield`);
      assertEqual(ARENA_UNLOCKS[id], undefined, `${id} is on the trophy ladder`);
      assertEqual(ARENA_PRICES[id], undefined, `${id} is for sale`);
      assert(PASS_ARENAS.includes(id), `${id} is not listed with the pass battlefields`);
      assert(!STORE_ARENAS.includes(id), `${id} is on the coin shelf`);
      assertEqual(ARENA_JAILS[id], jail, `${id} borrows another board's jail`);
      assertEqual(ARENA_THEMES[id].look.mound.kind, mound, `${id} lost its bump`);
      assertEqual(ARENA_THEMES[id].look.pit.kind, pit, `${id} lost its pit`);
    }
    assertEqual(ARENA_THEMES.suntemple.structure, 'sunstone', 'the Sun Temple is not built of sandstone');
    assertEqual(ARENA_THEMES.moongarden.structure, 'lanternWall', 'the Moon Garden has no lantern wall');
    assert(ARENA_THEMES.moongarden.look.pit.water === true, 'the moon pond is not water');
  });
});
