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

export const MOUND = {
  x: -1.0,
  z: -1.6,
  radius: 1.05,
  /** How deep the sphere is buried; visible bump height = radius - buried. */
  buried: 0.58,
} as const;

export const MOAT = {
  x: 1.3,
  z: 0.3,
  /** Side length of the square hole in the floor. */
  size: 2.0,
} as const;

export const OBSTACLES_BY_DIFFICULTY: Record<AiDifficultyId, ObstacleConfig> = {
  easy: { mound: false, moat: false },
  medium: { mound: true, moat: false },
  hard: { mound: true, moat: true },
};

export const OBSTACLE_HINTS: Record<AiDifficultyId, string> = {
  easy: 'A calm courtyard — just outroll him!',
  medium: 'He rolls faster… and a hill deflects your dice!',
  hard: 'Fastest rolls, the hill, AND a moat that swallows dice!',
};
