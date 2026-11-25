import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { authenticatePlayer, isOnline, touchSeen } from '@/lib/playerAuth';
import { JOIN_WAIT_MS, timeoutWinner } from '@/lib/battleClock';
import { mergeRematchAsks, rematchExpiresAt, rematchKind, rematchWindowOpen } from '@/lib/rematch';

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
 * THE WAITING ROOM, since 1 Nov 2026. David: "Fix the versus against
 * friends because it doesn't connect and it's not actually against each
 * other." Until then accepting a challenge started the battle there and
 * then: the accepter's phone was racing at once, while the challenger's
 * phone only heard on its next poll, up to eight seconds later, with the
 * clock already running down for both. Now the accept writes the battle
 * row `waiting`, and GET hands a waiting row to BOTH players, so the
 * challenger walks into the same room. Neither phone rolls yet. The
 * battle turns `playing`, and its clock starts, only when the second
 * phone's first beat arrives (./live) — and a room the friend
 * never walks into is closed after JOIN_WAIT_MS with no winner, by that
 * route and by sweep() below, whichever hears of it first.
 *
 * THE REMATCH, since 5 Nov 2026. Marc: "After a game against your
 * friend, if one of you chooses to play again, it should have to wait
 * for the other player too." "Play again" after a live battle is now
 * the action 'rematch': an invite from the asker to the other player,
 * with the finished battle's mode and difficulty, marked `rematch_of`
 * that battle (../../../../supabase/migrations/20261105_rematch.sql),
 * and alive until ten minutes after the battle ended rather than a
 * challenge's forty-five seconds. From there it IS a challenge: the
 * other player accepts, declines or lets it run out, the asker's phone
 * finds the room on its poll, and both walk into the waiting room
 * above. The one difference is two people asking at once: the second
 * ask accepts the first invite instead of sending a second one
 * (../../../../lib/rematch.ts), so there is one battle, and either phone
 * sending its ask a moment late still lands in it.
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
  /*
    The finished battle a rematch asks to play again; null, or missing
    from a database the rematch migration has not reached, for a
    challenge. Invites are read with `*` so that both work.
  */
  rematch_of?: string | null;
};

