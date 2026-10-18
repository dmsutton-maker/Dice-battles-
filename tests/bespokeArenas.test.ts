import { readFileSync } from 'node:fs';
import { TUNING } from '../src/game/tuning';
import { WALL_SLOTS } from '../src/game/stations';
import {
  brazierSpots,
  coursesAt,
  fallenStones,
  MIN_COURSES,
  ruinBlocks,
  ruinHeightAt,
  stumpBlocks,
  DUSK_SILHOUETTES,
} from '../src/arena/ruin';
import {
  clearBespokeFloorCacheForTests,
  courtyardFloorPixels,
  deckPixels,
  jungleTrayPixels,
  sunsetFloorPixels,
} from '../src/arena/bespokeFloors';
import { Painting } from '../src/arena/paint';
import { EXTRA_SPOTS } from '../src/arena/sceneryProps';
import { assert, note, suite, test } from './harness';

/**
 * The four hand-built battlefields after the October 2026 redesign
 * (docs/board-redesign.md): Castle Courtyard, Sunset Castle, Jungle
 * Clearing and Space Station.
 *
 * These cannot judge whether a board looks good — the arena preview tool
 * (tools/arena-preview) is for that, and somebody has to look. They pin
 * what CAN be measured: that the dusk castle is a different building from
 * the day one, that the ruin never leaves a figure standing on air or a
 * die leaning on nothing, and that every floor stays calm enough under
 * the dice for an ivory die to be seen on it.
 */

const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;
const DIE = TUNING.dieSize;

