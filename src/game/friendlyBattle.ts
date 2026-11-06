import type { ModeId } from './modes';
import type { AiDifficultyId } from './ai';
import { PRISONER_COLORS } from './colors';
import { dotsAt } from './matchmaking';

/**
 * Battling a friend, live — the rules, with no React and no network.
 *
 * David, 11 Sep 2026: "add the ability to play someone on your friends
 * list in a trophyless friendly battle... you challenge someone who's on
 * right now. It should be live only."
 *
 * LIVE ONLY, and that is the design rather than an apology. A challenge
 * is not a message waiting in an inbox: it is sent to somebody whose
 * phone spoke to the server seconds ago, and it expires on its own if
 * they do not answer while they are looking at it. A battle both people
 * have to be present for cannot be arranged an hour in advance.
 *
 * TROPHYLESS, as asked. Nothing is won and nothing is lost — which is
 * also what makes it safe for the first phone to say "I finished" to be
 * believed (see the note in the live route on the server).
 */

/**
 * WHICH MODES CAN HONESTLY BE PLAYED AGAINST A REAL PERSON.
 *
 * Not a shortlist of favourites — a statement about what the game's own
 * rules make possible over a connection, and the reason the other two
 * are missing is worth writing down rather than leaving as a gap
 * somebody rediscovers.
 *
 * Color Rush and Ultimate are INDEPENDENT RACES. Each player works
 * through their own set of six, and the only thing either needs to see
 * of the other is how far along they are. Sending "these are the colours
 * I have freed" is therefore the complete truth about the game, and two
 * phones a second apart still agree about everything that matters.
 *
 * Skirmish shares ONE jail: both players reach into the same set of
 * prisoners, so the two phones would have to agree about who got which
 * one, in order, and a second of lag means both can free the same
 * prisoner. Color War puts both players' prisoners on ONE board, where
 * the opponent's three are physical figures whose positions are part of
 * the round rather than a number.
 *
 * Either could be done — with the server holding the board and handing
 * out prisoners — and neither can be done by exchanging a list of
 * colours. Offering them by pretending otherwise would mean two children
 * watching two different games and disagreeing about who won, which is
 * worse than not offering them.
 */
export const FRIENDLY_MODES: ModeId[] = ['classic', 'ultimate'];

/** Why a mode is missing, in words a person can be told. */
export const MODE_NOT_READY: Partial<Record<ModeId, string>> = {
  skirmish: 'Skirmish shares one jail, so it needs both phones to agree who grabbed which prisoner.',
  colorwar: 'Color War puts both sets of prisoners on one board, so it needs more than a score to stay in step.',
};

export function canBattleFriend(mode: ModeId): boolean {
  return FRIENDLY_MODES.includes(mode);
}

/** How long a challenge lives, matching the server's own TTL. */
export const INVITE_TTL_MS = 45_000;

/** How long the popup sits on screen before sliding away by itself. */
export const POPUP_MS = 6_000;

/** How often the game asks whether anybody has challenged it. */
export const CHALLENGE_POLL_MS = 5_000;

/** How often each phone tells the other where it has got to. */
export const BATTLE_SYNC_MS = 1_000;

/**
 * HOW A FRIENDLY BATTLE STARTS, since 1 Nov 2026.
 *
 * David: "Fix the versus against friends because it doesn't connect and
 * it's not actually against each other." Until then the accepter's phone
 * started racing the moment they tapped Accept, while the challenger's
 * phone only found out on its next five-second poll — so one child was
 * rolling for up to eight seconds before the other had seen "BATTLE!",
 * and the clock had already run down for both.
 *
 * Now a battle row is born `waiting`. Each phone's first beat on
 * /api/battles/live says "I am here"; the beat that finds the OTHER
 * phone already there turns the row `playing`, restarts the clock, and
 * answers `started: true`. Both phones hold at "Waiting for Marc…" until
 * they hear that, then count down together — the same one-and-a-bit
 * seconds apart as any two polls, instead of up to eight.
 */

/** How long the first phone waits in the room before giving up on the other. */
export const JOIN_WAIT_MS = 30_000;

/**
 * While MY challenge is out, or I have just accepted one, the answer can
 * change any second — so ask that often. The ordinary five-second poll is
 * for a home screen where nothing is expected.
 */
export const OUTGOING_POLL_MS = 1_500;

/**
 * THE WAITING ROOM, in words. David, 1 Nov 2026: "Fix the versus against
 * friends because it doesn't connect and it's not actually against each
 * other."
 *
 * Both phones sit on the friend's own name, not a bot's, until the
 * server says the other one has arrived (`started` on the beat). Then
 * "MARC IS HERE!" for a moment, and both count down together.
 */
export type JoinState = 'waiting' | 'here';

/** How long "MARC IS HERE!" stays up before the countdown. */
export const HERE_MS = 1_000;

/**
 * How much longer than the server this phone waits before giving up by
 * itself. The server closes a room nobody joined after JOIN_WAIT_MS and
 * says so on the next beat; this is only for a phone whose beats have
 * stopped getting through, which would otherwise wait for ever.
 */
export const JOIN_SAFETY_MS = 5_000;

