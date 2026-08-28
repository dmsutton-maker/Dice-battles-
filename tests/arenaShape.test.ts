import * as THREE from 'three';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { palisadeLogs, palisadeTopHeight } from '../src/arena/palisade';
import { buildRim, RIM_PITCH, RimSpot } from '../src/arena/rim';
import { TUNING } from '../src/game/tuning';
import { ARENA_THEMES, ThemedArenaId } from '../src/arena/themeData';
import { createGroundSurface, createTraySurface, surfacePixels } from '../src/arena/groundTexture';

/** Every structure in the set, from the themes themselves. */
const ARENA_STRUCTURES = [
  ...new Set(Object.values(ARENA_THEMES).map((t) => t.structure)),
];
import { FIGURE_RADIUS, JAIL_SLOTS, RETREAT_SLOTS } from '../src/game/stations';
import { fitCamera } from '../src/demo/cameraFit';
import { assert, assertEqual, note, suite, test } from './harness';

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
    // One box is a wall. A palisade is many separate pieces of timber.
    assert(logs.length >= 16, `only ${logs.length} logs — that is not a built wall`);
  });

  test('the logs lie down, because the camera looks down', () => {
    // The whole reason the boundary was rebuilt. An upright log presents
    // its TOP to a camera above, so eighty-eight of them read as a ring of
    // sawn stumps — which is what the screenshot showed. A log on its side
    // presents its length.
    const logs = palisadeLogs();
    const upright = logs.filter((l) => l.upright);
    const rails = logs.filter((l) => !l.upright);
    note(`${rails.length} rails lying down, ${upright.length} upright corner posts`);
    assert(rails.length > upright.length * 2, 'most of the boundary is still standing on end');
    // The corners are the exception, and there are exactly four of them.
    assertEqual(upright.length, 4, 'the corner posts are not four');
  });

  test('every log actually points the way it is meant to', () => {
    // A cylinder's axis is +Y, so a rail has to be TURNED onto its side —
    // and the Euler order that does it is easy to get wrong in a way
    // nothing else would catch. A rail rotated wrongly lies across the
    // middle of the arena instead of along its edge, and no other test
    // here looks at rotation at all.
    for (const log of palisadeLogs()) {
      const axis = new THREE.Vector3(0, 1, 0)
        .applyEuler(new THREE.Euler(...log.rotation))
        .round();
      const [x, , z] = log.position;
      if (log.upright) {
        assertEqual(Math.abs(axis.y), 1, 'a corner post is not standing up');
      } else if (x === 0) {
        // A rail on the front or back run: it must lie along X.
        assertEqual(Math.abs(axis.x), 1, `a rail at z ${z} does not lie along its run`);
      } else {
        assertEqual(Math.abs(axis.z), 1, `a rail at x ${x} does not lie along its run`);
      }
    }
  });

  test('the timber stands proud of the wall the dice bounce off', () => {
    // A boundary drawn shorter than the invisible collision wall makes a
    // die look like it stopped against nothing.
    const { wallHeight } = TUNING.tray;
    const top = palisadeTopHeight();
    note(`palisade stands ${top.toFixed(2)} against a ${wallHeight} wall`);
    assert(top >= wallHeight, `timber only reaches ${top.toFixed(2)} of a ${wallHeight} wall`);
    // But not so tall it walls the player out of their own arena.
    assert(top < wallHeight * 1.6, `timber towers ${top.toFixed(2)} over a ${wallHeight} wall`);
  });

  test('the courses stack without daylight between them', () => {
    // Gaps between the rails would show the dark ground straight through
    // the wall, which is worse than a fence.
    const rails = palisadeLogs().filter((l) => !l.upright);
    const bySide = new Map<string, typeof rails>();
    for (const rail of rails) {
      const [x, , z] = rail.position;
      const key = rail.rotation[0] === 0 ? `alongX${z > 0 ? '+' : '-'}` : `alongZ${x > 0 ? '+' : '-'}`;
      if (!bySide.has(key)) bySide.set(key, []);
      bySide.get(key)!.push(rail);
    }
    assertEqual(bySide.size, 4, 'the boundary is not four runs of rails');
    let worst = -Infinity;
    for (const run of bySide.values()) {
      run.sort((a, b) => a.position[1] - b.position[1]);
      for (let i = 1; i < run.length; i++) {
        worst = Math.max(
          worst,
          run[i].position[1] - run[i - 1].position[1] - run[i].radius - run[i - 1].radius,
        );
      }
    }
    note(`palisade: worst gap between courses ${worst.toFixed(3)} (negative means overlapping)`);
    assert(worst < 0, `${worst.toFixed(2)} of daylight between two courses`);
  });

  test('every run reaches its corner posts', () => {
    // A rail short of the corner leaves a notch of daylight at each end.
    const { innerWidth, innerDepth, wallThickness } = TUNING.tray;
    for (const rail of palisadeLogs().filter((l) => !l.upright)) {
      const alongX = rail.rotation[0] === 0;
      const span = alongX ? innerWidth + wallThickness * 2 : innerDepth + wallThickness * 2;
      assert(
        rail.length >= span,
        `a rail spans ${rail.length.toFixed(2)} of a ${span.toFixed(2)} run`,
      );
    }
  });

  test('the logs are timber, not the temple stone', () => {
    // They were drawn in the two mossy-stone greens the ruins are built
    // from, so the whole boundary was grey-green posts. That is most of
    // why it did not read as a wall of logs at all.
    const source = readFileSync(join('src', 'arena', 'JungleArena.tsx'), 'utf8');
    const at = source.indexOf('The palisade: rails lying along each run');
    assert(at > 0, 'the palisade is gone');
    const block = source.slice(at, at + 1200);
    for (const stone of ['MOSS_STONE', 'wallMaterial', 'slabMaterial']) {
      assert(
        !block.includes(stone),
        `the palisade is still being painted with ${stone} — that is the temple's stone`,
      );
    }
    assert(block.includes('logMaterials'), 'the palisade is not using timber shades');
  });

  test('no two neighbouring rails are identical', () => {
    // Repeating pairs would read as a manufactured panel rather than
    // something somebody cut and stacked.
    //
    // Rails only. The four corner posts are deliberately the same as each
    // other — matching posts at the corners is what a built structure
    // looks like, and this test failed on them until it said so.
    const rails = palisadeLogs().filter((l) => !l.upright);
    let identical = 0;
    for (let i = 1; i < rails.length; i++) {
      if (Math.abs(rails[i].radius - rails[i - 1].radius) < 1e-6) identical++;
    }
    assert(identical === 0, `${identical} neighbouring rails are exactly the same thickness`);
  });

  test('the palisade is stable between builds', () => {
    // Hashed, not random. A boundary that reshuffled every launch would
    // make the arena feel like it was flickering.
    const a = palisadeLogs();
    const b = palisadeLogs();
    assert(
      a.every(
        (log, i) =>
          log.length === b[i].length &&
          log.radius === b[i].radius &&
          log.position[0] === b[i].position[0],
      ),
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

/**
 * No two of the sixteen themed battlefields are the same building.
 *
 * David, 26 Aug 2026: "the arenas all don't have to look like castles.
 * They can be something that makes sense for the arena name, like how the
 * space station doesn't look like a castle." He was describing exactly
 * what had happened: the shared renderer put notched merlons and
 * cone-roofed corner turrets on every one of them, so a coral reef, a
 * rooftop at night and a moon base were all the same fortress in
 * different paint — the same bug the four originals had, reintroduced
 * sixteen times over by the thing that made sixteen arenas affordable.
 *
 * The tray itself is deliberately unchanged: same walls, same height,
 * same physics in all four structures. Only the crest and the corners
 * differ, which is the same bargain the hazards already make.
 */
suite('arenas · the themed sixteen are not all castles', () => {
  const themeSource = readFileSync('src/arena/themeData.ts', 'utf8');
  const rendererSource = readFileSync('src/arena/ThemedArena.tsx', 'utf8');
  const structures = [...themeSource.matchAll(/^    structure: '(\w+)',$/gm)].map(
    (m) => m[1],
  );

  test('every theme says what it is built of', () => {
    assertEqual(
      structures.length,
      Object.keys(ARENA_THEMES).length,
      'a theme is missing its structure',
    );
    for (const id of Object.keys(ARENA_THEMES) as ThemedArenaId[]) {
      assert(
        typeof ARENA_THEMES[id].structure === 'string',
        `${id} has no structure`,
      );
    }
  });

  test('every one of the sixteen is built of something different', () => {
    note(`structures: ${structures.join(', ')}`);
    /*
      David, 26 Aug 2026, on the first attempt at this — which gave the
      sixteen four shared kinds: "you just used the same like 4 different
      templates for the arenas now, make them all unique."

      He is right, and the reason four was not enough is the reason one
      was not. A SKYLINE is what you recognise a place by, so four
      skylines across sixteen battlefields is four places wearing sixteen
      coats of paint. Exactly one arena is still a castle, and it is the
      Sky KINGDOM.
    */
    assertEqual(
      new Set(structures).size,
      structures.length,
      `only ${new Set(structures).size} kinds of building across ${structures.length} arenas`,
    );
    assertEqual(
      structures.filter((s) => s === 'battlement').length,
      1,
      'more than one themed arena is a castle again',
    );
  });

  test('the renderer actually draws every structure a theme asks for', () => {
    /*
      A theme naming a structure the renderer has no branch for falls
      through to the default and silently becomes the toy bricks — which
      LOOKS like it worked, which is exactly how sixteen arenas became
      one castle in the first place. Both the crest and the corner piece
      are checked: a structure with a crest and no corner is half-built.
    */
    const crest = rendererSource.slice(
      rendererSource.indexOf('function ThemedCrest'),
      rendererSource.indexOf('function ThemedCorners'),
    );
    const corners = rendererSource.slice(rendererSource.indexOf('function ThemedCorners'));
    assert(crest.length > 500 && corners.length > 500, 'the two builders have moved');
    for (const s of new Set(structures)) {
      assert(crest.includes(`case '${s}':`), `ThemedCrest never draws '${s}'`);
      assert(corners.includes(`case '${s}':`), `ThemedCorners has no corner for '${s}'`);
    }
  });

  test('nothing about the structure reaches the tray the dice bounce in', () => {
    /*
      The crest and the corners are decoration. If the choice of
      structure changed the wall geometry, then picking a battlefield
      would change how the game PLAYS, and a player who bought the
      pirate cove with coins would be buying an advantage.
    */
    const walls = rendererSource.slice(
      rendererSource.indexOf('{/* Walls */}'),
      rendererSource.indexOf('{/* What the rim'),
    );
    assert(walls.length > 100, 'the wall block moved — re-check this test');
    assert(
      !walls.includes('structure'),
      'the tray walls now depend on the structure, so the arena changes play',
    );
  });

  test('every kind of prop a theme places is a prop the renderer knows', () => {
    // A typo'd or retired PropKind renders nothing at all: the arena
    // just quietly loses its decoration, with no error anywhere.
    const placed = new Set<string>();
    for (const theme of Object.values(ARENA_THEMES)) {
      for (const p of theme.props) placed.add(p.kind);
    }
    for (const kind of placed) {
      assert(
        rendererSource.includes(`case '${kind}':`),
        `nothing draws the '${kind}' prop`,
      );
    }
    note(`${placed.size} kinds of prop placed across the sixteen`);
  });

  test('the decorations do not stand where a figure stands', () => {
    /*
      The Skirmish-prisoners-in-the-scenery bug, which is why
      src/game/stations.ts exists at all. Every prop added on 26 Aug 2026
      is checked against every slot a figure can occupy.
    */
    const slots = [...JAIL_SLOTS, ...RETREAT_SLOTS];
    for (const [id, theme] of Object.entries(ARENA_THEMES)) {
      for (const p of theme.props) {
        for (const slot of slots) {
          const d = Math.hypot(p.x - slot.x, p.z - slot.z);
          assert(
            d > FIGURE_RADIUS + 1,
            `${id}'s ${p.kind} at (${p.x}, ${p.z}) stands on a figure`,
          );
        }
      }
    }
  });
});

/**
 * Everything a battlefield is dressed with is inside the camera.
 *
 * David, 26 Aug 2026, looking at three of the new arenas on his phone:
 * "every new map, not just these, look either unfinished, off centered,
 * or only half done."
 *
 * He was right and the cause was measurable. The board is framed almost
 * straight down (cameraFit.ts) and the visible world is a narrow box —
 * roughly x ±3.9 and z from -10.5 to 7.8 on a modern iPhone, of which
 * the tray takes x ±2.8 and z ±5.1. Every prop the sixteen themed
 * arenas placed sat at |x| between 7 and 10. Not one of them had ever
 * been on screen, on any phone, since the day they were written; nor
 * had the five hills at |x| 12, the mountains at z -19, the clouds, the
 * sun, the stars or the moon. Sixteen battlefields were a bare tray in a
 * wash of flat colour, and the work that was meant to dress them was
 * being rendered into the dark.
 *
 * This is the check that was missing. It projects every prop through the
 * real fitted camera at the two extreme phone shapes the game supports
 * and fails if it lands outside the frame. Nothing else in the suite
 * could have caught it: a prop off screen throws nothing, looks like
 * nothing, and reads in the source exactly like a prop that works.
 */
suite('arenas · the scenery is where the camera is pointing', () => {
  const ASPECTS: [string, number][] = [
    ['iPhone 15 portrait', 393 / 852],
    ['iPhone SE portrait', 375 / 667],
  ];

  /** Screen position of a world point through the fitted camera. */
  function project(aspect: number, x: number, y: number, z: number): THREE.Vector3 {
    const camera = new THREE.PerspectiveCamera();
    fitCamera(camera, aspect);
    return new THREE.Vector3(x, y, z).project(camera);
  }

  test('every prop in every theme is on screen', () => {
    for (const [label, aspect] of ASPECTS) {
      let worst = 0;
      let worstLabel = '';
      for (const [id, theme] of Object.entries(ARENA_THEMES)) {
        for (const p of theme.props) {
          // A prop's base. Tops are allowed to crop — a tree leaning over
          // the wall is fine — but if the FOOT of it is outside the
          // frame the whole prop is somewhere nobody will ever look.
          const ndc = project(aspect, p.x, 0, p.z);
          const off = Math.max(Math.abs(ndc.x), Math.abs(ndc.y));
          if (off > worst) {
            worst = off;
            worstLabel = `${id}'s ${p.kind} at (${p.x}, ${p.z})`;
          }
        }
      }
      note(`${label}: furthest prop reaches ${worst.toFixed(2)} of the frame (${worstLabel})`);
      assert(
        worst <= 1,
        `${worstLabel} is off screen on ${label} — it is being rendered for nobody`,
      );
    }
  });

  test('the props are spread around the board, not stacked in one place', () => {
    /*
      The other way to pass the test above is to put all thirteen props
      in a heap at the origin. Each theme has to reach down both sides
      and across the back.
    */
    for (const [id, theme] of Object.entries(ARENA_THEMES)) {
      const left = theme.props.filter((p) => p.x < -2.9).length;
      const right = theme.props.filter((p) => p.x > 2.9).length;
      const back = theme.props.filter((p) => p.z < -8).length;
      assert(left >= 3, `${id} has only ${left} props down its left side`);
      assert(right >= 3, `${id} has only ${right} props down its right side`);
      assert(back >= 2, `${id} has only ${back} props behind the jail`);
    }
  });

  test('no prop stands inside the tray or on a figure', () => {
    const { innerWidth, innerDepth, wallThickness } = TUNING.tray;
    const outerX = innerWidth / 2 + wallThickness;
    const outerZ = innerDepth / 2 + wallThickness;
    const slots = [...JAIL_SLOTS, ...RETREAT_SLOTS];
    for (const [id, theme] of Object.entries(ARENA_THEMES)) {
      for (const p of theme.props) {
        assert(
          Math.abs(p.x) > outerX || Math.abs(p.z) > outerZ,
          `${id}'s ${p.kind} at (${p.x}, ${p.z}) is standing in the tray`,
        );
        for (const slot of slots) {
          assert(
            Math.hypot(p.x - slot.x, p.z - slot.z) > FIGURE_RADIUS + 0.9,
            `${id}'s ${p.kind} at (${p.x}, ${p.z}) stands on a figure`,
          );
        }
      }
    }
  });

  test('the renderer stopped building the sky nobody can see', () => {
    /*
      Pinned, because it is the kind of thing that gets "restored" by
      someone reading the theme data and noticing the renderer ignores
      half of it. ArenaTheme still DESCRIBES a sky, and correctly — the
      Inventory thumbnails are drawn wide and do show the sun, the stars
      and the aurora (assets/arenas/make-themed-art.py reads those very
      fields). What was wrong was hanging it in a 3D scene whose camera
      cannot include it.
    */
    const source = readFileSync('src/arena/ThemedArena.tsx', 'utf8');
    assert(!/<ThemedSky/.test(source), 'the invisible sky is back in the 3D scene');
    assert(
      !/coneGeometry args=\{\[r, h, 10\]\}/.test(source),
      'the mountains at z -19 are back',
    );
  });
});

/**
 * The floor under the dice is a different floor in every battlefield.
 *
 * It was not. The renderer called `createFlagstoneTexture(theme.floor.a)`
 * — one colour, one painter — so all sixteen themed arenas rolled on the
 * same grey eight-by-eight stone grid, and `theme.floor.b` was declared,
 * documented and never read by anything at all. The floor is the largest
 * thing on screen by a wide margin under this camera, so one floor
 * sixteen times is most of what "unfinished" meant.
 */
suite('arenas · every battlefield has its own surface', () => {
  const IDS = Object.keys(ARENA_THEMES) as ThemedArenaId[];

  /** A 4x4x4 histogram over the colour cube, as the thumbnails use. */
  function histogram(px: number[]): number[] {
    const bins = new Array(64).fill(0);
    for (let i = 0; i < px.length; i += 3) {
      bins[Math.floor(px[i] / 64) * 16 + Math.floor(px[i + 1] / 64) * 4 + Math.floor(px[i + 2] / 64)]++;
    }
    const total = px.length / 3;
    return bins.map((b) => b / total);
  }

  const floors = Object.fromEntries(
    IDS.map((id) => {
      const t = ARENA_THEMES[id];
      return [
        id,
        surfacePixels(t.structure, { a: t.floor.a, b: t.floor.b, accent: t.wall.cap }),
      ];
    }),
  ) as Record<ThemedArenaId, number[]>;

  test('no floor is a flat wash', () => {
    // The failure this replaces was the opposite — all detail, no
    // variety — but a painter that returns one colour would pass the
    // distinctness test below on palette alone.
    for (const id of IDS) {
      const px = floors[id];
      const tones = new Set<number>();
      for (let i = 0; i < px.length; i += 3) {
        tones.add(Math.round((px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) / 3));
      }
      note(`${id}: ${tones.size} tone steps in its floor`);
      assert(tones.size >= 8, `${id}'s floor paints only ${tones.size} tones — it is a flat colour`);
    }
  });

  test('both floor tones are used, not just the first', () => {
    /*
      The specific bug. `floor.b` existed on all sixteen themes and was
      dead — so changing it changed nothing, and a designer adjusting a
      floor would have seen no effect and had no way to find out why.
    */
    for (const id of IDS) {
      const t = ARENA_THEMES[id];
      const withB = surfacePixels(t.structure, {
        a: t.floor.a,
        b: t.floor.b,
        accent: t.wall.cap,
      });
      const swapped = surfacePixels(t.structure, {
        a: t.floor.a,
        b: '#ff00ff',
        accent: t.wall.cap,
      });
      let changed = 0;
      for (let i = 0; i < withB.length; i++) if (withB[i] !== swapped[i]) changed++;
      assert(
        changed > withB.length * 0.05,
        `${id}'s floor ignores floor.b — changing it moved only ${changed} of ${withB.length} channels`,
      );
    }
  });

  test('no two battlefields roll on the same floor', () => {
    const hists = Object.fromEntries(IDS.map((id) => [id, histogram(floors[id])]));
    const pairs: { d: number; label: string }[] = [];
    for (let i = 0; i < IDS.length; i++) {
      for (let j = i + 1; j < IDS.length; j++) {
        const a = hists[IDS[i]];
        const b = hists[IDS[j]];
        pairs.push({
          d: a.reduce((sum, v, k) => sum + Math.abs(v - b[k]), 0) / 2,
          label: `${IDS[i]} vs ${IDS[j]}`,
        });
      }
    }
    pairs.sort((a, b) => a.d - b.d);
    for (const p of pairs.slice(0, 3)) note(`closest floors: ${p.label} ${p.d.toFixed(2)} apart`);
    /*
      A low bar, and deliberately. This measures COLOUR only, and the
      closest pair — the snowfield and the Sky Kingdom — are both meant
      to be very nearly white; no palette bar can separate two pale
      arenas without banning pale arenas. What separates those two is
      their pattern, which is covered by the structures being unique
      (every structure has its own painter) and by the tone-step test
      above. This one is here to catch two arenas sharing a palette
      outright.
    */
    assert(
      pairs[0].d > 0.1,
      `${pairs[0].label} roll on the same floor (${pairs[0].d.toFixed(2)} apart)`,
    );
  });

  test('the flagstone painter is no longer wired to the themed arenas', () => {
    const source = readFileSync('src/arena/ThemedArena.tsx', 'utf8');
    // The import, not the name: the comment explaining what went wrong
    // names the old painter, and should.
    assert(
      !/from '\.\/flagstoneTexture'/.test(source),
      'ThemedArena is back on the one shared stone floor',
    );
    assert(
      /createTraySurface/.test(source) && /createGroundSurface/.test(source),
      'ThemedArena has stopped painting its own floor or its own ground',
    );
  });
});

/**
 * Nothing decorative is big enough to loom over the board.
 *
 * David, 26 Aug 2026, on a screenshot with the top third of it filled by
 * a featureless brown dome: "what is this giant blob".
 *
 * It was a "horizon bank" — a squashed sphere of radius 7.5 placed at
 * z -10.4 to give the world an edge to end at. The arithmetic nobody did:
 * a sphere of radius 7.5 centred at z -10.4 reaches FORWARD to z -2.9,
 * which is past the tray's own far wall at -5.1, and it stood 3.3 high
 * against a wall 1.4 high. So it was not a distant horizon at all. It
 * was a dome sitting directly on top of the jail.
 *
 * That is the mistake this file keeps making in different clothes. The
 * camera is near top-down and very tight (cameraFit.ts), so "far behind
 * the board" and "directly above the board" are the same place on
 * screen. Scenery has to be SMALL, and it has to be beside the tray
 * rather than behind it.
 */
suite('arenas · nothing looms over the board', () => {
  const source = readFileSync('src/arena/ThemedArena.tsx', 'utf8');

  test('no piece of scenery is bigger than the tray wall is tall', () => {
    /*
      A blunt rule, and blunt is what is wanted: the tray wall is 1.4
      high, and a decorative solid whose FIRST dimension is more than
      about twice that is not decoration, it is a landmass. The ground
      plane is exempt — it is flat, at y -0.12, and a flat thing cannot
      loom over anything.
    */
    const limit = TUNING.tray.wallHeight * 2;
    const offenders: string[] = [];
    for (const m of source.matchAll(
      /<(sphere|cone|cylinder|box|dodecahedron|torus)Geometry args=\{\[([\d.]+)/g,
    )) {
      const size = Number(m[2]);
      if (size > limit) offenders.push(`${m[1]}Geometry at ${size}`);
    }
    note(`largest decorative solid allowed: ${limit}; found ${offenders.length} over it`);
    assert(
      offenders.length === 0,
      `ThemedArena builds something the size of a landscape: ${offenders.join(', ')}`,
    );
  });

  test('nothing is built behind the jail at all', () => {
    /*
      The other half of the same rule. Behind the jail is not "the
      distance" under this camera — the jail's own back wall is at
      z -8.1 and the frame ends at -10.5, so there is about two units of
      ground back there and no room for a scene. Props are allowed (they
      sit ON that ground and the camera test frames them); solid
      landscape is not.
    */
    const scene = source.slice(source.indexOf('export function ThemedArena'));
    for (const m of scene.matchAll(/position=\{\[\s*[-\d.]+,\s*[-\d.]+,\s*(-[\d.]+)\s*\]\}/g)) {
      const z = Number(m[1]);
      assert(
        z > -9.5,
        `something is placed at z ${z}, behind the jail where the camera has no room for it`,
      );
    }
  });
});

/**
 * The furniture every battlefield has to carry is different in each one.
 *
 * David, 26 Aug 2026: "not every arena needs to have the same castle
 * toppers on the bottom corners of the screen, make everything about
 * every arena unique."
 *
 * The toppers were the retreat canopies. They stand at x ±3.3, z 5.35 —
 * the two bottom corners of the frame, the closest things to the camera
 * and among the biggest — and they were one cone on one post in all
 * sixteen, repainted. A cone on a post is a turret roof, so every
 * battlefield had a castle turret in each bottom corner however it was
 * built. The jail was the same story: nine identical iron bars behind
 * the far wall of a coral reef and a rooftop alike.
 *
 * This is the third round of the same fault — one crest for sixteen,
 * then four, then one canopy for sixteen. Every SHARED piece of
 * furniture is a place it can happen again, so the check is on the
 * pattern rather than on the particular piece.
 */
suite('arenas · the shared furniture is not shared', () => {
  const source = readFileSync('src/arena/ThemedArena.tsx', 'utf8');
  const structures = [...source.matchAll(/case '(\w+)':/g)].map((m) => m[1]);

  test('the retreat shelter is chosen per battlefield', () => {
    const shelter = source.slice(
      source.indexOf('function RetreatShelter'),
      source.indexOf('function jailBarShape'),
    );
    assert(shelter.length > 500, 'RetreatShelter has moved or gone');
    for (const s of new Set(ARENA_STRUCTURES)) {
      assert(shelter.includes(`case '${s}':`), `no retreat shelter for '${s}'`);
    }
    assert(
      !/coneGeometry args=\{\[0\.85, 0\.5, 10\]\}/.test(
        source.slice(source.indexOf('function ThemedRetreat')),
      ),
      'the shared turret-roof parasol is back on every retreat',
    );
  });

  test('the jail is caged in something that belongs to the place', () => {
    const cage = source.slice(
      source.indexOf('function jailBarShape'),
      source.indexOf('function ThemedJailPen'),
    );
    assert(cage.length > 400, 'jailBarShape has moved or gone');
    // Not one branch per structure here — a timber stake is a timber
    // stake in four different woods — but the shapes must genuinely
    // differ, and no battlefield may fall through to iron by accident.
    const shapes = new Set(
      [...cage.matchAll(/<(\w+)Geometry args=\{\[([\d., ]+)\]/g)].map((m) => `${m[1]}:${m[2]}`),
    );
    note(`${shapes.size} different jail cages across the sixteen`);
    assert(shapes.size >= 6, `only ${shapes.size} kinds of jail bar in the whole set`);
    assert(
      /structure: ArenaStructure/.test(source.slice(source.indexOf('function ThemedJailPen'))),
      'the jail pen no longer knows what battlefield it is in',
    );
  });

  test('nothing that is drawn for every arena is drawn the same way', () => {
    /*
      The general form of the fault, stated once. Anything a battlefield
      MUST have — the crest, the corners, the retreat shelter, the jail —
      is a place where one implementation can quietly serve sixteen
      places, and each time it has, David has spotted it before any test
      did.
    */
    for (const [what, from, to] of [
      ['the retreat shelter', 'function RetreatShelter', 'function jailBarShape'],
      ['the wall crest', 'function ThemedCrest', 'function ThemedCorners'],
      ['the corner pieces', 'function ThemedCorners', 'export function ThemedArena'],
    ] as const) {
      const block = source.slice(source.indexOf(from), source.indexOf(to));
      const branches = new Set([...block.matchAll(/case '(\w+)':/g)].map((m) => m[1]));
      note(`${what}: ${branches.size} branches`);
      assert(
        branches.size >= ARENA_STRUCTURES.length - 1,
        `${what} has only ${branches.size} branches for ${ARENA_STRUCTURES.length} battlefields`,
      );
    }
    assert(structures.length > 40, 'the structure switches have collapsed');
  });
});


/**
 * The crest runs round the whole wall, whichever pieces it picks.
 *
 * Marc, 27 Aug 2026: "on frozen lights the nobs at the top of the wall
 * still don't go around the entire wall." A previous version had already
 * fixed the POSITIONS — the ring was continuous and every corner filled.
 * What was still wrong was the ORDER they were listed in. The list was
 * built a wall at a time, pushing the left-hand spot and the right-hand
 * spot of each step together, so every even index sat on the left wall
 * and every odd index on the right. Almost every crest picks its pieces
 * with `i % 2` or `i % 4`; the polar station's ribs therefore landed
 * nine on one wall and none on the wall opposite.
 *
 * A test on the positions alone cannot see that, because the positions
 * were never wrong. So the check is on what the crests actually READ:
 * take the ring, apply the same filters the renderer applies, and insist
 * that what survives still touches all four walls.
 */
suite('arenas · the crest goes all the way round', () => {
  const rim = buildRim();
  const { innerWidth, innerDepth, wallThickness } = TUNING.tray;
  const endX = innerWidth / 2 + wallThickness / 2;
  const endZ = innerDepth / 2 + wallThickness / 2;

  /** Which of the four walls a spot sits on. A corner counts as its long wall. */
  const wallOf = (s: RimSpot) =>
    s.alongX ? (s.pos[2] > 0 ? 'far' : 'near') : s.pos[0] < 0 ? 'left' : 'right';

  test('the ring is unbroken and sits on the wall', () => {
    note(`${rim.length} crest spots round the tray`);
    assert(rim.length >= 40, `only ${rim.length} crest spots for the whole perimeter`);
    for (const s of rim) {
      const onSide = Math.abs(Math.abs(s.pos[0]) - endX) < 1e-6 && Math.abs(s.pos[2]) <= endZ + 1e-6;
      const onEnd = Math.abs(Math.abs(s.pos[2]) - endZ) < 1e-6 && Math.abs(s.pos[0]) <= endX + 1e-6;
      assert(onSide || onEnd, `a crest spot floats off the wall at ${s.pos.join(', ')}`);
    }
    // Every corner is occupied, or the crest has a hole at each turn.
    for (const cx of [-endX, endX])
      for (const cz of [-endZ, endZ])
        assert(
          rim.some((s) => Math.abs(s.pos[0] - cx) < 1e-6 && Math.abs(s.pos[2] - cz) < 1e-6),
          `nothing on the corner at ${cx}, ${cz}`,
        );
  });

  test('walking the list walks the wall', () => {
    /*
      The fault itself. Consecutive entries must be NEIGHBOURS: if index
      i and index i + 1 are on opposite walls, then `i % 2` is not "every
      other piece", it is "one whole side of the arena".
    */
    for (let i = 0; i < rim.length; i++) {
      const a = rim[i].pos;
      const b = rim[(i + 1) % rim.length].pos;
      const gap = Math.hypot(a[0] - b[0], a[2] - b[2]);
      assert(
        gap <= RIM_PITCH * 1.6,
        `the crest list jumps ${gap.toFixed(2)} between spot ${i} and ${i + 1} — ` +
          'it is not in the order you would walk the wall',
      );
    }
  });

  test('every other piece is still every wall', () => {
    for (const n of [2, 3, 4]) {
      const counts: Record<string, number> = { left: 0, right: 0, near: 0, far: 0 };
      rim.forEach((s, i) => {
        if (i % n === 0) counts[wallOf(s)]++;
      });
      note(`i % ${n}: left ${counts.left}, right ${counts.right}, near ${counts.near}, far ${counts.far}`);
      for (const [wall, count] of Object.entries(counts))
        assert(count > 0, `a crest that draws every ${n}${n === 2 ? 'nd' : 'rd'} piece puts none on the ${wall} wall`);
      // And in matching numbers, or one wall is dressed and its opposite bare.
      assertEqual(counts.left, counts.right, `the two long walls get different numbers of pieces at i % ${n}`);
      assertEqual(counts.near, counts.far, `the two short walls get different numbers of pieces at i % ${n}`);
    }
  });

  test('a repeating pattern closes up at the corner it started from', () => {
    // 2, 3 and 4 all divide the ring, so a striped crest has no seam.
    for (const n of [2, 3, 4])
      assertEqual(rim.length % n, 0, `a crest repeating every ${n} pieces breaks where the ring closes`);
  });

  test('the renderer uses the measured ring and nothing else', () => {
    const source = readFileSync('src/arena/ThemedArena.tsx', 'utf8');
    assert(source.includes('buildRim()'), 'ThemedArena has stopped using the measured crest ring');
    assert(
      !/const rim = useMemo\(\(\) => \{/.test(source),
      'ThemedArena is building its own crest ring again, where no test can see it',
    );
  });
});

/**
 * The floor is one picture.
 *
 * Marc, 27 Aug 2026: "make the floor of every arena one continuous
 * picture and design because you can see the line in the middle where
 * it's cut."
 *
 * There was a line, in the same place on all sixteen. The floor was a
 * square 128x128 picture laid down with `repeat` set to the tray's size
 * over 6.4 world units — [0.875, 1.594]. Across the tray that is under
 * one copy, so nothing shows; DOWN it the picture ran out at 1.0 and
 * started again, and the join was a hard cut about six-tenths along,
 * right where the dice land.
 *
 * A square picture cannot cover a 5.6 x 10.2 tray without repeating or
 * being stretched, so the shape of the picture is the thing to hold.
 */
suite('arenas · the floor is not cut in half', () => {
  const { innerWidth, innerDepth, wallThickness } = TUNING.tray;
  const floorW = innerWidth + wallThickness * 2;
  const floorD = innerDepth + wallThickness * 2;

  const trayFor = (id: ThemedArenaId) => {
    const t = ARENA_THEMES[id];
    return createTraySurface(
      t.structure,
      { a: t.floor.a, b: t.floor.b, accent: t.wall.cap },
      [floorW, floorD],
    );
  };

  test('every tray floor is laid down exactly once', () => {
    for (const id of Object.keys(ARENA_THEMES) as ThemedArenaId[]) {
      const t = trayFor(id);
      assertEqual(t.repeat.x, 1, `${id}'s floor repeats across the tray`);
      assertEqual(t.repeat.y, 1, `${id}'s floor repeats down the tray`);
    }
  });

  test('and cannot wrap round even if something asked it to', () => {
    // Clamped, not repeating: with the picture covering the floor once,
    // a wrapping filter samples the far edge along all four sides.
    const t = trayFor('cavern');
    assertEqual(t.wrapS, THREE.ClampToEdgeWrapping, 'the floor wraps across');
    assertEqual(t.wrapT, THREE.ClampToEdgeWrapping, 'the floor wraps down');
  });

  test('the picture is the shape of the tray, so nothing is stretched', () => {
    /*
      The real check. Repeat [1, 1] on a square picture would remove the
      join by squashing the floor instead — circles into ellipses. The
      texels have to stay square in WORLD space, which means the
      picture's proportions have to match the tray's.
    */
    const want = floorD / floorW;
    for (const id of Object.keys(ARENA_THEMES) as ThemedArenaId[]) {
      const t = trayFor(id);
      const got = t.image.height / t.image.width;
      assert(
        Math.abs(got - want) < 0.02,
        `${id}'s floor is ${t.image.width}x${t.image.height}, ` +
          `a ratio of ${got.toFixed(3)} against the tray's ${want.toFixed(3)}`,
      );
    }
    const one = trayFor('sky');
    note(`tray floor ${one.image.width}x${one.image.height} for ${floorW}x${floorD} world units`);
  });

  test('the ground outside still tiles, because it should', () => {
    /*
      Not everything wants to be one picture. The ground reaches 26 world
      units where the tray reaches ten, it is mostly behind scenery, and
      one picture that size would be either enormous to paint or blurred
      to nothing. Its painters wrap at SIZE, so its joins really are
      seamless — which is what the tray's could never be at 1.594.
    */
    const t = ARENA_THEMES.moon;
    const g = createGroundSurface(
      t.structure,
      { a: t.meadow, b: t.hill, accent: t.mountain ?? t.wall.cap },
      4,
    );
    assertEqual(g.repeat.x, 4, 'the ground has stopped tiling');
    assertEqual(g.image.width, g.image.height, 'the ground is no longer square');
  });

  test('nothing has quietly repainted a floor', () => {
    /*
      A fingerprint of every floor's pixels, and the reason it exists is
      a mistake this file nearly shipped.

      `noise` is the hottest function in the surface painters, and the
      obvious way to speed it up is to precompute its hashes into a table
      — it only ever hashes lattice points. That is wrong here: `hash` is
      a fract-of-a-sine over its arguments rather than a lookup, and the
      painters pass FRACTIONAL periods (SIZE / 3 is 42.667), so the
      coordinates it hashes are a continuum, not a grid. The table was
      written, it was three times faster, it passed every test in this
      suite — and it silently repainted five of the sixteen floors.

      Nothing else here could see that. The tone-step and
      distinct-surface tests measure a floor's CHARACTER, which survives
      being redrawn with different noise. So this measures identity: any
      change to a floor's pixels, deliberate or not, fails here and has
      to be looked at and re-pinned on purpose.
    */
    /*
      Two numbers per structure: the tray floor, then the ground outside.
      A painter can now draw the two differently — the Crystal Cavern's
      floor is a bed of cut facets while its ground stays rock — so
      pinning only the floor would leave half of every painter unwatched,
      which is the very gap this test exists to close.
    */
    const FINGERPRINT: Record<string, [number, number]> = {
      snowFence: [2822920031, 2591079004], adobe: [3332830248, 3217809634],
      basalt: [2367338390, 812598676], logPile: [3467978741, 3677557592],
      station: [4294572736, 11610392], stalagmite: [2332719538, 18287228],
      battlement: [2711802449, 3801047114], airlock: [1806471617, 1375994754],
      driftwood: [542929681, 1624185647], gingerbread: [4111876675, 4044205311],
      mossStone: [2127551540, 2729603520], shipHull: [2439740480, 1924898867],
      picket: [3596239287, 2708851089], coralRim: [588170051, 2042255654],
      parapet: [2389790565, 2377193977], blocks: [1393805627, 3816223702],
    };
    const fingerprint = (id: ThemedArenaId, tray: boolean) => {
      const t = ARENA_THEMES[id];
      const px = surfacePixels(
        t.structure,
        tray
          ? { a: t.floor.a, b: t.floor.b, accent: t.wall.cap }
          : { a: t.meadow, b: t.hill, accent: t.mountain ?? t.wall.cap },
        tray,
      );
      let h = 2166136261 >>> 0;
      for (let i = 0; i < px.length; i++) {
        h ^= px[i] & 255;
        h = Math.imul(h, 16777619) >>> 0;
      }
      return h;
    };
    const changed: string[] = [];
    for (const id of Object.keys(ARENA_THEMES) as ThemedArenaId[]) {
      const want = FINGERPRINT[ARENA_THEMES[id].structure];
      const floor = fingerprint(id, true);
      const ground = fingerprint(id, false);
      if (want[0] !== floor) changed.push(`${ARENA_THEMES[id].structure} floor (${floor})`);
      if (want[1] !== ground) changed.push(`${ARENA_THEMES[id].structure} ground (${ground})`);
    }
    assertEqual(
      changed.join(', '),
      '',
      'a surface is not the surface it was — re-pin the fingerprint if you meant it',
    );
    note(`${Object.keys(FINGERPRINT).length} structures match their pinned pixels, floor and ground`);
  });

  test('a floor still paints fast enough not to be seen', () => {
    /*
      A floor that takes a quarter of a second is a stall a player sees
      the first time an arena opens, and avoiding that stall is the whole
      reason textureCache.ts exists.

      Measured as the BEST of several runs, not the average. The first
      version of this test took a mean and failed on a machine that
      happened to be busy — 310ms for a floor that really costs 33ms —
      which is a test failing by weather rather than by regression. The
      minimum is the run least contaminated by whatever else was
      happening, so it tracks the real cost and cannot be pushed over the
      line by load. The ceiling is unchanged.
    */
    // Warms the JIT, not a cache — createTraySurface has none.
    for (let i = 0; i < 3; i++) trayFor('reef');
    let best = Infinity;
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      trayFor('reef');
      best = Math.min(best, Date.now() - start);
    }
    note(`the reef's floor — the slowest — paints in ${best}ms`);
    assert(best < 260, `a floor takes ${best}ms to paint`);
  });
});
