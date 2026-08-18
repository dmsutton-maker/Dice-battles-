import { supabaseServer } from '@/lib/supabase/server';

interface ActivityRow {
  id: string;
  idea_id: string | null;
  actor: string;
  action: string;
  detail: string;
  created_at: string;
}

/**
 * Everything that has happened, newest first.
 *
 * Same reasoning as the game's CHANGELOG recording who asked for what: a
 * decision you cannot trace back to a person and a date is a decision you
 * cannot argue with later.
 */
export default async function ActivityPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('activity')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = (data ?? []) as ActivityRow[];

  return (
    <div className="card">
      <h3>History</h3>
      {rows.length === 0 && <p className="faint">Nothing has happened yet.</p>}
      {rows.map((row) => (
        <div
          key={row.id}
          style={{
            borderTop: '1px solid var(--line)',
            padding: '9px 0',
          }}
        >
          <div>
            <strong>{row.actor}</strong>{' '}
            <span className="muted">{row.action}</span>
          </div>
          {row.detail && <div className="faint">{row.detail}</div>}
          <div className="faint">{new Date(row.created_at).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
