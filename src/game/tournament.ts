import AsyncStorage from '@react-native-async-storage/async-storage';
import { AiDifficultyId } from './ai';
import { ModeId, MODE_ORDER } from './modes';
import { RewardRange } from './rewards';

/**
 * Tournaments: a live challenge to win a run of battles in one mode at
 * one difficulty, for a prize you cannot get any other way.
 *
 * David, 25 Sep 2026: "Rework the entire cups tab to be online
 * tournaments, against AI for now, with unique rewards like some extra
 * gold, trophies, and even a dice or arena. You should have to achieve a
 * certain amount of wins in a row in the specific game mode and
 * difficulty of the tournament."
 *
 * WHAT THIS REPLACED, and why none of it survived. A cup used to be a
 * knockout bracket: pay an entry fee, play four rounds, and lose once and
 * both the run and the fee are gone. Three things were wrong with it for
 * this game. It charged coins for the chance to lose them, which is a
 * casino's idea of a reward and a poor one for a five-year-old. It paid
 * only coins, so winning one changed nothing you could look at. And it
 * was entirely local — "cup" meant a list baked into the binary, so a new
 * one needed an App Store release.
 *
 * WHAT A TOURNAMENT IS NOW:
 *
 *   - It names ONE mode and ONE difficulty, and only battles played that
 *     way count toward it.
 *   - It asks for a number of wins IN A ROW. A loss puts you back to
 *     nothing; a draw leaves you where you are (see `advance`).
 *   - It pays coins, trophies, and often an item — a die or a
 *     battlefield — once. Not every run, once, the first time you reach
 *     the target.
 *   - It is free to enter, because there is nothing to enter. The Cups
 *     tab describes the challenge; the battles are ordinary battles.
 *
 * WHAT "ONLINE" MEANS HERE, exactly, because the word deserves care in a
 * game that refuses to invent other players (see AGENTS.md):
 *
 *   - The LIST is fetched from the server, so a tournament can be added,
 *     corrected or retired without an App Store release or even an
 *     over-the-air update.
 *   - Fetched tournaments can be DATED. One that has not opened yet is
 *     shown as coming; one past its closing day is gone. So a tournament
 *     can be a real event with a deadline rather than a permanent menu
 *     item.
 *   - The OPPONENTS are the game's own rivals, as David asked ("against
 *     AI for now"), and the screen says so in as many words. Nothing here
 *     claims a human is on the other end, and there is no invented
 *     ranking of players.
 *
 * The four below are BUNDLED: they ship inside the app, have no dates,
 * and are always on. That is what makes the tab work on a plane and on
 * the first launch before anything has been fetched — and it is why they
 * deliberately have no closing day. A bundled tournament with a deadline
 * would expire on a phone that never gets another update and leave the
 * tab permanently empty.
 *
 * Pure apart from the fetch and its cache: no React, and the streak
 * itself lives in progress.ts.
 */

/** A die or a battlefield, named by the id its own module knows it by. */
export interface PrizeItem {
  kind: 'dice' | 'arena';
  /** A DiceSkin id, or an ArenaId. Resolved by src/game/prizes.ts. */
  id: string;
}

export interface TournamentPrize {
  /** Coins, as a band like every other payout in the game. */
  coins: RewardRange;
  /** Trophies, flat — a prize you can plan for should not be a gamble. */
  trophies: number;
  /**
   * A die or a battlefield, and MOST CUPS SHOULD NOT HAVE ONE.
   *
   * David, 25 Sep 2026: "don't make a new dice or arena every time." A
   * cup changes every week or two, and a game that invents a die for
   * each of them would have two hundred dice in a year, each worth
   * nothing because the next one is a week away. Coins and trophies are
   * what a weekly cup pays.
   *
   * When an item IS right, it is one that already exists: the standing
   * Gauntlet's Amethyst die, or something off the Store shelf handed
   * over for winning rather than for paying. Winning an item a player
   * already owns pays its shelf price in coins instead, so reusing one
   * costs nothing (see prizes.ts).
   */
  item?: PrizeItem;
}