/** The line under the friend's card while waiting, then when they arrive. */
export function joinLine(name: string, state: JoinState, elapsedMs: number): string {
  if (state === 'here') return `${name.toUpperCase()} IS HERE!`;
  return `Waiting for ${name}${dotsAt(elapsedMs)}`;
}

/** Said on the way back to the menu when the friend never came. */
export function noShowLine(name: string): string {
  return `${name} didn't make it`;
}

/** Has this phone waited longer than the server ever would? */
export function localWaitOver(waitingSince: number, now: number = Date.now()): boolean {
  if (!Number.isFinite(waitingSince) || waitingSince <= 0) return false;
  return now - waitingSince >= JOIN_WAIT_MS + JOIN_SAFETY_MS;
}

/** How far through the server's wait we are, 0 to 1, for the bar. */
export function joinProgress(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(1, elapsedMs / JOIN_WAIT_MS);
}

/**
 * WHO IS ON, for the Friends list. `online` is missing from a server
 * that predates it, which is "unknown" and shows nothing — never "off",
 * because saying somebody is away when nobody asked is a lie.
 */
export function presenceOf(online: boolean | undefined): 'on' | 'off' | null {
  if (online === true) return 'on';
  if (online === false) return 'off';
  return null;
}

export const PRESENCE_TEXT = { on: 'On now', off: 'Not playing right now' } as const;

/** Colours in `after` that were not in `before` — compared by content. */
export function coloursAdded(before: readonly string[], after: readonly string[]): string[] {
  return after.filter((c) => !before.includes(c));
}

/** The same set, in any order? */
export function sameColours(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && coloursAdded(a, b).length === 0;
}

const labelOf = (id: string): string =>
  PRISONER_COLORS.find((c) => c.id === id)?.label ?? 'a colour';

/**
 * WHAT TO SAY WHEN THE FRIEND MOVES, so a person is felt as much as a bot.
 *
 * Until 1 Nov 2026 a friend's rescue only moved a dot: none of the
 * computer rival's ping, flash or "Marc freed Red!" fired, and the other
 * player seemed not to be there. These are the AI path's own lines
 * (DiceDemoScreen's roll timer), by the friend's name.
 *
 * Compared by CONTENT, not by count: in Ultimate one colour can be
 * captured back and another freed between two beats, which leaves the
 * count the same and is still two things that happened. A gain is
 * reported before a loss, since it is the one the player has to answer.
 *
 * `mine` is my own count right now and `total` the colours in the race.
 * Null when there is nothing to say — including the friend's last
 * colour, because the server's verdict is about to say it for us.
 */
export function rivalProgressCallout(
  name: string,
  before: readonly string[],
  after: readonly string[],
  mine: number,
  total: number,
): { text: string; kind: 'lookout' | 'hurry' | null } | null {
  const added = coloursAdded(before, after);
  if (added.length > 0) {
    const label = labelOf(added[added.length - 1]);
    const theirs = after.length;
    if (theirs >= total) return null;
    if (theirs === total - 1) return { text: `${name} needs only ONE more — hurry!`, kind: 'hurry' };
    if (theirs === mine && mine > 0) return { text: `${name} ties it up ${theirs}–${mine}!`, kind: 'lookout' };
    if (theirs === mine + 1) {
      return { text: `${name} freed ${label} — you're falling behind!`, kind: 'lookout' };
    }
    return { text: `${name} freed ${label}!`, kind: 'lookout' };
  }
  const removed = coloursAdded(after, before);
  if (removed.length > 0) {
    // No voice cue: the computer rival's capture has none either, and
    // "Look out!" over good news for this player would be the wrong word.
    return { text: `Ha! ${name}'s ${labelOf(removed[removed.length - 1])} was captured again!`, kind: null };
  }
  return null;
}


/**
 * Seconds left on a challenge, never negative and never a fraction.
 *
 * Shown counting down on the popup, because a challenge that is about to
 * vanish should look like one: a button that quietly stops working is
 * worse than a number running out.
 */
export function secondsLeft(expiresAt: number, now: number = Date.now()): number {
  if (!Number.isFinite(expiresAt)) return 0;
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

export function hasExpired(expiresAt: number, now: number = Date.now()): boolean {
  return secondsLeft(expiresAt, now) <= 0;
}

export interface Challenge {
  id: string;
  mode: ModeId;
  difficulty: AiDifficultyId;
  expiresAt: number;
  /**
   * `online` is whether their phone spoke to the server lately, as the
   * Friends list has it (presenceOf): missing from a server that
   * predates it, which is "unknown", never "off".
   */
  who: { playerId: string; name: string; trophies: number; online?: boolean } | null;
  /**
   * The finished battle this invite asks to play again (rematch.ts), or
   * null for an ordinary challenge. Missing from an older server.
   */
  rematchOf?: string | null;
}

/**
 * The one challenge worth showing, out of however many arrived.
 *
 * Newest first — an older challenge from somebody who has given up
 * looking is the less useful of the two, and stacking popups on a
 * five-year-old's screen is not a design.
 */
export function topChallenge(
  list: Challenge[],
  now: number = Date.now(),
): Challenge | null {
  const live = list.filter((c) => !hasExpired(c.expiresAt, now));
  if (live.length === 0) return null;
  return live.reduce((best, c) => (c.expiresAt > best.expiresAt ? c : best));
}
