import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { authenticatePlayer } from '@/lib/playerAuth';

/**
 * Where to send "there's a new update" — one phone telling us its
 * address.
 *
 * David, 25 Sep 2026: "make push notifications for when there's a new
 * update."
 *
 * Called by the game once it has asked iOS for permission and been
 * given an Expo push token. Authenticated with the same device secret
 * every other write from the app uses (see lib/playerAuth): without it
 * anybody could fill this table with tokens belonging to other people's
 * phones, and every future announcement would go to strangers.
 *
 * AN EXPO PUSH TOKEN IS AN ADDRESS, not an identity. It is issued by
 * Expo, it routes to one install of one app, and it is useless for
 * anything but sending that install a notification. It is deliberately
 * not joined to anything else here, and nothing in this game ever sends
 * to one player rather than another — the only message that exists is
 * "a new version is out", to everybody at once.
 */

export const dynamic = 'force-dynamic';

/** Exactly the shape Expo issues. Anything else is not a push address. */
const EXPO_TOKEN = /^ExponentPushToken\[[A-Za-z0-9._-]{1,128}\]$/;

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'expected JSON' }, { status: 400 });
  }

  const auth = await authenticatePlayer(body.playerId, body.secret);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!EXPO_TOKEN.test(token)) {
    return NextResponse.json({ error: 'not a push token' }, { status: 400 });
  }
  const platform = body.platform === 'android' ? 'android' : 'ios';
  const version = typeof body.version === 'string' ? body.version.slice(0, 20) : '';

  /*
    UPSERT ON THE TOKEN, which is the primary key.

    The game re-registers on every launch — cheap, and the only way to
    notice a token that iOS has rotated. Keying on the token means that
    is an update rather than a pile of duplicates, and it means a device
    that changes hands simply overwrites its own row.
  */
  const { error } = await supabaseAdmin()
    .from('push_tokens')
    .upsert(
      { token, player_id: auth.playerId, platform, version, updated_at: new Date().toISOString() },
      { onConflict: 'token' },
    );

  if (error) {
    return NextResponse.json({ error: 'could not save' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * Stop sending to this device.
 *
 * Turning notifications off in the phone's own Settings is silent — iOS
 * does not tell the server — so the game calls this when it finds
 * permission has gone, and a person who wants out has a way out that
 * actually reaches us.
 */
export async function DELETE(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'expected JSON' }, { status: 400 });
  }
  const auth = await authenticatePlayer(body.playerId, body.secret);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!EXPO_TOKEN.test(token)) {
    return NextResponse.json({ error: 'not a push token' }, { status: 400 });
  }
  // Scoped to the authenticated player, so one device cannot unsubscribe
  // another.
  await supabaseAdmin()
    .from('push_tokens')
    .delete()
    .eq('token', token)
    .eq('player_id', auth.playerId);
  return NextResponse.json({ ok: true });
}
