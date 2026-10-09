import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { authenticatePlayer, isOnline, touchSeen } from '@/lib/playerAuth';

/**
 * Friendly battles: the challenge, and nothing else.
 *
 * David, 11 Sep 2026: "add the ability to play someone on your friends
 * list in a trophyless friendly battle... you challenge someone who's on
 * right now. It should be live only."
 *
 * LIVE ONLY IS A DESIGN, NOT A LIMITATION WE ARE APOLOGISING FOR. A
 * challenge is not a message that waits in an inbox: it is a row with an
 * expiry a few seconds long, sent to somebody whose phone spoke to this
 * server moments ago. If they do not answer while they are looking at
 * it, it is gone — because a battle both people have to be present for
 * cannot be arranged an hour in advance.
 *
 * WHY THERE IS NO PUSH. The friends API is a handful of serverless
 * functions; nothing here can hold a socket open. Real push
 * notifications would need a native module, an Apple certificate, a
 * permission prompt this 4+ game does not ask for, and a new binary. The
 * game already polls this server every few seconds while the friends
 * panel is open, and a challenge riding along on that poll arrives in
 * about the time it takes to look up.
 *
 * Authentication is the device secret, exactly as everywhere else here —
 * see the note at the top of ../players.
 */

export const dynamic = 'force-dynamic';

/** A challenge nobody answered in this long was never a live battle. */
const INVITE_TTL_MS = 45_000;

/** Modes and difficulties the game actually has. */
const MODES = ['classic', 'ultimate', 'skirmish', 'colorwar'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

type InviteRow = {
  id: string;
  from_id: string;
  to_id: string;
  mode: string;
  difficulty: string;
  state: string;
  expires_at: string;
};

/**
 * Mark anything past its expiry as expired, before answering.
 *
 * Cheaper and far more reliable than a scheduled job: the rows only
 * matter to somebody who is asking about them, and the person asking is
 * the one who would otherwise see a stale challenge.
 */
async function sweep(playerId: string) {
  const now = new Date().toISOString();
  await supabaseAdmin()
    .from('battle_invites')
    .update({ state: 'expired', decided_at: now })
    .eq('state', 'waiting')
    .lt('expires_at', now)
    .or(`from_id.eq.${playerId},to_id.eq.${playerId}`);
}

const peek = (p: Record<string, unknown> | undefined) =>
  p ? { playerId: p.player_id, name: p.name, trophies: p.trophies } : null;

/**
 * GET ?playerId=… with the secret in `x-player-secret`.
 *
 * Everything the challenge UI needs in one answer: who has challenged
 * me, whether my own challenge is still waiting, and whether there is a
 * battle to join. Deliberately one call — the game asks for this on the
 * same few-second beat as its friends list, and two calls would be two
 * round trips on a phone.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const auth = await authenticatePlayer(
    params.get('playerId'),
    request.headers.get('x-player-secret'),
  );
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 });
  touchSeen(auth.playerId);
  await sweep(auth.playerId);

  const supabase = supabaseAdmin();
  const { data: invites } = await supabase
    .from('battle_invites')
    .select('id, from_id, to_id, mode, difficulty, state, expires_at')
    .eq('state', 'waiting')
    .or(`from_id.eq.${auth.playerId},to_id.eq.${auth.playerId}`);

  const rows = (invites ?? []) as InviteRow[];
  const incoming = rows.filter((r) => r.to_id === auth.playerId);
  const outgoing = rows.find((r) => r.from_id === auth.playerId) ?? null;

  // Names for whoever is involved, so the popup can say who is asking.
  const ids = [...new Set(rows.flatMap((r) => [r.from_id, r.to_id]))].filter(
    (id) => id !== auth.playerId,
  );
  const { data: people } = ids.length
    ? await supabase
        .from('player_profiles')
        .select('player_id, name, trophies')
        .in('player_id', ids)
    : { data: [] };
  const byId = new Map((people ?? []).map((p) => [p.player_id, p]));

  // A battle in progress, if there is one. Either side of it.
  const { data: live } = await supabase
    .from('battles')
    .select('id, a_id, b_id, mode, difficulty, state')
    .eq('state', 'playing')
    .or(`a_id.eq.${auth.playerId},b_id.eq.${auth.playerId}`)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  /*
    The opponent's NAME, not just their id.

    Whoever sent the challenge never taps accept — the battle simply
    appears in this answer and they drop into it — so they have nothing
    else to learn the name from, and a scoreboard reading
    "local-f5qt…" against a five-year-old is not a scoreboard.
  */
  let opponentName = 'Your friend';
  if (live) {
    const otherId = live.a_id === auth.playerId ? live.b_id : live.a_id;
    const { data: other } = await supabase
      .from('player_profiles')
      .select('name')
      .eq('player_id', otherId)
      .maybeSingle();
    if (other?.name) opponentName = String(other.name);
  }

  return NextResponse.json({
    incoming: incoming.map((r) => ({
      id: r.id,
      mode: r.mode,
      difficulty: r.difficulty,
      expiresAt: new Date(r.expires_at).getTime(),
      from: peek(byId.get(r.from_id)),
    })),
    outgoing: outgoing
      ? {
          id: outgoing.id,
          mode: outgoing.mode,
          difficulty: outgoing.difficulty,
          expiresAt: new Date(outgoing.expires_at).getTime(),
          to: peek(byId.get(outgoing.to_id)),
        }
      : null,
    battle: live
      ? {
          id: live.id,
          mode: live.mode,
          difficulty: live.difficulty,
          opponentId: live.a_id === auth.playerId ? live.b_id : live.a_id,
          opponentName,
        }
      : null,
  });
}