export interface TournamentDef {
  id: string;
  name: string;
  /** One line for the card, written for a family rather than a player. */
  blurb: string;
  mode: ModeId;
  difficulty: AiDifficultyId;
  /** Wins in a row needed to take it. */
  target: number;
  prize: TournamentPrize;
  /**
   * The days it runs, as YYYY-MM-DD, both ends included. Absent means
   * always — which is what the bundled standing challenge is.
   */
  opens?: string;
  closes?: string;
  /**
   * The one that never rotates.
   *
   * Set only on the cup bundled with the game. It is shown LAST and is
   * never crowded off the screen by the week's cups (see
   * `liveTournaments`), so there is always something to play and the
   * prize die is always winnable.
   *
   * Never sent by the server — the API does not emit this field — so a
   * fetched cup is by definition one of the rotating ones.
   */
  standing?: true;
}

/**
 * THE ONE THAT IS ALWAYS THERE.
 *
 * David, 25 Sep 2026: "I only want like one or three cups at a time and
 * they should be much harder and they're gonna change every week or two
 * so don't make a new dice or arena every time."
 *
 * So the shape is: **one standing challenge, plus up to two running on
 * the board.** One to three, exactly as asked, and `liveTournaments`
 * enforces it rather than trusting whoever fills the table in.
 *
 * It shipped as four — one per mode, Easy to Hard — which was two
 * mistakes at once. Four is more than anybody looks at, and the Easy
 * three-in-a-row was close to free, so the tab read as a list of
 * chores rather than something worth chasing. Both are gone. What is
 * left is the hardest thing in the game, on Hard, and it is the only
 * cup that never expires.
 *
 * WHY A BUNDLED ONE AT ALL, when the rotation is the point: this is
 * what the tab shows on a plane, on a fresh install before anything has
 * been fetched, and in the gap between one week's cups and the next. It
 * deliberately has no dates — a closing day baked into a binary would
 * expire on a phone that never gets another update and leave the tab
 * permanently empty, with nobody able to fix it.
 *
 * AND IT IS WHERE THE PRIZE DIE LIVES, which is the other half of
 * David's instruction. "Don't make a new dice or arena every time" means
 * the weekly cups pay coins and trophies; the one die that can only be
 * won sits on the standing challenge, so it is always winnable and is
 * only ever won once. See the note above TOURNAMENTS' type for the rule
 * in full.
 */
export const TOURNAMENTS: TournamentDef[] = [
  {
    id: 'the-gauntlet',
    name: 'The Gauntlet',
    blurb:
      'Six Ultimate wins in a row, on Hard. The hardest thing in the game, it never closes, and it is the only way to get the Amethyst dice.',
    mode: 'ultimate',
    difficulty: 'hard',
    target: 6,
    prize: {
      coins: { min: 1000, max: 1400 },
      trophies: 90,
      item: { kind: 'dice', id: 'amethyst' },
    },
    standing: true,
  },
];

/* ── where a player stands in one tournament ──────────────────────── */

export interface TournamentState {
  /** Wins in a row right now. */
  streak: number;
  /** The best run ever managed here, which a reset streak must not lose. */
  best: number;
  /** True once the prize has been handed over. It is only handed over once. */
  won: boolean;
}

export const NO_PROGRESS: TournamentState = { streak: 0, best: 0, won: false };

/** What this player has done in a tournament, or a clean slate. */
export function stateOf(
  states: Record<string, TournamentState>,
  id: string,
): TournamentState {
  return states[id] ?? NO_PROGRESS;
}

