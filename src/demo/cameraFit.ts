import * as THREE from 'three';
import { TUNING } from '../game/tuning';

/**
 * Auto-frames the camera so the whole arena fits the actual screen.
 *
 * The scene has a fixed footprint but phones have wildly different aspect
 * ratios (iPhone SE 16:9, modern iPhones ~19.5:9, iPads 4:3). A hardcoded
 * camera either crops the arena on tall screens or wastes space on wide
 * ones. Instead we keep a fixed viewing direction and binary-search the
 * camera distance until every "must be visible" point projects inside
 * screen margins.
 *
 * Exported `cameraBase` is the fitted position — the camera-shake effect
 * offsets from it and returns to it.
 */
export const cameraBase = new THREE.Vector3(0, 10.5, 5.6);

/**
 * Viewing direction: near top-down with a slight tilt toward the player.
 * Kept small on purpose — a stronger tilt makes the near wall loom large in
 * perspective and eat the bottom of the screen.
 */
const TILT_DEGREES = 17;
const DIR = new THREE.Vector3(
  0,
  Math.cos(THREE.MathUtils.degToRad(TILT_DEGREES)),
  Math.sin(THREE.MathUtils.degToRad(TILT_DEGREES)),
).normalize();

const TARGET = new THREE.Vector3(0, 0.3, -0.1);

interface FitPoint {
  point: THREE.Vector3;
  /** Max |ndc.x|; > 1 allows decorative bleed off the sides. */
  marginX: number;
  /** Max ndc.y — keeps the far battlement below the HUD text. */
  topLimit: number;
  /** Min ndc.y. */
  bottomLimit: number;
}

function buildFitPoints(): FitPoint[] {
  const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;
  const halfW = innerWidth / 2;
  const halfD = innerDepth / 2;
  const outerX = halfW + wallThickness;
  const outerZ = halfD + wallThickness;
  const towerReach = 0.7; // tower radius + roof overhang beyond its center
  const figureTop = wallHeight + 0.24 + 0.95; // prisoner head incl. bounce

  const points: FitPoint[] = [];
  const add = (
    x: number,
    y: number,
    z: number,
    marginX: number,
    topLimit: number,
    bottomLimit = -0.97,
  ) => {
    points.push({
      point: new THREE.Vector3(x, y, z),
      marginX,
      topLimit,
      bottomLimit,
    });
  };

  // Inner playfield corners — where dice can actually roll — must always be
  // fully on screen.
  add(-halfW, 0, -halfD, 0.96, 0.8);
  add(halfW, 0, -halfD, 0.96, 0.8);
  add(-halfW, 0, halfD, 0.96, 0.8, -0.98);
  add(halfW, 0, halfD, 0.96, 0.8, -0.98);

  // Outer floor corners — slight corner bleed is fine.
  add(-outerX, 0, -outerZ, 1.05, 0.8);
  add(outerX, 0, -outerZ, 1.05, 0.8);
  add(-outerX, 0, outerZ, 1.05, 0.8, -1.05);
  add(outerX, 0, outerZ, 1.05, 0.8, -1.05);

  // Prison row on the far battlement — heads clear of the small top title.
  add(-(halfW - 0.15), figureTop, -(halfD + wallThickness / 2), 0.94, 0.78);
  add(halfW - 0.15, figureTop, -(halfD + wallThickness / 2), 0.94, 0.78);

  // Celebration spots on the side walls.
  add(-(halfW + wallThickness / 2), figureTop, 2.2, 0.99, 0.88);
  add(halfW + wallThickness / 2, figureTop, 2.2, 0.99, 0.88);
  add(-(halfW + wallThickness / 2), figureTop, -2.2, 0.99, 0.82);
  add(halfW + wallThickness / 2, figureTop, -2.2, 0.99, 0.82);

  // Near wall top edge — must clear the bottom of the screen.
  add(0, wallHeight + 0.3, outerZ, 0.97, 0.9, -0.96);

  // Far corner towers — decorative, allowed to bleed slightly off the sides.
  const towerTop = wallHeight + 1.2;
  add(-(outerX + towerReach), towerTop, -outerZ, 1.06, 0.85);
  add(outerX + towerReach, towerTop, -outerZ, 1.06, 0.85);
  // Near towers sit close to the camera and act as foreground framing —
  // let them crop freely at the sides/bottom rather than force a pullback.
  add(-(outerX + towerReach), towerTop, outerZ, 1.8, 0.95, -1.4);
  add(outerX + towerReach, towerTop, outerZ, 1.8, 0.95, -1.4);

  // Rescue-flight arc peak — may pass near the HUD but never off screen.
  add(-1.4, 4.4, -1.2, 0.97, 0.98);
  add(1.4, 4.4, -1.2, 0.97, 0.98);

  return points;
}

const scratch = new THREE.Vector3();

/**
 * Position `camera` so all fit points are inside their margins for the given
 * viewport aspect ratio. Call on mount and whenever the viewport changes.
 */
export function fitCamera(camera: THREE.PerspectiveCamera, aspect: number): void {
  // Longer lens = flatter, board-game look; slightly wider on narrow screens.
  camera.fov = aspect < 0.65 ? 46 : 40;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  const points = buildFitPoints();

  const fitsAt = (dist: number): boolean => {
    camera.position.copy(TARGET).addScaledVector(DIR, dist);
    camera.lookAt(TARGET);
    camera.updateMatrixWorld(true);
    return points.every((fp) => {
      scratch.copy(fp.point).project(camera);
      return (
        Math.abs(scratch.x) <= fp.marginX &&
        scratch.y <= fp.topLimit &&
        scratch.y >= fp.bottomLimit
      );
    });
  };

  // Binary search the smallest distance where everything fits (fit is
  // monotonic: pulling back always shrinks the projection toward center).
  let lo = 5;
  let hi = 45;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (fitsAt(mid)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  const dist = fitsAt(hi) ? hi : 45;
  camera.position.copy(TARGET).addScaledVector(DIR, dist);
  camera.lookAt(TARGET);
  camera.updateMatrixWorld(true);
  cameraBase.copy(camera.position);
}
