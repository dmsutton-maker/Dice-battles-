import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * The friend list, and the moves either player can make.
 *
 * Authentication is the device secret, exactly as in ../players — see
 * the long note there for why a public app cannot use a shared token.
 *
 * THE STATE MACHINE LIVES IN TWO PLACES ON PURPOSE. The game has its
 * own copy in src/game/friends.ts so a screen can grey out a button
 * without a round trip; this is the one that actually decides, because
 * the game is on someone else's phone and can be edited. The two are
 * kept in step by tests/friends.test.ts, which reads this file.
 */

export const dynamic = 'force-dynamic';

type State = 'none' | 'requested' | 'pending' | 'friends' | 'blocked';
type Action = 'request' | 'accept' | 'decline' | 'cancel' | 'remove' | 'block' | 'unblock';

/** What each move does to MY side and to THEIRS. */
const MOVES: Record<Action, { from: State[]; mine: State; theirs: State }> = {
  request:  { from: ['none'],      mine: 'requested', theirs: 'pending' },
  accept:   { from: ['pending'],   mine: 'friends',   theirs: 'friends' },
  decline:  { from: ['pending'],   mine: 'none',      theirs: 'none' },
  cancel:   { from: ['requested'], mine: 'none',      theirs: 'none' },
  remove:   { from: ['friends'],   mine: 'none',      theirs: 'none' },
  // A block changes only MY side. Theirs is left exactly as it was, so
  // they are told nothing and see nothing change — which is the whole
  // point of a block, and why this table is not symmetric.
  block:    { from: ['none', 'requested', 'pending', 'friends'], mine: 'blocked', theirs: 'none' },
  unblock:  { from: ['blocked'],   mine: 'none',      theirs: 'none' },
};

const MAX_FRIENDS = 100;
const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');

async function authenticate(playerId: unknown, secret: unknown) {
  if (typeof playerId !== 'string' || typeof secret !== 'string' || !playerId || !secret) {
    return { error: 'playerId and secret are required' };
  }
  const { data } = await supabaseAdmin()
    .from('player_profiles')
    .select('secret_hash')
    .eq('player_id', playerId)
    .maybeSingle();
  if (!data) return { error: 'no such player' };
  const a = Buffer.from(hash(secret));
  const b = Buffer.from(data.secret_hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { error: 'wrong secret' };
  return { playerId };
}

/**
 * GET ?playerId=… with the secret in the `x-player-secret` header —
 * my friends, my requests, and their profiles.
 *
 * The secret used to ride in the query string, which put a long-lived
 * device credential into the request log on every open of the Friends
 * screen. `?secret=` is still read as a fallback so a phone running an
 * older bundle keeps working; new bundles never send it.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const auth = await authenticate(
    params.get('playerId'),
    request.headers.get('x-player-secret') ?? params.get('secret'),
  );
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 });

  const supabase = supabaseAdmin();
  const { data: links } = await supabase
    .from('friendships')
    .select('other_id, state, since')
    .eq('player_id', auth.playerId)
    .neq('state', 'none');

  const rows = links ?? [];
  if (rows.length === 0) return NextResponse.json({ friends: [], requests: [], blocked: [] });

  /*
    Named columns, not `*`. The old select pulled secret_hash and
    friend_code of every friend into this process — a credential and a
    code that lets anyone who has it add you, neither of which any
    caller here reads. Nothing was ever serialised out, but the safest
    place for a secret is not in the request at all.

    These ten are exactly what full() and peek() below use.
  */
  const { data: profiles } = await supabase
    .from('player_profiles')
    .select('player_id, name, trophies, wins, mode_wins, dice_owned, arenas_owned, favourite_die, favourite_arena, last_played')
    .in('player_id', rows.map((r) => r.other_id));

  const byId = new Map((profiles ?? []).map((p) => [p.player_id, p]));

  /*
    A FULL profile only for a friend. Everyone else — someone who asked
    me, someone I asked, someone I blocked — gets a name and a trophy
    count, the same as a stranger found by code. Trimming here rather
    than in the app is deliberate: the app is on someone else's phone,
    so anything sent to it is effectively public to its owner.
  */
  const full = (p: Record<string, unknown>) => ({
    playerId: p.player_id,
    name: p.name,
    trophies: p.trophies,
    wins: p.wins,
    modeWins: p.mode_wins,
    diceOwned: p.dice_owned,
    arenasOwned: p.arenas_owned,
    favouriteDie: p.favourite_die,
    favouriteArena: p.favourite_arena,
    lastPlayed: new Date(String(p.last_played)).getTime(),
  });
  const peek = (p: Record<string, unknown>) => ({
    playerId: p.player_id,
    name: p.name,
    trophies: p.trophies,
  });

  const friends = [];
  const requests = [];
  const blocked = [];
  for (const row of rows) {
    const profile = byId.get(row.other_id);
    if (!profile) continue;
    if (row.state === 'friends') friends.push({ ...full(profile), since: row.since });
    else if (row.state === 'pending') requests.push({ ...peek(profile), incoming: true });
    else if (row.state === 'requested') requests.push({ ...peek(profile), incoming: false });
    else if (row.state === 'blocked') blocked.push(peek(profile));
  }
  return NextResponse.json({ friends, requests, blocked });
}