/** POST { playerId, secret, action, … } */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'not JSON' }, { status: 400 });
  }
  const auth = await authenticatePlayer(body.playerId, body.secret);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 });
  touchSeen(auth.playerId);
  await sweep(auth.playerId);

  const supabase = supabaseAdmin();
  const action = String(body.action);

  if (action === 'challenge') {
    const otherId = typeof body.otherId === 'string' ? body.otherId : '';
    const mode = String(body.mode);
    const difficulty = String(body.difficulty);
    if (!otherId || otherId === auth.playerId) {
      return NextResponse.json({ error: 'who?' }, { status: 400 });
    }
    if (!MODES.includes(mode) || !DIFFICULTIES.includes(difficulty)) {
      return NextResponse.json({ error: 'no such game mode' }, { status: 400 });
    }

    /*
      FRIENDS ONLY. Checked here rather than trusted from the app: a
      challenge is a popup on somebody else's phone, which is exactly the
      kind of thing a modified client would aim at strangers.
    */
    const { data: link } = await supabase
      .from('friendships')
      .select('state')
      .eq('player_id', auth.playerId)
      .eq('other_id', otherId)
      .maybeSingle();
    if (link?.state !== 'friends') {
      return NextResponse.json({ error: 'you can only challenge a friend' }, { status: 403 });
    }

    // And they must be ON. This is the whole premise of the feature.
    const { data: them } = await supabase
      .from('player_profiles')
      .select('last_seen, name')
      .eq('player_id', otherId)
      .maybeSingle();
    if (!isOnline(them?.last_seen)) {
      return NextResponse.json(
        { error: `${them?.name ?? 'They'} is not playing right now` },
        { status: 409 },
      );
    }

    // One outgoing challenge at a time — the unique index enforces it,
    // but replacing the old one is friendlier than refusing the new.
    const now = new Date();
    await supabase
      .from('battle_invites')
      .update({ state: 'cancelled', decided_at: now.toISOString() })
      .eq('from_id', auth.playerId)
      .eq('state', 'waiting');

    const { data: made, error } = await supabase
      .from('battle_invites')
      .insert({
        from_id: auth.playerId,
        to_id: otherId,
        mode,
        difficulty,
        expires_at: new Date(now.getTime() + INVITE_TTL_MS).toISOString(),
      })
      .select('id, expires_at')
      .single();
    if (error) return NextResponse.json({ error: 'could not send that' }, { status: 500 });
    return NextResponse.json({
      ok: true,
      id: made.id,
      expiresAt: new Date(made.expires_at).getTime(),
    });
  }

  const inviteId = typeof body.inviteId === 'string' ? body.inviteId : '';
  if (!inviteId) return NextResponse.json({ error: 'which challenge?' }, { status: 400 });

  const { data: invite } = await supabase
    .from('battle_invites')
    .select('id, from_id, to_id, mode, difficulty, state, expires_at')
    .eq('id', inviteId)
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: 'no such challenge' }, { status: 404 });

  const mine = invite.to_id === auth.playerId;
  const theirs = invite.from_id === auth.playerId;
  if (!mine && !theirs) {
    return NextResponse.json({ error: 'not your challenge' }, { status: 403 });
  }
  if (invite.state !== 'waiting') {
    return NextResponse.json({ error: 'that challenge is over' }, { status: 409 });
  }

  const now = new Date().toISOString();

  if (action === 'decline' || action === 'cancel') {
    // Either side may end it; which word is used is only about who did.
    if (action === 'decline' && !mine) {
      return NextResponse.json({ error: 'that one is yours to cancel' }, { status: 403 });
    }
    if (action === 'cancel' && !theirs) {
      return NextResponse.json({ error: 'that one is yours to decline' }, { status: 403 });
    }
    await supabase
      .from('battle_invites')
      .update({ state: action === 'decline' ? 'declined' : 'cancelled', decided_at: now })
      .eq('id', inviteId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'accept') {
    if (!mine) return NextResponse.json({ error: 'you sent that one' }, { status: 403 });
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'too late — that challenge expired' }, { status: 409 });
    }
    /*
      The battle takes the CHALLENGE'S id. So both phones already know
      what the room will be called before either has seen it exist, and
      accepting twice cannot make two battles.
    */
    const { error } = await supabase.from('battles').insert({
      id: invite.id,
      a_id: invite.from_id,
      b_id: invite.to_id,
      mode: invite.mode,
      difficulty: invite.difficulty,
    });
    if (error && !String(error.message).includes('duplicate')) {
      return NextResponse.json({ error: 'could not start that' }, { status: 500 });
    }
    await supabase
      .from('battle_invites')
      .update({ state: 'accepted', decided_at: now })
      .eq('id', inviteId);
    return NextResponse.json({
      ok: true,
      battle: { id: invite.id, mode: invite.mode, difficulty: invite.difficulty },
    });
  }

  return NextResponse.json({ error: 'no such action' }, { status: 400 });
}
