import type { AiDifficultyId } from './ai';
import { scramble } from './cupRotation';
import { easternOffsetMs } from './easternTime';
import type { ModeId } from './modes';
import { QUEST_XP, type QuestSize } from './seasonPass';

/**
 * Daily quests for the season pass: three on offer every day, pick one.
 *
 * David, 1 Nov 2026: "Make it were you can choose out of three quests
 * for the pass." Every day the Cups tab offers a quick quest, a medium
 * one and a longer one. Tap one and it is today's quest; the other two
 * go grey until tomorrow. Finish it before midnight and it pays a chunk
 * of season-pass experience (QUEST_XP in seasonPass.ts, beside the
 * battle experience) through the pass's own `addXp`, so the levels it
 * reaches pay out exactly as a battle's would, Gold row included.
 *
 * A DAY IS A NEW YORK DAY, midnight to midnight, because the weekly cup
 * and the season already turn on New York's clock (easternTime.ts) and
 * a family should not have three different midnights to keep track of.
 *
 * THE OFFERS ARE WORKED OUT FROM THE DATE ALONE, the same way on every
 * phone, like the weekly cup (cupRotation.ts): no server, nothing
 * written anywhere. Each size has its own five quests; each day picks
 * one of them by a fixed scramble of the day number, never one offered
 * in the last QUEST_REST_DAYS days, and where it can, one of a different
 * kind from the other two picks so a day is not "win 2, win 4, win 7".
 *
 * WHAT IS SAVED is only the day, the quest chosen, and how far along it
 * is (progress.ts, `quest`). A save from another day is read as nothing
 * chosen yet: a quest not finished by midnight simply ends.
 *
 * THE RULES ONLY, so the headless tests can read them. Drawing them is
 * SeasonPassCard; counting a battle is one call from finishRound.
 */

/** What a quest asks for, in terms a finished battle can answer. */
export type QuestRule =
  /** Finish this many battles, won, lost or tied — in one mode, if given. */
  | { kind: 'play'; count: number; mode?: ModeId }
  /**
   * Win this many — in one mode, if given; at this difficulty or harder,
   * if given; and, if `dry`, without one of your dice falling in.
   */
  | { kind: 'win'; count: number; mode?: ModeId; atLeast?: AiDifficultyId; dry?: boolean }
  /** Free this many prisoners, added up over battles. */
  | { kind: 'free'; count: number }
  /** Win this many in a row. A loss starts it again; a draw leaves it. */
  | { kind: 'streak'; count: number }
  /** Win once in every one of the four modes. */
  | { kind: 'everyMode' };

/** Which drawn icon a quest wears (SeasonPassCard maps it to src/ui). */
export type QuestIcon = 'die' | 'trophy' | 'people' | 'ranks' | ModeId;

export interface QuestDef {
  id: string;
  size: QuestSize;
  /** What to do, in a few plain words: "Win 4 battles". */
  title: string;
  /** A second line where the title needs one. Optional. */
  hint?: string;
  icon: QuestIcon;
  rule: QuestRule;
}

/*
  THE POOL: five of each size, fifteen in all.

  Only things a finished battle actually knows — whether it was won, the
  mode, the difficulty, how many of your prisoners stood free at the end,
  and whether one of your dice went in the water. Sized so the quick one
  is two or three battles, the medium four or five, and the long one an
  evening: a Hard win or two is a long quest for most of the family.
*/
export const QUESTS: readonly QuestDef[] = [
  // Quick.
  { id: 'play-3', size: 'quick', title: 'Play 3 battles', hint: 'Win or lose, they all count.', icon: 'die', rule: { kind: 'play', count: 3 } },
  { id: 'win-2', size: 'quick', title: 'Win 2 battles', icon: 'trophy', rule: { kind: 'win', count: 2 } },
  { id: 'free-10', size: 'quick', title: 'Free 10 prisoners', hint: 'Added up over your battles.', icon: 'people', rule: { kind: 'free', count: 10 } },
  { id: 'colorwar-1', size: 'quick', title: 'Win a Color War battle', icon: 'colorwar', rule: { kind: 'win', count: 1, mode: 'colorwar' } },
  { id: 'rush-2', size: 'quick', title: 'Play 2 Color Rush battles', icon: 'classic', rule: { kind: 'play', count: 2, mode: 'classic' } },
  // Medium.
  { id: 'win-4', size: 'medium', title: 'Win 4 battles', icon: 'trophy', rule: { kind: 'win', count: 4 } },
  { id: 'brave-3', size: 'medium', title: 'Win 3 on Medium or Hard', icon: 'ranks', rule: { kind: 'win', count: 3, atLeast: 'medium' } },
  { id: 'free-20', size: 'medium', title: 'Free 20 prisoners', hint: 'Added up over your battles.', icon: 'people', rule: { kind: 'free', count: 20 } },
  { id: 'ultimate-2', size: 'medium', title: 'Win 2 Ultimate battles', icon: 'ultimate', rule: { kind: 'win', count: 2, mode: 'ultimate' } },
  { id: 'skirmish-2', size: 'medium', title: 'Win 2 Skirmish battles', icon: 'skirmish', rule: { kind: 'win', count: 2, mode: 'skirmish' } },
  // Long.
  { id: 'win-7', size: 'long', title: 'Win 7 battles', icon: 'trophy', rule: { kind: 'win', count: 7 } },
  { id: 'hard-2', size: 'long', title: 'Win 2 battles on Hard', icon: 'ranks', rule: { kind: 'win', count: 2, atLeast: 'hard' } },
  { id: 'streak-3', size: 'long', title: 'Win 3 in a row', hint: 'A loss starts the count again.', icon: 'trophy', rule: { kind: 'streak', count: 3 } },
  {
    id: 'dry-hard',
    size: 'long',
    title: 'Win on Hard with no splash',
    hint: 'If one of your dice falls in the water, that win does not count.',
    icon: 'die',
    rule: { kind: 'win', count: 1, atLeast: 'hard', dry: true },
  },
  {
    id: 'every-mode',
    size: 'long',
    title: 'Win in all 4 modes',
    hint: 'Color Rush, Ultimate, Skirmish and Color War.',
    icon: 'die',
    rule: { kind: 'everyMode' },
  },
];