/**
 * Apply one finished battle to one tournament.
 *
 * `mode` and `difficulty` are the battle's, not the tournament's: a
 * battle only counts toward a tournament played the tournament's way, and
 * checking it HERE rather than at the call site is what stops a Hard
 * Ultimate win quietly advancing the Easy Color Rush streak.
 *
 * A DRAW LEAVES THE RUN ALONE — it neither counts nor breaks. Skirmish is
 * the reason: it is the one mode that can end level, it does so often
 * enough to matter, and "win four in a row" would otherwise mean
 * something much harsher in that mode than in the other three for a
 * reason nobody chose. A draw is not a win, so it does not advance; it is
 * not a defeat either, so it does not wipe four evenings of work.
 *
 * Returns the new state and whether the prize has just been earned —
 * which can only be true once, however many more times the target is
 * reached afterwards.
 */
export function advance(
  def: TournamentDef,
  state: TournamentState,
  battle: { mode: ModeId; difficulty: AiDifficultyId; outcome: 'won' | 'lost' | 'tie' },
): { state: TournamentState; justWon: boolean } {
  if (battle.mode !== def.mode || battle.difficulty !== def.difficulty) {
    return { state, justWon: false };
  }
  if (battle.outcome === 'tie') return { state, justWon: false };
  if (battle.outcome === 'lost') {
    // The SAME object when there was no streak to break. Callers use
    // identity to decide whether anything needs saving, and a defeat in
    // a mode you were not on a run in should not write to storage.
    if (state.streak === 0) return { state, justWon: false };
    return { state: { ...state, streak: 0 }, justWon: false };
  }
  const streak = state.streak + 1;
  const next: TournamentState = {
    streak,
    best: Math.max(state.best, streak),
    won: state.won || streak >= def.target,
  };
  return { state: next, justWon: !state.won && streak >= def.target };
}

export interface ScoredBattle {
  /** Only the tournaments whose state actually moved. */
  changed: Record<string, TournamentState>;
  /** The ones whose prize has just been earned, in list order. */
  won: TournamentDef[];
}

/**
 * Offer one finished battle to every tournament.
 *
 * PULLED OUT OF THE SCREEN on purpose, the same way friendsLoad was. The
 * interesting property here is that a battle is offered to ALL of them
 * and each decides for itself — which is the thing that replaced
 * entering a cup, and which a grep through a React component cannot
 * check. Given the list and the states, this is the whole rule, and a
 * test can run it.
 *
 * `changed` holds only what moved, so an ordinary battle in a mode
 * nobody is on a run in writes nothing at all. `won` is in list order
 * rather than by size of prize, because two cups completed by the same
 * battle should pop up in the order they are shown.
 */
export function scoreBattle(
  cups: TournamentDef[],
  states: Record<string, TournamentState>,
  battle: { mode: ModeId; difficulty: AiDifficultyId; outcome: 'won' | 'lost' | 'tie' },
): ScoredBattle {
  const changed: Record<string, TournamentState> = {};
  const won: TournamentDef[] = [];
  for (const cup of cups) {
    const before = stateOf(states, cup.id);
    const after = advance(cup, before, battle);
    if (after.state === before) continue;
    changed[cup.id] = after.state;
    if (after.justWon) won.push(cup);
  }
  return { changed, won };
}

/* ── the days a tournament runs ───────────────────────────────────── */

/**
 * Today, as YYYY-MM-DD in the phone's own time zone.
 *
 * LOCAL, not UTC, and that is the point: a tournament closing "on the
 * 30th" closes at the end of the 30th where the player is. Using UTC
 * would end it at four in the afternoon in California, on a day the phone
 * still calls the 30th.
 */