suite('bespoke arenas · the sunset castle is a ruin, not the castle in orange', () => {
  /*
    A family bug report, 20 Aug 2026: "The sunset castle doesn't really
    look any different from the regular. Castle needs to be more
    different." Lighting and paint had been tried; both are colour, and
    the board-redesign rule is that a board must be recognisable with the
    colour off. So these measure SHAPE.
  */
  test('its wall tops are broken, at several different heights', () => {
    const heights = new Set<number>();
    for (const side of ['left', 'right', 'near'] as const) {
      for (let a = -4.5; a <= 4.5; a += 0.25) heights.add(coursesAt(side, a));
    }
    note(`ruin wall tops stand at ${heights.size} different heights`);
    // The day castle's parapet is one height the whole way round.
    assert(heights.size >= 3, `the ruin's skyline has only ${heights.size} heights — that is a wall, not a ruin`);
  });

  test('it is laid from loose blocks, not drawn as four boxes', () => {
    const blocks = ruinBlocks();
    note(`${blocks.length} blocks in the ruin, ${stumpBlocks().length} in the tower stumps`);
    assert(blocks.length > 150, `only ${blocks.length} blocks`);
    // Settled stones, not a laid course: the top stones are not square on.
    const twisted = blocks.filter((b) => Math.abs(b.yaw) > 0.02).length;
    assert(twisted > blocks.length * 0.1, 'every block is perfectly square to its wall');
  });

  test('no stretch of wall falls below a resting die', () => {
    for (const side of ['left', 'right', 'far', 'near'] as const) {
      for (let a = -5.1; a <= 5.1; a += 0.05) {
        const h = ruinHeightAt(side, a);
        assert(h > DIE, `the ${side} wall drops to ${h.toFixed(2)} at ${a.toFixed(2)}, below a ${DIE} die`);
      }
    }
    assert(MIN_COURSES * (wallHeight / 5) > DIE, 'the lowest breach is lower than a die');
  });

  test('the far wall stays whole where captured prisoners are paraded', () => {
    for (const slot of WALL_SLOTS) {
      const h = ruinHeightAt('far', slot.x);
      assert(h >= wallHeight, `a wall-parade figure at x ${slot.x.toFixed(2)} stands over a breach (${h.toFixed(2)})`);
    }
  });

  test('fallen stones lie outside the tray, where no die can roll through them', () => {
    const halfW = innerWidth / 2 + wallThickness;
    for (const s of fallenStones()) {
      assert(Math.abs(s.position[0]) > halfW, `a fallen stone at x ${s.position[0].toFixed(2)} is inside the tray`);
    }
  });

  test('braziers stand on wall that is actually there, never on the parade wall', () => {
    for (const b of brazierSpots()) {
      assert(b.position[1] >= wallHeight * 0.9, `a brazier stands on a breach at ${b.along}`);
    }
  });

  test('the fallen towers take the two far prop spots, and nothing else does', () => {
    for (const t of DUSK_SILHOUETTES) {
      const spot = EXTRA_SPOTS.findIndex(([x, z]) => x === t.x && z === t.z);
      assert(spot === 2 || spot === 3, `a silhouette at (${t.x}, ${t.z}) is not on a far prop spot`);
    }
    const source = readFileSync('src/arena/CastleArena.tsx', 'utf8');
    assert(/\{!dusk && <group key="s2"/.test(source), 'the day campfire is still drawn inside a dusk tower');
    assert(/\{!dusk && <group key="s3"/.test(source), 'the day crate is still drawn inside a dusk tower');
  });

  test('the two castles draw different walls', () => {
    const source = readFileSync('src/arena/CastleArena.tsx', 'utf8');
    assert(/dusk \? <RuinWalls \/> : <CourtyardWalls \/>/.test(source), 'the castle no longer switches walls with the hour');
  });
});

/** Mean luminance and the share of texels as pale as an ivory die. */
function measure(p: Painting): { mean: number; ivory: number } {
  let sum = 0;
  let ivory = 0;
  const n = p.width * p.height;
  for (let i = 0; i < n; i++) {
    const l = 0.2126 * p.data[i * 4] + 0.7152 * p.data[i * 4 + 1] + 0.0722 * p.data[i * 4 + 2];
    sum += l;
    if (l > 215) ivory++;
  }
  return { mean: sum / n, ivory: ivory / n };
}

suite('bespoke arenas · the floors stay calm under the dice', () => {
  const floors: [string, () => Painting][] = [
    ['courtyard', courtyardFloorPixels],
    ['sunset cobbles', sunsetFloorPixels],
    ['jungle clearing', jungleTrayPixels],
    ['station deck', () => deckPixels().color],
  ];

  test('no floor is as pale as the dice that land on it', () => {
    /*
      The dice are ivory. The station deck's first lights were pale
      squares the size of a die face, and from above that is a decoy. A
      floor may have a few bright texels — a lamp, a highlight — but not
      enough to be mistaken for a die.
    */
    /*
      The sunset cobbles are the exception, and on purpose: they are
      painted pale because the dusk light they are seen under is low and
      orange (SUNSET_LIGHT), and in the render they come out at about 90
      of 255 — the darkest floor of the four, not the palest. What
      matters there is the share, not the presence, of pale texels.
    */
    const paleAllowed: Record<string, number> = {
      courtyard: 0.02,
      'sunset cobbles': 0.12,
      'jungle clearing': 0.02,
      'station deck': 0.02,
    };
    for (const [name, paint] of floors) {
      const { mean, ivory } = measure(paint());
      note(`${name}: mean ${mean.toFixed(0)}, ${(ivory * 100).toFixed(2)}% ivory-pale`);
      assert(mean < 200, `${name} averages ${mean.toFixed(0)} — too close to an ivory die`);
      assert(mean > 60, `${name} averages ${mean.toFixed(0)} — too dark to read a colour on`);
      assert(ivory < paleAllowed[name], `${name} has ${(ivory * 100).toFixed(1)}% ivory-pale texels`);
    }
  });

  test('every floor is the same floor every launch', () => {
    for (const [name, paint] of floors) {
      const a = paint().data.slice();
      clearBespokeFloorCacheForTests();
      const b = paint().data;
      let same = a.length === b.length;
      for (let i = 0; same && i < a.length; i += 97) same = a[i] === b[i];
      assert(same, `${name} changes between builds`);
    }
  });

  test('no two of the four floors are alike', () => {
    const means = floors.map(([name, paint]) => {
      const p = paint();
      let r = 0;
      let g = 0;
      let b = 0;
      const n = p.width * p.height;
      for (let i = 0; i < n; i++) {
        r += p.data[i * 4];
        g += p.data[i * 4 + 1];
        b += p.data[i * 4 + 2];
      }
      return { name, rgb: [r / n, g / n, b / n] };
    });
    for (let i = 0; i < means.length; i++) {
      for (let j = i + 1; j < means.length; j++) {
        const d = Math.hypot(
          means[i].rgb[0] - means[j].rgb[0],
          means[i].rgb[1] - means[j].rgb[1],
          means[i].rgb[2] - means[j].rgb[2],
        );
        assert(d > 12, `${means[i].name} and ${means[j].name} are nearly the same colour`);
      }
    }
  });

  test('each floor paints in reasonable time', () => {
    /*
      Painted in JavaScript on the phone the first time an arena opens;
      the themed floors settled on about 150ms in node as the ceiling a
      player does not notice. Generous here so a slow CI box does not
      fail it, tight enough to catch a painter that has gone quadratic.
    */
    for (const [name, paint] of floors) {
      clearBespokeFloorCacheForTests();
      const t0 = process.hrtime.bigint();
      paint();
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      note(`${name}: ${ms.toFixed(0)}ms`);
      assert(ms < 600, `${name} took ${ms.toFixed(0)}ms to paint`);
    }
  });

  test('the station lamps sit where the deck painted slots for them', () => {
    const { color, glow } = deckPixels();
    let lit = 0;
    let misplaced = 0;
    for (let i = 0; i < glow.width * glow.height; i++) {
      const g = glow.data[i * 4] + glow.data[i * 4 + 1] + glow.data[i * 4 + 2];
      if (g < 60) continue;
      lit++;
      // A glowing texel on a dark, unlit-looking plate is a lamp with no
      // fitting: the colour map must be pale where the glow map is lit.
      const c = color.data[i * 4] + color.data[i * 4 + 1] + color.data[i * 4 + 2];
      if (c < 300) misplaced++;
    }
    note(`${lit} lit texels on the deck`);
    assert(lit > 200, 'the deck has no lights');
    assert(misplaced < lit * 0.05, `${misplaced} of ${lit} glowing texels have no lamp painted under them`);
  });
});

suite('bespoke arenas · idle life rides the scene clock', () => {
  test('the water clock also ticks the scenery', () => {
    const source = readFileSync('src/arena/waterClock.tsx', 'utf8');
    assert(source.includes('SCENERY_LIFE'), 'WaterClock no longer advances the braziers, flags and beacons');
  });

  test('the arena files never import the native renderer', () => {
    /*
      They are loaded by the headless tests and the browser preview, and
      neither has `@react-three/fiber/native`. Idle motion goes through
      sceneryClock.ts instead.
    */
    for (const file of ['CastleArena.tsx', 'JungleArena.tsx', 'SpaceArena.tsx', 'castleParts.tsx', 'ruinParts.tsx', 'jungleParts.tsx', 'spaceParts.tsx']) {
      const source = readFileSync(`src/arena/${file}`, 'utf8');
      assert(!source.includes('@react-three/fiber'), `${file} imports the renderer`);
    }
  });

  test('no tick allocates', () => {
    /*
      A tick runs every drawn frame. `new` inside one is garbage every
      frame on a phone. Every tick in these files is built in a useMemo
      that creates its scratch objects first and returns the closure; the
      closure's own body must not construct anything.
    */
    let ticks = 0;
    for (const file of ['castleParts.tsx', 'ruinParts.tsx', 'jungleParts.tsx', 'spaceParts.tsx', 'SpaceArena.tsx']) {
      const source = readFileSync(`src/arena/${file}`, 'utf8');
      for (const m of source.matchAll(/return \(t: number\) => \{([\s\S]*?)\n {4}\};|\(t: number\) => \{([\s\S]*?)\n {4}\}/g)) {
        const body = m[1] ?? m[2] ?? '';
        ticks++;
        assert(!/\bnew \w/.test(body), `${file} allocates inside a frame tick`);
      }
    }
    // Not vacuous: the flags, braziers, vines, lamps, beacons, stars and
    // deck all have one.
    note(`${ticks} frame ticks checked`);
    assert(ticks >= 6, `only ${ticks} ticks found — has the pattern moved?`);
  });
});
