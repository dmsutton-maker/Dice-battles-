import { ModeId } from './modes';
import { AiDifficultyId } from './ai';

/**
 * Friends, and what a friend is allowed to see.
 *
 * David asked on 3 Sep 2026 for accounts, friends and profiles. The
 * account half is deliberately NOT built: this game is rated 4+ and
 * AGENTS.md says it collects nothing, and both of those stay true only
 * while there is no sign-up, no email and no password. Identity comes
 * from Game Center instead — Apple already holds it, already has the
 * parent's consent, and already offers the parental controls a
 * five-year-old's account would otherwise need us to invent.
 *
 * David chose "Game Center now, accounts later", so everything here is
 * keyed by an opaque `playerId` string rather than by anything Apple
 * specific. Swapping the source of that id for a real account later is a
 * change in ONE file (playerIdentity.ts) and none of this.
 */

/** What a player is called and how to find them. Never an email. */
export interface PublicProfile {
  /** Opaque and stable. Game Center's player id today. */
  playerId: string;
  /** Game Center's alias — chosen by the player, moderated by Apple. */
  name: string;
  /** Eight characters, shared to be added as a friend. */
  friendCode: string;
  trophies: number;
  /** Lifetime wins, by the difficulty they were won against. */
  wins: Record<AiDifficultyId, number>;
  /** Lifetime wins, by game mode. */
  modeWins: Record<ModeId, number>;
  /** How many dice sets and arenas they have unlocked. Counts, not lists. */
  diceOwned: number;
  arenasOwned: number;
  /** The die and arena they are using, so a profile looks like a person. */
  favouriteDie: string;
  favouriteArena: string;
  /** Epoch millis, for "last played" — never a precise location or time zone. */
  lastPlayed: number;
}

/**
 * WHAT IS DELIBERATELY NOT ON A PROFILE.
 *
 * No email, no real name, no age, no country, no device, no coin
 * balance, and no free-text anything. The first six are personal data
 * this game has no business holding; the last one is the important one
 * for a game children play — a profile with a bio or a status message is
 * a chat system with extra steps, and moderating it is a full-time job
 * nobody here has. Everything above is a number the game already knows
 * or a name Apple already moderates.
 */
export const PROFILE_HAS_NO_FREE_TEXT = true;

/**
 * How two players stand, from the point of view of the person asking.
 *
 * `blocked` is one-way and deliberately terminal: the blocked player is
 * told nothing, sees no change, and cannot send another request. Making
 * it visible would turn a quiet exit into a confrontation, which is the
 * opposite of what a block is for.
 */
export type FriendState =
  | 'none'
  | 'requested'   // I asked them
  | 'pending'     // they asked me
  | 'friends'
  | 'blocked';

export interface Friendship {
  playerId: string;
  state: FriendState;
  /** Epoch millis the state last changed. */
  since: number;
}

/** Every move either player can make, and nothing else. */
export type FriendAction =
  | 'request'
  | 'accept'
  | 'decline'
  | 'cancel'
  | 'remove'
  | 'block'
  | 'unblock';

/**
 * The state machine, written out rather than implied by ifs.
 *
 * A missing entry means the move is not allowed FROM that state, which
 * is how accepting a request you never received, or requesting someone
 * who already blocked you, become impossible rather than merely unlikely.
 */
const MOVES: Record<FriendState, Partial<Record<FriendAction, FriendState>>> = {
  none: { request: 'requested', block: 'blocked' },
  requested: { cancel: 'none', block: 'blocked' },
  pending: { accept: 'friends', decline: 'none', block: 'blocked' },
  friends: { remove: 'none', block: 'blocked' },
  // Only unblocking gets you out, and it returns to strangers rather
  // than to whatever you were before — a block should not remember a
  // friendship it ended.
  blocked: { unblock: 'none' },
};

export function canDo(state: FriendState, action: FriendAction): boolean {
  return MOVES[state]?.[action] !== undefined;
}

/** The new state, or the old one unchanged if the move is not allowed. */
export function applyFriendAction(
  state: FriendState,
  action: FriendAction,
): FriendState {
  return MOVES[state]?.[action] ?? state;
}

/**
 * Whether `viewer` may see `subject`'s full profile.
 *
 * Strangers get a name and nothing else, which is the whole reason a
 * friend request exists. This is the single place that decides, so a new
 * screen cannot accidentally show more by rendering a field it happens
 * to have been handed.
 */
export function mayViewProfile(state: FriendState): boolean {
  return state === 'friends';
}

/** The little a stranger sees: enough to know they found the right person. */
export type ProfilePeek = Pick<PublicProfile, 'playerId' | 'name' | 'trophies'>;

export function peek(profile: PublicProfile): ProfilePeek {
  return {
    playerId: profile.playerId,
    name: profile.name,
    trophies: profile.trophies,
  };
}

/**
 * What a screen should show, given who is asking.
 *
 * Returns the full profile only for a friend, and the peek otherwise —
 * so passing a whole profile to a stranger's screen is not a mistake
 * that can be made by forgetting a check somewhere.
 */
export function visibleProfile(
  profile: PublicProfile,
  state: FriendState,
): PublicProfile | ProfilePeek {
  return mayViewProfile(state) ? profile : peek(profile);
}

/**
 * How many friends one player may have.
 *
 * Not a technical limit — it is a cap on how far this can grow before
 * anyone has thought about what a hundred friends does to a five-year
 * old's screen, or to the size of one request to the server.
 */
export const MAX_FRIENDS = 100;

export function atFriendLimit(count: number): boolean {
  return count >= MAX_FRIENDS;
}