/** The three sizes, in the order the card shows them. */
export const QUEST_SIZES: readonly QuestSize[] = ['quick', 'medium', 'long'];

/** A quest offered on day d is not offered again before day d + QUEST_REST_DAYS. */
export const QUEST_REST_DAYS = 3;

/** How many of a thing a quest asks for: its count, or the four modes. */
export function questTarget(def: QuestDef): number {
  return def.rule.kind === 'everyMode' ? 4 : def.rule.count;
}

/** What a quest pays, by its size. */
export function questXp(def: QuestDef): number {
  return QUEST_XP[def.size];
}

export function questById(id: string): QuestDef | undefined {
  return QUESTS.find((q) => q.id === id);
}

/* ── the clock: days in New York ─────────────────────────────────── */

const DAY = 86_400_000;
/** Sunday 1 November 2026, 00:00 in New York, written as if UTC. Day 0. */
const EPOCH_LOCAL = Date.UTC(2026, 10, 1);

/**
 * Which day of the quests an instant falls in: whole New York days since
 * 1 November 2026, never negative. New York's own offset at that instant
 * (daylight saving included) is applied first, so the day turns at
 * midnight there whatever time zone the phone is in.
 */
export function questDay(utcMs: number): number {
  const local = utcMs + easternOffsetMs(utcMs);
  return Math.max(0, Math.floor((local - EPOCH_LOCAL) / DAY));
}

/** The New York date an instant falls on, YYYY-MM-DD — what a save is stamped with. */
export function questDayStamp(utcMs: number): string {
  return new Date(EPOCH_LOCAL + questDay(utcMs) * DAY).toISOString().slice(0, 10);
}

/* ── the offers ──────────────────────────────────────────────────── */

/** The sort of thing a quest asks, so one day's three can differ. */
function family(def: QuestDef): string {
  if ('mode' in def.rule && def.rule.mode) return 'mode';
  if (def.rule.kind === 'win' && def.rule.atLeast) return 'brave';
  return def.rule.kind;
}

const schedule: number[][] = [];

/**
 * The three quests offered on day `d`, quick first.
 *
 * Worked out day by day from day 0, because each day's picks depend on
 * the days before (what is still resting), and remembered, so asking
 * about today costs nothing after the first time. Arithmetic on the day
 * number only, so a phone that was off for a month gets the same answer
 * as one that was on.
 */
export function offersForDay(d: number): QuestDef[] {
  const day = Math.max(0, Math.floor(d));
  for (let k = schedule.length; k <= day; k++) {
    const recent = new Set(schedule.slice(Math.max(0, k - QUEST_REST_DAYS + 1), k).flat());
    const picks: number[] = [];
    QUEST_SIZES.forEach((size, s) => {
      const all = QUESTS.map((_, i) => i).filter((i) => QUESTS[i].size === size);
      const rested = all.filter((i) => !recent.has(i));
      const pool = rested.length > 0 ? rested : all;
      const different = pool.filter((i) => !picks.some((p) => family(QUESTS[p]) === family(QUESTS[i])));
      const from = different.length > 0 ? different : pool;
      picks.push(from[scramble(k * 3 + s + 0x51) % from.length]);
    });
    schedule.push(picks);
  }
  return schedule[day].map((i) => QUESTS[i]);
}

/** The three on offer at an instant. */
export function offersAt(now: number = Date.now()): QuestDef[] {
  return offersForDay(questDay(now));
}

/* ── one player's day ────────────────────────────────────────────── */

