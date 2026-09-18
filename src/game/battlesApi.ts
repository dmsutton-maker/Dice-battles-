import type { Identity } from './playerIdentity';
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
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const controller =
    typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller?.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const message = typeof body?.error === 'string' ? body.error : 'that did not work';
      return { ok: false, error: message };
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
  const result = await call<BattlePulse>('/battles/live', {
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
  };
}
