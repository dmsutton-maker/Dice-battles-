import { createDieBody, throwDie } from '../src/dice/die';
import { allStill, freezeDice, readFaces, shouldCallRoll } from '../src/dice/settle';
import { AiDifficultyId } from '../src/game/ai';
import { PRISONER_COLORS } from '../src/game/colors';
import {
  EMPTY_LAYOUT,
  generateObstacleLayout,
  MOAT,
  MOUND,
  ObstacleLayout,
} from '../src/game/obstacles';
import { TUNING } from '../src/game/tuning';
import { addTrayBodies, createPhysicsWorld } from '../src/physics/world';
import { assert, assertAtMost, note, suite, test } from './harness';

/**
 * Headless physics tests. These run the REAL settle rule from
 * src/dice/settle.ts against the REAL tray from src/physics/world.ts, so a
 * tuning change that lets dice escape, calls a roll mid-tumble, or makes
 * rolls crawl fails here rather than on a kid's phone.
 *
 * What is deliberately NOT asserted: where a throw ends up. The dice are
 * thrown from wherever they lie and scatter in any direction — that is the
 * feel the game wants, and pinning down landing spots would lock in the
 * tidier, more mechanical throw that replaced it and was rejected.
 */
const DIE_START: [number, number, number][] = [
  [-0.9, TUNING.dieSize / 2, 2.2],
  [0.9, TUNING.dieSize / 2, 2.4],
];

interface RollOutcome {
  ms: number;
  movingWhenCalled: boolean;
  escaped: boolean;
  faces: string[];
  restZ: number[];
  restX: number[];
}

/** Simulates one throw through the shipping settle rule. */
function simulateRoll(
  layout: ObstacleLayout,
  options: { flick?: { x: number; z: number } } = {},
): RollOutcome {
  const physics = createPhysicsWorld();
  addTrayBodies(physics, layout);
  const bodies = DIE_START.map((pos) => {
    const body = createDieBody(physics.dieMaterial, pos);
    physics.world.addBody(body);
    return body;
  });

  bodies.forEach((body) => throwDie(body, { flick: options.flick }));

  let stillFrames = 0;
  let escaped = false;
  /** Mirrors DiceScene: a respawn restarts the settle deadline. */
  let clockStart = 0;
  const maxFrames = 600;
  const halfW = TUNING.tray.innerWidth / 2;
  const halfD = TUNING.tray.innerDepth / 2;
  /** Mirrors DiceScene: a die swallowed by the moat is fished back out. */
  const sunkUntil = [0, 0];
  /** A die can be swallowed at most once per roll (mirrors DiceScene). */
  const sankThisRoll = [false, false];

  for (let frame = 1; frame <= maxFrames; frame++) {
    physics.world.step(TUNING.physics.timeStep, TUNING.physics.timeStep, 4);
    const elapsed = (frame / 60) * 1000;

    bodies.forEach((body, i) => {
      const inMoatZone =
        layout.moat !== null &&
        Math.abs(body.position.x - layout.moat.x) < MOAT.size / 2 + 0.15 &&
        Math.abs(body.position.z - layout.moat.z) < MOAT.size / 2 + 0.15;
      if (!sunkUntil[i] && !sankThisRoll[i] && inMoatZone && body.position.y < 0.12) {
        sunkUntil[i] = elapsed + 900;
      }
      const respawn = () => {
        body.position.set(DIE_START[i][0], DIE_START[i][1] + 0.15, DIE_START[i][2]);
        body.velocity.setZero();
        body.angularVelocity.setZero();
        body.wakeUp();
        sunkUntil[i] = 0;
        sankThisRoll[i] = true;
        clockStart = elapsed;
      };
      if (sunkUntil[i]) {
        body.velocity.y = Math.max(body.velocity.y, -1.6);
        if (elapsed >= sunkUntil[i] || body.position.y < -3) respawn();
      } else if (
        body.position.y < -1 ||
        Math.abs(body.position.x) > halfW + 0.8 ||
        Math.abs(body.position.z) > halfD + 0.8
      ) {
        respawn();
      }
    });

    // Only a die that gets through a WALL or the ceiling counts as escaped.
    // Dropping into the moat is the Hard-mode mechanic, and the game fishes
    // those back out (a respawn this harness does not model).
    for (const body of bodies) {
      const throughWall =
        body.position.y > -0.5 &&
        (Math.abs(body.position.x) > halfW + 0.6 ||
          Math.abs(body.position.z) > halfD + 0.6);
      if (throughWall || body.position.y > TUNING.tray.ceilingHeight + 1) {
        escaped = true;
      }
    }

    stillFrames = allStill(bodies) ? stillFrames + 1 : 0;

    if (shouldCallRoll(bodies, elapsed - clockStart, stillFrames)) {
      const movingWhenCalled = bodies.some(
        (b) => b.velocity.length() + b.angularVelocity.length() * 0.5 > 1.2,
      );
      freezeDice(bodies);
      return {
        ms: elapsed,
        movingWhenCalled,
        escaped,
        faces: readFaces(bodies).map((c) => c.id),
        restZ: bodies.map((b) => b.position.z),
        restX: bodies.map((b) => b.position.x),
      };
    }
  }
  return {
    ms: (maxFrames / 60) * 1000,
    movingWhenCalled: true,
    escaped,
    faces: [],
    restZ: bodies.map((b) => b.position.z),
    restX: bodies.map((b) => b.position.x),
  };
}

