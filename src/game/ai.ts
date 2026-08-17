import { ColorDef, PRISONER_COLORS } from './colors';

/**
 * The AI opponent. It plays by the same rules as the player: every "roll"
 * is two fair virtual dice (1/6 match chance), and a match frees that color
 * from ITS OWN prison — first to six wins. No cheating, no luck bias.
 *
 * Every opponent rolls at the same human pace. Difficulty is the
 * BATTLEFIELD — the hill and the moat (see src/game/obstacles.ts) — not
 * how fast the opponent's hands are. Speed used to scale with difficulty,
 * which cannot survive online play: a real opponent rolls at whatever pace
 * they roll, so a difficulty built on their speed would mean nothing.
 *
 * The pace is what a human roll cycle actually takes on device: throw
 * flight, settle, and reaction ≈ 2s per counted roll.
 */
export type AiDifficultyId = 'easy' | 'medium' | 'hard';

export interface AiDifficulty {
  id: AiDifficultyId;
  label: string;
  /** ms between AI rolls — the same at every difficulty. */
  rollIntervalMs: number;
}

/** One human-matched pace for every opponent, at every difficulty. */
export const AI_ROLL_INTERVAL_MS = 2000;

export const AI_DIFFICULTIES: Record<AiDifficultyId, AiDifficulty> = {
  easy: { id: 'easy', label: 'Easy', rollIntervalMs: AI_ROLL_INTERVAL_MS },
  medium: { id: 'medium', label: 'Medium', rollIntervalMs: AI_ROLL_INTERVAL_MS },
  hard: { id: 'hard', label: 'Hard', rollIntervalMs: AI_ROLL_INTERVAL_MS },
};

/**
 * The AI opponent roster — a different rival (name + scoreboard tag) is
 * drawn each round so every battle feels fresh. All family-friendly
 * castle-silly names; eventually these become online players.
 */
export interface AiOpponent {
  name: string;
  short: string;
  emoji: string;
}

export const AI_ROSTER: AiOpponent[] = [
  { name: 'David', short: 'DAVID', emoji: '🎲' },
  { name: 'Debra', short: 'DEBRA', emoji: '👑' },
  { name: 'Lilly', short: 'LILLY', emoji: '🌸' },
  { name: 'Sophia', short: 'SOPHIA', emoji: '⭐' },
  { name: 'Marc', short: 'MARC', emoji: '🛡️' },
  { name: 'AJ', short: 'AJ', emoji: '⚡' },
  { name: 'Sir Rollsalot', short: 'SIR R.', emoji: '⚔️' },
  { name: 'Lady Luckabelle', short: 'LADY L.', emoji: '🍀' },
];

export function pickOpponent(previous?: AiOpponent): AiOpponent {
  const pool = previous
    ? AI_ROSTER.filter((o) => o.name !== previous.name)
    : AI_ROSTER;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function rollAiDice(): [ColorDef, ColorDef] {
  const pick = () =>
    PRISONER_COLORS[Math.floor(Math.random() * PRISONER_COLORS.length)];
  return [pick(), pick()];
}
