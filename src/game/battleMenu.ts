import { AI_DIFFICULTIES, AiDifficultyId } from './ai';
import { ModeId, MODES } from './modes';
import { TROPHY_STAKES } from './progress';
import { RewardRange } from './rewards';
import { scoreBattle, TournamentDef, TournamentState } from './tournament';

/**
 * THE MENU IN THE MIDDLE OF A BATTLE — the rules, kept out of the screen
 * so a test can read them.
 *
 * Marc, 2 Nov 2026: "when you're in a battle and want to exit a game it
 * should be a button that's three lines and it should take you to a
 * small menu overlayed on the game playing. the menu should have the
 * ability to leave the game and when you click leave it should warn you
 * that forfeiting counts as a loss, and it should have the volume lines
 * and other things you think".
 *
 * Until then the only way out was a round ↺ in the corner that went
 * straight back to the menu: one tap, no question, and the battle was
 * simply forgotten — not a loss, so a battle going badly could be thrown
 * away for free. Leaving is now a loss, said before it happens.
 *
 * What lives here is every sentence the menu says and every decision it
 * makes that depends on what kind of battle this is. BattleMenu.tsx draws
 * them; DiceDemoScreen.tsx does what they say.
 */

/**
 * What kind of battle the menu was opened in.
 *
 * - `computer`: an ordinary battle against the game's own rival.
 * - `friend`: a live battle against another phone (friendlyBattle.ts).
 * - `tutorial`: a practice that must never cost anything. NO BATTLE IS
 *   ONE TODAY — the tutorial is the How to play pages (tutorial.ts,
 *   TutorialScreen.tsx) and never starts a battle — so the screen never
 *   asks for it. It is here so the day a guided first battle exists, it
 *   has its own words and costs nothing without anybody having to
 *   remember to make it so.
 */
export type BattleMenuKind = 'computer' | 'friend' | 'tutorial';

/** The phases the menu button is on screen in: the countdown and the battle. */
export type BattleMenuPhase = 'arm' | 'go' | 'battle';

/**
 * Whether the menu button (and so the menu) belongs on screen.
 *
 * The same three phases the ↺ was shown in. Not 'matching' — the reveal
 * has its own Cancel, which leaves for free because nobody has been met
 * yet — and not 'timeup' or a result, where the battle is already over
 * and there is nothing left to pause or leave.
 *
 * Also the rule for closing it: the screen shuts the menu the moment the
 * phase leaves these three, which is how a friend winning, or the clock
 * running out, while the menu is open brings the result up rather than
 * leaving it hidden behind a menu for a battle that has ended.
 */
export function menuShowsIn(phase: string): phase is BattleMenuPhase {
  return phase === 'battle' || phase === 'arm' || phase === 'go';
}

/**
 * Whether opening the menu stops the battle.
 *
 * Against the computer it does, exactly as putting the phone in a pocket
 * does: the rival stops rolling and the clock stops with it, and both
 * carry on from the same moment on Resume. Nothing is lost by stopping
 * to turn the music down.
 *
 * A FRIEND BATTLE CANNOT. The other phone keeps playing — the friend's
 * dice, and the server's clock, do not wait for anybody's menu — so a
 * "pause" here would only stop THIS phone's picture of a battle that is
 * still going on. The menu says so instead.
 */
export function pausesBattle(kind: BattleMenuKind): boolean {
  return kind !== 'friend';
}

/** The menu's heading. "Paused" only where it is true. */
export function menuTitle(kind: BattleMenuKind): string {
  return pausesBattle(kind) ? 'Paused' : 'Battle menu';
}

/** The line under the heading, or null. Only a battle that does not stop needs one. */
export function menuNote(kind: BattleMenuKind): string | null {
  return pausesBattle(kind) ? null : 'Your friend is still playing';
}

/**
 * How many trophies a loss right now can cost, or null if none.
 *
 * Worked out from the same band `applyMatchResult` (progress.ts) rolls a
 * loss from, so the warning and the result screen cannot disagree. A
 * loss is a roll inside the band, not a fixed number, so the honest
 * answer is the band — and trophies never go below nought, so somebody
 * holding fewer than the band's top can only lose what they have.
 */
export function trophyCost(
  trophies: number,
  difficulty: AiDifficultyId,
): RewardRange | null {
  const band = TROPHY_STAKES[difficulty].loss;
  const held = Math.max(0, Math.floor(trophies));
  const min = Math.min(band.min, held);
  const max = Math.min(band.max, held);
  if (max <= 0) return null;
  return { min, max };
}

const trophyWord = (n: number) => (n === 1 ? 'trophy' : 'trophies');

