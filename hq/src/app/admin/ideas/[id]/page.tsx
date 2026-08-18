import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentMember, supabaseServer } from '@/lib/supabase/server';
import {
  APP_OPTIONS,
  CATEGORY_LABELS,
  Comment,
  Idea,
  isDue,
  Member,
  monthLabel,
  Phase,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  whenPhrase,
} from '@/lib/types';
import { addComment, decideIdea, updateIdea } from '../../actions';

/**
 * One idea, in full: what it is, the argument about it, and — if you are
 * David — the buttons that decide its fate.
 *
 * Approving is what puts an idea in the queue Claude reads, so the
 * decision buttons are the hinge the whole system turns on.
 */
export default async function IdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = await currentMember();
  const supabase = await supabaseServer();

  const [{ data: idea }, { data: members }, { data: phases }, { data: comments }] =
    await Promise.all([
      supabase.from('ideas').select('*').eq('id', id).maybeSingle(),
      supabase.from('members').select('*'),
      supabase.from('phases').select('*').order('position'),
      supabase
        .from('comments')
        .select('*')
        .eq('idea_id', id)
        .order('created_at'),
    ]);

  if (!idea) notFound();

  const item = idea as Idea;
  const byId = new Map((members ?? []).map((m: Member) => [m.id, m]));
  const author = item.submitted_by ? byId.get(item.submitted_by) : null;
  const decider = item.decided_by ? byId.get(item.decided_by) : null;
  const isOwner = member?.role === 'owner';
  const canEdit = isOwner || (item.submitted_by === member?.id && item.status === 'pending');

  return (
    <>
      <Link href="/admin" className="faint">
        ← back to the board
      </Link>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="spread">
          <h2 style={{ margin: 0 }}>{item.title}</h2>
          <span className="pill" style={{ background: STATUS_COLORS[item.status] }}>
            {STATUS_LABELS[item.status]}
          </span>
        </div>
        <p className="faint" style={{ marginTop: 6 }}>
          {item.app} · {item.kind === 'bug' ? '🐞 Bug' : '💡 Feature'} ·{' '}
          {CATEGORY_LABELS[item.category]} · {PRIORITY_LABELS[item.priority]}
          {author ? ` · from ${author.display_name}` : ''}
          {item.shipped_version ? ` · shipped in ${item.shipped_version}` : ''}
        </p>

        {(item.scheduled_for || item.deadline) && (
          <div className="notice" style={{ marginTop: 10 }}>
            {item.scheduled_for && (
              <div>
                🗓️ <strong>Starts {monthLabel(item.scheduled_for)}</strong> —{' '}
                {item.scheduled_for} ({whenPhrase(item.scheduled_for)}).
                {!isDue(item) &&
                  ' Approved, but deliberately not started until then.'}
              </div>
            )}
            {item.deadline && (
              <div>
                ⏰ Has to be done by {item.deadline} ({whenPhrase(item.deadline)}).
              </div>
            )}
            {item.repeats_yearly && <div>🔁 Comes round again every year.</div>}
          </div>
        )}
        {item.detail && (
          <p style={{ whiteSpace: 'pre-wrap' }}>{item.detail}</p>
        )}
        {item.decision_note && (
          <div className="notice" style={{ marginTop: 12 }}>
            <strong>
              {decider ? `${decider.display_name} said:` : 'Decision:'}
            </strong>{' '}
            {item.decision_note}
          </div>
        )}
      </div>

      {isOwner && (
        <div className="card">
          <h3>Decide</h3>
          <p className="faint" style={{ marginTop: -4 }}>
            Approving puts this in the queue that gets built next. Everything
            else parks it without losing it.
          </p>
          <form action={decideIdea}>
            <input type="hidden" name="id" value={item.id} />
            <label htmlFor="decision_note">
              A NOTE ABOUT WHY (optional, but it is what gets remembered)
            </label>
            <input
              id="decision_note"
              name="decision_note"
              defaultValue={item.decision_note}
              placeholder="Yes, but only after the App Store launch."
            />
            <div className="row" style={{ marginTop: 14 }}>
              <button
                className="button-green"
                name="status"
                value="approved"
                type="submit"
              >
                ✅ Approve
              </button>
              <button
                className="button-quiet"
                name="status"
                value="parked"
                type="submit"
              >
                ⏸️ Park for later
              </button>
              <button
                className="button-red"
                name="status"
                value="declined"
                type="submit"
              >
                ✕ Not doing it
              </button>
              <button
                className="button-quiet"
                name="status"
                value="pending"
                type="submit"
              >
                ↩︎ Undecide
              </button>
            </div>
          </form>
        </div>
      )}

      {canEdit && (
        <details className="card">
          <summary style={{ cursor: 'pointer', fontWeight: 800 }}>
            ✏️ Edit this idea
          </summary>
          <form action={updateIdea}>
            <input type="hidden" name="id" value={item.id} />
            <label htmlFor="title">TITLE</label>
            <input id="title" name="title" defaultValue={item.title} required />
            <label htmlFor="detail">DETAIL</label>
            <textarea id="detail" name="detail" defaultValue={item.detail} />
            <label htmlFor="app">WHICH APP</label>
            <select id="app" name="app" defaultValue={item.app}>
              {APP_OPTIONS.map((app) => (
                <option key={app} value={app}>
                  {app}
                </option>
              ))}
            </select>
            <div className="grid">
              <div>
                <label htmlFor="category">KIND</label>
                <select id="category" name="category" defaultValue={item.category}>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="priority">PRIORITY</label>
                <select
                  id="priority"
                  name="priority"
                  defaultValue={String(item.priority)}
                >
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {value} — {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="phase_id">PHASE</label>
                <select
                  id="phase_id"
                  name="phase_id"
                  defaultValue={item.phase_id ?? ''}
                  disabled={!isOwner}
                >
                  <option value="">— not scheduled —</option>
                  {(phases ?? []).map((phase: Phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid">
              <div>
                <label htmlFor="scheduled_for">START IT ON</label>
                <input
                  id="scheduled_for"
                  name="scheduled_for"
                  type="date"
                  defaultValue={item.scheduled_for ?? ''}
                />
              </div>
              <div>
                <label htmlFor="deadline">DONE BY</label>
                <input
                  id="deadline"
                  name="deadline"
                  type="date"
                  defaultValue={item.deadline ?? ''}
                />
              </div>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                name="repeats_yearly"
                defaultChecked={item.repeats_yearly}
                style={{ width: 18, height: 18 }}
              />
              <span>Comes round every year</span>
            </label>

            <div style={{ marginTop: 16 }}>
              <button type="submit">Save changes</button>
            </div>
          </form>
        </details>
      )}

      <div className="card">
        <h3>Talk about it</h3>
        {(comments ?? []).length === 0 && (
          <p className="faint">No comments yet.</p>
        )}
        {((comments ?? []) as Comment[]).map((comment) => {
          const who = comment.member_id ? byId.get(comment.member_id) : null;
          return (
            <div
              key={comment.id}
              style={{
                borderTop: '1px solid var(--line)',
                paddingTop: 10,
                marginTop: 10,
              }}
            >
              <div className="faint">
                {who?.display_name ?? 'someone'} ·{' '}
                {new Date(comment.created_at).toLocaleDateString()}
              </div>
              <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                {comment.body}
              </p>
            </div>
          );
        })}
        <form action={addComment} style={{ marginTop: 14 }}>
          <input type="hidden" name="idea_id" value={item.id} />
          <label htmlFor="body">ADD A COMMENT</label>
          <textarea id="body" name="body" required style={{ minHeight: 70 }} />
          <div style={{ marginTop: 12 }}>
            <button className="button-quiet" type="submit">
              Post
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
