import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { authenticatePlayer, touchSeen } from '@/lib/playerAuth';
import {
  MATCH_DIFFICULTIES,
  MATCH_MODES,
  MAX_TROPHIES,
  QUEUE_FORGET_MS,
  QUEUE_FRESH_MS,
  isServiceMissing,
  opponentDisplayName,
  pickPartner,
  type QueueEntry,
} from '@/lib/matchQueue';

/**
 * Online matchmaking: looking for somebody to play.
 *
 * Marc, 4 Nov 2026: "add the online matchmaking where you now verse real
 * players instead of bots. it should search for a player for 15 seconds
 * and it should say 'searching for opponent' or something, and if it
 * can't find a real person to verse after 15 seconds then it loads you
 * against one of the bots".
 *
 * POST { playerId, secret, action: 'search' | 'leave', mode, difficulty, trophies }
 *
 * A searching phone sends `search` about once a second. Each one says
 * "I am still here" (the row's `seen_at`) and looks for somebody else
 * who is too (../../../lib/matchQueue.ts, pickPartner). Two who fit get
 * ONE battle row, written by claim_match() in the database so two phones
 * finding each other in the same instant cannot make two battles. The
 * battle is born `waiting` with `kind = 'match'`, exactly like an
 * accepted friend challenge, and from there both phones play it through
 * ../battles/live: the waiting room, the clock and the finish are the
 * friends' protocol, unchanged.
 *
 * The fifteen seconds are the GAME'S, not this route's. At the end of
 * them the phone sends `leave`, and the answer settles the race where a
 * pair was made a moment before: `left` means nobody, play a bot;
 * `matched` means somebody was found after all, go and play them.
 *
 * Answers, always 200 unless the request itself is wrong:
 *   { state: 'off' }        no matchmaking here (migration not applied)
 *   { state: 'searching' }  nobody yet, ask again
 *   { state: 'matched', battle: { id, mode, difficulty, opponentId, opponentName } }
 *   { state: 'left' }       out of the queue, nobody was found
 * and 400 for a bad request, 401 for an unknown player or wrong secret
 * (the game then sends its profile once and asks again), 429 for more
 * than three asks a second.
 *
 * THE SWITCH. Until 20261104_matchmaking.sql is applied there is no
 * `match_queue` and no claim_match(), and every answer is `off`, which
 * the game reads as "play a bot now" — what every app did before this
 * route existed. That is what makes the website safe to deploy first.
 *
 * Authentication is the device secret, exactly as everywhere else here —
 * see the note at the top of ../players.
 */

export const dynamic = 'force-dynamic';

const OFF = { state: 'off' } as const;

/*
  The rate guard. In memory, so it only counts the calls one Vercel
  instance sees — enough to stop a stuck loop hammering the database,
  which is all it is for. Counted after authentication, so nobody can
  lock somebody else out by sending their id.
*/
const RATE_WINDOW_MS = 1_000;
const RATE_MAX = 3;
const recentCalls = new Map<string, number[]>();

function tooFast(playerId: string, nowMs: number): boolean {
  const kept = (recentCalls.get(playerId) ?? []).filter((t) => nowMs - t < RATE_WINDOW_MS);
  if (kept.length >= RATE_MAX) {
    recentCalls.set(playerId, kept);
    return true;
  }
  kept.push(nowMs);
  recentCalls.set(playerId, kept);
  // A long-lived instance must not keep a list of everybody it has seen.
  if (recentCalls.size > 5_000) {
    for (const [id, times] of recentCalls) {
      if (times.every((t) => nowMs - t >= RATE_WINDOW_MS)) recentCalls.delete(id);
    }
  }
  return false;
}

type QueueRow = {
  player_id: string;
  mode: string;
  difficulty: string;
  trophies: number;
  state: string;
  joined_at: string;
  seen_at: string;
  battle_id: string | null;
  opponent_id: string | null;
};

const QUEUE_COLUMNS =
  'player_id, mode, difficulty, trophies, state, joined_at, seen_at, battle_id, opponent_id';

const ms = (v: unknown) => (v ? new Date(String(v)).getTime() : Number.NaN);

const entry = (r: QueueRow): QueueEntry => ({
  playerId: String(r.player_id),
  mode: String(r.mode),
  difficulty: String(r.difficulty),
  trophies: Number(r.trophies) || 0,
  state: String(r.state),
  joinedAtMs: ms(r.joined_at),
  seenAtMs: ms(r.seen_at),
});

