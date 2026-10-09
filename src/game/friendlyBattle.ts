import type { ModeId } from './modes';
import type { AiDifficultyId } from './ai';

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
  who: { playerId: string; name: string; trophies: number } | null;
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
