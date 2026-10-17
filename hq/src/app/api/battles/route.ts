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
 * A playing battle that neither phone has spoken for in this long is
 * dead. The live route stamps `a_seen` / `b_seen` about once a second, so
 * two minutes of silence from BOTH sides means both phones are gone.
 */
const BATTLE_SILENT_MS = 2 * 60_000;

/** Nobody's friendly race lasts this long; a "playing" row older is stuck. */
const BATTLE_MAX_MS = 30 * 60_000;

/*
  WHY THERE ARE NO PostgREST "or" FILTER STRINGS ANYWHERE BELOW.

  An "or" filter is a string the server parses, so an id
  containing a comma or a dot could add clauses of its own — and a
  player_id is whatever the first claim on it said it was. Every
  "either side" lookup is therefore two plain `.eq()` queries, merged
  here, where the value can only ever be a value.
*/

/**
 * Mark anything past its expiry as expired, before answering.
 *
 * Cheaper and far more reliable than a scheduled job: the rows only
 * matter to somebody who is asking about them, and the person asking is
 * the one who would otherwise see a stale challenge.
 *
 * Battles get the same treatment. A battle only ends when a phone says
 * `leave` or `claimWin`, so if both phones die mid-race it would stay
 * 'playing' for ever — and the game joins any playing battle it is
 * handed, so the next time either player opened the menu they would be
 * dropped into a race nobody is running. Only THIS player's battles are
 * looked at, for the same reason invites are: the person asking is the
 * one who would otherwise walk into it.
 */
async function sweep(playerId: string) {
  const supabase = supabaseAdmin();
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();

  for (const side of ['from_id', 'to_id'] as const) {
    await supabase
      .from('battle_invites')
      .update({ state: 'expired', decided_at: now })
      .eq('state', 'waiting')
      .lt('expires_at', now)
      .eq(side, playerId);
  }

  const stuck: string[] = [];
  for (const side of ['a_id', 'b_id'] as const) {
    const { data } = await supabase
      .from('battles')
      .select('id, a_seen, b_seen, started_at')
      .eq('state', 'playing')
      .eq(side, playerId);
    for (const b of data ?? []) {
      const ms = (v: unknown) => (v ? new Date(String(v)).getTime() : NaN);
      const started = ms(b.started_at);
      // A phone that has never spoken counts as silent, but only once the
      // battle itself is old enough to have heard from it.
      const silent = (seen: unknown) => {
        const t = ms(seen);
        return Number.isFinite(t)
          ? nowMs - t > BATTLE_SILENT_MS
          : Number.isFinite(started) && nowMs - started > BATTLE_SILENT_MS;
      };
      const tooOld = Number.isFinite(started) && nowMs - started > BATTLE_MAX_MS;
      if (tooOld || (silent(b.a_seen) && silent(b.b_seen))) stuck.push(String(b.id));
    }
  }
  if (stuck.length) {
    // No winner: nobody finished. The state guard means a battle that
    // ended in the meantime is not overwritten.
    await supabase
      .from('battles')
      .update({ state: 'over', ended_at: now })
      .in('id', stuck)
      .eq('state', 'playing');
  }
}

/**
 * Are these two FRIENDS from both sides?
 *
 * A block only rewrites the blocker's own row (see ../friends): the
 * person who was blocked still has a row reading 'friends'. Reading only
 * the challenger's row therefore let a blocked player keep sending
 * challenge popups to the person who had blocked them — the exact thing
 * a block exists to stop. Both rows must say 'friends'.
 *
 * `error` is a read that FAILED, which is not the same as "not friends".
 */
