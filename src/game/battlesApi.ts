import type { Identity } from './playerIdentity';
import { stripEmojiDeep } from './noEmoji';
import type { ModeId } from './modes';
import type { AiDifficultyId } from './ai';
import type { Challenge } from './friendlyBattle';

/**
 * Talking to the friendly-battle server.
 *
 * THE RULE, the same one friendsApi.ts, gameCenter.ts and ads.ts follow:
 * nothing here may throw, reject, or block. A dropped connection in the
 * middle of a battle must show a player that their friend has gone
 * quiet, never a crash and never a spinner that spins for ever.
 */

const BASE = 'https://dice-battles-hq.vercel.app/api';

/**
 * Shorter than the friends screen's eight seconds, deliberately.
 *
 * Everything here is about what is happening RIGHT NOW — a challenge
 * that expires in forty-five seconds, a rival's score a second old. An
 * answer that takes eight seconds to arrive is not late, it is wrong.
 */
const TIMEOUT_MS = 5000;

async function call<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  const controller =
    typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller?.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    // The opponent's name is a Game Center nickname — no emoji reaches a screen.
    const body = stripEmojiDeep((await response.json()) as Record<string, unknown>);
    if (!response.ok) {
      const message = typeof body?.error === 'string' ? body.error : 'that did not work';
      return { ok: false, error: message, status: response.status };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: 'No connection' };
  } finally {
    clearTimeout(timer);
  }
}

export interface BattleHandle {
  id: string;
  mode: ModeId;
  difficulty: AiDifficultyId;
  opponentId?: string;
  /** Their name, so the scoreboard is not two player ids. */
  opponentName?: string;
}

export interface ChallengeState {
  incoming: Challenge[];
  outgoing: (Challenge & { who: Challenge['who'] }) | null;
  battle: BattleHandle | null;
}

const EMPTY: ChallengeState = { incoming: [], outgoing: null, battle: null };

/**
 * Is this the challenge state the screen already has?
 *
 * The home screen asks every few seconds, and nearly every answer is the
 * same as the last one. Handing React an identical-looking NEW object
 * re-renders the whole game screen and its 3D scene, so the poll only
 * sets state when this says something moved. Compared by what the player
 * can see or act on: which challenges exist, who from, what they ask for,
 * when they run out, and whether a battle is waiting.
 */
export function sameChallenges(a: ChallengeState, b: ChallengeState): boolean {
  const one = (c: Challenge) =>
    [c.id, c.mode, c.difficulty, c.expiresAt, c.who?.playerId ?? null, c.who?.name ?? null, c.who?.trophies ?? null];
  const key = (s: ChallengeState) =>
    JSON.stringify([
      s.incoming.map(one),
      s.outgoing ? one(s.outgoing) : null,
      s.battle
        ? [s.battle.id, s.battle.mode, s.battle.difficulty, s.battle.opponentId ?? null, s.battle.opponentName ?? null]
        : null,
    ]);
  return key(a) === key(b);
}

type RawChallenge = {
  id: string;
  mode: ModeId;
  difficulty: AiDifficultyId;
  expiresAt: number;
  from?: Challenge['who'];
  to?: Challenge['who'];
};

/**
 * Everything the challenge UI needs, in one answer.
 *
 * One call rather than three, because the game asks for this every few
 * seconds and three round trips on a phone is three times the wait and
 * three times the battery.
 *
 * Never returns an error: a challenge screen that cannot reach the
 * server has no challenges, which is both true and the only useful thing
 * to draw.
 */
export async function fetchChallenges(me: Identity): Promise<ChallengeState> {
  const result = await call<{
    incoming: RawChallenge[];
    outgoing: RawChallenge | null;
    battle: BattleHandle | null;
  }>(`/battles?playerId=${encodeURIComponent(me.playerId)}`, {
    headers: { 'x-player-secret': me.secret },
  });
  if (!result.ok) return EMPTY;
  const shape = (raw: RawChallenge): Challenge => ({
    id: raw.id,
    mode: raw.mode,
    difficulty: raw.difficulty,
    expiresAt: raw.expiresAt,
    who: raw.from ?? raw.to ?? null,
  });
  return {
    incoming: (result.data.incoming ?? []).map(shape),
    outgoing: result.data.outgoing ? shape(result.data.outgoing) : null,
    battle: result.data.battle ?? null,
  };
}

/** Ask a friend for a battle. The error is shown to the player as it is. */
export async function sendChallenge(
  me: Identity,
  otherId: string,
  mode: ModeId,
  difficulty: AiDifficultyId,
): Promise<{ ok: true; expiresAt: number } | { ok: false; error: string }> {
  const result = await call<{ expiresAt: number }>('/battles', {
    method: 'POST',
    body: JSON.stringify({
      playerId: me.playerId,
      secret: me.secret,
      action: 'challenge',
      otherId,
      mode,
      difficulty,
    }),
  });
  return result.ok ? { ok: true, expiresAt: result.data.expiresAt } : result;
}

export async function answerChallenge(
  me: Identity,
  inviteId: string,
  action: 'accept' | 'decline' | 'cancel',
): Promise<{ ok: true; battle: BattleHandle | null } | { ok: false; error: string }> {
  const result = await call<{ battle?: BattleHandle }>('/battles', {
    method: 'POST',
    body: JSON.stringify({
      playerId: me.playerId,
      secret: me.secret,
      action,
      inviteId,
    }),
  });
  return result.ok ? { ok: true, battle: result.data.battle ?? null } : result;
}