const DIFFICULTIES: AiDifficultyId[] = ['easy', 'medium', 'hard'];

suite('physics · rolling', () => {
  for (const difficulty of DIFFICULTIES) {
    test(`${difficulty}: rolls finish fast enough to keep rolling`, () => {
      const rolls = Array.from({ length: 120 }, () =>
        simulateRoll(generateObstacleLayout(difficulty)),
      );
      const times = rolls.map((r) => r.ms).sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)];
      const worst = times[times.length - 1];
      note(
        `${difficulty}: roll median ${median.toFixed(0)}ms, worst ${worst.toFixed(0)}ms`,
      );
      // The roll lock holds input until these fire, so this is the budget
      // for responsiveness. It was tighter while the dice were artificially
      // damped to stop sooner — that damping is what made them read as
      // rolling through syrup, so the livelier original physics came back
      // and this moved with it. Feel over speed was the explicit trade.
      assertAtMost(median, 1700, `${difficulty} median roll time`);
      // Hard has the moat, and a roll there can legitimately include one
      // capture per die: the die visibly sinks, is fished out, and rolls
      // on. That is the mechanic playing out on screen, not the game
      // stalling, so it gets an allowance on top of the settle deadline.
      const moatAllowance = difficulty === 'hard' ? 1400 : 0;
      assertAtMost(
        worst,
        TUNING.settle.hardMaxRollMs + moatAllowance,
        `${difficulty} worst roll time`,
      );
    });

    test(`${difficulty}: dice never get out of the tray`, () => {
      const rolls = Array.from({ length: 120 }, () =>
        simulateRoll(generateObstacleLayout(difficulty)),
      );
      const escapes = rolls.filter((r) => r.escaped).length;
      assert(escapes === 0, `${escapes}/120 rolls put a die through a wall`);
    });

    test(`${difficulty}: rolls are never called mid-tumble`, () => {
      const rolls = Array.from({ length: 120 }, () =>
        simulateRoll(generateObstacleLayout(difficulty)),
      );
      const moving = rolls.filter((r) => r.movingWhenCalled).length;
      // Calling a roll while the dice visibly move snaps them still on
      // screen and reads as the game deciding for you.
      assertAtMost(moving / rolls.length, 0.02, 'share of rolls called mid-tumble');
    });
  }

  test('every roll reports two readable colors', () => {
    const valid = new Set(PRISONER_COLORS.map((c) => c.id));
    for (let i = 0; i < 60; i++) {
      const roll = simulateRoll(generateObstacleLayout('medium'));
      assert(roll.faces.length === 2, `roll reported ${roll.faces.length} faces`);
      roll.faces.forEach((face) =>
        assert(valid.has(face as never), `unknown face color ${face}`),
      );
    }
  });

  test('a flick in any direction, at any strength, stays in the tray', () => {
    // The player can flick anywhere, including sideways and back at
    // themselves. Every one of those has to stay inside a sealed tray.
    const max = TUNING.throw.flickMaxSpeed;
    for (const difficulty of DIFFICULTIES) {
      for (let angle = 0; angle < 360; angle += 30) {
        for (const strength of [0.35, 0.7, 1]) {
          const radians = (angle * Math.PI) / 180;
          const flick = {
            x: Math.cos(radians) * max * strength,
            z: Math.sin(radians) * max * strength,
          };
          for (let trial = 0; trial < 3; trial++) {
            const roll = simulateRoll(generateObstacleLayout(difficulty), { flick });
            assert(
              !roll.escaped,
              `a ${angle}° flick at ${strength} strength on ${difficulty} went through a wall`,
            );
          }
        }
      }
    }
  });

  test('flicking harder throws the dice further', () => {
    // The point of a flick: your hand decides how hard they go.
    const travelAt = (strength: number) => {
      const rolls = Array.from({ length: 120 }, () =>
        simulateRoll(EMPTY_LAYOUT, {
          flick: { x: 0, z: -TUNING.throw.flickMaxSpeed * strength },
        }),
      );
      const all = rolls.flatMap((r) => r.restZ.map((z, i) => DIE_START[i][2] - z));
      return all.reduce((a, b) => a + b, 0) / all.length;
    };
    const gentle = travelAt(0.4);
    const hard = travelAt(1);
    note(`gentle flick travels ${gentle.toFixed(1)}, hard flick ${hard.toFixed(1)}`);
    assert(
      hard - gentle > 0.8,
      `flick strength barely matters (gentle ${gentle.toFixed(1)} vs hard ${hard.toFixed(1)})`,
    );
  });

  test('flicking left and right throws the dice that way', () => {
    const meanX = (x: number) => {
      const xs = Array.from({ length: 120 }, () =>
        simulateRoll(EMPTY_LAYOUT, { flick: { x, z: -8 } }),
      ).flatMap((r) => r.restX);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    const left = meanX(-TUNING.throw.flickMaxSpeed * 0.7);
    const right = meanX(TUNING.throw.flickMaxSpeed * 0.7);
    note(`flick left lands at x ${left.toFixed(2)}, right at x ${right.toFixed(2)}`);
    assert(
      right - left > 0.8,
      `flicking sideways barely moves the dice (${left.toFixed(2)} vs ${right.toFixed(2)})`,
    );
  });

  test('the dice are never interfered with while they roll', () => {
    // Bleeding velocity off a rolling die to end the roll sooner is felt
    // instantly as the dice being grabbed. Deciding when a roll is over
    // must only ever READ the dice, never push them.
    const physics = createPhysicsWorld();
    addTrayBodies(physics);
    const bodies = DIE_START.map((pos) => {
      const body = createDieBody(physics.dieMaterial, pos);
      physics.world.addBody(body);
      return body;
    });
    bodies.forEach((b) => throwDie(b));

    for (let frame = 1; frame <= 40; frame++) {
      physics.world.step(TUNING.physics.timeStep, TUNING.physics.timeStep, 4);
      const before = bodies.map((b) => ({
        v: b.velocity.clone(),
        w: b.angularVelocity.clone(),
      }));
      shouldCallRoll(bodies, (frame / 60) * 1000, 0);
      allStill(bodies);
      bodies.forEach((b, i) => {
        assert(
          b.velocity.almostEquals(before[i].v, 1e-12) &&
            b.angularVelocity.almostEquals(before[i].w, 1e-12),
          'deciding whether the roll was over changed how the dice were moving',
        );
      });
    }
  });

  test('frozen dice cannot move after a roll is called', () => {
    const physics = createPhysicsWorld();
    addTrayBodies(physics);
    const bodies = DIE_START.map((pos) => {
      const body = createDieBody(physics.dieMaterial, pos);
      physics.world.addBody(body);
      return body;
    });
    bodies.forEach((b) => throwDie(b));
    for (let i = 0; i < 30; i++) {
      physics.world.step(TUNING.physics.timeStep, TUNING.physics.timeStep, 4);
    }
    freezeDice(bodies);
    const faces = readFaces(bodies).map((c) => c.id);
    const positions = bodies.map((b) => ({ ...b.position }));

    for (let i = 0; i < 120; i++) {
      physics.world.step(TUNING.physics.timeStep, TUNING.physics.timeStep, 4);
    }
    const after = readFaces(bodies).map((c) => c.id);
    assert(
      faces.join() === after.join(),
      `face read changed after freeze: ${faces.join()} -> ${after.join()}`,
    );
    bodies.forEach((body, i) => {
      const moved = Math.hypot(
        body.position.x - positions[i].x,
        body.position.y - positions[i].y,
        body.position.z - positions[i].z,
      );
      assertAtMost(moved, 0.001, 'frozen die drifted');
    });
  });
});

