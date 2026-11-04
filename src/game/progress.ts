import AsyncStorage from '@react-native-async-storage/async-storage';
import { AiDifficultyId } from './ai';
import { ModeId } from './modes';
import type { TournamentState } from './tournament';
import { RewardRange, rollReward } from './rewards';
import type { SeasonState } from './seasonPass';
import type { QuestState } from './quests';

/**
 * Trophy progression, Clash Royale style: win trophies on victory, lose
 * some on defeat (never below zero), and crossing thresholds unlocks new
 * content. Persisted on device — no accounts.
 */
export interface Progress {
  trophies: number;
  /** Lifetime wins per difficulty — the per-difficulty medal counters. */
  wins: Record<AiDifficultyId, number>;
  /** Lifetime wins per game mode, shown in Your Records. */
  modeWins: Record<ModeId, number>;
  /**
   * Lifetime battles FINISHED per difficulty and per mode — won, lost or
   * tied.
   *
   * David, 20 Sep 2026: "add counters in the ranks tab for total games
   * played and games played for each mode and difficulty."
   *
   * Counted for the same battles the wins are: the ones played against
   * the computer. A friendly battle against somebody on your friends
   * list pays nothing and counts nothing (see finishRound), which also
   * keeps the screen able to add up — the three difficulties and the
   * four modes each total the same number of battles, and a child
   * checking that with a finger down the column is right.
   *
   * A TIE IS A GAME PLAYED. It is the one outcome that never reaches
   * applyMatchResult — a draw moves no trophies — so these are recorded
   * by `notePlayed` instead, beside the ad counter, where every finished
   * battle passes.
   */
  played: Record<AiDifficultyId, number>;
  modePlayed: Record<ModeId, number>;
  /**
   * Family tester mode: every unlock available regardless of trophies, so
   * playtesters can try all arenas/modes immediately. Toggled by the secret
   * code in Settings; trophies still count normally underneath.
   */
  unlockAll?: boolean;
  /**
   * A number on this save was typed in rather than played for.
   *
   * Set by the trophy and coin codes ONLY — the two that invent a figure
   * Game Center would go on to rank people by. Family tester mode is
   * deliberately not counted: it unlocks cosmetics and fabricates no
   * count, so the people who use it most are not shut out of their own
   * leaderboard for testing an arena.
   *
   * Nothing a player sees on their own phone changes. Flagged saves keep
   * every reward, every unlock and every local record, and simply stop
   * posting to the shared board.
   *
   * There is no undo. `RESET` empties the Store cupboard but leaves the
   * typed trophies and coins sitting there, so clearing the flag would
   * just be a two-step way of posting the typed number.
   */
  cheated?: boolean;
  /**
   * Where this player stands in every tournament they have played, by
   * tournament id.
   *
   * This replaced `run`, the single cup bracket in progress, on 25 Sep
   * 2026. A bracket was one thing at a time and was thrown away the
   * moment it ended; a tournament streak is per-tournament, survives
   * being finished, and keeps a best run worth looking at afterwards.
   *
   * Keyed by id and never pruned, on purpose. Tournaments arrive over
   * the network and can be retired, and a retired one coming back to
   * find its old streak still here is right — whereas a player who
   * cleared a tournament and then had the prize handed to them again,
   * because the row was tidied away, would be a real bug.
   */
  tournaments?: Record<string, TournamentState>;
  /**
   * Where this player stands in the current season pass
   * (src/game/seasonPass.ts). Absent until the first battle after the
   * pass arrived on 30 Sep 2026; a state from an older season is
   * replaced, not added to.
   */
  season?: SeasonState;
  /**
   * Today's quest for the season pass (src/game/quests.ts): the New York
   * day it was chosen on, which one, and how far along it is. Absent
   * until a quest is first chosen; a save from another day is simply
   * read as "nothing chosen yet today".
   */
  quest?: QuestState;
  /**
   * Snowy Hollow and Volcano Rim moved from the trophy ladder to the
   * season pass on 30 Sep 2026, and anybody who had already climbed
   * past either one KEEPS it. That hand-over happens exactly once, the
   * first time this version loads a save, and this records that it has
   * — otherwise a player who crossed 1,475 trophies next month would be
   * handed Snowy Hollow by the old ladder through the back door.
   */
  passArenasKept?: true;
  /**
   * Bubblegum Dice moved up the ladder from 430 to 560 on 21 Oct 2026.
   * Anybody already past 430 keeps it — handed over once, the first time
   * this version loads a save, the same way as `passArenasKept`.
   */
  raisedRungsKept?: true;
}

