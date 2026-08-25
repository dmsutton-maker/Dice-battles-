import * as THREE from 'three';
import { createDieBody, snapDieToNearestFace, throwDie, topFaceAlignment, topFaceColor } from '../src/dice/die';
import {
  allStill,
  freezeDice,
  readFaces,
  shouldCallRoll,
} from '../src/dice/settle';
import { AI_ROLL_INTERVAL_MS, AiDifficultyId } from '../src/game/ai';
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
import { assert, assertAtMost, assertEqual, note, suite, test } from './harness';

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
  /** Each die's orientation at the moment the roll was called. */
  orientations: THREE.Quaternion[];
}

/** Simulates one throw through the shipping settle rule. */
function simulateRoll(
  layout: ObstacleLayout,
  options: { flick?: { x: number; z: number }; hurried?: boolean } = {},
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

    if (shouldCallRoll(bodies, elapsed - clockStart, stillFrames, options.hurried)) {
      const movingWhenCalled = bodies.some(
        (b) => b.velocity.length() + b.angularVelocity.length() * 0.5 > 1.2,
      );
      // Mirrors DiceScene: a hurried call snaps the dice onto the face
      // they were nearest before anything is read off them.
      if (options.hurried) bodies.forEach(snapDieToNearestFace);
      freezeDice(bodies);
      return {
        ms: elapsed,
        movingWhenCalled,
        escaped,
        orientations: bodies.map(
          (b) => new THREE.Quaternion(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w),
        ),
        faces: readFaces(bodies).map((c) => c.id),
        restZ: bodies.map((b) => b.position.z),
        restX: bodies.map((b) => b.position.x),
      };
    }
  }
  // The roll never resolved inside the frame budget. Reported with no
  // faces, which every caller already treats as a failure.
  return {
    ms: (maxFrames / 60) * 1000,
    movingWhenCalled: true,
    escaped,
    faces: [],
    orientations: [],
    restZ: bodies.map((b) => b.position.z),
    restX: bodies.map((b) => b.position.x),
  };
}

const DIFFICULTIES: AiDifficultyId[] = ['easy', 'medium', 'hard'];

