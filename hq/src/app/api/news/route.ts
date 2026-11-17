import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * The News tab's feed, read by the game itself.
 *
 * Deliberately PUBLIC and read-only. Every other endpoint here wants the
 * HQ token, but this one is read by a phone, and a token shipped inside an
 * app is not a token — it is a string anybody can pull out of the binary.
 * Since the only thing behind this door is news we want players to read,
 * there is nothing to protect.
 *
 * It reads with the admin key for the same reason the public website does:
 * the table's own rules are member-only, and there is no signed-in person
 * on the other end of this request. The filter to `published` is applied
 * HERE rather than left to the caller, so an unfinished draft cannot be
 * fetched by guessing a query string.
 */

export const dynamic = 'force-dynamic';

/** What the game expects. Matches NewsItem in src/game/news.ts. */
interface NewsPost {
  id: string;
  date: string;
  title: string;
  emoji: string;
  body: string;
  version?: string;
}

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('game_news')
      .select('slug, shown_date, title, emoji, body, version')
      .eq('published', true)
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const posts: NewsPost[] = (data ?? []).map((row) => ({
      id: row.slug,
      date: row.shown_date,
      title: row.title,
      emoji: row.emoji || '📣',
      body: row.body,
      ...(row.version ? { version: row.version } : {}),
    }));

    return NextResponse.json(
      { posts },
      {
        headers: {
          // Five minutes at the edge, and a stale copy may be served for an
          // hour while a fresh one is fetched behind it. A News tab is not
          // worth waking the database for on every launch, and a player
          // seeing five-minute-old news has lost nothing.
          'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600',
        },
      },
    );
  } catch {
    // An empty list, not a 500. The game treats this endpoint as an
    // optional extra on top of the news it already ships with, so the
    // worst outcome of a failure here should be "no new posts today" —
    // never an error a player has to see.
    return NextResponse.json({ posts: [] }, { status: 200 });
  }
}