/** Today's quest, once one is chosen. Saved in progress.ts. */
export interface QuestState {
  /** The New York day it was chosen on, YYYY-MM-DD. */
  day: string;
  /** The quest chosen. */
  chosen: string;
  /** How far along: battles, wins, prisoners or the current run. */
  progress: number;
  /** For "win in all 4 modes": the modes already won in. */
  modes?: ModeId[];
  /** Finished and paid. Set once, so it can never pay twice. */
  done?: boolean;
}

/**
 * The quest chosen today, or undefined if none is — which is what a save
 * from another day, or one that does not make sense (a quest that was
 * not on offer that day, a broken number), comes back as.
 */
export function questToday(state: QuestState | undefined, now: number = Date.now()): QuestState | undefined {
  if (!state || typeof state !== 'object') return undefined;
  if (state.day !== questDayStamp(now)) return undefined;
  if (!offersAt(now).some((q) => q.id === state.chosen)) return undefined;
  if (!Number.isFinite(state.progress) || state.progress < 0) return undefined;
  return state;
}

/**
 * Choose one of today's three. Once chosen it stays chosen until
 * midnight: choosing again, or choosing one that is not on offer today,
 * changes nothing and hands the same state back.
 */
export function chooseQuest(state: QuestState | undefined, id: string, now: number = Date.now()): QuestState | undefined {
  const today = questToday(state, now);
  if (today) return state;
  if (!offersAt(now).some((q) => q.id === id)) return state;
  return { day: questDayStamp(now), chosen: id, progress: 0 };
}

/** What finishRound knows about a battle once it is over. */
export interface QuestBattle {
  outcome: 'won' | 'lost' | 'tie';
  difficulty: AiDifficultyId;
  mode: ModeId;
  /** How many of YOUR prisoners stood free when it ended. */
  freed: number;
  /** Whether one of your dice fell in the water (or through the hatch). */
  splashed: boolean;
  /** A friendly battle against somebody on your friends list. */
  friendly?: boolean;
}

const RANK: Record<AiDifficultyId, number> = { easy: 0, medium: 1, hard: 2 };

/** One battle's step along a quest, before it is capped at the target. */
function step(def: QuestDef, state: QuestState, b: QuestBattle): { progress: number; modes?: ModeId[] } {
  const r = def.rule;
  const won = b.outcome === 'won';
  switch (r.kind) {
    case 'play':
      return { progress: state.progress + (!r.mode || r.mode === b.mode ? 1 : 0) };
    case 'win': {
      const counts =
        won &&
        (!r.mode || r.mode === b.mode) &&
        (!r.atLeast || RANK[b.difficulty] >= RANK[r.atLeast]) &&
        (!r.dry || !b.splashed);
      return { progress: state.progress + (counts ? 1 : 0) };
    }
    case 'free':
      return { progress: state.progress + Math.max(0, Math.floor(Number.isFinite(b.freed) ? b.freed : 0)) };
    case 'streak':
      return { progress: won ? state.progress + 1 : b.outcome === 'lost' ? 0 : state.progress };
    case 'everyMode': {
      const modes = state.modes ?? [];
      if (!won || modes.includes(b.mode)) return { progress: state.progress, modes: state.modes };
      const next = [...modes, b.mode];
      return { progress: next.length, modes: next };
    }
  }
}

/**
 * Count one finished battle towards today's quest.
 *
 * Returns the new state (the same object when nothing changed), the
 * experience to add to the pass — zero unless this battle FINISHED the
 * quest — and the quest itself when it did, for the popup.
 *
 * Nothing counts before a quest is chosen, after it is done, or on a
 * day it was not chosen on. And A FRIENDLY BATTLE NEVER COUNTS, the
 * same rule the pass itself uses (see BATTLE_XP): a battle against your
 * brother pays no coins, no trophies and no experience, so a quest
 * finished by one would be experience coming in through the back door —
 * two brothers could fill each other's pass by playing to a draw. The
 * tutorial plays no battle at all (it is pages; see tutorial.ts), so it
 * never reaches here.
 */
export function countQuestBattle(
  state: QuestState | undefined,
  battle: QuestBattle,
  now: number = Date.now(),
): { state: QuestState | undefined; xp: number; finished?: QuestDef } {
  const today = questToday(state, now);
  if (!today || today.done || battle.friendly) return { state, xp: 0 };
  const def = questById(today.chosen);
  if (!def) return { state, xp: 0 };
  const moved = step(def, today, battle);
  const target = questTarget(def);
  const progress = Math.min(target, moved.progress);
  if (progress === today.progress && moved.modes === today.modes) return { state, xp: 0 };
  const next: QuestState = { ...today, progress, ...(moved.modes ? { modes: moved.modes } : {}) };
  if (progress < target) return { state: next, xp: 0 };
  return { state: { ...next, done: true }, xp: questXp(def), finished: def };
}

/** The words on the popup when a quest is finished. */
export function questDoneWords(def: QuestDef): { name: string; note: string } {
  return {
    name: 'Quest done!',
    note: `${def.title}: done. That is ${questXp(def)} XP for the season pass. Three new quests tomorrow.`,
  };
}
