import { easternLocalToUtc, easternOffsetMs } from './easternTime';
import { todayStamp, type TournamentDef } from './tournament';

/** New York's clock, shared with the season pass. Re-exported for the tests. */
export { easternOffsetMs };

/**
 * The weekly cup: ten cups built into the game, one running at a time,
 * changing every Monday at midnight Eastern time, never the same run
 * twice.
 *
 * David, 21 Oct 2026: "I want you to make 10 different unique cups of
 * varying difficulty but never too easy. I want you to automatically
 * change the cup every week at 12 AM EST. Whenever a cup is used, it
 * can't be used again for at least another 6 weeks after. I don't want
 * the same rotation every time though, so give some variation."
 *
 * HOW IT CHANGES ON ITS OWN, with nothing running anywhere: the cup for
 * a given week is worked out from the date, the same way on every
 * phone, so there is no server job, no row to write on Sunday night and
 * nothing that can be late. The week turns at midnight in New York
 * (clocks change with daylight saving, so "12 AM" stays 12 AM all
 * year), and every phone turns with it at the same instant, whatever
 * time zone it is in.
 *
 * WHICH CUP RUNS. Week 0 is the week of 19 October 2026. Each week's cup
 * is chosen from the ones that have had their rest — a cup that ran in
 * week w cannot run again before week w + REST_WEEKS — by a fixed hash
 * of the week number, so the order is scrambled rather than a loop of
 * ten, and a cup left out for MAX_IDLE_WEEKS is put on before any
 * other, so none is forgotten. The first ten weeks use every cup once.
 * Because the choice is arithmetic on the week number, it never needs
 * to be stored: a phone that was off for a month works out the same
 * answer as one that was on.
 *
 * A board cup from the HQ website can still run alongside it — the tab
 * shows at most two (tournament.ts, liveTournaments) and the weekly cup
 * always takes the first place.
 *
 * The streak for each week's cup is kept under its own id (`<cup>-w<n>`),
 * so a run does not carry over from one week to the next and the same
 * cup can be won again when it comes round.
 */

/** A cup used in week w cannot run again before week w + REST_WEEKS. */
export const REST_WEEKS = 6;
/** A cup not used for this many weeks goes on before any other. */
export const MAX_IDLE_WEEKS = 12;

/** The ten. Ordered roughly easiest to hardest; none is easy. */
export const ROTATION_CUPS: readonly Omit<TournamentDef, 'opens' | 'closes'>[] = [
  {
    id: 'courtyard-streak',
    name: 'Courtyard Streak',
    blurb: 'Five Color Rush wins in a row, on Medium. The gentlest cup there is, and it is still five.',
    mode: 'classic',
    difficulty: 'medium',
    target: 5,
    prize: { coins: { min: 350, max: 500 }, trophies: 40 },
  },
  {
    id: 'ultimate-five',
    name: 'Ultimate Five',
    blurb: 'Five Ultimate wins in a row, on Medium. One careless match sends a prisoner back.',
    mode: 'ultimate',
    difficulty: 'medium',
    target: 5,
    prize: { coins: { min: 400, max: 550 }, trophies: 45 },
  },
  {
    id: 'standoff',
    name: 'Color War Standoff',
    blurb: 'Six Color War wins in a row, on Medium. One colour each, six times, no slips.',
    mode: 'colorwar',
    difficulty: 'medium',
    target: 6,
    prize: { coins: { min: 500, max: 700 }, trophies: 50 },
  },
  {
    id: 'seven-skirmishes',
    name: 'Seven Skirmishes',
    blurb: 'Seven Skirmish wins in a row, on Medium. A draw will not break the run, but it will not help either.',
    mode: 'skirmish',
    difficulty: 'medium',
    target: 7,
    prize: { coins: { min: 650, max: 900 }, trophies: 60 },
  },
  {
    id: 'siege',
    name: 'Skirmish Siege',
    blurb: 'Five Skirmish wins in a row, on Hard. The shared jail, against the sharpest rival.',
    mode: 'skirmish',
    difficulty: 'hard',
    target: 5,
    prize: { coins: { min: 700, max: 1000 }, trophies: 65 },
  },
  {
    id: 'marathon',
    name: 'Color Rush Marathon',
    blurb: 'Six Color Rush wins in a row, on Hard. The classic game, and no second chances.',
    mode: 'classic',
    difficulty: 'hard',
    target: 6,
    prize: { coins: { min: 800, max: 1100 }, trophies: 70 },
  },
  {
    id: 'iron-ultimate',
    name: 'Iron Ultimate',
    blurb: 'Six Ultimate wins in a row, on Hard. Every roll can undo you.',
    mode: 'ultimate',
    difficulty: 'hard',
    target: 6,
    prize: { coins: { min: 900, max: 1200 }, trophies: 80 },
  },
  {
    id: 'color-war-seven',
    name: 'Color War Seven',
    blurb: 'Seven Color War wins in a row, on Hard. Your three before theirs, seven times running.',
    mode: 'colorwar',
    difficulty: 'hard',
    target: 7,
    prize: { coins: { min: 1100, max: 1500 }, trophies: 100 },
  },
  {
    id: 'long-haul',
    name: 'The Long Haul',
    blurb: 'Eight Color Rush wins in a row, on Hard. Most runs end at five. Yours will not.',
    mode: 'classic',
    difficulty: 'hard',
    target: 8,
    prize: { coins: { min: 1400, max: 1900 }, trophies: 120 },
  },
  {
    /*
      The Gauntlet was the game's one standing cup until 30 Sep 2026, and
      the Amethyst die was its prize. It is back as the hardest of the
      ten, with the same prize, so the one win-only die can be won again
      when it comes round — about once every two or three months.
    */
    id: 'gauntlet',
    name: 'The Gauntlet',
    blurb: 'Eight Ultimate wins in a row, on Hard. The hardest cup there is, and the Amethyst dice are its prize.',
    mode: 'ultimate',
    difficulty: 'hard',
    target: 8,
    prize: { coins: { min: 1500, max: 2000 }, trophies: 140, item: { kind: 'dice', id: 'amethyst' } },
  },
];