/**
 * Higher difficulties risk and reward MUCH more — Hard pays nearly 5x Easy,
 * so climbing the ladder fast means daring the moat.
 */
export const TROPHY_STAKES: Record<
  AiDifficultyId,
  { win: RewardRange; loss: RewardRange }
> = {
  // The smallest possible win must beat the biggest possible loss at every
  // difficulty, or an unlucky win followed by a lucky loss costs you rank
  // for playing well. Easy is gentlest on purpose — it is where a five-
  // year-old learns the game.
  easy: { win: { min: 10, max: 20 }, loss: { min: 3, max: 8 } },
  medium: { win: { min: 25, max: 45 }, loss: { min: 9, max: 18 } },
  hard: { win: { min: 55, max: 85 }, loss: { min: 20, max: 40 } },
};

export type UnlockId =
  | 'castle'
  | 'ivory-dice'
  | 'golden-dice'
  | 'sunset-castle'
  | 'mint-dice'
  | 'jungle'
  | 'bubblegum-dice'
  | 'space'
  | 'midnight-dice'
  // The long ladder, added 26 Aug 2026 — eight themed battlefields and
  // six dice, still alternating so there is always something close.
  | 'ruby-dice'
  | 'desert-arena'
  | 'ocean-dice'
  | 'autumn-arena'
  | 'lavender-dice'
  | 'aurora-arena'
  | 'slate-dice'
  | 'blossom-dice'
  | 'cavern-arena'
  | 'copper-dice'
  | 'sky-arena'
  | 'moon-arena';

export interface Tier {
  at: number;
  name: string;
  id: UnlockId;
}

/** The unlock ladder. */
/**
 * The unlock ladder, alternating battlefields and dice so there is always
 * something close to earn. Everything cosmetic lands in the Inventory.
 */