export interface BattlePulse {
  /** Colours the OTHER player has freed. */
  theirs: string[];
  /** The player_id of whoever won, or null while it is still on. */
  winner: string | null;
  over: boolean;
  /** Their phone has stopped talking to the server. */
  theyDropped: boolean;
  /**
   * What is left on the battle clock, by the SERVER's reckoning, or null
   * from a server that predates the clock. The server is the clock in a
   * friendly battle (hq/src/lib/battleClock.ts), so both phones show the
   * same time whatever their own clocks say.
   */
  msLeft: number | null;
  /**
   * Both phones are in the room and the clock is running (the row is
   * `playing` or already `over`). False while the other phone has not
   * yet sent its first beat — the game holds at "Waiting for Marc…"
   * (friendlyBattle.ts, JOIN_WAIT_MS). A server from before this says
   * nothing, which is read as started, so nobody waits for an answer
   * that will never come.
   */
  started: boolean;
}

/**
 * One beat of a live battle: here is my side, give me theirs.
 *
 * `claimWin` is how a phone says "I have finished". Both run the same
 * rules over their own board, so the first honest claim is the winner —
 * see the long note on the server route about why that is a deliberate
 * trade for a battle worth no trophies.
 *
 * On any failure this answers with the LAST thing it was told rather
 * than an error, because a battle must not stop because one beat was
 * missed. Sustained silence shows up as `theyDropped` from the server
 * side instead.
 */
export async function pulseBattle(
  me: Identity,
  battleId: string,
  freed: string[],
  options: { claimWin?: boolean; leave?: boolean } = {},
): Promise<BattlePulse | null> {
  const result = await call<Partial<BattlePulse>>('/battles/live', {
    method: 'POST',
    body: JSON.stringify({
      playerId: me.playerId,
      secret: me.secret,
      battleId,
      freed,
      claimWin: options.claimWin === true,
      leave: options.leave === true,
    }),
  });
  if (!result.ok) return null;
  return {
    theirs: Array.isArray(result.data.theirs) ? result.data.theirs : [],
    winner: result.data.winner ?? null,
    over: result.data.over === true,
    theyDropped: result.data.theyDropped === true,
    msLeft:
      typeof result.data.msLeft === 'number' && Number.isFinite(result.data.msLeft)
        ? result.data.msLeft
        : null,
    started: result.data.started !== false,
  };
}

/**
 * ONLINE MATCHMAKING, the server's half of "find me somebody to play".
 * Marc, 4 Nov 2026: "add the online matchmaking where you now verse real
 * players instead of bots".
 *
 * Every answer is one of these, and nothing else: a failure of any kind
 * — no connection, a timeout, a site from before /api/match that answers
 * a page instead of JSON, a server error — is `off`, which the game reads
 * as "play a rival now", exactly what it did before matchmaking existed.
 * `no-profile` is the server not knowing this phone yet (401); the caller
 * publishes the profile and asks again.
 */
export type MatchAnswer =
  | { kind: 'off' }
  | { kind: 'no-profile' }
  | { kind: 'searching' }
  | { kind: 'left' }
  | { kind: 'matched'; battle: BattleHandle; opponentName: string };

export interface MatchRequest {
  mode: ModeId;
  difficulty: AiDifficultyId;
  trophies: number;
}

type RawMatch = {
  state?: string;
  battle?: Partial<BattleHandle> & { opponentName?: string };
};

function readMatch(
  result: { ok: true; data: RawMatch } | { ok: false; error: string; status?: number },
): MatchAnswer {
  if (!result.ok) return result.status === 401 ? { kind: 'no-profile' } : { kind: 'off' };
  const { state, battle } = result.data ?? {};
  if (state === 'searching') return { kind: 'searching' };
  if (state === 'left') return { kind: 'left' };
  if (state === 'matched' && battle && typeof battle.id === 'string' && battle.mode && battle.difficulty) {
    return {
      kind: 'matched',
      battle: {
        id: battle.id,
        mode: battle.mode,
        difficulty: battle.difficulty,
        opponentId: battle.opponentId,
        opponentName: battle.opponentName,
      },
      opponentName: battle.opponentName ?? '',
    };
  }
  // `off`, and anything this build does not understand.
  return { kind: 'off' };
}

/** Join the queue, or ask again whether it has found somebody. */
export async function searchMatch(me: Identity, request: MatchRequest): Promise<MatchAnswer> {
  const result = await call<RawMatch>('/match', {
    method: 'POST',
    body: JSON.stringify({
      playerId: me.playerId,
      secret: me.secret,
      action: 'search',
      mode: request.mode,
      difficulty: request.difficulty,
      trophies: request.trophies,
    }),
  });
  return readMatch(result);
}

/**
 * Stop looking. The answer can still be `matched`: the server may have
 * paired this phone in the moment before it asked to leave, and then
 * there is a person in a room waiting for it.
 */
export async function leaveMatch(me: Identity): Promise<MatchAnswer> {
  const result = await call<RawMatch>('/match', {
    method: 'POST',
    body: JSON.stringify({ playerId: me.playerId, secret: me.secret, action: 'leave' }),
  });
  return readMatch(result);
}