/* ── the clock: weeks in Eastern time ─────────────────────────────── */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;

/** Monday 19 October 2026, 00:00, as a local Eastern time written as if UTC. */
const EPOCH_LOCAL = Date.UTC(2026, 9, 19);

/** Which week of the rotation an instant falls in. Never negative. */
export function weekIndex(utcMs: number): number {
  const local = utcMs + easternOffsetMs(utcMs);
  return Math.max(0, Math.floor((local - EPOCH_LOCAL) / WEEK));
}

/** The instant week `w` begins: midnight Monday, New York time. */
export function weekStart(w: number): number {
  return easternLocalToUtc(EPOCH_LOCAL + w * WEEK);
}

/* ── the schedule ─────────────────────────────────────────────────── */

/** A fixed scramble of a week number, 0..2^32. Integer maths only, so every phone agrees. */
export function scramble(w: number): number {
  let x = (Math.imul(w ^ 0x5bd1e995, 0x9e3779b1) + 0x7f4a7c15) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d) >>> 0;
  x ^= x >>> 12;
  x = Math.imul(x, 0x297a2d39) >>> 0;
  x ^= x >>> 15;
  return x >>> 0;
}

const schedule: number[] = [];

/**
 * Which of the ten runs in week `w`.
 *
 * Worked out week by week from week 0, because each choice depends on
 * the ones before it (what has rested, what is overdue). Remembered, so
 * asking about this week costs nothing after the first time.
 */
export function cupIndexForWeek(w: number): number {
  const lastUsed: number[] = new Array(ROTATION_CUPS.length).fill(-Infinity);
  for (let k = 0; k < schedule.length; k++) lastUsed[schedule[k]] = k;
  for (let k = schedule.length; k <= w; k++) {
    const rested: number[] = [];
    const overdue: number[] = [];
    for (let i = 0; i < ROTATION_CUPS.length; i++) {
      const idle = k - lastUsed[i];
      if (idle < REST_WEEKS) continue;
      rested.push(i);
      if (idle >= MAX_IDLE_WEEKS) overdue.push(i);
    }
    const pool = overdue.length > 0 ? overdue : rested;
    const pick = pool[scramble(k) % pool.length];
    schedule.push(pick);
    lastUsed[pick] = k;
  }
  return schedule[w];
}

/**
 * The cup running at an instant, dated for the phone it is shown on.
 *
 * The dates are the phone's OWN calendar days for the week's first and
 * last instants, because the Cups tab compares them with the phone's
 * own "today" (tournament.ts, todayStamp). A player in California gets
 * the new cup at 9 PM on Sunday, and on that phone it opens on Sunday.
 */
export function rotationCup(utcMs: number): TournamentDef {
  const w = weekIndex(utcMs);
  const cup = ROTATION_CUPS[cupIndexForWeek(w)];
  return {
    ...cup,
    id: `${cup.id}-w${w}`,
    opens: todayStamp(new Date(weekStart(w))),
    closes: todayStamp(new Date(weekStart(w + 1) - 1)),
  };
}

/** The week's cup first, then whatever the board sent. */
export function withRotation(board: TournamentDef[], utcMs: number): TournamentDef[] {
  return [rotationCup(utcMs), ...board];
}
