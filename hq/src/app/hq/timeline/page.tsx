import Link from 'next/link';
import { currentMember, supabaseServer } from '@/lib/supabase/server';
import {
  Idea,
  Phase,
  STATUS_COLORS,
  STATUS_LABELS,
} from '@/lib/types';
import { addPhase, setPhaseStatus } from '../actions';

/**
 * The timeline: phases down the page, with the ideas assigned to each.
 *
 * Ideas with no phase are listed at the bottom rather than hidden — an
 * approved idea nobody has scheduled is exactly the thing that quietly
 * gets forgotten.
 */
export default async function TimelinePage() {
  const member = await currentMember();
  const supabase = await supabaseServer();

  const [{ data: phases }, { data: ideas }] = await Promise.all([
    supabase.from('phases').select('*').order('position'),
    supabase.from('ideas').select('*').order('priority'),
  ]);

  const all = (ideas ?? []) as Idea[];
  const unscheduled = all.filter(
    (idea) =>
      !idea.phase_id &&
      ['approved', 'building', 'pending'].includes(idea.status),
  );

  return (
    <>
      <p className="muted">
        What happens when. Each phase is a chunk of work — drag nothing,
        just set an idea&apos;s phase on its own page.
      </p>

      {((phases ?? []) as Phase[]).map((phase) => {
        const inPhase = all.filter((idea) => idea.phase_id === phase.id);
        const done = inPhase.filter((i) => i.status === 'shipped').length;
        return (
          <div
            key={phase.id}
            className={`phase ${
              phase.status === 'active'
                ? 'phase-active'
                : phase.status === 'done'
                  ? 'phase-done'
                  : ''
            }`}
            style={{ marginBottom: 22 }}
          >
            <div className="spread">
              <h2 style={{ marginBottom: 2 }}>{phase.name}</h2>
              <span className="pill pill-outline">
                {phase.status === 'active'
                  ? 'happening now'
                  : phase.status === 'done'
                    ? 'finished'
                    : 'later'}
              </span>
            </div>
            {phase.summary && <p className="muted">{phase.summary}</p>}
            <p className="faint">
              {inPhase.length === 0
                ? 'Nothing scheduled in here yet.'
                : `${done} of ${inPhase.length} shipped`}
              {phase.starts_on ? ` · from ${phase.starts_on}` : ''}
              {phase.ends_on ? ` to ${phase.ends_on}` : ''}
            </p>

            {inPhase.map((idea) => (
              <Link
                key={idea.id}
                href={`/hq/ideas/${idea.id}`}
                className="idea"
                style={{ borderLeftColor: STATUS_COLORS[idea.status] }}
              >
                <div className="spread">
                  <strong>{idea.title}</strong>
                  <span className="faint">{STATUS_LABELS[idea.status]}</span>
                </div>
              </Link>
            ))}

            {member?.role === 'owner' && (
              <form action={setPhaseStatus} className="row" style={{ marginTop: 8 }}>
                <input type="hidden" name="id" value={phase.id} />
                <button
                  className="button-quiet button-small"
                  name="status"
                  value="planned"
                  type="submit"
                >
                  Later
                </button>
                <button
                  className="button-small"
                  name="status"
                  value="active"
                  type="submit"
                >
                  Happening now
                </button>
                <button
                  className="button-green button-small"
                  name="status"
                  value="done"
                  type="submit"
                >
                  Finished
                </button>
              </form>
            )}
          </div>
        );
      })}

      {unscheduled.length > 0 && (
        <div className="card">
          <h3>Not in a phase yet</h3>
          <p className="faint" style={{ marginTop: -4 }}>
            Live ideas with no home on the timeline. These are the ones that
            get forgotten.
          </p>
          {unscheduled.map((idea) => (
            <Link
              key={idea.id}
              href={`/hq/ideas/${idea.id}`}
              className="idea"
              style={{ borderLeftColor: STATUS_COLORS[idea.status] }}
            >
              <div className="spread">
                <strong>{idea.title}</strong>
                <span className="faint">{STATUS_LABELS[idea.status]}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {member?.role === 'owner' && (
        <details className="card">
          <summary style={{ cursor: 'pointer', fontWeight: 800 }}>
            ➕ Add a phase
          </summary>
          <form action={addPhase}>
            <label htmlFor="name">NAME</label>
            <input id="name" name="name" required placeholder="Phase 5 — Android" />
            <label htmlFor="summary">WHAT IS IT FOR?</label>
            <textarea id="summary" name="summary" style={{ minHeight: 60 }} />
            <div className="grid">
              <div>
                <label htmlFor="position">ORDER</label>
                <input id="position" name="position" type="number" defaultValue={5} />
              </div>
              <div>
                <label htmlFor="starts_on">STARTS</label>
                <input id="starts_on" name="starts_on" type="date" />
              </div>
              <div>
                <label htmlFor="ends_on">ENDS</label>
                <input id="ends_on" name="ends_on" type="date" />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <button type="submit">Add phase</button>
            </div>
          </form>
        </details>
      )}
    </>
  );
}
