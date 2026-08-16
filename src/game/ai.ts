import { ColorDef, PRISONER_COLORS } from './colors';

/**
 * The AI opponent for Classic mode. It plays by the same rules as the
 * player: every "roll" is two fair virtual dice (1/6 match chance), and a
 * match frees that color from ITS OWN prison — first to six wins. There is
 * no cheating and no luck bias; difficulty is purely how fast it rolls.
 *
 * Intervals are tuned to what a HUMAN roll cycle actually takes on device:
 * throw flight (~0.8s) + settle + sleep detection (~0.6s) + reaction
 * (~0.3s) ≈ 1.8-2.2s per counted roll. Freeing all six takes ~88 rolls on
 * average, so: Easy rolls slower than a steady human (you should usually
 * win), Medium matches a good frantic pace (coin flip), Hard outrolls most
 * fingers (you need luck and clean throws).
 */
export type AiDifficultyId = 'easy' | 'medium' | 'hard';

export interface AiDifficulty {
  id: AiDifficultyId;
  label: string;
  /** ms between AI rolls. */
  rollIntervalMs: number;
}

export const AI_DIFFICULTIES: Record<AiDifficultyId, AiDifficulty> = {
  easy: { id: 'easy', label: 'Easy', rollIntervalMs: 2800 },
  medium: { id: 'medium', label: 'Medium', rollIntervalMs: 2000 },
  hard: { id: 'hard', label: 'Hard', rollIntervalMs: 1400 },
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
