import { DICE_SKINS } from './diceSkins';
import { MODE_ORDER } from './modes';
import { owns } from './currency';
import { getProgress, hasCheated, Progress, TIERS } from './progress';

/**
 * What Game Center is told about a player, as rules rather than events.
 *
 * Every achievement here is a QUESTION ABOUT THE CURRENT SAVE — "does this
 * player have ten sets of dice?" — never "did a set just get bought?". That
 * is the whole design. Event-shaped reporting loses an achievement forever
 * if the one moment it could fire happens while the phone is offline, the
 * player is signed out, or the app is killed mid-write. State-shaped
 * reporting simply asks again after the next battle and heals itself.
 *
 * The IDs are permanent. Apple will not let an achievement be renamed at
 * the identifier level or deleted once it has shipped, so a typo here is
 * not a bug that gets fixed — it is a dead achievement that can never fire
 * and can never be removed. They are checked against App Store Connect in
 * the test suite rather than trusted to the eye.
 */

export const LEADERBOARD_TROPHIES = 'papershipstudio.dicebattles.trophies';
export const LEADERBOARD_WINS = 'papershipstudio.dicebattles.wins';

/** Everything an achievement can be decided from. */
export interface AchievementState {
  trophies: number;
  totalWins: number;
  hardWins: number;
  /** How many of the four modes have been won at least once. */
  modesWon: number;
  /** Sets of dice genuinely owned — see `setsOwned`. */
  setsOwned: number;
}

export interface AchievementDef {
  id: string;
  /** For the reader: the words in App Store Connect, so the two can't drift. */
  title: string;
  /** How far along the player is, as a count and the count that earns it. */
  have: (s: AchievementState) => number;
  need: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'papershipstudio.dicebattles.firstwin', title: 'First Victory', have: (s) => s.totalWins, need: 1 },
  { id: 'papershipstudio.dicebattles.wins10', title: 'Ten Battles', have: (s) => s.totalWins, need: 10 },
  { id: 'papershipstudio.dicebattles.wins50', title: 'Fifty Battles', have: (s) => s.totalWins, need: 50 },
  { id: 'papershipstudio.dicebattles.hardwin', title: 'The Hard Way', have: (s) => s.hardWins, need: 1 },
  { id: 'papershipstudio.dicebattles.allmodes', title: 'Every Way to Play', have: (s) => s.modesWon, need: MODE_ORDER.length },
  { id: 'papershipstudio.dicebattles.trophies100', title: 'Sunset Castle', have: (s) => s.trophies, need: 100 },
  { id: 'papershipstudio.dicebattles.trophies290', title: 'Jungle Clearing', have: (s) => s.trophies, need: 290 },
  { id: 'papershipstudio.dicebattles.trophies850', title: 'Space Station', have: (s) => s.trophies, need: 850 },
  { id: 'papershipstudio.dicebattles.trophies1150', title: 'Midnight', have: (s) => s.trophies, need: 1150 },
  // Ten of the thirteen sets, deliberately NOT "all of them". A moving
  // finish line would mean the achievement quietly changed value every
  // time a new die shipped; new dice get their own achievement instead.
  { id: 'papershipstudio.dicebattles.collector', title: 'Collector', have: (s) => s.setsOwned, need: 10 },
];

/** One report: the achievement, and how far along, 0–100 as Apple wants it. */
export interface AchievementReport {
  id: string;
  percent: number;
}

export function achievementReports(state: AchievementState): AchievementReport[] {
  return ACHIEVEMENTS.map((a) => ({
    id: a.id,
    percent: Math.max(0, Math.min(100, (a.have(state) / a.need) * 100)),
  }));
}

/**
 * Sets of dice the player actually has.
 *
 * Deliberately does NOT go through `isSkinUnlocked`, which answers "may
 * this be equipped right now?" and therefore says yes to everything while
 * family tester mode is on. Borrowing every die for an afternoon is not
 * owning them, and an achievement that a cheat code hands over is worth
 * nothing on a board other people are on.
 */
export function setsOwned(trophies: number): number {
  return DICE_SKINS.filter((skin) => {
    if (skin.price !== undefined) return owns(skin.id);
    if (skin.unlock === null || skin.unlock === undefined) return true;
    const tier = TIERS.find((t) => t.id === skin.unlock);
    return tier !== undefined && trophies >= tier.at;
  }).length;
}

/** The live save, as the rules above want to see it. */
export function currentAchievementState(progress: Progress = getProgress()): AchievementState {
  return {
    trophies: progress.trophies,
    totalWins: progress.wins.easy + progress.wins.medium + progress.wins.hard,
    hardWins: progress.wins.hard,
    modesWon: MODE_ORDER.filter((m) => progress.modeWins[m] > 0).length,
    setsOwned: setsOwned(progress.trophies),
  };
}

/**
 * Whether this save is allowed onto a board other people share.
 *
 * The trophy and coin codes set a count to whatever is typed. That is
 * exactly right for a game on one phone — it is how a locked arena gets
 * looked at without grinding to it — and exactly wrong for a ranking,
 * where it would put a typed number above everyone who actually played.
 * Such a save keeps every local reward and stays off the board.
 *
 * Family tester mode is NOT a cheat by this measure: it unlocks cosmetics
 * and invents no count, so testing an arena does not cost you your place.
 */
export function mayPost(): boolean {
  return !hasCheated();
}
