import type { FriendAction, PublicProfile } from './friends';
import type { Identity } from './playerIdentity';

/**
 * Talking to the friends server.
 *
 * THE RULE, the same one gameCenter.ts and ads.ts follow: nothing here
 * may throw or reject. A player on a plane, on a bad train connection,
 * or on a day the site is down must see a friends screen that says so —
 * never a crash, and never a spinner that spins for ever.
 *
 * Every call therefore returns a result object rather than throwing, and
 * every one has a timeout: a fetch with no timeout on a captive-portal
 * wifi hangs until the app is killed, which is worse than an error.
 */

const BASE = 'https://dice-battles-hq.vercel.app/api';

/** Long enough for a slow phone, short enough not to feel broken. */
const TIMEOUT_MS = 8000;

export type ProfilePeek = Pick<PublicProfile, 'playerId' | 'name' | 'trophies'>;

export interface FriendRequest extends ProfilePeek {
  /** True when THEY asked ME — the ones with buttons to press. */
  incoming: boolean;
}

export interface FriendList {
  friends: PublicProfile[];
  requests: FriendRequest[];
  blocked: ProfilePeek[];
}

export const EMPTY_LIST: FriendList = { friends: [], requests: [], blocked: [] };

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
    // Offline, timed out, DNS gone, or an answer that was not JSON.
    // They are the same thing to a player, so they read the same.
    return { ok: false, error: 'No connection' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Push my own profile up. Called after a battle, and on opening the
 * friends screen.
 *
 * The friend code goes only on the FIRST call, which is the one that
 * claims the player id; afterwards the server ignores it. Sending my
 * secret is what proves this phone owns that id.
 */
export async function pushProfile(
  me: Identity,
  stats: Omit<PublicProfile, 'playerId' | 'name' | 'friendCode' | 'lastPlayed'>,
): Promise<boolean> {
  const result = await call<{ ok: boolean }>('/players', {
    method: 'POST',
    body: JSON.stringify({
      playerId: me.playerId,
      secret: me.secret,
      friendCode: me.friendCode,
      name: me.name,
      ...stats,
    }),
  });
  return result.ok;
}

/** Look somebody up by the code they gave you. */
export async function findByCode(
  code: string,
): Promise<{ ok: true; profile: ProfilePeek | null } | { ok: false; error: string }> {
  const result = await call<{ found: boolean; profile?: ProfilePeek }>(
    `/players?code=${encodeURIComponent(code)}`,
  );
  if (!result.ok) return result;
  return { ok: true, profile: result.data.found ? result.data.profile ?? null : null };
}

/** Everyone I am connected to, and how. */
export async function fetchFriends(
  me: Identity,
): Promise<{ ok: true; list: FriendList } | { ok: false; error: string }> {
  const result = await call<FriendList>(
    `/friends?playerId=${encodeURIComponent(me.playerId)}&secret=${encodeURIComponent(me.secret)}`,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    list: {
      friends: result.data.friends ?? [],
      requests: result.data.requests ?? [],
      blocked: result.data.blocked ?? [],
    },
  };
}

/**
 * Make a move — ask, accept, decline, remove, block.
 *
 * The server decides, not the app: this game is on somebody else's
 * phone and can be edited, so the copy of the rules in friends.ts is
 * only there to grey out a button before the round trip.
 */
export async function actOnFriend(
  me: Identity,
  otherId: string,
  action: FriendAction,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await call<{ ok: boolean }>('/friends', {
    method: 'POST',
    body: JSON.stringify({
      playerId: me.playerId,
      secret: me.secret,
      otherId,
      action,
    }),
  });
  return result.ok ? { ok: true } : result;
}
