import { readFileSync } from 'node:fs';
import { assert, assertEqual, note, suite, test } from './harness';
import { createWaterMaterial, troughOf } from '../src/arena/water';
import { OBSTACLE_LOOKS } from '../src/arena/obstacleLooks';
import { isWaterPit } from '../src/arena/hazardShapes';
import { splitPlacement } from '../src/ui/placement';

/**
 * Three fixes from one message, David, 30 Sep 2026:
 *
 *   "Fix the button on the cups screen to make it look full and not
 *   partially black. ... On old boards that have the water trap I don't
 *   like that diamond instead I wanna see the water moving in all the
 *   ponds flowing maybe some little waves in there something to show
 *   that it's real water."
 *
 * (The third, "one or two cups and no always-on cup", is in
 * tournament.test.ts with the rest of the cup rules.)
 */

const code = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

suite('buttons · the shadow sits under the face', () => {
  test('a margin moves the whole button, not just its face', () => {
    /*
      The drop shadow is drawn from the top of the wrapper. A margin on
      the FACE pushed the face down inside that wrapper, and the shadow
      showed as a black band above the button and another below it —
      the Cups screen's "partially black" Play button.
    */
    const { placement, face } = splitPlacement({
      marginTop: 14,
      alignSelf: 'stretch',
      paddingVertical: 18,
      backgroundColor: 'red',
    });
    assertEqual(placement.marginTop, 14, 'the margin stayed on the face');
    assertEqual(face.marginTop, undefined, 'the face still carries the margin');
    assertEqual(face.paddingVertical, 18, 'the padding left the face');
    assertEqual(face.backgroundColor, 'red', 'the colour left the face');
    // Stretched across its parent, and still stretched inside the wrapper.
    assertEqual(placement.alignSelf, 'stretch', 'the wrapper does not stretch');
    assertEqual(face.alignSelf, 'stretch', 'the face no longer fills the wrapper');
  });

  test('a flex share goes to the wrapper, so side-by-side buttons share the row', () => {
    const { placement, face } = splitPlacement({ flex: 1, paddingVertical: 10 });
    assertEqual(placement.flex, 1, 'flex stayed on the face, inside a wrapper that does not grow');
    assertEqual(face.flex, undefined, 'the face still carries flex');
  });

  test('the card really uses it', () => {
    const card = code('src/ui/Card.tsx');
    assert(/splitPlacement\(style\)/.test(card), 'Card no longer splits placement from the face');
    assert(/style=\{placement\}/.test(card), 'the placement never reaches the wrapper');
  });
});

suite('water · no diamond', () => {
  test('the moat edge is not a four-segment ring', () => {
    /*
      ringGeometry with four segments draws a DIAMOND, at 45 degrees to
      the square hole it was meant to outline. That was the diamond.
    */
    for (const file of ['src/demo/DiceScene.tsx', 'src/arena/Hazards.tsx']) {
      assert(!/ringGeometry args=\{\[[^\]]*,\s*4,\s*1\]\}/.test(code(file)), `the diamond is back in ${file}`);
    }
  });
});