export const TIERS: Tier[] = [
  // The two you start with, so the ladder shows where you began.
  { at: 0, name: 'Castle Courtyard', id: 'castle' },
  { at: 0, name: 'Ivory Dice', id: 'ivory-dice' },
  // Gaps widen the whole way up — 40, 60, 80, 110, 270, 290, 300, 350.
  // The first reward used to cost 100 trophies, several sessions before
  // anything at all happened.
  { at: 40, name: 'Gold Dice', id: 'golden-dice' },
  { at: 100, name: 'Sunset Castle', id: 'sunset-castle' },
  { at: 180, name: 'Mint Dice', id: 'mint-dice' },
  { at: 290, name: 'Jungle Clearing', id: 'jungle' },
  /*
    Courtyard Treasure sat at 610 until 21 Oct 2026: a chest of gold added
    beside the board, which on every current iPhone was drawn off the
    bottom-right corner of the screen, so the reward could not be seen.
    David: "Get rid of it and just adjust some trophy unlock amounts near
    it to make it better."

    Bubblegum Dice moved from 430 to 560 to close the hole it left. It is
    the only rung that could: Sunset Castle (100), Jungle Clearing (290),
    Space Station (850) and Midnight Dice (1150) each have a Game Center
    achievement with the number in its id. Between 290 and 850 the steps
    have to grow and stay under the 300 above, which only 551-569 does.
    That is the one rung ever moved UP, and nobody loses it: anybody
    already at 430 when this version first loads keeps it for good —
    keepRaisedRungs() in loadout.ts.
  */
  { at: 560, name: 'Bubblegum Dice', id: 'bubblegum-dice' },
  { at: 850, name: 'Space Station', id: 'space' },
  { at: 1150, name: 'Midnight Dice', id: 'midnight-dice' },
  /*
    The long ladder. David asked on 26 Aug 2026 for many more arenas, some
    earned with trophies — these are the trophy half (the other half is
    sold in the Store, deliberately NOT here: one route each, the same
    rule dice skins follow).

    The gaps keep widening the whole way: 325, 375, 425, 475, then 500
    and fifty more each rung to 950. David asked on 26 Aug 2026 for
    thresholds that "make sense scaling up higher and higher"; the run
    used to start 350, 350 — the only place on the whole ladder where a
    rung was no harder than the one below it, which reads as a mistake
    because it was one.

    The summit WAS 10,000 exactly (it is 8,000 since 4 Nov 2026, below). Marc asked for that on 27 Aug 2026:
    "change the trophy amount of some items so that the highest thing is
    only 10 thousand trophies." This comment used to argue it could not be
    done without a kink, and ran the ladder on to 10,600 instead. That is
    true only of gaps that all grow by the same fifty — fourteen of those,
    each wider than the 300 below, come to at least 9,450 and overshoot.

    Until 30 Sep 2026 that was four twenty-fives at the bottom of the
    run — 325, 375, 425, 475 — and then ten clean fifties, 500 through
    950, summing to exactly 8,850. Two rungs then left for the season
    pass and the run was respaced; see the note beside Ruby Dice below.

    Midnight Dice stays on 1,150, and that is not for tidiness. Its Game
    Center achievement id is `…trophies1150`, the number is IN the id, and
    those ids are live records in App Store Connect — moving the rung
    would mean renaming one there or leaving an achievement that never
    fires. A ladder is worth bending around that; an external identifier
    is not worth bending around a ladder.

    A Hard win pays 50-85, so the summit is a season of play rather than
    a weekend — the long game for Marc and AJ. Tester mode still opens
    everything for testing.
  */
  /*
    Snowy Hollow sat here, at 1475, and Volcano Rim at 5750, until 30
    Sep 2026, when David moved both to the season pass: "make the
    volcano rim and snowy hollow arenas unlocked through the season pass
    only." Anybody already past either rung keeps it — see
    `passArenasKept` and keepPassArenas() in loadout.ts, which read those
    two numbers from FORMER_LADDER there rather than from here.

    THE RUNGS ABOVE WERE RESPACED to close the two holes, under three
    rules that all had to hold at once:

      - The summit stays 10,000 exactly (Marc, 27 Aug 2026, above;
        8,000 from 4 Nov 2026).
      - Every step is bigger than the one below it.
      - NOTHING MOVES UP. An item that moved up would lock itself again
        for anybody sitting between its old and new number, so every
        rung either stayed put or came DOWN — things only arrive sooner.

    The twelve steps from Midnight Dice were 350, 400, 450, 500, 550,
    650, 700, 850, 950, 1050, 1150 and 1250, which sum to 8,850.
  */
  /*
    RESPACED AGAIN on 4 Nov 2026. Marc: "rework the ladder trophy amounts
    to make sense with the loss of some dice, and maybe lessen the
    highest amount too in order so that the gaps aren't as big, like
    maybe somewhere around 8500 or 8000." The summit is now 8,000 and the
    twelve steps from Midnight Dice are 350, 390, 430, 470, 510, 550,
    590, 630, 670, 710, 750 and 800: every step still bigger than the one
    below, but the top gaps fall from 1,150 and 1,250 to 750 and 800.
    Rungs up to Midnight Dice (the Game Center ids) did not move, and
    nothing moved UP, so things only arrive sooner.
  */
  { at: 1500, name: 'Ruby Dice', id: 'ruby-dice' },
  { at: 1890, name: 'Desert Dunes', id: 'desert-arena' },
  { at: 2320, name: 'Ocean Dice', id: 'ocean-dice' },
  { at: 2790, name: 'Autumn Woods', id: 'autumn-arena' },
  { at: 3300, name: 'Lavender Dice', id: 'lavender-dice' },
  { at: 3850, name: 'Frozen Lights', id: 'aurora-arena' },
  { at: 4440, name: 'Slate Dice', id: 'slate-dice' },
  { at: 5070, name: 'Blossom Dice', id: 'blossom-dice' },
  { at: 5740, name: 'Crystal Cavern', id: 'cavern-arena' },
  { at: 6450, name: 'Copper Dice', id: 'copper-dice' },
  { at: 7200, name: 'Sky Kingdom', id: 'sky-arena' },
  { at: 8000, name: 'Moon Base', id: 'moon-arena' },
];

/**
 * Picker/teaser label. Every tier shows its real name from the start —
 * seeing what Space Station IS is what makes 700 trophies worth chasing;
 * a "❓ Mystery Arena" card gave the player nothing to want.
 */
export function tierLabel(tier: Tier, _trophies: number): { name: string } {
  return { name: tier.name };
}

