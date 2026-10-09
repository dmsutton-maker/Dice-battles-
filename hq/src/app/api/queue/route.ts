import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isDue, whenPhrase, type Idea } from '@/lib/types';

/**
 * The hand-off between the board and whoever builds from it.
 *
 * GET  — the work David has approved, in the order it should be done.
 * POST — mark one of those as being built, or as shipped in a version.
 *
 * The one thing this endpoint deliberately CANNOT do is approve
 * anything. Approving is David's alone, from a signed-in browser; a token
 * that could approve would let the builder authorise its own work, which
 * defeats the point of a board. Allowed moves are listed in TRANSITIONS
 * and nothing else is accepted.
 */

export const dynamic = 'force-dynamic';

/** approved → building → shipped, and nothing else. */
const TRANSITIONS: Record<string, string[]> = {
  approved: ['building'],
  building: ['shipped', 'approved'],
};

function authorised(request: NextRequest): boolean {
  const expected = process.env.HQ_API_TOKEN;
  if (!expected) return false;

  const header = request.headers.get('authorization') ?? '';
  const supplied =
    request.headers.get('x-hq-token') ??
    (header.startsWith('Bearer ') ? header.slice(7) : '') ??
    '';

  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  // Compare in constant time, and only when the lengths already match —
  // timingSafeEqual throws on a length mismatch.
  return a.length === b.length && timingSafeEqual(a, b);
}

function deny() {
  return NextResponse.json(
    { error: 'Send the HQ token in an x-hq-token header.' },
    { status: 401 },
  );
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return deny();

  const supabase = supabaseAdmin();
  const [{ data: ideas, error }, { data: phases }] = await Promise.all([
    supabase
      .from('ideas')
      .select('*')
      .in('status', ['approved', 'building'])
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('phases').select('*').order('position'),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const phaseName = new Map(
    (phases ?? []).map((p: { id: string; name: string }) => [p.id, p.name]),
  );
  const shape = (idea: Idea) => ({
    id: idea.id,
    title: idea.title,
    detail: idea.detail,
    category: idea.category,
    kind: idea.kind,
    priority: idea.priority,
    phase: idea.phase_id ? (phaseName.get(idea.phase_id) ?? null) : null,
    decision_note: idea.decision_note,
    approved_at: idea.decided_at,
    scheduled_for: idea.scheduled_for,
    deadline: idea.deadline,
    repeats_yearly: idea.repeats_yearly,
    ...(idea.scheduled_for ? { starts: whenPhrase(idea.scheduled_for) } : {}),
    ...(idea.deadline ? { due: whenPhrase(idea.deadline) } : {}),
  });

  const all = (ideas ?? []) as Idea[];
  const approved = all.filter((i) => i.status === 'approved');

  return NextResponse.json({
    // Read this first: approved work whose time has come. Anything with
    // no date is always here; anything dated appears on its date.
    building: all.filter((i) => i.status === 'building').map(shape),
    approved: approved.filter((i) => isDue(i)).map(shape),
    // Approved but NOT yet — do not start these early. A November idea
    // built in August ships months of dead code and misses the point.
    scheduled: approved
      .filter((i) => !isDue(i))
      .sort((a, b) => (a.scheduled_for ?? '').localeCompare(b.scheduled_for ?? ''))
      .map(shape),
    phases: (phases ?? []).map(
      (p: { name: string; status: string; summary: string }) => ({
        name: p.name,
        status: p.status,
        summary: p.summary,
      }),
    ),
  });
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) return deny();

  let body: {
    id?: string;
    status?: string;
    version?: string;
    note?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send JSON.' }, { status: 400 });
  }

  const { id, status, version, note } = body;
  if (!id || !status) {
    return NextResponse.json(
      { error: 'Send an id and a status.' },
      { status: 400 },
    );
  }

  const supabase = supabaseAdmin();
  const { data: idea, error: readError } = await supabase
    .from('ideas')
    .select('id, title, status')
    .eq('id', id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }
  if (!idea) {
    return NextResponse.json({ error: 'No such idea.' }, { status: 404 });
  }

  const allowed = TRANSITIONS[idea.status] ?? [];
  if (!allowed.includes(status)) {
    return NextResponse.json(
      {
        error: `An idea that is "${idea.status}" cannot become "${status}" from here. Allowed: ${
          allowed.join(', ') || 'nothing — only David can move this one'
        }.`,
      },
      { status: 409 },
    );
  }

  const patch: Record<string, string> = { status };
  if (status === 'shipped' && version) patch.shipped_version = version;

  const { error: writeError } = await supabase
    .from('ideas')
    .update(patch)
    .eq('id', id);

  if (writeError) {
    return NextResponse.json({ error: writeError.message }, { status: 500 });
  }

  await supabase.from('activity').insert({
    idea_id: id,
    actor: 'Claude',
    action:
      status === 'shipped'
        ? `shipped it${version ? ` in ${version}` : ''}`
        : `started building it`,
    detail: note ?? '',
  });

  return NextResponse.json({ ok: true, id, status });
}
