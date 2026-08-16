import * as CANNON from 'cannon-es';
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
 * Add the static tray collision bodies: floor, four walls, and an invisible
 * ceiling that keeps wild flicks inside the camera frame. The visual arena
 * is drawn separately (see src/arena) — these are physics-only.
 */
export function addTrayBodies(physics: PhysicsWorld): void {
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

  // Floor (top surface at y = 0).
  addStaticBox([halfW + wallThickness, 0.5, halfD + wallThickness], [0, -0.5, 0]);
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
