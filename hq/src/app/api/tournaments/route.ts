import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * The Cups tab's feed, read by the game itself.
 *
 * David, 25 Sep 2026: "Rework the entire cups tab to be online
 * tournaments." This is the online half — the list of cups the game
 * shows, served from here rather than baked into the binary, so a new
 * one can be put in front of every player without an App Store release
 * or even an over-the-air update.
 *
 * PUBLIC and read-only, for the same reason /api/news is. It is read by
 * a phone, and a token shipped inside an app is not a token — it is a
 * string anybody can pull out of the binary. There is nothing behind
 * this door but a list of challenges we want players to find.
 *
 * It reads with the admin key because the table's own rules are
 * member-only and there is no signed-in person on the other end. The
 * filter to `published` is applied HERE rather than left to the caller,
 * so a cup still being written cannot be fetched by guessing a query
 * string.
 *
 * An EMPTY list is a real answer. The game ships with four permanent
 * cups and merges these on top, so "nothing extra is running this
 * month" is a thing this endpoint must be able to say — and saying it
 * can never empty the tab.
 */

export const dynamic = 'force-dynamic';

/** What the game expects. Matches TournamentDef in src/game/tournament.ts. */
interface Tournament {
  id: string;
  name: string;
  blurb: string;
  mode: string;
  difficulty: string;
  target: number;
  prize: {
    coins: { min: number; max: number };
    trophies: number;
    item?: { kind: string; id: string };
  };
  opens?: string;
  closes?: string;
}

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('tournaments')
      .select(
        'slug, name, blurb, mode, difficulty, target, coins_min, coins_max, trophies, item_kind, item_id, opens, closes',
      )
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;

    const tournaments: Tournament[] = (data ?? []).map((row) => ({
      id: row.slug,
      name: row.name,
      blurb: row.blurb ?? '',
      mode: row.mode,
      difficulty: row.difficulty,
      target: row.target,
      prize: {
        coins: { min: row.coins_min, max: row.coins_max },
        trophies: row.trophies,
        ...(row.item_kind && row.item_id
          ? { item: { kind: row.item_kind, id: row.item_id } }
          : {}),
      },
      ...(row.opens ? { opens: row.opens } : {}),
      ...(row.closes ? { closes: row.closes } : {}),
    }));

    return NextResponse.json(
      { tournaments },
      {
        headers: {
          /*
            Five minutes at the edge, and a stale copy may be served for
            an hour while a fresh one is fetched behind it — the same
            deal the news feed has.

            Safe despite the deadlines, because a cup's window is read
            from the DATE on the row rather than from when it was
            fetched: an hour-old copy of a cup that closed last night is
            still a cup that closed last night, and the game drops it.
          */
          'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600',
        },
      },
    );
  } catch {
    /*
      An empty list, not a 500. The game treats this endpoint as an extra
      on top of the cups it already ships with, so the worst outcome of a
      failure here is "nothing new this week" — never an error a player
      has to see, and never an empty Cups tab.
    */
    return NextResponse.json({ tournaments: [] }, { status: 200 });
  }
}