/*
  Every column an invite is read back with. `*` rather than a list, so
  `rematch_of` comes back where the column exists and the read still
  works where it does not yet (20261105_rematch.sql adds it) — the same
  arrangement the battles read below has for `kind`.
*/
const INVITE_COLUMNS = '*';

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

  /*
    A waiting room the friend never walked into is closed, with no
    winner: nobody played, so nobody won. Without this, a room left
    'waiting' (both phones put down between Accept and the room) would be
    handed back by GET below and the game would drop the player into it
    the next time they opened the menu. `started_at` of a waiting row is
    still the moment of the accept, so "older than JOIN_WAIT_MS" is
    "waited the whole join window" — the same rule as the live route's
    joinWindowOver, written as one guarded update like the invites above.
  */
  const joinCutoff = new Date(nowMs - JOIN_WAIT_MS).toISOString();
  for (const side of ['a_id', 'b_id'] as const) {
    await supabase
      .from('battles')
      .update({ state: 'over', ended_at: now })
      .eq('state', 'waiting')
      .lt('started_at', joinCutoff)
      .eq(side, playerId);
  }

  const stuck: string[] = [];
  /*
    A battle whose clock has run out is OVER, with a result, even when
    nobody's phone was there to send the beat that would have closed it
    (../live). David, 1 Nov 2026: a battle that does not finish in two
    and a half minutes is "a tie if the score is tied, or a win for
    whoever is winning at that moment" — so it is closed here by the
    same rule, not swept away with no winner like a stuck one.
  */
  const timedOut: { id: string; winner: string }[] = [];
  for (const side of ['a_id', 'b_id'] as const) {
    const { data } = await supabase
      .from('battles')
      .select('id, a_id, b_id, a_freed, b_freed, a_seen, b_seen, started_at')
      .eq('state', 'playing')
      .eq(side, playerId);
    for (const b of data ?? []) {
      const ms = (v: unknown) => (v ? new Date(String(v)).getTime() : NaN);
      const started = ms(b.started_at);
      const winner = timeoutWinner({
        startedAtMs: started,
        nowMs,
        aId: String(b.a_id),
        bId: String(b.b_id),
        aFreed: b.a_freed,
        bFreed: b.b_freed,
      });
      if (winner) {
        timedOut.push({ id: String(b.id), winner });
        continue;
      }
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
  for (const { id, winner } of timedOut) {
    // Same guards as a beat: only a battle still playing, still unwon.
    await supabase
      .from('battles')
      .update({ state: 'over', ended_at: now, winner })
      .eq('id', id)
      .eq('state', 'playing')
      .is('winner', null);
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

/**
 * Has either of these two blocked the other?
 *
 * For the rematch of a match — two strangers, who were never friends,
 * so friendsBothWays has nothing to say about them — the one thing that
 * must still keep them apart is a block, in either direction, exactly
 * as ../match reads it. Two plain reads, never an "or" string (see the
 * note above). `error` is a read that FAILED, not "not blocked".
 */
async function blockedEitherWay(
  supabase: ReturnType<typeof supabaseAdmin>,
  me: string,
  other: string,
): Promise<{ blocked: boolean; error: boolean }> {
  const [a, b] = await Promise.all([
    supabase.from('friendships').select('state').eq('player_id', me).eq('other_id', other).maybeSingle(),
    supabase.from('friendships').select('state').eq('player_id', other).eq('other_id', me).maybeSingle(),
  ]);
  return {
    blocked: a.data?.state === 'blocked' || b.data?.state === 'blocked',
    error: Boolean(a.error || b.error),
  };
}

/**
 * May these two play each other, right now? Friends from both sides
 * for a friend battle; for the rematch of a match, only that neither
 * has blocked the other. Asked at the moment of asking and again at the
 * moment of accepting, because either side can block or unfriend while
 * an invite is waiting.
 */
async function mayPlay(
  supabase: ReturnType<typeof supabaseAdmin>,
  me: string,
  other: string,
  kind: 'friend' | 'match',
): Promise<{ ok: boolean; error: boolean }> {
  if (kind === 'match') {
    const block = await blockedEitherWay(supabase, me, other);
    return { ok: !block.blocked, error: block.error };
  }
  const link = await friendsBothWays(supabase, me, other);
  return { ok: link.mine && link.theirs, error: link.error };
}

/**
 * ACCEPTING AN INVITE: the battle is made and the invite marked.
 *
 * Shared by the 'accept' action and by a 'rematch' ask that finds the
 * other player's own rematch invite already waiting (mergeRematchAsks):
 * the second of two people to say "play again" accepts the first, by
 * exactly this path, so both asks end in one battle.
 */
async function acceptInvite(
  supabase: ReturnType<typeof supabaseAdmin>,
  invite: InviteRow,
  now: string,
) {
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'too late — that challenge expired' }, { status: 409 });
  }
  /*
    What kind of battle this makes. A rematch is the kind the finished
    battle was — the rematch of a match counts like the match did
    (src/game/stakes.ts) — and a challenge is a friend battle.
  */
  let kind: 'friend' | 'match' = 'friend';
  if (invite.rematch_of) {
    const { data: original } = await supabase
      .from('battles')
      .select('*')
      .eq('id', invite.rematch_of)
      .maybeSingle();
    kind = rematchKind(original?.kind);
  }
  /*
    Still friends, both ways, at the moment of accepting. A challenge
    lives for 45 seconds, a rematch for ten minutes, and either side can
    block or unfriend in that time; a battle must not start between
    people who no longer are. For a match's rematch, "still friends" is
    "neither has blocked the other".
  */
  const may = await mayPlay(supabase, invite.to_id, invite.from_id, kind);
  if (may.error) {
    return NextResponse.json({ error: 'could not start that' }, { status: 500 });
  }
  if (!may.ok) {
    await supabase
      .from('battle_invites')
      .update({ state: 'cancelled', decided_at: now })
      .eq('id', invite.id);
    return NextResponse.json({ error: 'that challenge is over' }, { status: 409 });
  }
  /*
    The battle takes the CHALLENGE'S id. So both phones already know
    what the room will be called before either has seen it exist, and
    accepting twice cannot make two battles.

    Born WAITING, not playing (1 Nov 2026 — see the note at the top).
    `started_at`, `a_seen` and `b_seen` are written as ONE instant from
    this server's clock rather than left to the database's now(): the
    live route reads "their seen is later than the start" as "they have
    arrived", and the beats that stamp `*_seen` use this server's clock,
    so the start they are compared against must come from the same one.

    `kind` is only ever written for a match's rematch: the column's
    default is 'friend', and a match row can only exist once the column
    does (20261104_matchmaking.sql).
  */
  const bornAt = new Date().toISOString();
  const { error } = await supabase.from('battles').insert({
    id: invite.id,
    a_id: invite.from_id,
    b_id: invite.to_id,
    mode: invite.mode,
    difficulty: invite.difficulty,
    state: 'waiting',
    started_at: bornAt,
    a_seen: bornAt,
    b_seen: bornAt,
    ...(kind === 'match' ? { kind } : {}),
  });
  if (error && !String(error.message).includes('duplicate')) {
    return NextResponse.json({ error: 'could not start that' }, { status: 500 });
  }
  await supabase
    .from('battle_invites')
    .update({ state: 'accepted', decided_at: now })
    .eq('id', invite.id);
  return NextResponse.json({
    ok: true,
    battle: {
      id: invite.id,
      mode: invite.mode,
      difficulty: invite.difficulty,
      opponentId: invite.from_id,
      kind,
    },
  });
}

