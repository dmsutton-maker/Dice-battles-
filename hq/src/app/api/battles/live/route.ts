import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { authenticatePlayer, touchSeen } from '@/lib/playerAuth';
import {
  BATTLE_TIME_MS,
  battleMsLeft,
  hasArrived,
  joinWindowOver,
  timeoutWinner,
} from '@/lib/battleClock';
import { matchClaimHolds } from '@/lib/matchQueue';

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
 *
 * WHEN THE CLOCK RUNS OUT, THIS ROUTE DECIDES, not the phones. David,
 * 1 Nov 2026: "Add a two minute thirty second timer and if the game
 * doesn't finish by then it is a tie if the score is tied, or a win for
 * whoever is winning at that moment." The first beat to arrive after the
 * clock and its grace (../../../../lib/battleClock.ts) closes the battle
 * by the colours each side has stored, before any claim or leave in that
 * same beat is looked at — a battle that is over on time cannot be won
 * or handed away afterwards. That is what makes both phones agree, and
 * what ends a battle on an app from before the clock, which never stops
 * on its own. Every answer carries `msLeft` so both phones show the same
 * clock.
 *
 * THE WAITING ROOM COMES BEFORE ALL OF THAT. David, 1 Nov 2026: "Fix the
 * versus against friends because it doesn't connect and it's not
 * actually against each other." The phone that accepted used to be
 * racing before the other phone even knew there was a battle. Now a row
 * is born 'waiting' (../route.ts) and a beat on it is a phone saying "I
 * am here": it stamps that phone's `*_seen` and nothing more. The beat
 * that finds the OTHER phone already arrived turns the row 'playing' and
 * restarts `started_at`, so the clock starts at that moment for both of
 * them. That beat is answered `started: true` at once and the other
 * phone hears it on its next beat — about a second apart, instead of up
 * to eight.
 *
 * "Arrived" is their `*_seen` strictly LATER than `started_at`
 * (hasArrived in ../../../../lib/battleClock.ts). The accept writes all
 * three as one instant, and any real beat is a moment later, which is
 * how this works with no new column. A room the other phone never walks
 * into is closed after JOIN_WAIT_MS with no winner, and the phone that
 * waited is told `over` with nobody having won, which the game reads as
 * "your friend did not make it".
 *
 * A MATCH IS PLAYED HERE TOO, with two differences. Marc, 4 Nov 2026,
 * asked for online battles against real players; online matchmaking
 * (../../match) writes a battle row with `kind = 'match'`, and it is
 * beaten exactly like a friend battle except:
 *  - backing out of the waiting room closes it with NO winner, so the
 *    stranger still in it takes the no-show path and gets a bot. A free
 *    win for a battle nobody played is wrong once wins are worth
 *    something.
 *  - a claim to have won holds only with every colour freed and at
 *    least MATCH_MIN_MS in (matchClaimHolds, ../../../../lib/matchQueue.ts).
 *    One that does not is ignored and the beat is just a beat.
 * The clock, the tie and the sweep are the same for both. A row from
 * before the `kind` column existed has none, and is a friend battle.
 */

export const dynamic = 'force-dynamic';

/** Nothing heard from a phone in this long: they have gone. */
const DROPPED_MS = 20_000;

