import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS, type Idea } from '@/lib/types';
import { Office, type Worker } from './Office';

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

interface ChangeRow {
  id: string;
  summary: string;
  area: string;
  version: string;
  created_at: string;
}

const AREA_COLOR: Record<string, string> = {
  game: 'var(--accent)',
  website: 'var(--green)',
  admin: 'var(--yellow)',
  'behind the scenes': 'var(--muted)',
};

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

  const [{ data: ideas }, { data: drafts }, { data: changes }, { data: activity }] =
    await Promise.all([
      supabase.from('ideas').select('*').eq('kind', 'bug').order('created_at', { ascending: false }),
      supabase.from('message_replies').select('id').eq('is_draft', true),
      supabase
        .from('changes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('activity')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

  const bugs = (ideas ?? []) as Idea[];
  const openBugs = bugs.filter((b) => b.status !== 'shipped' && b.status !== 'declined');
  const dropEverything = openBugs.filter((b) => b.priority === 1);
  const draftCount = (drafts ?? []).length;

  // Everyone in the room, and why they are in the state they are in.
  const workers: Worker[] = [
    {
      id: 'bugs',
      name: 'Bug watch',
      emoji: '🐞',
      role: 'Finds and fixes what is broken',
      x: 20,
      y: 52,
      state:
        dropEverything.length > 0 ? 'alert' : openBugs.length > 0 ? 'waiting' : 'idle',
      note:
        dropEverything.length > 0
          ? `${dropEverything.length} drop-everything ${dropEverything.length === 1 ? 'bug' : 'bugs'} — fixing without waiting`
          : openBugs.length > 0
            ? `${openBugs.length} open ${openBugs.length === 1 ? 'bug' : 'bugs'} — asked, waiting on your yes`
            : 'No open bugs',
    },
    {
      id: 'support',
      name: 'Support',
      emoji: '✍️',
      role: 'Drafts replies for you to send',
      x: 50,
      y: 60,
      state: draftCount > 0 ? 'waiting' : 'idle',
      note:
        draftCount > 0
          ? `${draftCount} suggested ${draftCount === 1 ? 'reply' : 'replies'} for you to check`
          : 'No messages needing a reply',
    },
    {
      id: 'tests',
      name: 'Build checks',
      emoji: '🧪',
      role: 'Runs the tests before anything ships',
      x: 80,
      y: 52,
      state: 'idle',
      note: 'Runs on every change, not on a clock',
    },
  ];

  return (
    <>
      <Office workers={workers} />

      <div className="grid" style={{ marginBottom: 18 }}>
        {workers.map((w) => (
          <div className="card card-tight" key={`note-${w.id}`}>
            <strong>
              {w.emoji} {w.name}
            </strong>
            <div className="faint">{w.role}</div>
            <div className="muted" style={{ marginTop: 4 }}>{w.note}</div>
          </div>
        ))}
      </div>

      <div className="grid" style={{ marginBottom: 18 }}>
        <Link href="/admin" className="card card-tight" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
          <h3 style={{ color: dropEverything.length > 0 ? 'var(--red)' : 'var(--text)' }}>
            {dropEverything.length}
          </h3>
          <div className="faint">drop-everything bugs open</div>
        </Link>
        <Link href="/admin" className="card card-tight" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
          <h3>{openBugs.length}</h3>
          <div className="faint">bugs open in total</div>
        </Link>
        <Link href="/admin/support" className="card card-tight" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
          <h3 style={{ color: draftCount > 0 ? 'var(--orange)' : 'var(--text)' }}>{draftCount}</h3>
          <div className="faint">
            {draftCount === 1 ? 'reply waiting' : 'replies waiting'} for you to check
          </div>
        </Link>
      </div>

      {openBugs.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>Bugs open right now</h3>
          <p className="faint" style={{ marginTop: 0 }}>
            Click one to read it and decide. Anything marked{' '}
            <strong>Drop everything</strong> gets fixed without waiting to be
            asked; the rest wait for your yes.
          </p>
          {openBugs.map((bug) => (
            <Link
              key={bug.id}
              href={`/admin/ideas/${bug.id}`}
              className="idea"
              style={{
                borderLeftColor:
                  bug.priority === 1 ? 'var(--red)' : STATUS_COLORS[bug.status],
              }}
            >
              <div className="spread">
                <h3>{bug.title}</h3>
                <span
                  className="pill"
                  style={
                    bug.priority === 1
                      ? { background: 'var(--red)' }
                      : { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)' }
                  }
                >
                  {PRIORITY_LABELS[bug.priority]}
                </span>
              </div>
              <div className="faint">
                {bug.app} · {STATUS_LABELS[bug.status]}
              </div>
              {bug.detail && (
                <p
                  className="muted"
                  style={{
                    margin: '4px 0 0',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {bug.detail}
                </p>
              )}
            </Link>
          ))}
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

      <h2 style={{ fontSize: 18, marginTop: 24 }}>What changed, in plain words</h2>
      <p className="faint" style={{ marginTop: -6 }}>
        Every change to the game, the website or this admin — one line each,
        newest first.
      </p>
      <div className="card">
        {(changes ?? []).length === 0 && <p className="faint">Nothing yet.</p>}
        {((changes ?? []) as ChangeRow[]).map((row) => (
          <div key={row.id} style={{ borderTop: '1px solid var(--line)', padding: '11px 0' }}>
            <div className="row" style={{ gap: 8, marginBottom: 3 }}>
              <span
                className="pill"
                style={{ background: AREA_COLOR[row.area] ?? 'var(--faint)' }}
              >
                {row.area}
              </span>
              {row.version && <span className="pill pill-outline">{row.version}</span>}
              <span className="faint">
                {new Date(row.created_at).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </div>
            <div>{row.summary}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Who did what in here</h2>
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
