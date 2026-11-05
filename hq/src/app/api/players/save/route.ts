import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { authenticatePlayer, touchSeen } from '@/lib/playerAuth';
import { checkSnapshot, cleanGameVersion, isSaveAction } from '@/lib/playerSave';

/**
 * The player's progress backup.
 *
 * Marc, 5 Nov 2026: "When I delete the game and redownload it, it
 * completely resets my account, friends, friend code, trophies, coins,
 * and everything."
 *
 * POST { playerId, secret, action: 'save', snapshot, gameVersion }
 *   keeps the snapshot as this player's one row in `player_saves`
 *   (20261105_player_saves.sql), replacing whatever was there.
 * POST { playerId, secret, action: 'load' }
 *   answers { snapshot, savedAt, gameVersion }, with snapshot null when
 *   the player has never saved.
 *
 * The snapshot is the GAME'S: an opaque JSON object the game collects
 * from its own saved modules (src/game/cloudSave.ts) and reads back
 * through the same validation a local save gets. The server checks its
 * shape and its size (../../../lib/playerSave.ts) and nothing inside.
 *
 * Authentication is the device secret, exactly as everywhere else here
 * — see the note at the top of ../route.ts. The profile row is made by
 * the friends and matchmaking routes; a phone the server has never met
 * gets 401 and the game sends its profile once and tries again.
 *
 * Until the migration is applied there is no `player_saves` table:
 * both answer 503, which the game reads as "try again later", so it
 * carries on exactly as it did before this existed. That is what makes
 * the website safe to deploy first.
 */

export const dynamic = 'force-dynamic';

type SaveRow = { snapshot: unknown; saved_at: string; game_version: string };

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'not JSON' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
  if (!isSaveAction(body.action)) {
    return NextResponse.json({ error: 'action must be save or load' }, { status: 400 });
  }

  const auth = await authenticatePlayer(body.playerId, body.secret);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  touchSeen(auth.playerId);
  const supabase = supabaseAdmin();

  if (body.action === 'load') {
    const { data, error } = await supabase
      .from('player_saves')
      .select('snapshot, saved_at, game_version')
      .eq('player_id', auth.playerId)
      .maybeSingle<SaveRow>();
    /*
      A read that FAILED is not a player who has never saved. The game
      reads null as "the server has none" and stops asking, so a blip
      (or the table not being there yet) answers 503 instead, which the
      game reads as "no answer, ask again next launch".
    */
    if (error) return NextResponse.json({ error: 'could not read that' }, { status: 503 });
    if (!data) return NextResponse.json({ snapshot: null });
    return NextResponse.json({
      snapshot: data.snapshot,
      savedAt: data.saved_at,
      gameVersion: data.game_version,
    });
  }

  const checked = checkSnapshot(body.snapshot);
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: checked.status });
  }
  const { error } = await supabase.from('player_saves').upsert(
    {
      player_id: auth.playerId,
      snapshot: body.snapshot,
      saved_at: new Date().toISOString(),
      game_version: cleanGameVersion(body.gameVersion),
    },
    { onConflict: 'player_id' },
  );
  if (error) {
    // The database's own message is not shown to a player. The game
    // keeps the snapshot marked as waiting and tries again later.
    return NextResponse.json({ error: 'could not save that' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, bytes: checked.bytes });
}