suite('physics · obstacles', () => {
  test('layouts keep obstacles clear of the dice spawns', () => {
    for (let i = 0; i < 300; i++) {
      const layout = generateObstacleLayout('hard');
      for (const [sx, , sz] of DIE_START) {
        if (layout.mound) {
          const d = Math.hypot(layout.mound.x - sx, layout.mound.z - sz);
          assert(d > MOUND.radius, `mound spawned on a die start (distance ${d.toFixed(2)})`);
        }
        if (layout.moat) {
          const d = Math.hypot(layout.moat.x - sx, layout.moat.z - sz);
          assert(d > MOAT.size / 2, `moat spawned on a die start (distance ${d.toFixed(2)})`);
        }
      }
    }
  });

  test('layouts stay inside the tray and apart from each other', () => {
    const halfW = TUNING.tray.innerWidth / 2;
    const halfD = TUNING.tray.innerDepth / 2;
    for (let i = 0; i < 300; i++) {
      const layout = generateObstacleLayout('hard');
      for (const place of [layout.mound, layout.moat]) {
        if (!place) continue;
        assert(
          Math.abs(place.x) < halfW && Math.abs(place.z) < halfD,
          `obstacle placed outside the tray at (${place.x}, ${place.z})`,
        );
      }
      if (layout.mound && layout.moat) {
        const d = Math.hypot(
          layout.mound.x - layout.moat.x,
          layout.mound.z - layout.moat.z,
        );
        // Below the sum of their radii the moat's hole is cut through the
        // hill, and a die landing there behaves nonsensically. The
        // generator aims for a visible gap on top of that; both are
        // asserted so a placement change cannot quietly erode the margin.
        const touching = MOUND.radius + MOAT.size / 2;
        assert(d > touching, `hill and moat overlap (${d.toFixed(2)} < ${touching})`);
        assert(
          d >= touching + 0.45,
          `hill and moat are closer than the generator targets (${d.toFixed(2)})`,
        );
      }
    }
  });

  test('difficulty decides which obstacles appear', () => {
    const easy = Array.from({ length: 30 }, () => generateObstacleLayout('easy'));
    assert(
      easy.every((l) => l.mound === null && l.moat === null),
      'Easy should have a clear battlefield',
    );
    const medium = Array.from({ length: 30 }, () => generateObstacleLayout('medium'));
    assert(
      medium.every((l) => l.mound !== null && l.moat === null),
      'Medium should have the hill only',
    );
    const hard = Array.from({ length: 30 }, () => generateObstacleLayout('hard'));
    assert(
      hard.every((l) => l.mound !== null && l.moat !== null),
      'Hard should have both hill and moat',
    );
  });

  test('obstacles move around between battles', () => {
    const seen = new Set(
      Array.from({ length: 40 }, () => {
        const l = generateObstacleLayout('hard');
        return `${l.mound?.x.toFixed(2)},${l.moat?.z.toFixed(2)}`;
      }),
    );
    assert(seen.size > 20, `layouts barely vary (${seen.size} distinct in 40)`);
  });
});
