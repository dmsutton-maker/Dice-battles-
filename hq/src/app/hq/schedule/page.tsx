import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import {
  Idea,
  isDue,
  monthLabel,
  STATUS_COLORS,
  STATUS_LABELS,
  today,
  whenPhrase,
} from '@/lib/types';

/**
 * The calendar: dated work, month by month.
 *
 * This is the answer to "work on holiday themes in November". Give an
 * idea a date and it waits there quietly; when the month arrives it
 * moves itself to the top of the queue Claude reads, without anyone
 * having to remember.
 */
export default async function SchedulePage() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('ideas')
    .select('*')
    .order('scheduled_for', { ascending: true });

  const all = (data ?? []) as Idea[];
  const now = today();
  const live = all.filter((i) => !['shipped', 'declined'].includes(i.status));

  const dated = live.filter((i) => i.scheduled_for);
  const dueNow = live.filter(
    (i) => isDue(i) && ['approved', 'building'].includes(i.status),
  );
  const overdue = live.filter((i) => i.deadline && i.deadline < now);
  const undated = live.filter((i) => !i.scheduled_for && !i.deadline);

  // Group the dated ones under a month heading each.
  const months = new Map<string, Idea[]>();
  for (const idea of dated) {
    const key = idea.scheduled_for!.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), idea]);
  }

  const row = (idea: Idea, note?: string) => (
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
      <div className="faint">
        {note ??
          [
            idea.scheduled_for
              ? `starts ${idea.scheduled_for} (${whenPhrase(idea.scheduled_for)})`
              : null,
            idea.deadline ? `due ${idea.deadline}` : null,
            idea.repeats_yearly ? '🔁 every year' : null,
          ]
            .filter(Boolean)
            .join(' · ')}
      </div>
    </Link>
  );

  return (
    <>
      <p className="muted">
        Work with a date on it. Anything scheduled sits still until its
        month comes round, then appears as work to be picked up — so
        &quot;holiday themes in November&quot; can be decided in August and
        still happen at the right time.
      </p>

      {overdue.length > 0 && (
        <div className="card" style={{ borderColor: '#cc2533', borderWidth: 2 }}>
          <h3>⏰ Past its deadline</h3>
          {overdue.map((idea) =>
            row(idea, `was due ${idea.deadline} — ${whenPhrase(idea.deadline)}`),
          )}
        </div>
      )}

      <div className="card">
        <h3>▶️ Ready to work on now</h3>
        <p className="faint" style={{ marginTop: -4 }}>
          Approved, and nothing is holding it back.
        </p>
        {dueNow.length === 0 ? (
          <p className="faint">Nothing approved and waiting.</p>
        ) : (
          dueNow.map((idea) => row(idea, idea.scheduled_for ? undefined : 'any time'))
        )}
      </div>

      {[...months.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, ideas]) => {
          const isPast = key < now.slice(0, 7);
          return (
            <div key={key} className="card">
              <div className="spread">
                <h3 style={{ margin: 0 }}>
                  🗓️ {monthLabel(`${key}-01`)}
                </h3>
                <span className="pill pill-outline">
                  {isPast ? 'started' : whenPhrase(`${key}-01`)}
                </span>
              </div>
              <div style={{ marginTop: 10 }}>{ideas.map((idea) => row(idea))}</div>
            </div>
          );
        })}

      {undated.length > 0 && (
        <div className="card">
          <h3>No date — whenever</h3>
          <p className="faint" style={{ marginTop: -4 }}>
            Not everything needs a date. These get done in priority order.
          </p>
          {undated.map((idea) => row(idea, 'any time'))}
        </div>
      )}
    </>
  );
}
