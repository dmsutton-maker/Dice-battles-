import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Where the game's in-app bug report button actually lands.
 *
 * Unlike /api/queue and /api/proposals, this is deliberately PUBLIC — it
 * has to be, since it is called by every player's phone, not just this
 * session. It writes through the service role because there is no signed
 * -in HQ member behind the request, only a beta tester. Trust is placed
 * in the report being harmless text, not in who sent it.
 *
 * A report becomes an idea with kind='bug', which the rest of the system
 * already treats as pre-approved and safe to fix without waiting — same
 * rule as a bug typed straight into the HQ.
 */

export const dynamic = 'force-dynamic';

const MAX_MESSAGE = 2000;
const MAX_DEVICE = 300;

export async function POST(request: NextRequest) {
  let body: { message?: string; device?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send JSON.' }, { status: 400 });
  }

  const message = String(body.message ?? '').trim().slice(0, MAX_MESSAGE);
  const device = String(body.device ?? '').trim().slice(0, MAX_DEVICE);

  if (message.length < 5) {
    return NextResponse.json(
      { error: 'Tell us a little more about what happened.' },
      { status: 400 },
    );
  }

  const supabase = supabaseAdmin();

  // A soft brake on floods: a burst of reports in the same minute reads
  // as one bug reported many times over, or a device stuck retrying.
  const minuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const { count } = await supabase
    .from('ideas')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'bug')
    .gte('created_at', minuteAgo);
  if ((count ?? 0) >= 20) {
    return NextResponse.json(
      { error: 'Getting a lot of reports right now — please try again shortly.' },
      { status: 429 },
    );
  }

  const title =
    message.length > 80 ? `${message.slice(0, 77)}...` : message;

  const { data, error } = await supabase
    .from('ideas')
    .insert({
      title: `Bug report: ${title}`,
      detail: message,
      category: 'game',
      kind: 'bug',
      status: 'approved',
      decision_note: `Reported from the app${device ? ` — ${device}` : ''}. Already broken, being investigated without waiting for approval.`,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('activity').insert({
    idea_id: data.id,
    actor: 'a beta tester',
    action: 'reported a bug from the app',
    detail: device,
  });

  return NextResponse.json({ ok: true });
}
