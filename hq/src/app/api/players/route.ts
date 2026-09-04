import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Profiles and friends, as seen from the GAME.
 *
 * Unlike every other endpoint here, this one is called by an app anyone
 * can download, so it cannot be protected by a shared token — a secret
 * compiled into a public binary is not a secret. It authenticates each
 * DEVICE instead: the game makes a random secret on first run, keeps it
 * on the device, and sends it with every write. Only its SHA-256 is
 * stored, so the database never holds anything that could be replayed.
 *
 * WHAT THIS IS AND IS NOT. It stops one player editing another's
 * profile or answering their friend requests, which is the thing that
 * would actually spoil the feature. It does not stop somebody who has
 * pulled the app apart from making unlimited profiles of their own —
 * nothing short of real accounts would, and real accounts are exactly
 * what a 4+ game is avoiding. Nothing here is worth stealing: the whole
 * database is trophy counts and how many dice sets somebody owns.
 *
 * The device secret is also the upgrade path. When accounts arrive, a
 * profile already has a credential; it just becomes one a person knows.
 */

export const dynamic = 'force-dynamic';

const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');

function sameSecret(supplied: string, storedHash: string): boolean {
  const a = Buffer.from(hash(supplied));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

const FRIEND_CODE = /^[0-9A-HJKMNP-TV-Z]{8}$/;

/** Only these fields, and only of these shapes, are ever written. */
function cleanProfile(body: Record<string, unknown>) {
  const int = (v: unknown, cap: number) =>
    Math.max(0, Math.min(cap, Math.floor(Number(v) || 0)));
  const id = (v: unknown) =>
    typeof v === 'string' && /^[a-z0-9_-]{1,40}$/i.test(v) ? v : null;
  return {
    trophies: int(body.trophies, 10_000_000),
    wins: typeof body.wins === 'object' && body.wins ? body.wins : {},
    mode_wins: typeof body.modeWins === 'object' && body.modeWins ? body.modeWins : {},
    dice_owned: int(body.diceOwned, 10_000),
    arenas_owned: int(body.arenasOwned, 10_000),
    favourite_die: id(body.favouriteDie) ?? 'ivory',
    favourite_arena: id(body.favouriteArena) ?? 'castle',
    last_played: new Date().toISOString(),
  };
}

/**
 * The name is Game Center's alias, so it is already moderated by Apple.
 * Trimmed and capped anyway: a caller is not the app just because it
 * says it is.
 */
function cleanName(value: unknown): string {
  if (typeof value !== 'string') return 'New Player';
  const trimmed = value.replace(/\s+/g, ' ').trim().slice(0, 24);
  return trimmed.length > 0 ? trimmed : 'New Player';
}

async function authenticate(body: Record<string, unknown>) {
  const playerId = typeof body.playerId === 'string' ? body.playerId : '';
  const secret = typeof body.secret === 'string' ? body.secret : '';
  if (!playerId || !secret) return { error: 'playerId and secret are required' };

  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from('player_profiles')
    .select('player_id, secret_hash')
    .eq('player_id', playerId)
    .maybeSingle();

  if (!data) return { playerId, secret, isNew: true as const };
  if (!sameSecret(secret, data.secret_hash)) return { error: 'wrong secret' };
  return { playerId, secret, isNew: false as const };
}

/** GET ?code=K7M29XPQ — find somebody, or ?playerId=… — read your own. */
export async function GET(request: NextRequest) {
  const supabase = supabaseAdmin();
  const code = request.nextUrl.searchParams.get('code');

  if (code) {
    if (!FRIEND_CODE.test(code)) {
      return NextResponse.json({ error: 'not a friend code' }, { status: 400 });
    }
    // A stranger gets a name and a trophy count. Never the collection,
    // and never the friend code — handing that back would let anyone
    // who searched you add you without being told it.
    const { data } = await supabase
      .from('player_profiles')
      .select('player_id, name, trophies')
      .eq('friend_code', code)
      .maybeSingle();
    if (!data) return NextResponse.json({ found: false });
    return NextResponse.json({
      found: true,
      profile: { playerId: data.player_id, name: data.name, trophies: data.trophies },
    });
  }

  return NextResponse.json({ error: 'pass a code' }, { status: 400 });
}

/**
 * POST — create or update your own profile.
 *
 * The first call for a player_id claims it and sets the secret. Every
 * later one has to prove it holds that secret.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'not JSON' }, { status: 400 });
  }

  const auth = await authenticate(body);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const fields = cleanProfile(body);

  if (auth.isNew) {
    const friendCode =
      typeof body.friendCode === 'string' && FRIEND_CODE.test(body.friendCode)
        ? body.friendCode
        : null;
    if (!friendCode) {
      return NextResponse.json({ error: 'a valid friendCode is required' }, { status: 400 });
    }
    const { error } = await supabase.from('player_profiles').insert({
      player_id: auth.playerId,
      name: cleanName(body.name),
      friend_code: friendCode,
      secret_hash: hash(auth.secret),
      ...fields,
    });
    if (error) {
      // A duplicate friend code is the one collision worth naming, so
      // the game can draw a new one rather than guess at the failure.
      const taken = error.code === '23505' && error.message.includes('friend_code');
      return NextResponse.json(
        { error: taken ? 'friend code taken' : error.message },
        { status: taken ? 409 : 500 },
      );
    }
    return NextResponse.json({ ok: true, created: true });
  }

  const { error } = await supabase
    .from('player_profiles')
    .update({ name: cleanName(body.name), ...fields })
    .eq('player_id', auth.playerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, created: false });
}