type Supabase = ReturnType<typeof supabaseAdmin>;

/** The name to show for somebody, by the rule in matchQueue.ts. */
async function nameOf(supabase: Supabase, playerId: string): Promise<string> {
  const { data } = await supabase
    .from('player_profiles')
    .select('name')
    .eq('player_id', playerId)
    .maybeSingle();
  return opponentDisplayName(data?.name);
}

/**
 * The battle a matched row points at, as the `matched` answer — or null
 * once that battle is over, so the row counts as nothing.
 */
async function matchedAnswer(supabase: Supabase, me: string, row: QueueRow | null) {
  if (!row || row.state !== 'matched' || !row.battle_id) return null;
  const { data: battle } = await supabase
    .from('battles')
    .select('id, a_id, b_id, mode, difficulty, state')
    .eq('id', row.battle_id)
    .maybeSingle();
  if (!battle || (battle.state !== 'waiting' && battle.state !== 'playing')) return null;
  const opponentId = String(battle.a_id === me ? battle.b_id : battle.a_id);
  return {
    state: 'matched' as const,
    battle: {
      id: String(battle.id),
      mode: String(battle.mode),
      difficulty: String(battle.difficulty),
      opponentId,
      opponentName: await nameOf(supabase, opponentId),
    },
  };
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'not JSON' }, { status: 400 });
  }
  const action = String(body.action);
  if (action !== 'search' && action !== 'leave') {
    return NextResponse.json({ error: 'no such action' }, { status: 400 });
  }
  const mode = String(body.mode);
  const difficulty = String(body.difficulty);
  if (action === 'search' && (!MATCH_MODES.includes(mode) || !MATCH_DIFFICULTIES.includes(difficulty))) {
    return NextResponse.json({ error: 'no such game mode' }, { status: 400 });
  }
  const trophies = Math.min(MAX_TROPHIES, Math.max(0, Math.floor(Number(body.trophies) || 0)));

  const auth = await authenticatePlayer(body.playerId, body.secret);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 });
  const me = auth.playerId;
  if (tooFast(me, Date.now())) {
    return NextResponse.json({ error: 'too many requests' }, { status: 429 });
  }
  touchSeen(me);

  const supabase = supabaseAdmin();
  const mine = await supabase.from('match_queue').select(QUEUE_COLUMNS).eq('player_id', me).maybeSingle();
  if (mine.error) {
    if (isServiceMissing(mine.error)) return NextResponse.json(OFF);
    return NextResponse.json({ error: 'could not reach the database' }, { status: 500 });
  }
  const row = (mine.data as QueueRow | null) ?? null;

  if (action === 'leave') {
    if (row?.state === 'searching') {
      // Guarded on still searching: a pair made a moment ago wins, and
      // the phone is told about it below rather than left in the queue.
      const { data: left, error } = await supabase
        .from('match_queue')
        .update({ state: 'withdrawn' })
        .eq('player_id', me)
        .eq('state', 'searching')
        .select('player_id')
        .maybeSingle();
      if (error && isServiceMissing(error)) return NextResponse.json(OFF);
      if (left) return NextResponse.json({ state: 'left' });
      const { data: reread } = await supabase
        .from('match_queue')
        .select(QUEUE_COLUMNS)
        .eq('player_id', me)
        .maybeSingle();
      const matched = await matchedAnswer(supabase, me, (reread as QueueRow | null) ?? null);
      return NextResponse.json(matched ?? { state: 'left' });
    }
    const matched = await matchedAnswer(supabase, me, row);
    return NextResponse.json(matched ?? { state: 'left' });
  }

  // search. Already paired by somebody else's ask: go and play them.
  const already = await matchedAnswer(supabase, me, row);
  if (already) return NextResponse.json(already);

  const now = new Date();
  const nowMs = now.getTime();
  /*
    The wait is counted from when this search began, so the trophy band
    widens second by second — but only while it is one search: the same
    mode and difficulty, still searching, and not gone quiet in between.
  */
  const sameSearch =
    row?.state === 'searching' &&
    row.mode === mode &&
    row.difficulty === difficulty &&
    nowMs - ms(row.seen_at) < QUEUE_FRESH_MS;
  const joinedAt = sameSearch && row ? row.joined_at : now.toISOString();
  const { error: upsertError } = await supabase.from('match_queue').upsert({
    player_id: me,
    mode,
    difficulty,
    trophies,
    state: 'searching',
    joined_at: joinedAt,
    seen_at: now.toISOString(),
    battle_id: null,
    opponent_id: null,
  });
  if (upsertError) {
    if (isServiceMissing(upsertError)) return NextResponse.json(OFF);
    return NextResponse.json({ error: 'could not reach the database' }, { status: 500 });
  }

  /*
    Who else is looking, and who I may not be paired with. A block in
    EITHER direction keeps two people apart: friendships are one row per
    direction (see ../friends), so that is two plain `.eq()` reads — no
    "or" filter string, for the reason the note in ../battles gives.
  */
  const [others, iBlocked, blockedMe] = await Promise.all([
    supabase
      .from('match_queue')
      .select(QUEUE_COLUMNS)
      .eq('state', 'searching')
      .eq('mode', mode)
      .eq('difficulty', difficulty)
      .gt('seen_at', new Date(nowMs - QUEUE_FRESH_MS).toISOString())
      .neq('player_id', me)
      .order('seen_at', { ascending: false })
      .limit(50),
    supabase.from('friendships').select('other_id').eq('player_id', me).eq('state', 'blocked'),
    supabase.from('friendships').select('player_id').eq('other_id', me).eq('state', 'blocked'),
  ]);
  if (others.error) {
    if (isServiceMissing(others.error)) return NextResponse.json(OFF);
    return NextResponse.json({ error: 'could not reach the database' }, { status: 500 });
  }
  // A block that could not be READ is not "nobody blocked": pair nobody.
  if (iBlocked.error || blockedMe.error) return NextResponse.json({ state: 'searching' });
  const blockedIds = new Set([
    ...(iBlocked.data ?? []).map((r) => String(r.other_id)),
    ...(blockedMe.data ?? []).map((r) => String(r.player_id)),
  ]);

  const self: QueueEntry = {
    playerId: me,
    mode,
    difficulty,
    trophies,
    state: 'searching',
    joinedAtMs: ms(joinedAt),
    seenAtMs: nowMs,
  };
  const partner = pickPartner(
    self,
    ((others.data ?? []) as QueueRow[]).map(entry),
    nowMs,
    blockedIds,
  );

  if (partner) {
    /*
      `p_born` is THIS server's clock, not the database's now(): the live
      route reads "their seen is later than the start" as "they have
      arrived", and the beats that stamp `*_seen` use this clock, so the
      start they are compared with must come from the same one (as the
      accept in ../battles does). The partner is `a`, the one who was
      already waiting to be found.
    */
    const battleId = randomUUID();
    const { data: claimed, error: claimError } = await supabase.rpc('claim_match', {
      p_battle: battleId,
      p_a: partner.playerId,
      p_b: me,
      p_mode: mode,
      p_difficulty: difficulty,
      p_born: new Date().toISOString(),
    });
    if (claimError && isServiceMissing(claimError)) return NextResponse.json(OFF);
    if (claimed === true) {
      return NextResponse.json({
        state: 'matched',
        battle: {
          id: battleId,
          mode,
          difficulty,
          opponentId: partner.playerId,
          opponentName: await nameOf(supabase, partner.playerId),
        },
      });
    }
    // Taken by somebody else's ask in the same instant. Ask again.
    return NextResponse.json({ state: 'searching' });
  }

  /*
    Housekeeping, on the asks that found nobody: rows nobody has stamped
    for QUEUE_FORGET_MS are deleted, a few at a time, so the table holds
    the people looking now rather than everybody who ever looked.
  */
  const forgetBefore = new Date(nowMs - QUEUE_FORGET_MS).toISOString();
  const { data: forgotten } = await supabase
    .from('match_queue')
    .select('player_id')
    .lt('seen_at', forgetBefore)
    .limit(20);
  const ids = (forgotten ?? []).map((r) => String(r.player_id));
  // Still old at the moment of deleting: a row stamped in between stays.
  if (ids.length) {
    await supabase.from('match_queue').delete().in('player_id', ids).lt('seen_at', forgetBefore);
  }

  return NextResponse.json({ state: 'searching' });
}
