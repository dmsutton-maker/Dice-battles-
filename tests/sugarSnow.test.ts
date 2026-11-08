import './storageMock';
import * as THREE from 'three';
import { assert, assertEqual, note, suite, test } from './harness';
import { DICE_SKINS, LADDER_SKINS, PASS_SKINS, skinById, STORE_SKINS } from '../src/game/diceSkins';
import { ARENA_PRICES, ARENA_UNLOCKS, PASS_ARENAS, STORE_ARENAS } from '../src/game/loadout';
import { ARENA_JAILS } from '../src/arena/jailKinds';
import { ARENA_THEMES, THEMED_ARENA_META } from '../src/arena/themeData';
import { DiceGingerbread } from '../src/dice/diceGingerbread';
import { DiceBauble } from '../src/dice/diceBauble';
import type { DieEffect, DieSample } from '../src/dice/dieEffect';
import { Kind, ParticlePool } from '../src/dice/particles';
import { patternPixels } from '../src/dice/patterns';
import { paintBauble, paintGingerbread } from '../src/dice/preview';
import { SEASONS } from '../src/game/seasonPass';
import { TUNING } from '../src/game/tuning';

/*
  Season 1 of the pass, "Sugar & Snow", October to December 2026, built 8 Nov 2026 and swapped in as Season 1 the same day
  to the plan in docs/seasons-3-to-8.md. David, 21 Oct 2026: "Make 2 new
  dice and 2 new arenas every month normally going on with a theme like
  how this one is fire and ice." Marc, 8 Nov 2026: "Work on season 2."
  Two dice with effects of their own and two battlefields with their own
  kits, to the standard of Fire & Ice and Sun & Moon.
*/

const HALF = TUNING.dieSize / 2;
const FRAME = 1 / 60;

function die(x = 0, z = 0, moving = false): DieSample {
  return { x, y: HALF, z, vx: 0, vy: 0, vz: 0, quaternion: new THREE.Quaternion(), moving };
}

type Effect = DiceGingerbread | DiceBauble;

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

suite('sugar & snow · the season', () => {
  test('Season 1 is October to December 2026, with its four things on the usual levels', () => {
    // Built as Season 2 for December; swapped to Season 1 the same day,
    // 8 Nov 2026, David: "so season 2 is the current season, but
    // obviously call it season 1 ... go until the end of December".
    const s = SEASONS.find((x) => x.number === 1);
    assert(s !== undefined, 'there is no Season 1');
    assertEqual(s!.name, 'Sugar & Snow', 'its name');
    assertEqual(s!.month, '2026-10', 'its month');
    assertEqual(s!.months ?? 1, 3, 'three months long: October to December');
    const at = (level: number) => s!.items.find((i) => i.level === level)!;
    assertEqual(`${at(6).item.kind}:${at(6).item.id}:${at(6).track}`, 'arena:gingerbread:gold', 'level 6');
    assertEqual(`${at(12).item.kind}:${at(12).item.id}:${at(12).track}`, 'dice:gingerbread:gold', 'level 12');
    assertEqual(`${at(20).item.kind}:${at(20).item.id}:${at(20).track}`, 'dice:bauble:free', 'level 20');
    assertEqual(`${at(30).item.kind}:${at(30).item.id}:${at(30).track}`, 'arena:twinklemarket:gold', 'level 30');
  });
});