suite('water · the ponds move', () => {
  test('the water pits are marked as water, and the rest are not', () => {
    const water = Object.entries(OBSTACLE_LOOKS)
      .filter(([, look]) => look.pit.water)
      .map(([id]) => id)
      .sort();
    note(`moving water in: ${water.join(', ')}`);
    for (const id of ['castle', 'castleSunset', 'jungle']) {
      assert(water.includes(id), `${id}'s ${OBSTACLE_LOOKS[id as keyof typeof OBSTACLE_LOOKS].words.pit} does not move`);
    }
    // Not water at all: these must keep their own surface.
    for (const id of ['volcano', 'desert', 'space', 'moon', 'city']) {
      assert(!water.includes(id), `${id}'s pit is drawn as water`);
    }
  });

  test('the moat draws water as moving water', () => {
    /*
      The pit is drawn by src/arena/Hazards.tsx since the board redesign
      (18 Oct 2026), where each board's pit got its own look. Same three
      promises, checked where they now live: the pit asks whether it is
      water, water is the moving WaterSurface, and the scene's clock
      drives it.
    */
    const scene = code('src/demo/DiceScene.tsx');
    const pit = code('src/arena/Hazards.tsx');
    assert(/<Pit look=\{look\}/.test(scene), 'the scene no longer draws the pit');
    assert(/isWaterPit\(p\.kind\) &&/.test(pit), 'the moat does not ask whether it is water');
    assert(/<WaterSurface[\s\S]*?shape="square"/.test(pit), 'the moat is not drawn as moving water');
    assert(/<WaterClock idle=\{waterIdle\} \/>/.test(scene), 'nothing moves the water');
    // Every pit marked as water moves: as a WaterSurface, or (the
    // whirlpool) as its own shader on the same clock.
    for (const [id, look] of Object.entries(OBSTACLE_LOOKS)) {
      if (!look.pit.water) continue;
      assert(
        isWaterPit(look.pit.kind) || look.pit.kind === 'whirlpool',
        `${id}'s ${look.words.pit} is marked water but drawn as something else`,
      );
    }
  });

  test('every pond, pool and river in the originals moves', () => {
    const castle = code('src/arena/CastleArena.tsx');
    const jungle = code('src/arena/JungleArena.tsx');
    assert(!/color=\{palette\.water\}/.test(castle), 'a castle pond is still a flat colour');
    assertEqual((castle.match(/<WaterSurface/g) ?? []).length, 2, 'the castle pond and pool are not both moving');
    assert(!/color="#3fa8c9"/.test(jungle), 'the jungle river is still a flat colour');
    assertEqual((jungle.match(/<WaterSurface/g) ?? []).length, 3, 'the jungle lagoon, pool and river do not all move');
    // The river runs along its length.
    assert(/flow=\{\[0, 0\.55\]\}/.test(jungle), 'the river does not flow');
  });

  test('the material has a clock, a current and a shape', () => {
    const m = createWaterMaterial(
      { shallow: '#2f9be2', deep: troughOf('#2f9be2'), foam: '#ffffff', opacity: 0.94 },
      'square',
      [2, 2],
      [0.1, 0.05],
    );
    for (const u of ['uTime', 'uShallow', 'uDeep', 'uFoam', 'uFlow', 'uSize', 'uRound']) {
      assert(u in m.uniforms, `the water has no ${u}`);
    }
    assert(m.transparent, 'see-through water is drawn solid');
    const solid = createWaterMaterial(
      { shallow: '#2f9be2', deep: '#123456', foam: '#ffffff', opacity: 1 },
      'round',
      [2, 2],
    );
    assert(!solid.transparent, 'a solid pond is drawn as see-through');
    assertEqual(solid.uniforms.uRound.value, 1, 'a round pond has square foam');
  });

  test('the troughs are darker than the crests', () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11;
    };
    for (const c of ['#2f9be2', '#3fa8c9', '#2f8f74', '#5c6fc4']) {
      assert(lum(troughOf(c)) < lum(c), `${c}'s troughs are not darker than its crests`);
    }
  });
});

suite('water · and the battery', () => {
  const screen = code('src/demo/DiceDemoScreen.tsx');
  const expr = screen.slice(screen.indexOf('frameloop={'), screen.indexOf('camera={{ position'));

  test('idle life only keeps the board drawing during a battle', () => {
    /*
      Since the 18 Oct 2026 redesign every board has something moving
      besides water (lava, beacons, torches, fireflies), so the idle
      redraw no longer asks whether the pit is water. What it must still
      never do is draw behind the menus or with the game in the
      background — that is the battery rule this test is for.
    */
    assert(/'demand'/.test(expr), 'the idle board never asks for a frame');
    const rule = screen.slice(screen.indexOf('const waterIdle ='), screen.indexOf(';', screen.indexOf('const waterIdle =')));
    assert(/appActive/.test(rule), 'the board keeps drawing with the game in the background');
    assert(/phase === 'battle'/.test(rule), 'the board keeps drawing behind the menus');
  });

  test('idle water is drawn at a fraction of the full rate', () => {
    const clock = code('src/arena/waterClock.tsx');
    const ms = Number(/WATER_IDLE_FRAME_MS = (\d+)/.exec(clock)?.[1]);
    assert(ms >= 33, `idle water redraws every ${ms}ms — more than thirty times a second`);
    assert(/if \(!idle\) return;/.test(clock), 'the idle ticker runs when it is not needed');
    assert(/clearInterval/.test(clock), 'the idle ticker is never stopped');
    note(`idle water: a frame every ${ms}ms`);
  });
});