/** "You will lose 3 to 8 trophies", "You will lose 2 trophies", or null. */
export function trophyLine(cost: RewardRange | null): string | null {
  if (!cost) return null;
  if (cost.min === cost.max) return `You will lose ${cost.max} ${trophyWord(cost.max)}`;
  return `You will lose ${cost.min} to ${cost.max} trophies`;
}

/** A cup run a loss right now would end. */
export interface BrokenRun {
  name: string;
  streak: number;
}

/**
 * The cup runs a loss in this battle would reset.
 *
 * Asked of `scoreBattle` itself, the very function finishRound scores a
 * battle with, by offering it this battle as a loss and seeing which runs
 * move. So the rule about which cups count (the mode and difficulty must
 * match; a run of nought has nothing to break) is the cups' own, and the
 * warning names exactly the runs the real loss ends. `cups` is the list
 * finishRound scores against — the ones the Cups tab shows as running.
 */
export function runsALossEnds(
  cups: TournamentDef[],
  states: Record<string, TournamentState>,
  battle: { mode: ModeId; difficulty: AiDifficultyId },
): BrokenRun[] {
  const scored = scoreBattle(cups, states, { ...battle, outcome: 'lost' });
  return cups
    .filter((cup) => scored.changed[cup.id] !== undefined)
    .map((cup) => ({ name: cup.name, streak: states[cup.id]?.streak ?? 0 }));
}

/** "your run of 3 in The Gauntlet ends", or both cups at once. */
function runWords(runs: BrokenRun[]): string | null {
  if (runs.length === 0) return null;
  if (runs.length === 1) {
    const [run] = runs;
    return `your run of ${run.streak} in ${run.name} ends`;
  }
  return 'your cup runs end';
}

export interface LeaveContext {
  kind: BattleMenuKind;
  /** Trophies held now (computer battles). */
  trophies?: number;
  difficulty?: AiDifficultyId;
  /** Cup runs a loss would end — `runsALossEnds`. */
  runs?: BrokenRun[];
  /** The friend's name (friend battles). */
  friendName?: string;
}

export interface LeaveWords {
  title: string;
  /** The sentences under the title, each a line of its own. */
  lines: string[];
  /** The safe answer. The big button, where a thumb lands by habit. */
  stayLabel: string;
  /** The answer that leaves, naming what it costs. */
  leaveLabel: string;
}

/**
 * What "Leave battle" asks before anything happens.
 *
 * Asked INSIDE the panel, not with the phone's own Alert box — the same
 * reason src/ui/Confirm.tsx gives: everything in this game is a piece of
 * card, and the grey system box would be the one surface that is not.
 * The safe answer is the big button; the one that costs something is the
 * quiet one under it, the same arrangement Confirm uses.
 */
export function leaveWords(ctx: LeaveContext): LeaveWords {
  if (ctx.kind === 'tutorial') {
    return {
      title: 'Leave the tutorial?',
      lines: [],
      stayLabel: 'Keep playing',
      leaveLabel: 'Leave',
    };
  }
  if (ctx.kind === 'friend') {
    const who = ctx.friendName?.trim() || 'Your friend';
    return {
      title: 'Leave the battle?',
      // Not "counts as a loss" on its own: a friendly moves no trophies
      // (finishRound), so the thing that actually happens is that the
      // friend is told they won — and that is what is said.
      lines: [`Leaving gives ${who} the win.`, 'Friendly battles never move trophies.'],
      stayLabel: 'Keep playing',
      leaveLabel: `Leave (${who} wins)`,
    };
  }
  const lines = ['Leaving now counts as a loss.'];
  const trophies = trophyLine(
    ctx.difficulty ? trophyCost(ctx.trophies ?? 0, ctx.difficulty) : null,
  );
  const runs = runWords(ctx.runs ?? []);
  if (trophies && runs) lines.push(`${trophies}, and ${runs}.`);
  else if (trophies) lines.push(`${trophies}.`);
  else if (runs) lines.push(`${runs.charAt(0).toUpperCase()}${runs.slice(1)}.`);
  return {
    title: 'Leave the battle?',
    lines,
    stayLabel: 'Keep playing',
    leaveLabel: 'Leave (counts as a loss)',
  };
}

/**
 * The small print at the foot of the menu: where you are. "Color Rush ·
 * Easy" against the computer, "Color Rush · with Sam" with a friend. The
 * clock beside it is read live by the panel itself.
 */
export function whereLine(
  kind: BattleMenuKind,
  mode: ModeId,
  difficulty: AiDifficultyId,
  friendName?: string,
): string {
  const name = MODES[mode].name;
  if (kind === 'friend') return `${name} · with ${friendName?.trim() || 'your friend'}`;
  if (kind === 'tutorial') return `${name} · practice`;
  return `${name} · ${AI_DIFFICULTIES[difficulty].label}`;
}
