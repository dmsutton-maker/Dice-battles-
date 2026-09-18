import { AiDifficultyId } from './ai';
import { RewardRange } from './rewards';

/**
 * A tournament: a bracket of AI opponents played one after another, where
 * losing ends the run.
 *
 * Deliberately offline. Real bracket play against other people needs
 * accounts and a server, which v1 does not have and does not want (see
 * AGENTS.md) — so rather than fake a lobby, this uses the opponent roster
 * the game already has, and the same reveal screen already shows before
 * every round.
 *
 * Pure: no storage, no React. The screen holds the run and asks this
 * module what happens next.
 */

export type BracketSize = 4 | 8;

export interface TournamentDef {
  id: string;
  name: string;
  emoji: string;
  size: BracketSize;
  difficulty: AiDifficultyId;
  /** Coins for taking the whole thing. */
  prize: RewardRange;
  /** What it costs to enter. Zero for the starter cup. */
  entry: number;
}

/**
 * Three cups, so there is one you can always enter and one worth working
 * toward. The entry fee is what makes a tournament different from a
 * normal battle: a run you can lose is a run worth winning.
 */
export const TOURNAMENTS: TournamentDef[] = [
  {
    id: 'courtyard-cup',
    name: 'Courtyard Cup',
    emoji: '🥉',
    size: 4,
    difficulty: 'easy',
    prize: { min: 60, max: 110 },
    entry: 0,
  },
  {
    id: 'castle-classic',
    name: 'Castle Classic',
    emoji: '🥈',
    size: 4,
    difficulty: 'medium',
    prize: { min: 160, max: 260 },
    entry: 50,
  },
  {
    id: 'grand-championship',
    name: 'Grand Championship',
    emoji: '🥇',
    size: 8,
    difficulty: 'hard',
    prize: { min: 500, max: 800 },
    entry: 150,
  },
];

export function tournamentById(id: string): TournamentDef | undefined {
  return TOURNAMENTS.find((t) => t.id === id);
}

export interface RunState {
  tournamentId: string;
  /** How many rounds have been won so far. */
  wins: number;
  /** Set once the run is over, either way. */
  finished: 'champion' | 'knocked-out' | null;
}

export function startRun(tournament: TournamentDef): RunState {
  return { tournamentId: tournament.id, wins: 0, finished: null };
}

/** How many rounds a bracket of this size takes to win. */
export function roundsToWin(size: BracketSize): number {
  return Math.log2(size);
}

/**
 * The name of the round about to be played — "Semi-final", "Final". Read
 * from how many are LEFT, which is what a bracket actually means.
 */
export function roundName(size: BracketSize, wins: number): string {
  const remaining = roundsToWin(size) - wins;
  if (remaining <= 0) return 'Champion';
  if (remaining === 1) return 'Final';
  if (remaining === 2) return 'Semi-final';
  if (remaining === 3) return 'Quarter-final';
  return `Round ${wins + 1}`;
}

/** How many players are still in at the start of this round. */
export function playersLeft(size: BracketSize, wins: number): number {
  return Math.max(1, size / Math.pow(2, wins));
}

/** Apply the result of one bracket round. */
export function advanceRun(
  run: RunState,
  tournament: TournamentDef,
  won: boolean,
): RunState {
  if (run.finished) return run;
  if (!won) return { ...run, finished: 'knocked-out' };
  const wins = run.wins + 1;
  return {
    ...run,
    wins,
    finished: wins >= roundsToWin(tournament.size) ? 'champion' : null,
  };
}

/** Whether the player can pay to enter. */
export function canEnter(tournament: TournamentDef, coins: number): boolean {
  return coins >= tournament.entry;
}