/**
 * The ceilings on a typed count. The top of the ladder is a few hundred
 * trophies, so anything past this is a bug rather than a request, and a
 * count that wide breaks the HUD layout it has to fit inside. Coins get a
 * wider ceiling because they legitimately pile up as you play, but not so
 * wide that the pill in the HUD stops fitting.
 *
 * The secret codes themselves live, as hashes, in secretCodes.ts; every
 * amount they set is far below these.
 */
export const TROPHY_CODE_MAX = 99_999;
export const COIN_CODE_MAX = 999_999;

/**
 * Set the trophy count outright, and report which tiers that crosses.
 *
 * Wins are deliberately left alone: they are a record of what was actually
 * played, and a cheat code that rewrote history would make Your Records
 * lie. Going DOWN relocks things — that is the point, not a side effect —
 * and both activeArena and activeDieBody already fall back when the
 * equipped item is no longer unlocked.
 */
export function setTrophies(trophies: number): MatchResult {
  const before = current.trophies;
  const after = Math.max(0, Math.min(Math.floor(trophies), TROPHY_CODE_MAX));
  current = { ...current, trophies: after, cheated: true };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  return {
    trophies: after,
    delta: after - before,
    newUnlocks: TIERS.filter((t) => t.at > before && t.at <= after),
  };
}

/**
 * Add trophies that were EARNED — today, only a tournament prize.
 *
 * Deliberately not `setTrophies`, which is the cheat code and flags the
 * save as `cheated` so it stops posting to the shared board. These
 * trophies were won by winning battles, so flagging them would shut a
 * player out of Game Center for playing the game properly. That is the
 * entire difference between the two functions and it is the one thing
 * worth getting right in this file.
 *
 * Reports the tiers crossed, exactly as applyMatchResult does, so a
 * prize that carries you past a rung unlocks it there and then rather
 * than on the next ordinary win.
 */
export function awardTrophies(amount: number): MatchResult {
  const before = current.trophies;
  const add = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  const after = before + add;
  current = { ...current, trophies: after };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  return {
    trophies: after,
    delta: after - before,
    newUnlocks: TIERS.filter((t) => t.at > before && t.at <= after),
  };
}

export function setUnlockAll(on: boolean): Progress {
  current = { ...current, unlockAll: on };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  return current;
}

export function hasUnlockAll(): boolean {
  return !!current.unlockAll;
}

/** Record that a typed-in number landed on this save. One way. */
export function markCheated(): void {
  if (current.cheated) return;
  current = { ...current, cheated: true };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
}

/**
 * Remember where a player stands in one tournament.
 *
 * Written after every finished battle that touches one, so a streak
 * survives the app being force-quit mid-run — which is the whole reason
 * the old bracket was persisted too. Writes are fire-and-forget like
 * every other write here: a storage failure must never stop a battle.
 */
export function setTournamentState(id: string, state: TournamentState): Progress {
  current = {
    ...current,
    tournaments: { ...(current.tournaments ?? {}), [id]: state },
  };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  return current;
}

/** Remember where this player stands in the season pass. */
export function setSeasonState(state: SeasonState): Progress {
  current = { ...current, season: state };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  return current;
}

/** Remember today's quest, the same way as the season pass. */
export function setQuestState(state: QuestState): Progress {
  current = { ...current, quest: state };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  return current;
}

/** Record that the dice whose rung moved up have been handed over. */
export function markRaisedRungsKept(): void {
  if (current.raisedRungsKept) return;
  current = { ...current, raisedRungsKept: true };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
}

/** Record that the two former ladder arenas have been handed over. */
export function markPassArenasKept(): void {
  if (current.passArenasKept) return;
  current = { ...current, passArenasKept: true };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
}

/** Everything known about this player's tournaments. Never undefined. */
export function tournamentStates(): Record<string, TournamentState> {
  return current.tournaments ?? {};
}

export function hasCheated(): boolean {
  return !!current.cheated;
}


const STORAGE_KEY = 'dice-battles:progress';

const EMPTY_WINS: Record<AiDifficultyId, number> = { easy: 0, medium: 0, hard: 0 };

const EMPTY_MODE_WINS: Record<ModeId, number> = {
  classic: 0,
  ultimate: 0,
  skirmish: 0,
  colorwar: 0,
};

let current: Progress = {
  trophies: 0,
  wins: { ...EMPTY_WINS },
  modeWins: { ...EMPTY_MODE_WINS },
  played: { ...EMPTY_WINS },
  modePlayed: { ...EMPTY_MODE_WINS },
};