async function friendsBothWays(
  supabase: ReturnType<typeof supabaseAdmin>,
  me: string,
  other: string,
): Promise<{ mine: boolean; theirs: boolean; error: boolean }> {
  const [a, b] = await Promise.all([
    supabase.from('friendships').select('state').eq('player_id', me).eq('other_id', other).maybeSingle(),
    supabase.from('friendships').select('state').eq('player_id', other).eq('other_id', me).maybeSingle(),
  ]);
  return {
    mine: a.data?.state === 'friends',
    theirs: b.data?.state === 'friends',
    error: Boolean(a.error || b.error),
  };
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
  const [fromMe, toMe, blockedRows] = await Promise.all([
    supabase
      .from('battle_invites')
      .select('id, from_id, to_id, mode, difficulty, state, expires_at')
      .eq('state', 'waiting')
      .eq('from_id', auth.playerId),
    supabase
      .from('battle_invites')
      .select('id, from_id, to_id, mode, difficulty, state, expires_at')
      .eq('state', 'waiting')
      .eq('to_id', auth.playerId),
    supabase
      .from('friendships')
      .select('other_id')
      .eq('player_id', auth.playerId)
      .eq('state', 'blocked'),
  ]);
  const invites = [...(fromMe.data ?? []), ...(toMe.data ?? [])];

  /*
    Anything sent by somebody I have blocked never reaches me. Their
    challenge may well have been sent BEFORE I blocked them and still be
    inside its 45 seconds, and the block has to cover that one too.
  */
  const blockedIds = new Set((blockedRows.data ?? []).map((r) => String(r.other_id)));

  const rows = (invites ?? []) as InviteRow[];
  const incoming = rows.filter(
    (r) => r.to_id === auth.playerId && !blockedIds.has(r.from_id),
  );
  const outgoing = rows.find((r) => r.from_id === auth.playerId) ?? null;

  // Names for whoever is involved, so the popup can say who is asking.
  const ids = [
    ...new Set([...incoming, ...(outgoing ? [outgoing] : [])].flatMap((r) => [r.from_id, r.to_id])),
  ].filter(
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
  const liveSides = await Promise.all(
    (['a_id', 'b_id'] as const).map((side) =>
      supabase
        .from('battles')
        .select('id, a_id, b_id, mode, difficulty, state, started_at')
        .eq('state', 'playing')
        .eq(side, auth.playerId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  );
  const live =
    liveSides
      .map((r) => r.data)
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .sort((x, y) => String(y.started_at).localeCompare(String(x.started_at)))[0] ?? null;

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
      FRIENDS ONLY, from BOTH sides. Checked here rather than trusted
      from the app: a challenge is a popup on somebody else's phone,
      which is exactly the kind of thing a modified client would aim at
      strangers — or at somebody who has blocked them. See
      friendsBothWays for why one row is not enough.
    */
    const link = await friendsBothWays(supabase, auth.playerId, otherId);
    if (link.error) {
      return NextResponse.json({ error: 'could not send that' }, { status: 500 });
    }
    if (!link.mine) {
      return NextResponse.json({ error: 'you can only challenge a friend' }, { status: 403 });
    }

    // And they must be ON. This is the whole premise of the feature.
    const { data: them } = await supabase
      .from('player_profiles')
      .select('last_seen, name')
      .eq('player_id', otherId)
      .maybeSingle();
    /*
      A block answers EXACTLY like an absent friend. Saying "you can't
      challenge them" would tell a blocked child that they have been
      blocked; "not playing right now" is true, harmless, and the same
      words they would get at any quiet hour.
    */
    if (!link.theirs || !isOnline(them?.last_seen)) {
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
      Still friends, both ways, at the moment of accepting. A challenge
      lives for 45 seconds, and either side can block or unfriend in
      that time; a battle must not start between people who no longer
      are.
    */
    const link = await friendsBothWays(supabase, invite.to_id, invite.from_id);
    if (link.error) {
      return NextResponse.json({ error: 'could not start that' }, { status: 500 });
    }
    if (!link.mine || !link.theirs) {
      await supabase
        .from('battle_invites')
        .update({ state: 'cancelled', decided_at: now })
        .eq('id', inviteId);
      return NextResponse.json({ error: 'that challenge is over' }, { status: 409 });
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
