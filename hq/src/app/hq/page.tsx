import Link from 'next/link';
import { currentMember, supabaseServer } from '@/lib/supabase/server';
import {
  CATEGORY_LABELS,
  Idea,
  isDue,
  Member,
  monthLabel,
  Phase,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_ORDER,
} from '@/lib/types';
import { addIdea } from './actions';

/**
 * The board: every idea, grouped by what has been decided about it.
 *
 * Order matters — being built, then approved and waiting, then the
 * undecided pile. What is happening now sits above what might happen.
 */
export default async function IdeasPage() {
  const member = await currentMember();
  const supabase = await supabaseServer();

  const [{ data: ideas }, { data: members }, { data: phases }] =
    await Promise.all([
      supabase
        .from('ideas')
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false }),
      supabase.from('members').select('*'),
      supabase.from('phases').select('*').order('position'),
    ]);

  const byId = new Map((members ?? []).map((m: Member) => [m.id, m]));
  const phaseById = new Map((phases ?? []).map((p: Phase) => [p.id, p]));
  const all = (ideas ?? []) as Idea[];

  const counts = {
    pending: all.filter((i) => i.status === 'pending').length,
    approved: all.filter((i) => i.status === 'approved').length,
    building: all.filter((i) => i.status === 'building').length,
    shipped: all.filter((i) => i.status === 'shipped').length,
  };

  return (
    <>
      <div className="grid" style={{ marginBottom: 18 }}>
        <div className="card card-tight">
          <h3 style={{ color: STATUS_COLORS.pending }}>{counts.pending}</h3>
          <div className="faint">waiting on a decision</div>
        </div>
        <div className="card card-tight">
          <h3 style={{ color: STATUS_COLORS.approved }}>{counts.approved}</h3>
          <div className="faint">approved, queued up</div>
        </div>
        <div className="card card-tight">
          <h3 style={{ color: STATUS_COLORS.building }}>{counts.building}</h3>
          <div className="faint">being built now</div>
        </div>
        <div className="card card-tight">
          <h3 style={{ color: STATUS_COLORS.shipped }}>{counts.shipped}</h3>
          <div className="faint">shipped into the game</div>
        </div>
      </div>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 800 }}>
          ➕ Report a bug or add an idea
        </summary>
        <form action={addIdea}>
          <label>WHICH IS IT?</label>
          <div className="row" style={{ marginBottom: 6 }}>
            <label
              style={{
                display: 'flex', gap: 8, alignItems: 'center',
                margin: 0, flex: '1 1 45%', color: 'var(--text)',
                fontWeight: 700, textTransform: 'none', fontSize: 15,
              }}
            >
              <input type="radio" name="kind" value="bug" style={{ width: 18, height: 18 }} />
              <span>🐞 Something is broken</span>
            </label>
            <label
              style={{
                display: 'flex', gap: 8, alignItems: 'center',
                margin: 0, flex: '1 1 45%', color: 'var(--text)',
                fontWeight: 700, textTransform: 'none', fontSize: 15,
              }}
            >
              <input
                type="radio" name="kind" value="feature" defaultChecked
                style={{ width: 18, height: 18 }}
              />
              <span>💡 A new idea</span>
            </label>
          </div>
          <p className="faint" style={{ marginTop: 0 }}>
            Bugs get fixed without waiting — they go straight onto the work
            list. New ideas wait for David to say yes.
          </p>

          <label htmlFor="title">WHAT IS THE IDEA?</label>
          <input
            id="title"
            name="title"
            required
            maxLength={120}
            placeholder="Dice that leave a trail of sparkles"
          />

          <label htmlFor="detail">
            TELL ME MORE — why is it good, how should it work?
          </label>
          <textarea
            id="detail"
            name="detail"
            placeholder="The more you write here, the closer what gets built will be to what you pictured."
          />

          <div className="grid">
            <div>
              <label htmlFor="category">WHAT KIND OF THING IS IT?</label>
              <select id="category" name="category" defaultValue="game">
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="priority">HOW BADLY DO YOU WANT IT?</label>
              <select id="priority" name="priority" defaultValue="3">
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {value} — {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid">
            <div>
              <label htmlFor="scheduled_for">START IT ON — leave empty for any time</label>
              <input id="scheduled_for" name="scheduled_for" type="date" />
            </div>
            <div>
              <label htmlFor="deadline">HAS TO BE DONE BY</label>
              <input id="deadline" name="deadline" type="date" />
            </div>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              name="repeats_yearly"
              style={{ width: 18, height: 18 }}
            />
            <span>Comes round every year (holidays, seasons)</span>
          </label>
          <p className="faint" style={{ marginTop: 4 }}>
            A date means it waits its turn. Put &quot;holiday themes&quot; on
            1 November and it sits quietly until November, then shows up as
            work to do.
          </p>

          <div style={{ marginTop: 16 }}>
            <button type="submit">Put it on the board</button>
          </div>
        </form>
      </details>

      {all.length === 0 && (
        <div className="notice">
          Nothing on the board yet. Add the first idea above — anyone in the
          family can, and {member?.role === 'owner' ? 'you' : 'David'} decides
          what gets built.
        </div>
      )}

      {STATUS_ORDER.map((status) => {
        const group = all.filter((idea) => idea.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status} style={{ marginTop: 26 }}>
            <h2 style={{ fontSize: 18 }}>
              <span
                className="pill"
                style={{ background: STATUS_COLORS[status] }}
              >
                {STATUS_LABELS[status]}
              </span>{' '}
              <span className="faint">{group.length}</span>
            </h2>
            {group.map((idea) => {
              const author = idea.submitted_by
                ? byId.get(idea.submitted_by)
                : null;
              const phase = idea.phase_id ? phaseById.get(idea.phase_id) : null;
              return (
                <Link
                  key={idea.id}
                  href={`/hq/ideas/${idea.id}`}
                  className="idea"
                  style={{ borderLeftColor: STATUS_COLORS[idea.status] }}
                >
                  <div className="spread">
                    <h3>{idea.title}</h3>
                    <span className="pill pill-outline">
                      {idea.kind === 'bug' ? '🐞 Bug' : CATEGORY_LABELS[idea.category]}
                    </span>
                  </div>
                  {idea.detail && (
                    <p
                      className="muted"
                      style={{
                        margin: '4px 0 6px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {idea.detail}
                    </p>
                  )}
                  <div className="faint">
                    {author ? `from ${author.display_name}` : 'from someone'}
                    {' · '}
                    {PRIORITY_LABELS[idea.priority]}
                    {phase ? ` · ${phase.name}` : ''}
                    {idea.shipped_version ? ` · ${idea.shipped_version}` : ''}
                  </div>
                  {(idea.scheduled_for || idea.deadline) && (
                    <div style={{ marginTop: 5 }}>
                      {idea.scheduled_for && (
                        <span
                          className="pill"
                          style={{
                            background: isDue(idea) ? '#33cc6b' : '#4b7bff',
                            color: isDue(idea) ? '#0d2417' : '#ffffff',
                            marginRight: 6,
                          }}
                        >
                          {isDue(idea)
                            ? '🗓️ its turn now'
                            : `🗓️ ${monthLabel(idea.scheduled_for)}`}
                        </span>
                      )}
                      {idea.deadline && (
                        <span className="pill pill-outline">
                          ⏰ by {idea.deadline}
                        </span>
                      )}
                      {idea.repeats_yearly && (
                        <span className="pill pill-outline" style={{ marginLeft: 6 }}>
                          🔁 yearly
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </section>
        );
      })}
    </>
  );
}
