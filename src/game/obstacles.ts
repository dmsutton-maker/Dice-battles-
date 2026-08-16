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
  const clearOfSpawns = (x: number, z: number, radius: number) =>
    DIE_SPAWNS.every((s) => Math.hypot(x - s.x, z - s.z) > radius);

  let mound: ObstaclePlacement | null = null;
  if (config.mound) {
    for (let i = 0; i < 40; i++) {
      const x = rand(-1.2, 1.2);
      const z = rand(-3.4, 1.4);
      if (clearOfSpawns(x, z, 1.7)) {
        mound = { x, z };
        break;
      }
    }
    mound = mound ?? { x: -1.0, z: -1.6 };
  }

  let moat: ObstaclePlacement | null = null;
  if (config.moat) {
    for (let i = 0; i < 60; i++) {
      const x = rand(-1.6, 1.6);
      const z = rand(-3.8, 1.6);
      if (!clearOfSpawns(x, z, 1.9)) continue;
      if (mound && Math.hypot(x - mound.x, z - mound.z) < 2.5) continue;
      moat = { x, z };
      break;
    }
    moat = moat ?? { x: 1.3, z: 0.3 };
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