/** POST { playerId, secret, otherId, action } */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'not JSON' }, { status: 400 });
  }

  const auth = await authenticate(body.playerId, body.secret);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 });

  const otherId = typeof body.otherId === 'string' ? body.otherId : '';
  const action = String(body.action) as Action;
  if (!otherId) return NextResponse.json({ error: 'otherId is required' }, { status: 400 });
  if (otherId === auth.playerId) {
    return NextResponse.json({ error: 'you cannot befriend yourself' }, { status: 400 });
  }
  const move = MOVES[action];
  if (!move) return NextResponse.json({ error: 'no such action' }, { status: 400 });

  const supabase = supabaseAdmin();

  const { data: mineRow } = await supabase
    .from('friendships')
    .select('state')
    .eq('player_id', auth.playerId)
    .eq('other_id', otherId)
    .maybeSingle();
  const mine: State = (mineRow?.state as State) ?? 'none';

  if (!move.from.includes(mine)) {
    return NextResponse.json(
      { error: `cannot ${action} from ${mine}` },
      { status: 409 },
    );
  }

  /*
    Their side of the pair, read for EVERY action.

    It used to be read only inside `if (action === 'request')`, and that
    was the bug: every other action upserted their row unconditionally
    from the MOVES table, so a block could be wiped by the person who
    had been blocked. B blocks A; A calls `remove`, which is legal from
    'friends'; B's row is overwritten to 'none' and the block is gone —
    A can then ask again and B gets a request they had deliberately shut
    off. Worse from a pending request: B asked A and then blocked, A
    accepts, and B's blocked row becomes 'friends'.

    src/game/friends.ts calls blocked terminal and promises the blocked
    player cannot send another request. This is what makes that true.
  */
  const { data: theirRow } = await supabase
    .from('friendships')
    .select('state')
    .eq('player_id', otherId)
    .eq('other_id', auth.playerId)
    .maybeSingle();

  /*
    A request is refused if THEY have blocked me — and the refusal is
    deliberately indistinguishable from any other failure, because a
    message saying "they blocked you" is exactly the confrontation a
    quiet block exists to avoid.
  */
  if (action === 'request') {
    if (theirRow?.state === 'blocked') {
      return NextResponse.json({ ok: true, sent: true });
    }
    const { count } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('player_id', auth.playerId)
      .eq('state', 'friends');
    if ((count ?? 0) >= MAX_FRIENDS) {
      return NextResponse.json({ error: 'friend list is full' }, { status: 409 });
    }
  }

  const now = new Date().toISOString();
  const writes = [
    supabase.from('friendships').upsert({
      player_id: auth.playerId,
      other_id: otherId,
      state: move.mine,
      since: now,
    }),
  ];
  /*
    `block` deliberately leaves their side alone; every other move is
    agreed by both, so both rows move together — UNLESS their row holds
    a block. A row that says 'blocked' is never overwritten by the other
    side, whatever they do, which is what makes a block survive.
  */
  if (action !== 'block' && theirRow?.state !== 'blocked') {
    writes.push(
      supabase.from('friendships').upsert({
        player_id: otherId,
        other_id: auth.playerId,
        state: move.theirs,
        since: now,
      }),
    );
  }
  const results = await Promise.all(writes);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, state: move.mine });
}
