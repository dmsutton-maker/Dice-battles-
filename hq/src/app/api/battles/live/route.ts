import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { authenticatePlayer, touchSeen } from '@/lib/playerAuth';

/**
 * The battle itself, while two people are playing it.
 *
 * One call, sent by each phone about once a second: here is my side,
 * give me theirs. That is the whole protocol, and it is small on
 * purpose — the only thing either player needs to see of the other is
 * which colours they have freed.
 *
 * WHY POLLING IS ENOUGH HERE, which is not obvious for a race. A roll in
 * this game takes about a second and a half from throw to settle, and
 * the rival's prisoners move when a roll of theirs lands. A second of
 * lag on that is about the same as watching somebody across a table
 * reach for their dice — it is not a shooter, and nothing either player
 * does can invalidate the other's roll.
 *
 * WHO DECIDES WHO WON. The first phone to say "I have finished" does.
 * Both run the same rules over their own board, so in an honest game
 * that is the player who genuinely got there first; the server's job is
 * only to make sure the SECOND claim does not overwrite the first.
 *
 * That is trusting the client, and it is a deliberate trade. A friendly
 * battle is worth no trophies and no coins by David's own design, so
 * there is nothing to win by cheating except lying to a member of your
 * own family. Arbitrating four different game modes on the server, for a
 * game with nothing at stake, would be a great deal of machinery
 * defending an empty room.
 */

export const dynamic = 'force-dynamic';

/** Nothing heard from a phone in this long: they have gone. */
const DROPPED_MS = 20_000;

const colours = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string' && /^[a-z]{1,12}$/.test(v))
    .slice(0, 24);
};

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

  const battleId = typeof body.battleId === 'string' ? body.battleId : '';
  if (!battleId) return NextResponse.json({ error: 'which battle?' }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: battle } = await supabase
    .from('battles')
    .select('id, a_id, b_id, a_freed, b_freed, a_seen, b_seen, winner, state, mode, difficulty')
    .eq('id', battleId)
    .maybeSingle();
  if (!battle) return NextResponse.json({ error: 'no such battle' }, { status: 404 });

  const iAmA = battle.a_id === auth.playerId;
  const iAmB = battle.b_id === auth.playerId;
  if (!iAmA && !iAmB) return NextResponse.json({ error: 'not your battle' }, { status: 403 });

  const now = new Date();
  const patch: Record<string, unknown> = iAmA
    ? { a_freed: colours(body.freed), a_seen: now.toISOString() }
    : { b_freed: colours(body.freed), b_seen: now.toISOString() };

  /*
    Leaving is a real move, not a disconnection. A player who backs out
    of a friendly battle hands it to the other one rather than leaving
    them staring at a board that has stopped moving.
  */
  if (body.leave === true && battle.state === 'playing') {
    patch.state = 'over';
    patch.ended_at = now.toISOString();
    if (!battle.winner) patch.winner = iAmA ? battle.b_id : battle.a_id;
  } else if (body.claimWin === true && battle.state === 'playing' && !battle.winner) {
    // First claim wins; a second one finds `winner` already set and the
    // `.is('winner', null)` below refuses it.
    patch.winner = auth.playerId;
    patch.state = 'over';
    patch.ended_at = now.toISOString();
  }

  let saved = battle;
  if (patch.winner !== undefined) {
    /*
      The race, settled in the database rather than in this process. Two
      phones can claim within the same instant; only the update that
      finds `winner` still null may set it, and the loser of that race
      re-reads and is told who actually won.
    */
    const { data: won } = await supabase
      .from('battles')
      .update(patch)
      .eq('id', battleId)
      .is('winner', null)
      .select('id, a_id, b_id, a_freed, b_freed, a_seen, b_seen, winner, state, mode, difficulty')
      .maybeSingle();
    if (won) {
      saved = won;
    } else {
      const { data: already } = await supabase
        .from('battles')
        .select('id, a_id, b_id, a_freed, b_freed, a_seen, b_seen, winner, state, mode, difficulty')
        .eq('id', battleId)
        .maybeSingle();
      if (already) saved = already;
    }
  } else {
    const { data: updated } = await supabase
      .from('battles')
      .update(patch)
      .eq('id', battleId)
      .select('id, a_id, b_id, a_freed, b_freed, a_seen, b_seen, winner, state, mode, difficulty')
      .maybeSingle();
    if (updated) saved = updated;
  }

  const theirSeen = iAmA ? saved.b_seen : saved.a_seen;
  return NextResponse.json({
    theirs: iAmA ? saved.b_freed : saved.a_freed,
    mine: iAmA ? saved.a_freed : saved.b_freed,
    // Null while nobody has won, then the player_id of whoever did.
    winner: saved.winner ?? null,
    over: saved.state !== 'playing',
    // True when their phone has stopped talking to us. The game says so
    // rather than leaving somebody racing an opponent who has gone.
    theyDropped:
      saved.state === 'playing' &&
      Date.now() - new Date(String(theirSeen)).getTime() > DROPPED_MS,
  });
}
