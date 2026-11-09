import './storageMock';
import * as THREE from 'three';
import { assert, assertEqual, note, suite, test } from './harness';
import { DICE_SKINS, LADDER_SKINS, PASS_SKINS, skinById, STORE_SKINS } from '../src/game/diceSkins';
import { ARENA_PRICES, ARENA_UNLOCKS, PASS_ARENAS, STORE_ARENAS } from '../src/game/loadout';
import { ARENA_JAILS } from '../src/arena/jailKinds';
import { ARENA_THEMES, THEMED_ARENA_META } from '../src/arena/themeData';
import { DiceGingerbread } from '../src/dice/diceGingerbread';
import { DiceSnowGlobe } from '../src/dice/diceSnowGlobe';
import type { DieEffect, DieSample } from '../src/dice/dieEffect';
import { Kind, ParticlePool } from '../src/dice/particles';
import { patternPixels } from '../src/dice/patterns';
import { paintGingerbread, paintSnowGlobe } from '../src/dice/preview';
import { fitCamera } from '../src/demo/cameraFit';
import { alongRoute, LANE_FAR, LANE_NEAR, LANE_X, MARKET_ROUTE, obstacles, SHOPPER_RADIUS } from '../src/arena/marketPath';
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

type Effect = DiceGingerbread | DiceSnowGlobe;

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
    // The Bauble dice held level 20 for a day; David had it deleted on 8 Nov
    // 2026 and picked the Snow Globe dice (9 Nov) in its place.
    assertEqual(`${at(20).item.kind}:${at(20).item.id}:${at(20).track}`, 'dice:snowglobe:free', 'level 20');
    assertEqual(`${at(30).item.kind}:${at(30).item.id}:${at(30).track}`, 'arena:twinklemarket:gold', 'level 30');
  });
});

