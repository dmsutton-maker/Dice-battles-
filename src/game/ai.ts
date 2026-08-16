import { ColorDef, PRISONER_COLORS } from './colors';

/**
 * The AI opponent for Classic mode. It plays by the same rules as the
 * player: every "roll" is two fair virtual dice (1/6 match chance), and a
 * match frees that color from ITS OWN prison — first to six wins. There is
 * no cheating and no luck bias; difficulty is purely how fast it rolls.
 *
 * For reference, freeing all six takes ~88 rolls on average, so the roll
 * interval maps directly to an expected race time: a frantic human taps
 * roughly 2-3 rolls/second and finishes in ~35-45s.
 */
export type AiDifficultyId = 'easy' | 'medium' | 'hard';

export interface AiDifficulty {
  id: AiDifficultyId;
  label: string;
  /** ms between AI rolls. */
  rollIntervalMs: number;
}

export const AI_DIFFICULTIES: Record<AiDifficultyId, AiDifficulty> = {
  easy: { id: 'easy', label: 'Easy', rollIntervalMs: 1500 },
  medium: { id: 'medium', label: 'Medium', rollIntervalMs: 950 },
  hard: { id: 'hard', label: 'Hard', rollIntervalMs: 600 },
};

export const AI_NAME = 'Sir Rollsalot';

export function rollAiDice(): [ColorDef, ColorDef] {
  const pick = () =>
    PRISONER_COLORS[Math.floor(Math.random() * PRISONER_COLORS.length)];
  return [pick(), pick()];
}
