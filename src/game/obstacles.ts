import { AiDifficultyId } from './ai';

/**
 * Physical obstacles in the player's courtyard, tied to difficulty. The AI
 * rolls virtual dice, so obstacles pressure the PLAYER side of the race —
 * Medium/Hard change your battlefield as well as Sir Rollsalot's speed.
 *
 * - Mound: a slick grassy bump that deflects rolls unpredictably.
 * - Moat: a water pool in the courtyard floor; a die that rolls in SINKS
 *   (there is a real hole in the physics floor under the water plane),
 *   splashes, and is fished back to the start — lost seconds in a race.
 */
export interface ObstacleConfig {
  mound: boolean;
  moat: boolean;
}

/** Dimensions only — positions are rolled fresh every battle. */
export const MOUND = {
  radius: 1.05,
  /** How deep the sphere is buried; visible bump height = radius - buried. */
  buried: 0.58,
} as const;

export const MOAT = {
  /** Side length of the square hole in the floor. */
  size: 2.0,
} as const;

export interface ObstaclePlacement {
  x: number;
  z: number;
}

/** Where this round's obstacles ended up. null = not present. */
export interface ObstacleLayout {
  mound: ObstaclePlacement | null;
  moat: ObstaclePlacement | null;
}

export const EMPTY_LAYOUT: ObstacleLayout = { mound: null, moat: null };

const DIE_SPAWNS: ObstaclePlacement[] = [
  { x: -0.9, z: 2.2 },
  { x: 0.9, z: 2.4 },
];

/**
 * Roll fresh obstacle positions for a new battle. Rejection-sampled so
 * obstacles never spawn on the dice's starting spots, never overlap each
 * other, and always leave the floor strips around the moat hole intact.
 */
export function generateObstacleLayout(difficulty: AiDifficultyId): ObstacleLayout {
  const config = OBSTACLES_BY_DIFFICULTY[difficulty];
  const rand = (min: number, max: number) => min + Math.random() * (max - min);

  /**
   * Rejection-sample a spot, keeping the roomiest candidate seen. Every
   * sample can miss on a crowded battlefield, and falling back to a fixed
   * position would ignore what is already placed — that is how the moat
   * once ended up cut through the hill. Returning the best candidate keeps
   * the fallback as far clear as the tray allows.
   */
  const place = (
    xRange: [number, number],
    zRange: [number, number],
    clearances: { x: number; z: number; radius: number }[],
    attempts = 120,
  ): ObstaclePlacement => {
    const slackAt = (x: number, z: number) =>
      Math.min(...clearances.map((c) => Math.hypot(x - c.x, z - c.z) - c.radius));

    for (let i = 0; i < attempts; i++) {
      const x = rand(xRange[0], xRange[1]);
      const z = rand(zRange[0], zRange[1]);
      if (slackAt(x, z) > 0) return { x, z };
    }

    // Random sampling missed. Sweep the range instead of keeping the best
    // random guess: on a crowded battlefield the roomiest spot is a small
    // target, and a near-miss guess is what let the moat sit too close to
    // the hill. A grid sweep finds it whenever one exists.
    let best: ObstaclePlacement = { x: xRange[0], z: zRange[0] };
    let bestSlack = -Infinity;
    const STEPS = 24;
    for (let ix = 0; ix <= STEPS; ix++) {
      for (let iz = 0; iz <= STEPS; iz++) {
        const x = xRange[0] + ((xRange[1] - xRange[0]) * ix) / STEPS;
        const z = zRange[0] + ((zRange[1] - zRange[0]) * iz) / STEPS;
        const slack = slackAt(x, z);
        if (slack > bestSlack) {
          bestSlack = slack;
          best = { x, z };
        }
      }
    }
    return best;
  };

  const spawnClearances = (radius: number) =>
    DIE_SPAWNS.map((s) => ({ x: s.x, z: s.z, radius }));

  let mound: ObstaclePlacement | null = null;
  if (config.mound) {
    mound = place([-1.2, 1.2], [-3.4, 1.4], spawnClearances(1.7));
  }

  let moat: ObstaclePlacement | null = null;
  if (config.moat) {
    moat = place(
      [-1.6, 1.6],
      [-3.8, 1.6],
      [
        ...spawnClearances(1.9),
        // The hill and the moat must never intersect: a sphere sitting
        // over the hole in the floor makes dice behave nonsensically.
        ...(mound ? [{ x: mound.x, z: mound.z, radius: MOUND.radius + MOAT.size / 2 + 0.45 }] : []),
      ],
    );
  }

  return { mound, moat };
}

export const OBSTACLES_BY_DIFFICULTY: Record<AiDifficultyId, ObstacleConfig> = {
  easy: { mound: false, moat: false },
  medium: { mound: true, moat: false },
  hard: { mound: true, moat: true },
};

export const OBSTACLE_HINTS: Record<AiDifficultyId, string> = {
  easy: 'A calm courtyard — just outroll him!',
  medium: 'He rolls faster… and a hill in a new spot every battle!',
  hard: 'Fastest rolls, the hill, AND a wandering moat that swallows dice!',
};
