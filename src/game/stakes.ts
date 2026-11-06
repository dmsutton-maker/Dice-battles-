/**
 * WHAT A FINISHED BATTLE COUNTS TOWARD, by the kind of battle it was.
 *
 * Marc, 4 Nov 2026: "the online battle should be the dominant way to
 * play and should count towards everything. the only way to play a bot
 * should be if no real player is found in 15 seconds, and the rewards
 * should still be for that also. Also there should be a button in
 * settings that lets you play a bot as practice and those battles don't
 * count for anything".
 *
 * - `online`: a stranger the matchmaking queue paired us with.
 * - `computer`: the rival you get when nobody was found in fifteen
 *   seconds, or in Skirmish and Color War, which cannot be played live.
 * - `practice`: a computer battle started from Settings. Counts for nothing.
 * - `friend`: a challenged friend. David, 11 Sep 2026: "a trophyless
 *   friendly battle". Counts for nothing.
 *
 * Every row is all or nothing, and `finishRound` (DiceDemoScreen.tsx)
 * relies on that: a kind that pays nothing returns before the paid
 * path, and a kind that pays runs the whole of it. A partial row would
 * need the paid path wired field by field; tests/stakes.test.ts fails
 * if one appears so that cannot happen by accident.
 */
export type BattleKind = 'online' | 'computer' | 'practice' | 'friend';

export interface Stakes {
  trophies: boolean;
  coins: boolean;
  /** Season pass experience. */
  xp: boolean;
  /** Today's quest. */
  quests: boolean;
  /** The week's cup and any board cup. */
  cups: boolean;
  /** Reported to Game Center. */
  gameCenter: boolean;
  /** Counted toward the interstitial after every third finished game. */
  adCount: boolean;
  /** Recorded in the games-played tally. */
  recordPlayed: boolean;
}

const EVERYTHING: Stakes = {
  trophies: true,
  coins: true,
  xp: true,
  quests: true,
  cups: true,
  gameCenter: true,
  adCount: true,
  recordPlayed: true,
};

const NOTHING: Stakes = {
  trophies: false,
  coins: false,
  xp: false,
  quests: false,
  cups: false,
  gameCenter: false,
  adCount: false,
  recordPlayed: false,
};

export const STAKES: Record<BattleKind, Stakes> = {
  online: EVERYTHING,
  computer: EVERYTHING,
  practice: NOTHING,
  friend: NOTHING,
};

export function stakesFor(kind: BattleKind): Stakes {
  return STAKES[kind];
}

/** Does a battle of this kind count for nothing at all? */
export function paysNothing(stakes: Stakes): boolean {
  return Object.values(stakes).every((v) => v === false);
}

/** The result screen's line for a battle that counted for nothing. */
export const PRACTICE_RESULT_LINE = 'Practice — nothing changes';

/**
 * The kind of the battle that just finished, from what the screen knows:
 * the live battle's kind if there is one, else practice or computer.
 */
export function battleKindOf(live: 'friend' | 'match' | null, practice: boolean): BattleKind {
  if (live === 'friend') return 'friend';
  if (live === 'match') return 'online';
  return practice ? 'practice' : 'computer';
}
