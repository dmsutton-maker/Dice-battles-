import * as CANNON from 'cannon-es';
import { EMPTY_LAYOUT, MOAT, MOUND, ObstacleLayout } from '../game/obstacles';
import { TUNING } from '../game/tuning';

export interface PhysicsWorld {
  world: CANNON.World;
  dieMaterial: CANNON.Material;
  trayMaterial: CANNON.Material;
}

/** Create the cannon-es world with die/tray contact behavior pre-configured. */
export function createPhysicsWorld(): PhysicsWorld {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, TUNING.gravity, 0),
    allowSleep: true,
  });
  world.broadphase = new CANNON.SAPBroadphase(world);

  const dieMaterial = new CANNON.Material('die');
  const trayMaterial = new CANNON.Material('tray');

  world.addContactMaterial(
    new CANNON.ContactMaterial(dieMaterial, trayMaterial, {
      friction: TUNING.physics.trayFriction,
      restitution: TUNING.physics.trayRestitution,
    }),
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(dieMaterial, dieMaterial, {
      friction: TUNING.physics.dieFriction,
      restitution: TUNING.physics.dieRestitution,
    }),
  );

  return { world, dieMaterial, trayMaterial };
}

/**
 * Add the static tray collision bodies: floor, four walls, an invisible
 * ceiling that keeps wild flicks inside the camera frame, and optional
 * difficulty obstacles. The visual arena is drawn separately — physics only.
 *
 * With the moat enabled, the floor is built as four boxes leaving a real
 * square hole; the water plane drawn above it is visual-only, so a die that
 * rolls in genuinely sinks (the out-of-bounds respawn fishes it out).
 */
export function addTrayBodies(
  physics: PhysicsWorld,
  obstacles: ObstacleLayout = EMPTY_LAYOUT,
): void {
  const { world, trayMaterial } = physics;
  const { innerWidth, innerDepth, wallHeight, wallThickness, ceilingHeight } =
    TUNING.tray;

  const halfW = innerWidth / 2;
  const halfD = innerDepth / 2;
  const halfT = wallThickness / 2;

  const addStaticBox = (
    halfExtents: [number, number, number],
    position: [number, number, number],
  ) => {
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      material: trayMaterial,
      shape: new CANNON.Box(new CANNON.Vec3(...halfExtents)),
      position: new CANNON.Vec3(...position),
    });
    world.addBody(body);
  };

  const floorHalfW = halfW + wallThickness;
  const floorHalfD = halfD + wallThickness;
  if (!obstacles.moat) {
    // Solid floor (top surface at y = 0).
    addStaticBox([floorHalfW, 0.5, floorHalfD], [0, -0.5, 0]);
  } else {
    // Floor with a square hole for the moat.
    const h = MOAT.size / 2;
    const moat = obstacles.moat!;
    const west = { from: -floorHalfW, to: moat.x - h };
    const east = { from: moat.x + h, to: floorHalfW };
    const north = { from: -floorHalfD, to: moat.z - h };
    const south = { from: moat.z + h, to: floorHalfD };
    const strip = (
      x0: number,
      x1: number,
      z0: number,
      z1: number,
    ) =>
      addStaticBox(
        [(x1 - x0) / 2, 0.5, (z1 - z0) / 2],
        [(x0 + x1) / 2, -0.5, (z0 + z1) / 2],
      );
    strip(west.from, west.to, -floorHalfD, floorHalfD);
    strip(east.from, east.to, -floorHalfD, floorHalfD);
    strip(west.to, east.from, north.from, north.to);
    strip(west.to, east.from, south.from, south.to);
  }

  if (obstacles.mound) {
    // Slick dome: dice skid off instead of resting tilted on top.
    const moundMaterial = new CANNON.Material('mound');
    world.addContactMaterial(
      new CANNON.ContactMaterial(physics.dieMaterial, moundMaterial, {
        friction: 0.04,
        restitution: 0.35,
      }),
    );
    // Center below floor level so only a bump of height (radius - buried)
    // pokes through: sphere top = -buried + radius.
    const mound = new CANNON.Body({
      type: CANNON.Body.STATIC,
      material: moundMaterial,
      shape: new CANNON.Sphere(MOUND.radius),
      position: new CANNON.Vec3(
        obstacles.mound!.x,
        -MOUND.buried,
        obstacles.mound!.z,
      ),
    });
    world.addBody(mound);
  }
  // Walls. The VISIBLE walls are only `wallHeight` tall, but the colliders
  // extend all the way up to the ceiling: rapid mid-air re-throws stack
  // altitude (throwDie resets velocity at the die's current height), and any
  // gap between wall top and ceiling lets a pumped die escape the tray,
  // fall into the void, and soft-lock settle detection forever.
  const wallColliderHalfH = (ceilingHeight + 1) / 2;
  // Left / right walls.
  addStaticBox([halfT, wallColliderHalfH, halfD + wallThickness], [-(halfW + halfT), wallColliderHalfH, 0]);
  addStaticBox([halfT, wallColliderHalfH, halfD + wallThickness], [halfW + halfT, wallColliderHalfH, 0]);
  // Far / near walls.
  addStaticBox([halfW + wallThickness, wallColliderHalfH, halfT], [0, wallColliderHalfH, -(halfD + halfT)]);
  addStaticBox([halfW + wallThickness, wallColliderHalfH, halfT], [0, wallColliderHalfH, halfD + halfT]);
  // Ceiling (invisible; overlaps the wall tops so there is no seam).
  addStaticBox([halfW + wallThickness, 0.5, halfD + wallThickness], [0, ceilingHeight + 0.5, 0]);
}
