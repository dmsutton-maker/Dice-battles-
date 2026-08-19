import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import type { Idea } from '@/lib/types';

/**
 * What runs on its own, and what it has actually done.
 *
 * Two halves on purpose. The top half is what is CONFIGURED — described
 * here in code, because the schedules themselves live in Claude's own
 * routines, not in this database, and a page that invented its own
 * version of that would drift from the truth. The bottom half is what
 * actually HAPPENED, read live from the board and the activity log — so
 * if something claims to be running and nothing ever appears below, that
 * gap is the story.
 */

interface Standing {
  name: string;
  emoji: string;
  when: string;
  does: string;
  asks: string;
  caveat?: string;
}

const STANDING: Standing[] = [
  {
    emoji: '🐞',
    name: 'Bug watch',
    when: 'Every hour',
    does: 'Reads the board for new bug reports — from the family, or sent straight from the game’s Report a Bug button.',
    asks:
      'Priority 1 ("Drop everything") is fixed straight away without asking. Everything else emails David and waits for a yes.',
    caveat:
      'Set up, but not yet proven: the first automatic run will show whether it keeps the database and email access it needs. If nothing ever appears below, that is what went wrong.',
  },
  {
    emoji: '✍️',
    name: 'Support drafts',
    when: 'When a message arrives',
    does: 'Writes a suggested reply to a player’s message and leaves it on the ticket.',
    asks: 'Never sends anything. A person reads it, edits it, and presses Send — or bins it.',
  },
  {
    emoji: '🧪',
    name: 'Build checks',
    when: 'After every code change',
    does: 'Typecheck, the full test suite, and a bundle check for the game; build and a real page-load check for the website.',
    asks: 'Nothing ships if these fail.',
  },
];

export default async function AutomationPage() {
  const supabase = await supabaseServer();

  const [{ data: ideas }, { data: drafts }, { data: activity }] = await Promise.all([
    supabase.from('ideas').select('*').eq('kind', 'bug').order('created_at', { ascending: false }),
    supabase.from('message_replies').select('id').eq('is_draft', true),
    supabase
      .from('activity')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  const bugs = (ideas ?? []) as Idea[];
  const openBugs = bugs.filter((b) => b.status !== 'shipped' && b.status !== 'declined');
  const dropEverything = openBugs.filter((b) => b.priority === 1);
  const draftCount = (drafts ?? []).length;

  return (
    <>
      <div className="grid" style={{ marginBottom: 18 }}>
        <div className="card card-tight">
          <h3 style={{ color: dropEverything.length > 0 ? 'var(--red)' : 'var(--text)' }}>
            {dropEverything.length}
          </h3>
          <div className="faint">drop-everything bugs open</div>
        </div>
        <div className="card card-tight">
          <h3>{openBugs.length}</h3>
          <div className="faint">bugs open in total</div>
        </div>
        <div className="card card-tight">
          <h3 style={{ color: draftCount > 0 ? 'var(--orange)' : 'var(--text)' }}>{draftCount}</h3>
          <div className="faint">
            {draftCount === 1 ? 'reply waiting' : 'replies waiting'} for you to check
          </div>
        </div>
      </div>

      {dropEverything.length > 0 && (
        <div className="notice notice-bad">
          <strong>Drop everything:</strong>{' '}
          {dropEverything.map((bug, i) => (
            <span key={bug.id}>
              {i > 0 && ', '}
              <Link href={`/admin/ideas/${bug.id}`}>{bug.title}</Link>
            </span>
          ))}
          . These get fixed without waiting to be asked.
        </div>
      )}

      {draftCount > 0 && (
        <div className="notice">
          <strong>{draftCount} suggested {draftCount === 1 ? 'reply' : 'replies'}</strong> waiting
          in <Link href="/admin/support">Support</Link>. Nothing has been sent to anyone —
          they go out only when a person presses Send.
        </div>
      )}

      <h2 style={{ fontSize: 18, marginTop: 24 }}>What runs on its own</h2>
      {STANDING.map((job) => (
        <div className="card" key={job.name}>
          <div className="spread">
            <h3 style={{ margin: 0 }}>
              {job.emoji} {job.name}
            </h3>
            <span className="pill pill-outline">{job.when}</span>
          </div>
          <p className="muted" style={{ margin: '8px 0 4px' }}>{job.does}</p>
          <p className="faint" style={{ margin: 0 }}>{job.asks}</p>
          {job.caveat && (
            <div className="notice" style={{ marginTop: 10, marginBottom: 0 }}>
              {job.caveat}
            </div>
          )}
        </div>
      ))}

      <h2 style={{ fontSize: 18, marginTop: 24 }}>What has actually happened</h2>
      <div className="card">
        {(activity ?? []).length === 0 && (
          <p className="faint">Nothing recorded yet.</p>
        )}
        {(activity ?? []).map((row: { id: string; actor: string; action: string; detail: string; created_at: string }) => (
          <div key={row.id} style={{ borderTop: '1px solid var(--line)', padding: '9px 0' }}>
            <div>
              <strong>{row.actor}</strong> <span className="muted">{row.action}</span>
            </div>
            {row.detail && <div className="faint">{row.detail}</div>}
            <div className="faint">{new Date(row.created_at).toLocaleString()}</div>
          </div>
        ))}
        <p className="faint" style={{ marginTop: 12, marginBottom: 0 }}>
          The last 40. <Link href="/admin/activity">Full history →</Link>
        </p>
      </div>
    </>
  );
}