suite('sugar & snow · the Gingerbread and Bauble dice', () => {
  test('both are pass dice, with their own effects, and nowhere else', () => {
    for (const [id, effect] of [
      ['gingerbread', 'gingerbread'],
      ['bauble', 'bauble'],
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
    assertEqual(DICE_SKINS.filter((s) => s.pattern === 'gingerbread' || s.pattern === 'bauble').length, 2, 'the two patterns belong to the two dice');
  });

  test('the icing runs over the edges: the same icing on both sides of every edge', () => {
    /*
      The zig-zag is a function of the point in space, so a texel on one
      face and its neighbour across the edge see the same line. Paint the
      four faces round the die as four squares (patternPixels takes the
      cell), and compare the right-hand column of each with the left-hand
      column of the next: where either is iced, both should be.
    */
    const skin = skinById('gingerbread');
    const SIZE = 64;
    const faces = [0, 1, 2, 3].map((k) => patternPixels(skin.pattern as never, skin.body, skin.body, k, 0));
    const white = (px: number[], x: number, y: number) => {
      const i = (y * SIZE + x) * 3;
      return 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    };
    let disagree = 0;
    let icedPairs = 0;
    for (let k = 0; k < 4; k++) {
      const a = faces[k];
      const b = faces[(k + 1) % 4];
      for (let y = 2; y < SIZE - 2; y++) {
        const wa = white(a, SIZE - 1, y);
        if (wa < 200) continue;
        icedPairs++;
        // A zig-zag crosses the edge at a slant, so the line's continuation
        // may sit a texel up or down: iced anywhere in the three is a match.
        const wb = Math.max(white(b, 0, y - 1), white(b, 0, y), white(b, 0, y + 1));
        if (wb < 150) disagree++;
      }
    }
    note(`${icedPairs} iced texel pairs across the four vertical edges, ${disagree} disagree`);
    assert(icedPairs > 12, 'the icing never reaches an edge');
    assert(disagree < icedPairs * 0.2, 'the icing breaks at the edges of the die');
  });

  test('the shelf cards show an iced snowflake and a gleam, not a ring round nothing', () => {
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
    const ginger = skinById('gingerbread');
    const gingerShell = patternPixels(ginger.pattern as never, ginger.body, ginger.body);
    const gingerCard = gingerShell.slice();
    paintGingerbread(gingerCard);
    note(`the Gingerbread card's middle: ${middle(gingerShell).toFixed(0)} before, ${middle(gingerCard).toFixed(0)} after`);
    assert(middle(gingerCard) > middle(gingerShell) + 25, 'the Gingerbread card has no icing in the middle');
    const bauble = skinById('bauble');
    const baubleShell = patternPixels(bauble.pattern as never, bauble.body, bauble.body);
    const baubleCard = baubleShell.slice();
    paintBauble(baubleCard);
    note(`the Bauble card's middle: ${middle(baubleShell).toFixed(0)} before, ${middle(baubleCard).toFixed(0)} after`);
    assert(middle(baubleCard) > middle(baubleShell) + 20, 'the Bauble card has no gleam in the middle');
  });
});

suite('sugar & snow · the Gingerbread dice shed crumbs', () => {
  test('crumbs fall off a rolling die and none off one at rest', () => {
    const fx = new DiceGingerbread(1);
    const dice = [die(0, 0, true)];
    dice[0].y = 1.2;
    run(fx, dice, 0.5);
    assert(live(fx.pool, Kind.Crumb).length > 5, 'a tumbling Gingerbread die sheds no crumbs');
    const still = new DiceGingerbread(1);
    const rest = [die(0, 0, false)];
    run(still, rest, 2);
    assertEqual(live(still.pool, Kind.Crumb).length, 0, 'a Gingerbread die at rest is still shedding crumbs');
    assertEqual(live(still.pool, Kind.Sugar).length, 0, 'sugar is puffing off a die at rest');
  });

  test('a puff of sugar where it lands, and crumbs that bounce away, none over the top', () => {
    const fx = new DiceGingerbread(1);
    const dice = [die(0, 0)];
    fx.thrown();
    dropOnto(fx, dice, 0, 0);
    const sugar = live(fx.pool, Kind.Sugar);
    assert(sugar.length >= TUNING.gingerbread.puffCount * 0.8, 'no puff of sugar where the die came down');
    assert(live(fx.pool, Kind.Crumb).length >= TUNING.gingerbread.bounceCrumbs, 'no crumbs bounced away');
    dice[0].moving = false;
    for (let t = 0; t < 0.3; t += FRAME) fx.update(FRAME, t, dice, 1000);
    assertEqual(overTheTop(live(fx.pool, Kind.Sugar)), 0, 'sugar is sitting over the face on top, which is the roll');
    // Crumbs shed on the way down are still falling past the die for a
    // moment; a second later every one of them has reached the floor.
    run(fx, dice, 1, 0.3);
    assertEqual(overTheTop(live(fx.pool, Kind.Crumb)), 0, 'a crumb is sitting over the face on top');
  });

  test('crumbs are gone when they reach the floor', () => {
    const fx = new DiceGingerbread(1);
    const dice = [die(0, 0, true)];
    dice[0].y = 1.0;
    run(fx, dice, 0.4);
    dice[0].moving = false;
    run(fx, dice, 3, 0.4);
    assertEqual(live(fx.pool, Kind.Crumb).length, 0, 'crumbs are lying about three seconds later');
  });

  test('soggy in the moat, dry again on the next throw', () => {
    const fx = new DiceGingerbread(1);
    fx.sank(0, 1, -1);
    assert(fx.biscuits[0].sunk, 'the biscuit is still dry under water');
    assert(live(fx.pool, Kind.Crumb).length > 0, 'no crumbs floated off on the water');
    const wet = [die(1, -1, true)];
    run(fx, wet, 1.5);
    const after = live(fx.pool, Kind.Crumb).filter(([, y]) => y > 0.1).length;
    assertEqual(after, 0, 'a soggy biscuit is still shedding crumbs');
    fx.fishedOut(0);
    assert(!fx.biscuits[0].sunk, 'fished out, it stays soggy');
    fx.sank(0, 1, -1);
    fx.thrown();
    assert(!fx.biscuits[0].sunk, 'thrown again, it stays soggy');
    assertEqual((fx as DieEffect).heldAt(0), null, 'a biscuit is being held in the moat — only the ice does that');
    fx.dispose();
  });
});

suite('sugar & snow · the Bauble dice glitter', () => {
  test('glitter trails behind a rolling die, and the glass has a sheen', () => {
    const fx = new DiceBauble(1);
    const d = die(-2, 0, true);
    fx.thrown();
    for (let t = 0; t < 1; t += FRAME) {
      d.x += 2 * FRAME;
      d.vx = 2;
      fx.update(FRAME, t, [d], 1000);
    }
    assert(live(fx.pool, Kind.Glitter).length > 8, 'no glitter behind a rolling Bauble die');
    assert(live(fx.pool, Kind.Halo).length > 3, 'no sheen on a rolling Bauble die');
  });

  test('a ring of glitter where it lands, one twinkle on a top corner, nothing over the top face', () => {
    const fx = new DiceBauble(1);
    const dice = [die(0, 0)];
    fx.thrown();
    dropOnto(fx, dice, 0, 0);
    assert(live(fx.pool, Kind.Glitter).length >= TUNING.bauble.ringDots, 'no ring of glitter where the die came down');
    const twinkles = live(fx.pool, Kind.Flash);
    assertEqual(twinkles.length, 1, 'there should be exactly one twinkle');
    const [tx, ty, tz] = twinkles[0];
    assert(ty > HALF * 0.9, 'the twinkle is not up on the die');
    assert(Math.hypot(tx, tz) > HALF * 0.95, 'the twinkle is over the face, not on a corner');
    dice[0].moving = false;
    run(fx, dice, 2);
    const dust = live(fx.pool, Kind.Glitter);
    assert(dust.length > 3, 'a Bauble die at rest sheds no glitter');
    assertEqual(overTheTop(dust), 0, 'glitter is sitting over the face on top, which is the roll');
    assertEqual(overTheTop(live(fx.pool, Kind.Halo)), 0, 'a sheen is sitting over the face on top');
    assert(live(fx.pool, Kind.Flash).length <= 1, 'the twinkle multiplied');
  });

  test('under the water it goes dark, and glitters again on the next throw', () => {
    const fx = new DiceBauble(1);
    fx.sank(0, 1, -1);
    assert(fx.glasses[0].sunk, 'the bauble is still lit under water');
    assert(live(fx.pool, Kind.Glint).length > 0, 'no glints off the water');
    run(fx, [die(1, -1, true)], 1.5);
    assertEqual(live(fx.pool, Kind.Halo).length, 0, 'a sunk Bauble die still has a sheen');
    fx.thrown();
    assert(!fx.glasses[0].sunk, 'thrown again, it stays dark');
    assertEqual((fx as DieEffect).heldAt(0), null, 'a Bauble die is being held in the moat — only the ice does that');
    fx.dispose();
  });
});

suite('sugar & snow · Gingerbread Village and Twinkle Market', () => {
  test('both are pass battlefields, each with a kit of its own', () => {
    for (const [id, jail, mound, pit] of [
      ['gingerbread', 'biscuitPen', 'sugarDrift', 'cocoaPond'],
      ['twinklemarket', 'marketStall', 'parcelPile', 'skatingPond'],
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
    assertEqual(ARENA_THEMES.gingerbread.structure, 'icedBiscuit', 'the Gingerbread Village is not built of biscuit');
    assertEqual(ARENA_THEMES.twinklemarket.structure, 'stringLights', 'the Twinkle Market has no string lights');
    assert(ARENA_THEMES.twinklemarket.look.pit.water === true, 'the skating pond is not water');
    assertEqual(ARENA_THEMES.gingerbread.look.words.sink, 'Splash! A die fell in the cocoa pond!', "the cocoa pond's message");
    assertEqual(ARENA_THEMES.twinklemarket.look.words.sink, 'Whoosh! A die slid into the skating pond!', "the skating pond's message");
  });

  test('the strips beside the walls stay clear for the life', () => {
    /*
      The train, the shoppers and the skaters move round the outside of
      the tray. A prop in a strip has to stand against the wall (x about
      ±3.05) or in the band beyond the far wall, never out in the lane.
    */
    for (const id of ['gingerbread', 'twinklemarket'] as const) {
      for (const p of ARENA_THEMES[id].props) {
        const inBand = p.z <= -8.7;
        const againstWall = Math.abs(p.x) >= 3.0 && Math.abs(p.x) <= 3.1;
        const farCorner = Math.abs(p.x) >= 3.9 && p.z <= -9;
        assert(inBand || againstWall || farCorner, `${id}: a ${p.kind} at (${p.x}, ${p.z}) is out in the lane`);
      }
    }
  });
});