export function todayStamp(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Whether a tournament is running today.
 *
 * Compared as STRINGS. YYYY-MM-DD sorts correctly as text, so this needs
 * no date parsing at all — and date parsing is where time zones get in.
 */
export function isOpen(def: TournamentDef, today: string): boolean {
  if (def.opens && today < def.opens) return false;
  if (def.closes && today > def.closes) return false;
  return true;
}

/** Not open yet, rather than finished — the "coming soon" case. */
export function isComing(def: TournamentDef, today: string): boolean {
  return !!def.opens && today < def.opens;
}

/**
 * Whole days until a tournament closes, or null if it never does.
 *
 * Parsed as UTC midnight on both sides, which is safe because both are
 * plain dates with no time in them: the difference between two midnights
 * is the same number of days whichever zone you count it in.
 */
export function daysLeft(def: TournamentDef, today: string): number | null {
  if (!def.closes) return null;
  const end = Date.parse(`${def.closes}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(end) || !Number.isFinite(now)) return null;
  return Math.round((end - now) / 86_400_000);
}

/** "Last day", "3 days left", or null when it runs forever. */
export function closingLabel(def: TournamentDef, today: string): string | null {
  const left = daysLeft(def, today);
  if (left === null) return null;
  if (left <= 0) return 'Last day';
  if (left === 1) return '1 day left';
  return `${left} days left`;
}

const DIFFICULTY_ORDER: AiDifficultyId[] = ['easy', 'medium', 'hard'];

/** One standing challenge plus at most two of the week's. */
export const MAX_ROTATING = 2;
export const MAX_SHOWN = 3;

/**
 * The tournaments to show, in the order to show them.
 *
 * David, 25 Sep 2026: "I only want like one or three cups at a time."
 * ENFORCED HERE rather than left to whoever fills the table in, because
 * the table is filled in weekly, from a browser, months from now, by
 * somebody who will not remember this rule — and the failure is a Cups
 * tab with nine cards on it, which nobody would call a bug and everybody
 * would stop reading.
 *
 * The order, and why:
 *
 *   1. THE WEEK'S CUPS, at most two, easiest first. They have deadlines
 *      and they are what is new, so they go where the eye lands.
 *   2. THE STANDING CHALLENGE, always, and never crowded out. It is the
 *      one that is there when nothing else is — offline, on a fresh
 *      install, and in the gap between one week and the next — and it
 *      carries the prize die, which must not become unwinnable because
 *      a busy week pushed it off the screen. Capping the rotating ones
 *      at two rather than trimming the end of a merged list is the
 *      whole reason this cannot happen.
 *   3. WHAT IS COMING, if there is room. A card you cannot play is
 *      worth less than one you can, so it yields.
 *
 * Anything already finished is dropped: a closed tournament is a card
 * that can only disappoint.
 */
export function liveTournaments(
  all: TournamentDef[],
  today: string,
): TournamentDef[] {
  const byEffort = (a: TournamentDef, b: TournamentDef) => {
    const byDifficulty =
      DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty);
    if (byDifficulty !== 0) return byDifficulty;
    return a.target - b.target;
  };

  const open = all.filter((t) => isOpen(t, today));
  /*
    CHOSEN BY THE BOARD'S ORDER, SHOWN BY DIFFICULTY — two different
    questions, and sorting before slicing answered the wrong one.

    Which cups run is an editorial decision David makes weekly; the API
    hands them over in his `sort_order`, and taking the two EASIEST
    would silently overrule him — putting on whichever pair he happened
    to make gentlest rather than the pair at the top of his list. So the
    cut is made in the order they arrive. Only then are the survivors
    arranged easiest first, which is a kindness to the reader and costs
    nothing.
  */
  const rotating = open
    .filter((t) => !t.standing)
    .slice(0, MAX_ROTATING)
    .sort(byEffort);
  const standing = open.filter((t) => t.standing).sort(byEffort);
  const coming = all
    .filter((t) => isComing(t, today))
    .sort((a, b) => (a.opens ?? '').localeCompare(b.opens ?? ''));

  return [...rotating, ...standing, ...coming].slice(0, MAX_SHOWN);
}

export function tournamentById(
  id: string,
  all: TournamentDef[] = TOURNAMENTS,
): TournamentDef | undefined {
  return all.find((t) => t.id === id);
}

/* ── the list, fetched ────────────────────────────────────────────── */

const FEED_URL = 'https://dice-battles-hq.vercel.app/api/tournaments';
const CACHE_KEY = 'dice-battles:tournaments-cache';
const FETCH_TIMEOUT_MS = 6000;

const isRange = (value: unknown): value is RewardRange => {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.min === 'number' &&
    typeof r.max === 'number' &&
    Number.isFinite(r.min) &&
    Number.isFinite(r.max) &&
    r.min >= 0
  );
};

const isStamp = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * Whether a row off the server is a tournament this game can run.
 *
 * Strict, and deliberately so. A malformed NEWS post costs a post; a
 * malformed tournament could promise a prize the game cannot hand over,
 * or ask for a mode that does not exist and never advance. Anything with
 * a field out of place is dropped and the player never sees it.
 *
 * The prize ITEM is checked for shape only — whether that die or
 * battlefield actually exists is prizes.ts's job, because this module
 * deliberately knows nothing about either.
 */
export function isTournamentDef(value: unknown): value is TournamentDef {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<string, unknown>;
  if (typeof t.id !== 'string' || t.id.length === 0) return false;
  if (typeof t.name !== 'string' || t.name.length === 0) return false;
  if (typeof t.blurb !== 'string') return false;
  if (!MODE_ORDER.includes(t.mode as ModeId)) return false;
  if (!DIFFICULTY_ORDER.includes(t.difficulty as AiDifficultyId)) return false;
  if (typeof t.target !== 'number' || !Number.isInteger(t.target) || t.target < 1) {
    return false;
  }
  const prize = t.prize as Record<string, unknown> | undefined;
  if (typeof prize !== 'object' || prize === null) return false;
  if (!isRange(prize.coins)) return false;
  if (typeof prize.trophies !== 'number' || prize.trophies < 0) return false;
  if (prize.item !== undefined) {
    const item = prize.item as Record<string, unknown>;
    if (typeof item !== 'object' || item === null) return false;
    if (item.kind !== 'dice' && item.kind !== 'arena') return false;
    if (typeof item.id !== 'string' || item.id.length === 0) return false;
  }
  if (t.opens !== undefined && !isStamp(t.opens)) return false;
  if (t.closes !== undefined && !isStamp(t.closes)) return false;
  return true;
}

/**
 * Bundled plus fetched, with a fetched one winning on a shared id.
 *
 * That override is the useful half: giving `courtyard-streak` a row on
 * the server retunes the tournament every installed copy of the game is
 * already playing — a target that turned out too hard, a prize that
 * turned out too thin — without shipping anything.
 */
export function mergeTournaments(
  bundled: TournamentDef[],
  fetched: TournamentDef[],
): TournamentDef[] {
  const byId = new Map<string, TournamentDef>();
  for (const t of bundled) byId.set(t.id, t);
  for (const t of fetched) byId.set(t.id, t);
  return [...byId.values()];
}

async function readCache(): Promise<TournamentDef[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTournamentDef) : [];
  } catch {
    return [];
  }
}

/**
 * The tournament list. Never rejects, never throws.
 *
 * Every failure — no network, a timeout, a 500, bad JSON, a row missing a
 * field — lands in the same place: the four this version of the game
 * ships with, plus whatever was last successfully read. A Cups tab that
 * showed an error, or nothing, would be worse than one showing the
 * challenges that have always been there.
 */
export async function fetchTournaments(): Promise<TournamentDef[]> {
  const cached = await readCache();
  const fallback = mergeTournaments(TOURNAMENTS, cached);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(FEED_URL, { signal: controller.signal });
    if (!response.ok) return fallback;
    const body = await response.json();
    const rows: unknown = (body as Record<string, unknown>)?.tournaments;
    if (!Array.isArray(rows)) return fallback;
    const clean = rows.filter(isTournamentDef);
    /*
      An EMPTY list is a real answer here, unlike in the news feed.

      "Nothing extra is running this month" is a thing the server must be
      able to say, and it says it by returning no rows. The bundled four
      are still merged in underneath, so the tab can never be empty —
      which is exactly why an empty response is safe to accept.
    */
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(clean)).catch(() => {});
    return mergeTournaments(TOURNAMENTS, clean);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
