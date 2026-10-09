import { createHash, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Proving a request came from the phone that owns a profile.
 *
 * The same check ../app/api/players and ../app/api/friends each carry a
 * copy of, lifted out here when the battle routes would have made a
 * third. Those two are deliberately left alone: they work, they are
 * covered by tests that read their source, and rewriting a working
 * authentication path to tidy it is a poor trade. A third copy was the
 * line worth not crossing.
 *
 * See the long note at the top of api/players for WHY a device secret
 * rather than an account: this game ships to anyone, so a token compiled
 * into the binary is not a secret, and a 4+ game is deliberately avoiding
 * real logins.
 */

const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');

export type Authed = { playerId: string } | { error: string };

export async function authenticatePlayer(
  playerId: unknown,
  secret: unknown,
): Promise<Authed> {
  if (typeof playerId !== 'string' || typeof secret !== 'string' || !playerId || !secret) {
    return { error: 'playerId and secret are required' };
  }
  const { data, error } = await supabaseAdmin()
    .from('player_profiles')
    .select('secret_hash')
    .eq('player_id', playerId)
    .maybeSingle();
  // A read that FAILED is not a player who does not exist — the same
  // distinction api/players had to learn.
  if (error) return { error: 'could not reach the database' };
  if (!data) return { error: 'no such player' };
  const a = Buffer.from(hash(secret));
  const b = Buffer.from(data.secret_hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { error: 'wrong secret' };
  return { playerId };
}

/**
 * "This phone is awake and in the app, right now."
 *
 * David asked for challenges to be live only, which needs an answer to
 * "is this person on?" — and without a socket the honest answer is "they
 * spoke to us a moment ago". Every authenticated call stamps this, and
 * the friends screen makes one every few seconds while it is open, so
 * the stamp is fresh exactly while somebody is looking at their phone.
 *
 * Never awaited by a caller that would be delayed by it, and never able
 * to fail a request: presence being a little stale is not worth a
 * refused call.
 */
export function touchSeen(playerId: string): void {
  void supabaseAdmin()
    .from('player_profiles')
    .update({ last_seen: new Date().toISOString() })
    .eq('player_id', playerId)
    .then(
      () => undefined,
      () => undefined,
    );
}

/** How long after their last word somebody still counts as on. */
export const ONLINE_WINDOW_MS = 30_000;

export function isOnline(lastSeen: string | null | undefined): boolean {
  if (!lastSeen) return false;
  const t = new Date(lastSeen).getTime();
  return Number.isFinite(t) && Date.now() - t < ONLINE_WINDOW_MS;
}