/** Every column a beat reads back. `started_at` is the start of the clock. */
const COLUMNS =
  'id, a_id, b_id, a_freed, b_freed, a_seen, b_seen, winner, state, mode, difficulty, started_at';

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
  // `*` rather than COLUMNS for this first read only, so `kind` comes
  // back when the column exists and the read still works when it does not.
  const { data: battle } = await supabase
    .from('battles')
    .select('*')
    .eq('id', battleId)
    .maybeSingle();
  if (!battle) return NextResponse.json({ error: 'no such battle' }, { status: 404 });
  const isMatch = battle.kind === 'match';

  const iAmA = battle.a_id === auth.playerId;
  const iAmB = battle.b_id === auth.playerId;
  if (!iAmA && !iAmB) return NextResponse.json({ error: 'not your battle' }, { status: 403 });

  const now = new Date();
  const freed = colours(body.freed);
  // What every beat writes, whatever else happens: my colours, and that
  // my phone is here.
  const stamp: Record<string, unknown> = iAmA
    ? { a_freed: freed, a_seen: now.toISOString() }
    : { b_freed: freed, b_seen: now.toISOString() };
  const patch: Record<string, unknown> = { ...stamp };
  const startedAtMs = new Date(String(battle.started_at)).getTime();
  const theirSeenMs = new Date(String(iAmA ? battle.b_seen : battle.a_seen)).getTime();
  const waiting = battle.state === 'waiting';
  /*
    Set when this beat moves a WAITING room on — to playing, or closed —
    so the write below only lands if the room is still waiting. Two
    phones can each find the other arrived in the same instant; only one
    of them may restart the clock.
  */
  let onlyIfWaiting = false;

  /*
    Time up comes FIRST. Past the clock and its grace, the score decides
    — the colours just reported by this phone and the last ones stored
    for the other — and a claim or a leave arriving in the same beat
    changes nothing: the battle was already over. A tie is written as
    TIE_WINNER rather than left null, because null means "still on" to
    every app ever shipped and would leave both of them racing.
  */
  const onTime =
    battle.state === 'playing' && !battle.winner
      ? timeoutWinner({
          startedAtMs,
          nowMs: now.getTime(),
          aId: battle.a_id,
          bId: battle.b_id,
          aFreed: iAmA ? freed : battle.a_freed,
          bFreed: iAmA ? battle.b_freed : freed,
        })
      : null;

  if (onTime) {
    patch.winner = onTime;
    patch.state = 'over';
    patch.ended_at = now.toISOString();
  } else if (waiting && joinWindowOver(startedAtMs, now.getTime())) {
    /*
      The friend never walked in. Closed with NO winner, even if this
      beat is a leave: there was never a battle to hand to anybody, and
      the phone that waited reads `over` with no winner as "your friend
      did not make it", which is the truth.
    */
    patch.state = 'over';
    patch.ended_at = now.toISOString();
    onlyIfWaiting = true;
  } else if (isMatch && body.leave === true && waiting) {
    /*
      A MATCH left before it began: closed with no winner. The stranger
      still waiting reads `over` with nobody having won as "your opponent
      did not make it" and plays a bot, instead of being handed a win
      for a battle that never happened.
    */
    patch.state = 'over';
    patch.ended_at = now.toISOString();
    onlyIfWaiting = true;
  } else if (body.leave === true && (battle.state === 'playing' || waiting)) {
    /*
      Leaving is a real move, not a disconnection. A player who backs out
      of a friendly battle hands it to the other one rather than leaving
      them staring at a board that has stopped moving.

      The same from the waiting room: backing out of it closes the room
      and the friend who is still in it is told they won, rather than
      being left waiting the full thirty seconds for somebody who has
      already gone.
    */
    patch.state = 'over';
    patch.ended_at = now.toISOString();
    if (!battle.winner) patch.winner = iAmA ? battle.b_id : battle.a_id;
  } else if (
    body.claimWin === true &&
    battle.state === 'playing' &&
    !battle.winner &&
    (!isMatch || matchClaimHolds(freed, startedAtMs, now.getTime()))
  ) {
    // First claim wins; a second one finds `winner` already set and the
    // `.is('winner', null)` below refuses it.
    patch.winner = auth.playerId;
    patch.state = 'over';
    patch.ended_at = now.toISOString();
  } else if (waiting && hasArrived(theirSeenMs, startedAtMs)) {
    /*
      They are already here, and now so am I: the battle starts. The
      clock is restarted from THIS moment, not the accept, so neither
      child loses the seconds the other phone took to walk in.
    */
    patch.state = 'playing';
    patch.started_at = now.toISOString();
    onlyIfWaiting = true;
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
      .select(COLUMNS)
      .maybeSingle();
    if (won) {
      saved = won;
    } else {
      const { data: already } = await supabase
        .from('battles')
        .select(COLUMNS)
        .eq('id', battleId)
        .maybeSingle();
      if (already) saved = already;
    }
  } else if (onlyIfWaiting) {
    const { data: moved } = await supabase
      .from('battles')
      .update(patch)
      .eq('id', battleId)
      .eq('state', 'waiting')
      .select(COLUMNS)
      .maybeSingle();
    if (moved) {
      saved = moved;
    } else {
      /*
        Lost the race: the other phone's beat moved the room on first.
        Still write that I am here, then answer with the row as it now
        stands — which says `playing`, with the clock the other beat
        started, so both phones agree when it began.
      */
      const { data: reread } = await supabase
        .from('battles')
        .update(stamp)
        .eq('id', battleId)
        .select(COLUMNS)
        .maybeSingle();
      if (reread) saved = reread;
    }
  } else {
    const { data: updated } = await supabase
      .from('battles')
      .update(patch)
      .eq('id', battleId)
      .select(COLUMNS)
      .maybeSingle();
    if (updated) saved = updated;
  }

  const theirSeen = iAmA ? saved.b_seen : saved.a_seen;
  const savedStartMs = new Date(String(saved.started_at)).getTime();
  return NextResponse.json({
    theirs: iAmA ? saved.b_freed : saved.a_freed,
    mine: iAmA ? saved.a_freed : saved.b_freed,
    // Null while nobody has won, then the player_id of whoever did, or
    // TIE_WINNER when time ran out level.
    winner: saved.winner ?? null,
    // The clock both phones show, worked out here so a phone whose own
    // clock is set wrong still shows the same time as its friend's.
    // While the room is still waiting nothing has started, so the whole
    // clock is left; after that it counts from the `started_at` the
    // second phone's arrival wrote.
    msLeft: saved.state === 'waiting' ? BATTLE_TIME_MS : battleMsLeft(savedStartMs, Date.now()),
    // False while the room is waiting for the other phone; the game
    // holds at "Waiting for…" until this turns true. A room closed
    // because the friend never came is `over` and so counts as started,
    // which is why the game looks at `over` first.
    started: saved.state === 'playing' || saved.state === 'over',
    // Only 'over' is over. `!== 'playing'` would read a waiting room as
    // finished and end the battle before it began.
    over: saved.state === 'over',
    // True when their phone has stopped talking to us. The game says so
    // rather than leaving somebody racing an opponent who has gone.
    theyDropped:
      saved.state === 'playing' &&
      Date.now() - new Date(String(theirSeen)).getTime() > DROPPED_MS,
  });
}