suite('physics · rolling', () => {
  for (const difficulty of DIFFICULTIES) {
    test(`${difficulty}: rolls finish fast enough to keep rolling`, () => {
      const SAMPLES = 240;
      const rolls = Array.from({ length: SAMPLES }, () =>
        simulateRoll(generateObstacleLayout(difficulty)),
      );
      const times = rolls.map((r) => r.ms).sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)];
      // The single slowest roll out of N is dominated by whichever sample
      // was unluckiest, so it swings hundreds of milliseconds between runs
      // and says nothing about what a player feels. The 95th percentile is
      // the slow roll they actually hit, and it holds steady.
      const p95 = times[Math.floor(times.length * 0.95)];
      note(
        `${difficulty}: roll median ${median.toFixed(0)}ms, p95 ${p95.toFixed(0)}ms`,
      );
      // The roll lock holds input until these fire, so this is the budget
      // for responsiveness. It was tighter while the dice were artificially
      // damped to stop sooner — that damping is what made them read as
      // rolling through syrup, so the livelier original physics came back
      // and this moved with it. Feel over speed was the explicit trade.
      assertAtMost(median, 1700, `${difficulty} median roll time`);
      // Hard has the moat, and a roll there can legitimately include one
      // capture per die: the die visibly sinks, is fished out, and rolls
      // on. That is the mechanic playing out on screen, not a stall, so it
      // gets a larger budget. Bounds measured over 30 runs of 240 rolls:
      // p95 lands at 1883-2133ms without the moat, 2417-2933ms with it.
      assertAtMost(p95, difficulty === 'hard' ? 3200 : 2400, `${difficulty} p95 roll time`);
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

/**
 * The hurried roll — a tap arriving while the dice are still going. It
 * must be faster (that is the whole point) and it must not change what
 * comes up, because a roll called early that reads a different face from
 * the one the die actually lands on is a rigged roll.
 */
/**
 * How fast the board can be cleared by a player doing nothing but
 * swiping as fast as their thumb allows.
 *
 * David, 24 Aug 2026: "you're able to just spam as fast as you can and get
 * every color in only a matter of seconds." This is that sentence turned
 * into a number, because "a matter of seconds" is the thing that has to
 * stay untrue — not the internals that happened to cause it this time.
 */
suite('physics · spamming cannot clear the board in seconds', () => {
  /** Fastest a scoring roll can possibly come round, thumb speed aside. */
  const cadenceMs =
    TUNING.settle.minRollMs + TUNING.settle.hurriedThrowDelayMs;

  test('a scoring roll cannot come round faster than the floor', () => {
    // The exploit was not "matches are too likely" — it was that the
    // CYCLE was free. One swipe ended the previous roll and began the
    // next, so rolls-per-second was a property of the player's hand.
    assert(
      cadenceMs >= 600,
      `a scored roll every ${cadenceMs}ms is fast enough to spam the board clear`,
    );
    note(`fastest possible scoring roll: one per ${cadenceMs}ms`);
  });

  test('clearing all six colours takes a real game, not a few seconds', () => {
    /*
      Coupon collector. A roll matches with probability 1/6, and a match
      frees a uniformly chosen colour, so freeing all six needs 6·H(6)
      matches ≈ 14.7, and 6 rolls per match ≈ 88 rolls. At the cadence
      above that is the shortest a spammed Classic game can realistically
      run. Held well clear of "a matter of seconds".
    */
    const H6 = [1, 2, 3, 4, 5, 6].reduce((sum, k) => sum + 1 / k, 0);
    const rolls = 6 * H6 * 6;
    const seconds = (rolls * cadenceMs) / 1000;
    note(
      `spamming Classic: ~${rolls.toFixed(0)} rolls, ~${seconds.toFixed(0)}s ` +
        `(the AI needs ~${((rolls * AI_ROLL_INTERVAL_MS) / 1000).toFixed(0)}s)`,
    );
    assert(
      seconds >= 45,
      `six colours fall in ~${seconds.toFixed(0)}s of spamming — that is the bug David reported`,
    );
  });

  test('but rolling again is still much faster than waiting it out', () => {
    // The floor must not quietly undo what David asked for twice: no
    // sitting watching dice that have obviously finished.
    assert(
      cadenceMs < 1000,
      `waiting ${cadenceMs}ms to roll again brings back the dead-input feel`,
    );
  });
});

suite('physics · rolling again without waiting', () => {
  for (const difficulty of DIFFICULTIES) {
    test(`${difficulty}: a hurried roll is called sooner`, () => {
      const SAMPLES = 240;
      const layouts = Array.from({ length: SAMPLES }, () =>
        generateObstacleLayout(difficulty),
      );
      const normal = layouts
        .map((l) => simulateRoll(l).ms)
        .sort((a, b) => a - b);
      const hurried = layouts
        .map((l) => simulateRoll(l, { hurried: true }).ms)
        .sort((a, b) => a - b);
      const mid = (xs: number[]) => xs[Math.floor(xs.length / 2)];
      const p95 = (xs: number[]) => xs[Math.floor(xs.length * 0.95)];
      note(
        `${difficulty}: hurried median ${mid(hurried).toFixed(0)}ms vs ${mid(normal).toFixed(0)}ms, ` +
          `p95 ${p95(hurried).toFixed(0)}ms vs ${p95(normal).toFixed(0)}ms`,
      );
      assert(
        mid(hurried) < mid(normal),
        `hurrying saved nothing: ${mid(hurried).toFixed(0)}ms vs ${mid(normal).toFixed(0)}ms`,
      );
      /*
        The half this test was missing, and the reason David could "spam as
        fast as you can and get every color in only a matter of seconds".
        One-sided "faster than a normal roll" was satisfied by 17ms — one
        frame — which is what it printed here for five releases while a
        swipe both ended the previous roll and started the next.
      */
      assert(
        mid(hurried) >= TUNING.settle.minRollMs,
        `a hurried roll resolved in ${mid(hurried).toFixed(0)}ms, under the ` +
          `${TUNING.settle.minRollMs}ms floor — the dice are being read before they have rolled`,
      );
    });

    test(`${difficulty}: a hurried roll leaves the dice lying flat`, () => {
      // The guard that matters now. A hurried call can arrive with the
      // dice anywhere — mid-air, on an edge, still spinning — so what
      // makes it safe is that they are SNAPPED onto a face before anything
      // is read. A die left at 45 degrees would be showing a colour that
      // is not the one the game counted.
      for (let i = 0; i < 120; i++) {
        const roll = simulateRoll(generateObstacleLayout(difficulty), {
          hurried: true,
        });
        assertEqual(roll.faces.length, 2, 'a hurried roll must still read two faces');
        for (const q of roll.orientations) {
          assert(
            topFaceAlignment(q) > 0.999,
            `a hurried roll left a die at ${topFaceAlignment(q).toFixed(3)} — not flat`,
          );
        }
      }
    });

  }
});

/**
 * Hurrying must not become a way to dodge a bad roll. That is the rule the
 * roll lock exists for: in Ultimate a matched colour sends a rescued
 * prisoner back to jail, so a roll you can throw away mid-air is a rule
 * you can opt out of.
 */
suite('physics · a hurried roll still counts', () => {
  test('a hurried roll always produces a result', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 60; i++) {
        const roll = simulateRoll(generateObstacleLayout(difficulty), {
          hurried: true,
        });
        assertEqual(roll.faces.length, 2, `${difficulty}: a hurried roll was lost`);
      }
    }
  });

  test('snapping never changes which colour is up', () => {
    // The honesty of the whole feature. Snapping is only defensible if it
    // puts the die onto the face it was ALREADY nearest — if it could
    // rotate a die onto a different colour, hurrying would be changing
    // results, not just reading them sooner.
    const physics = createPhysicsWorld();
    addTrayBodies(physics, EMPTY_LAYOUT);
    const body = createDieBody(physics.dieMaterial, [0, 3, 0]);
    physics.world.addBody(body);

    for (let i = 0; i < 400; i++) {
      // A fresh arbitrary orientation each time, including the awkward
      // ones — balanced on an edge, and on a corner.
      const q = new THREE.Quaternion()
        .setFromEuler(new THREE.Euler((i * 0.618) % Math.PI, (i * 1.211) % Math.PI, (i * 0.317) % Math.PI))
        .normalize();
      body.quaternion.set(q.x, q.y, q.z, q.w);
      body.position.set(0, 3, 0);

      const before = topFaceColor(q);
      snapDieToNearestFace(body);
      const after = topFaceColor(
        new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w),
      );
      assertEqual(after.id, before.id, `snapping turned ${before.id} into ${after.id}`);
    }
  });

  test('a snapped die is left resting on the floor, not hanging in the air', () => {
    // It is thrown again a frame or two later, but a die that stayed at
    // the height it was called at would visibly hang there first.
    const physics = createPhysicsWorld();
    addTrayBodies(physics, EMPTY_LAYOUT);
    const body = createDieBody(physics.dieMaterial, [0, 5, 0]);
    physics.world.addBody(body);
    body.velocity.set(3, 4, -2);
    body.angularVelocity.set(9, 4, 7);
    snapDieToNearestFace(body);
    assertEqual(Math.abs(body.position.y - TUNING.dieSize / 2) < 1e-6, true, 'die not set down');
    assertEqual(body.velocity.length() < 1e-9, true, 'die still moving after being called');
  });
});