export function getProgress(): Progress {
  return current;
}

/**
 * Seed a battles-played count from the wins it must already contain.
 *
 * Counting started on 20 Sep 2026. Every save written before that knows
 * how many battles were WON and has no idea how many were played, and a
 * player who has won forty easy battles must not be shown "40 won, 0
 * played" — the screen would read as broken, and it would be.
 *
 * So an old save starts at its own win count. That is a FLOOR, not a
 * guess: those battles were certainly played. It undercounts the losses
 * nobody recorded, which is the honest way round — the alternative is
 * inventing a number of defeats that never happened.
 */
function seedPlayed<K extends string>(
  played: Record<K, number> | undefined,
  wins: Record<K, number>,
): Record<K, number> {
  const out = { ...wins };
  for (const key of Object.keys(out) as K[]) {
    const stored = played?.[key];
    out[key] = Math.max(out[key], Number.isFinite(stored) ? (stored as number) : 0);
  }
  return out;
}

export async function loadProgress(): Promise<Progress> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const wins = { ...EMPTY_WINS, ...(parsed.wins ?? {}) };
      // Saves written before per-mode counting existed have no modeWins;
      // they start at zero rather than breaking the read.
      const modeWins = { ...EMPTY_MODE_WINS, ...(parsed.modeWins ?? {}) };
      current = {
        ...current,
        ...parsed,
        wins,
        modeWins,
        played: seedPlayed(parsed.played, wins),
        modePlayed: seedPlayed(parsed.modePlayed, modeWins),
      };
    }
  } catch {
    // Defaults are fine if storage is unavailable.
  }
  return current;
}

/**
 * Test-only reset so suites do not leak state into each other.
 *
 * There is deliberately no in-game way to clear `cheated` — see the field
 * — so this is the only thing that puts it back, and only in node.
 */
export function resetProgressForTests(progress: Partial<Progress> = {}): void {
  current = {
    trophies: 0,
    wins: { ...EMPTY_WINS },
    modeWins: { ...EMPTY_MODE_WINS },
    played: { ...EMPTY_WINS },
    modePlayed: { ...EMPTY_MODE_WINS },
    ...progress,
  };
}

/**
 * One battle finished, whoever won.
 *
 * Separate from `applyMatchResult` because a TIE reaches this and not
 * that: a draw moves no trophies and no wins, and it is still a game
 * played. Called from finishRound beside `noteGameFinished`, which is
 * the one place every paid battle passes through exactly once.
 */
export function notePlayed(difficulty: AiDifficultyId, mode: ModeId): Progress {
  current = {
    ...current,
    played: { ...current.played, [difficulty]: current.played[difficulty] + 1 },
    modePlayed: { ...current.modePlayed, [mode]: current.modePlayed[mode] + 1 },
  };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  return current;
}

export function isUnlocked(id: UnlockId, trophies: number): boolean {
  if (current.unlockAll) return true;
  const tier = TIERS.find((t) => t.id === id);
  return tier !== undefined && trophies >= tier.at;
}

/** The next tier still above this trophy count, if any. */
export function nextTier(trophies: number): Tier | null {
  return TIERS.find((t) => t.at > trophies) ?? null;
}

export interface MatchResult {
  trophies: number;
  delta: number;
  newUnlocks: Tier[];
}

/** Apply a win/loss, persist, and report any freshly crossed unlocks. */
export function applyMatchResult(
  won: boolean,
  difficulty: AiDifficultyId,
  mode: ModeId,
  rng: () => number = Math.random,
): MatchResult {
  const stakes = TROPHY_STAKES[difficulty];
  const before = current.trophies;
  // Varies inside the band, like coins — two easy wins should not be worth
  // an identical number every time.
  const delta = won
    ? rollReward(stakes.win, rng)
    : -rollReward(stakes.loss, rng);
  const after = Math.max(0, before + delta);
  const wins = won
    ? { ...current.wins, [difficulty]: current.wins[difficulty] + 1 }
    : current.wins;
  const modeWins = won
    ? { ...current.modeWins, [mode]: current.modeWins[mode] + 1 }
    : current.modeWins;
  current = { ...current, trophies: after, wins, modeWins };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  const newUnlocks = won
    ? TIERS.filter((t) => t.at > before && t.at <= after)
    : [];
  return { trophies: after, delta: after - before, newUnlocks };
}
