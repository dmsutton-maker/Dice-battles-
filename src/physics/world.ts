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
  // Left / right walls.
  addStaticBox([halfT, wallHeight, halfD + wallThickness], [-(halfW + halfT), wallHeight, 0]);
  addStaticBox([halfT, wallHeight, halfD + wallThickness], [halfW + halfT, wallHeight, 0]);
  // Far / near walls.
  addStaticBox([halfW + wallThickness, wallHeight, halfT], [0, wallHeight, -(halfD + halfT)]);
  addStaticBox([halfW + wallThickness, wallHeight, halfT], [0, wallHeight, halfD + halfT]);
  // Ceiling (invisible).
  addStaticBox([halfW + wallThickness, 0.5, halfD + wallThickness], [0, ceilingHeight + 0.5, 0]);
}