suite('sugar & snow · the Gingerbread and Snow Globe dice', () => {
  test('both are pass dice, with their own effects, and nowhere else', () => {
    for (const [id, effect] of [
      ['gingerbread', 'gingerbread'],
      ['snowglobe', 'snowglobe'],
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
    assertEqual(DICE_SKINS.filter((s) => s.pattern === 'gingerbread' || s.pattern === 'snowglobe').length, 2, 'the two patterns belong to the two dice');
    assert(!DICE_SKINS.some((s) => s.id === 'bauble'), 'the Bauble dice is back (deleted 8 Nov 2026 at David\'s request)');
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
    const globe = skinById('snowglobe');
    const globeShell = patternPixels(globe.pattern as never, globe.body, globe.body);
    const globeCard = globeShell.slice();
    paintSnowGlobe(globeCard);
    // The card's middle holds a cottage: its berry-red roof is paint the bare glass never has.
    const roofTexels = (px: number[]) => {
      let n = 0;
      for (let y = 16; y < 48; y++) {
        for (let x = 16; x < 48; x++) {
          const i = (y * 64 + x) * 3;
          if (px[i] > 150 && px[i + 1] < 110 && px[i + 2] < 130) n++;
        }
      }
      return n;
    };
    note(`the Snow Globe card's middle: ${roofTexels(globeShell)} red texels before, ${roofTexels(globeCard)} after`);
    assertEqual(roofTexels(globeShell), 0, 'the bare glass already has a roof in the middle');
    assert(roofTexels(globeCard) >= 30, 'the Snow Globe card has no cottage in the middle');
  });

  test('the village sits in the corners of every face, clear of the colour and of the edges', () => {
    // David, 8 Nov 2026: "put the houses and trees on the design at the
    // corners of the dice where there's the most room". A roof is berry
    // red (#b84a5c) and a tree is fir green (#2f6f4a / #3a8a5c): both must
    // be found in every corner quarter of every face and never within the
    // colour sticker's ring or over an edge.
    const globe = skinById('snowglobe');
    const size = 64;
    // Roof red and fir green only: the cream walls and brown trunks are too
    // close to what the brass stand's sparkle makes over pale glass.
    const isScene = (r: number, g: number, b: number) =>
      (Math.abs(r - 184) < 30 && Math.abs(g - 74) < 30 && Math.abs(b - 92) < 30) || // roof
      (r < 100 && g > 90 && g < 160 && b > 60 && b < 120); // fir
    // The strip's four squares are the four sides; the top and bottom are
    // painted from the same function, so their corners are the same.
    for (let face = 0; face < 4; face++) {
      const px = patternPixels(globe.pattern as never, globe.body, globe.body, face);
      for (const [cu, cv] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        let found = 0;
        for (let y = cv * 32; y < cv * 32 + 32; y++) {
          for (let x = cu * 32; x < cu * 32 + 32; x++) {
            const i = (y * size + x) * 3;
            if (!isScene(px[i], px[i + 1], px[i + 2])) continue;
            found++;
            const d = Math.hypot(x + 0.5 - 32, y + 0.5 - 32);
            assert(d > 21 * 1.16, `face ${face}: scene paint ${d.toFixed(1)} from the centre, inside the stand`);
            assert(x > 0 && x < 63 && y > 0 && y < 63, `face ${face}: scene paint on the very edge at (${x}, ${y})`);
          }
        }
        assert(found > 6, `face ${face}, corner (${cu}, ${cv}) has no cottage or tree (${found} texels)`);
      }
    }
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

suite('sugar & snow · the Snow Globe dice swirl with snow', () => {
  test('snow swirls round a rolling die and none round one at rest from a standing start', () => {
    const fx = new DiceSnowGlobe(1);
    const d = die(-2, 0, true);
    fx.thrown();
    for (let t = 0; t < 1; t += FRAME) {
      d.x += 2 * FRAME;
      d.vx = 2;
      fx.update(FRAME, t, [d], 1000);
    }
    const flakes = live(fx.pool, Kind.Flake);
    assert(flakes.length > 20, `only ${flakes.length} flakes round a rolling Snow Globe die`);
    // Every flake is near the die, where the globe's snow would be.
    // Near the die, or trailing a little behind it the way shaken snow lags.
    for (const [x, , z] of flakes) assert(Math.hypot(x - d.x, z - d.z) < HALF * 1.45 + 2.2, 'a flake is far from the die');
    const still = new DiceSnowGlobe(1);
    run(still, [die(0, 0)], 0.3);
    // A die at rest sheds a slow settle, never a swirl.
    assert(live(still.pool, Kind.Flake).length < 4, 'a die at rest is swirling');
    fx.dispose();
    still.dispose();
  });

  test('a flurry where it lands, settling flakes at rest, nothing over the top face', () => {
    const fx = new DiceSnowGlobe(1);
    const dice = [die(0, 0)];
    fx.thrown();
    dropOnto(fx, dice, 0, 0);
    assert(live(fx.pool, Kind.Flake).length >= TUNING.snowglobe.flurryCount * 0.8, 'no flurry where the die came down');
    dice[0].moving = false;
    run(fx, dice, 2);
    const settling = live(fx.pool, Kind.Flake);
    assert(settling.length > 2, 'a Snow Globe die at rest has no snow settling round it');
    assertEqual(overTheTop(settling), 0, 'snow is sitting over the face on top, which is the roll');
    fx.dispose();
  });

  test('under the water: bubbles, no snow, and snow again on the next throw', () => {
    const fx = new DiceSnowGlobe(1);
    fx.sank(0, 1, -1);
    assert(fx.globes[0].sunk, 'the globe is not under');
    assert(live(fx.pool, Kind.Glint).length >= TUNING.snowglobe.bubbles, 'no bubbles off the glass');
    run(fx, [die(1, -1, true)], 1.5);
    assertEqual(live(fx.pool, Kind.Flake).length, 0, 'a sunk Snow Globe die is still shedding snow');
    fx.thrown();
    assert(!fx.globes[0].sunk, 'thrown again, it stays under');
    assertEqual((fx as DieEffect).heldAt(0), null, 'a Snow Globe die is being held in the moat; only the ice does that');
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

suite('twinkle market · the shoppers walk round the stalls', () => {
  /*
    David, 8 Nov 2026: "the people in twinkle market walk through the
    surrounding objects so make them go around them." The route is built
    from the theme's own props (marketPath.ts); this walks every step of
    it and checks it against them, the tray and the camera.
  */
  const samples: { x: number; z: number; heading: number }[] = [];
  for (let u = 0; u < 1; u += 0.1 / MARKET_ROUTE.total) {
    const p = { x: 0, z: 0 };
    const heading = alongRoute(MARKET_ROUTE, u, p);
    samples.push({ ...p, heading });
  }

  test('the route passes clear of every stall, parcel pile and lantern', () => {
    const props = obstacles();
    assert(props.length >= 6, `only ${props.length} props found to walk round`);
    for (const o of props) {
      let nearest = Infinity;
      for (const q of samples) {
        // Distance outside the prop's footprint, as a box.
        const dx = Math.max(0, Math.abs(q.x - o.x) - o.hx);
        const dz = Math.max(0, Math.abs(q.z - o.z) - o.hz);
        nearest = Math.min(nearest, Math.hypot(dx, dz));
      }
      assert(nearest >= SHOPPER_RADIUS, `the shoppers brush the prop at (${o.x}, ${o.z}): ${nearest.toFixed(2)} clear`);
    }
    note(`${samples.length} steps checked against ${props.length} props`);
  });

  test('the route stays off the tray and inside an iPhone frame, and faces the way it walks', () => {
    const outX = TUNING.tray.innerWidth / 2 + TUNING.tray.wallThickness;
    const outZ = TUNING.tray.innerDepth / 2 + TUNING.tray.wallThickness;
    for (const q of samples) {
      assert(Math.abs(q.x) >= outX + SHOPPER_RADIUS || Math.abs(q.z) >= outZ + SHOPPER_RADIUS, `(${q.x.toFixed(2)}, ${q.z.toFixed(2)}) is on the tray`);
      // On a side, never inside the lane; the near and far legs cross between the sides.
      const crossing = Math.abs(q.z - LANE_NEAR) < 0.35 || Math.abs(q.z - LANE_FAR) < 0.35;
      assert(crossing || Math.abs(q.x) >= LANE_X - 0.01, `(${q.x.toFixed(2)}, ${q.z.toFixed(2)}) is inside the lane`);
    }
    for (const [label, aspect] of [['iPhone 15', 393 / 852], ['iPhone SE', 375 / 667]] as const) {
      const camera = new THREE.PerspectiveCamera();
      fitCamera(camera, aspect);
      let worst = 0;
      for (const q of samples) {
        for (const y of [0, 0.7]) {
          const ndc = new THREE.Vector3(q.x, y, q.z).project(camera);
          worst = Math.max(worst, Math.abs(ndc.x), Math.abs(ndc.y));
        }
      }
      note(`${label}: the route reaches ${(worst * 100).toFixed(0)}% of the way to the frame's edge`);
      assert(worst <= 1, `${label}: the shoppers walk out of the frame`);
    }
    // Heading: the direction of travel between two samples, except where
    // a step straddles a corner (the two samples then lie on two edges).
    let straddles = 0;
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1];
      const b = samples[i];
      const dir = Math.atan2(b.x - a.x, b.z - a.z);
      const diff = Math.abs(Math.atan2(Math.sin(dir - a.heading), Math.cos(dir - a.heading)));
      if (diff >= 0.01) {
        straddles++;
        assert(diff < Math.PI / 2, `a shopper walks one way and faces another at (${a.x.toFixed(2)}, ${a.z.toFixed(2)})`);
      }
    }
    assert(straddles <= MARKET_ROUTE.points.length, `${straddles} steps face the wrong way for ${MARKET_ROUTE.points.length} corners`);
  });
});