/*
  Who an invite is from or to. `online` is yes or no and never the time,
  as ../friends says it: the phone that sent a rematch sits in a waiting
  room until it is answered, and "they have closed the app" is the one
  thing it cannot otherwise tell from "they are thinking about it".
*/
const peek = (p: Record<string, unknown> | undefined) =>
  p
    ? {
        playerId: p.player_id,
        name: p.name,
        trophies: p.trophies,
        online: isOnline(p.last_seen as string | null | undefined),
      }
    : null;

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
      .select(INVITE_COLUMNS)
      .eq('state', 'waiting')
      .eq('from_id', auth.playerId),
    supabase
      .from('battle_invites')
      .select(INVITE_COLUMNS)
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
        .select('player_id, name, trophies, last_seen')
        .in('player_id', ids)
    : { data: [] };
  const byId = new Map((people ?? []).map((p) => [p.player_id, p]));

  /*
    A battle in progress, if there is one. Either side of it.

    WAITING counts as well as playing (1 Nov 2026). That is how the
    challenger joins: they never tap Accept, so the only way their phone
    learns the room exists is finding it here while it is still waiting
    for them. A list of values, not an "or" string — see the note above.

    NEVER A MATCH (4 Nov 2026). A battle against a stranger from online
    matchmaking (../match) is a `battles` row too, with `kind = 'match'`,
    and the game joins whatever this answer hands it as a FRIEND battle.
    So matches are left out here, in JS rather than in the query: `*` and
    a filter on the value read back work whether or not the `kind` column
    exists yet (20261104_matchmaking.sql adds it), and a row without one
    is a friend battle. A few rows per side, so a match that is newer
    than a friend battle cannot hide it.

    EXCEPT A MATCH BORN FROM AN INVITE (5 Nov 2026): the rematch of a
    match is a `kind = 'match'` row too, but the only way the phone that
    asked for it learns it exists is here, exactly as a challenger's
    does. A battle made from an invite takes the invite's id (see the
    accept below), so one read of battle_invites tells the two apart;
    the queue's own battles are still never handed out here. The answer
    says `kind`, and the game plays it as the kind it is.
  */
  const liveSides = await Promise.all(
    (['a_id', 'b_id'] as const).map((side) =>
      supabase
        .from('battles')
        .select('*')
        .in('state', ['waiting', 'playing'])
        .eq(side, auth.playerId)
        .order('started_at', { ascending: false })
        .limit(5),
    ),
  );
  const liveRows = liveSides.flatMap((r) => r.data ?? []);
  const matchIds = liveRows.filter((r) => r.kind === 'match').map((r) => String(r.id));
  const { data: invited } = matchIds.length
    ? await supabase.from('battle_invites').select('id').in('id', matchIds)
    : { data: [] };
  const fromInvite = new Set((invited ?? []).map((r) => String(r.id)));
  const live =
    liveRows
      .filter((r) => r.kind !== 'match' || fromInvite.has(String(r.id)))
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
      rematchOf: r.rematch_of ?? null,
    })),
    outgoing: outgoing
      ? {
          id: outgoing.id,
          mode: outgoing.mode,
          difficulty: outgoing.difficulty,
          expiresAt: new Date(outgoing.expires_at).getTime(),
          to: peek(byId.get(outgoing.to_id)),
          rematchOf: outgoing.rematch_of ?? null,
        }
      : null,
    battle: live
      ? {
          id: live.id,
          mode: live.mode,
          difficulty: live.difficulty,
          opponentId: live.a_id === auth.playerId ? live.b_id : live.a_id,
          opponentName,
          kind: rematchKind(live.kind),
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

  if (action === 'rematch') {
    /*
      "PLAY AGAIN", AFTER A LIVE BATTLE (Marc, 5 Nov 2026 — see the note
      at the top). Either player of a battle that is OVER may ask, for
      ten minutes after it ended. The ask is an invite to the other
      player with the same mode and difficulty, marked as the rematch of
      that battle; what it does when somebody has already asked is
      mergeRematchAsks in ../../../../lib/rematch.ts.
    */
    const battleId = typeof body.battleId === 'string' ? body.battleId : '';
    if (!battleId) return NextResponse.json({ error: 'which battle?' }, { status: 400 });
    const { data: battle } = await supabase
      .from('battles')
      .select('*')
      .eq('id', battleId)
      .maybeSingle();
    if (!battle) return NextResponse.json({ error: 'no such battle' }, { status: 404 });
    const iAmA = battle.a_id === auth.playerId;
    const iAmB = battle.b_id === auth.playerId;
    if (!iAmA && !iAmB) return NextResponse.json({ error: 'not your battle' }, { status: 403 });
    if (battle.state !== 'over') {
      return NextResponse.json({ error: 'that battle is still on' }, { status: 409 });
    }
    const endedAtMs = new Date(String(battle.ended_at)).getTime();
    if (!rematchWindowOpen(endedAtMs, Date.now())) {
      return NextResponse.json({ error: 'too late for a rematch' }, { status: 409 });
    }
    const otherId = String(iAmA ? battle.b_id : battle.a_id);
    const kind = rematchKind(battle.kind);

    /*
      Who has asked already. A read that fails — which is what a database
      without the `rematch_of` column answers — is "could not send that",
      not "nobody", because answering "nobody" would go on to insert a
      second invite under the first.
    */
    const { data: open, error: openError } = await supabase
      .from('battle_invites')
      .select(INVITE_COLUMNS)
      .eq('state', 'waiting')
      .eq('rematch_of', battleId);
    if (openError) return NextResponse.json({ error: 'could not send that' }, { status: 500 });
    const merged = mergeRematchAsks(auth.playerId, (open ?? []) as InviteRow[]);
    if (merged.kind === 'accept') {
      // They asked first: my ask is the answer, and the battle takes
      // their invite's id, exactly as a tapped Accept would.
      return acceptInvite(supabase, merged.invite, new Date().toISOString());
    }
    if (merged.kind === 'mine') {
      return NextResponse.json({
        ok: true,
        id: merged.invite.id,
        expiresAt: new Date(merged.invite.expires_at).getTime(),
      });
    }

    /*
      Still able to play each other, and they must be ON — the same two
      questions a challenge asks, with the same answer for either "no":
      a block, an unfriending and a closed app all read "not playing
      right now", which is true and tells nobody anything.
    */
    const may = await mayPlay(supabase, auth.playerId, otherId, kind);
    if (may.error) return NextResponse.json({ error: 'could not send that' }, { status: 500 });
    const { data: them } = await supabase
      .from('player_profiles')
      .select('last_seen, name')
      .eq('player_id', otherId)
      .maybeSingle();
    if (!may.ok || !isOnline(them?.last_seen)) {
      return NextResponse.json(
        { error: `${them?.name ?? 'They'} is not playing right now` },
        { status: 409 },
      );
    }

    // One outgoing invite at a time, as with a challenge.
    const now = new Date();
    await supabase
      .from('battle_invites')
      .update({ state: 'cancelled', decided_at: now.toISOString() })
      .eq('from_id', auth.playerId)
      .eq('state', 'waiting');

    /*
      Alive until the window closes, not for a challenge's 45 seconds:
      the asker is in a waiting room until this is answered, and both
      phones were told ten minutes.
    */
    const { data: made, error } = await supabase
      .from('battle_invites')
      .insert({
        from_id: auth.playerId,
        to_id: otherId,
        mode: battle.mode,
        difficulty: battle.difficulty,
        expires_at: new Date(rematchExpiresAt(endedAtMs)).toISOString(),
        rematch_of: battleId,
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

  const { data: found } = await supabase
    .from('battle_invites')
    .select(INVITE_COLUMNS)
    .eq('id', inviteId)
    .maybeSingle();
  if (!found) return NextResponse.json({ error: 'no such challenge' }, { status: 404 });
  const invite = found as InviteRow;

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
    return acceptInvite(supabase, invite, now);
  }

  return NextResponse.json({ error: 'no such action' }, { status: 400 });
}
