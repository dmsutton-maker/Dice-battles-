import { senderHash } from '@/lib/sender';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/*
  Reports are counted per sender through activity rows with action
  'bug-report-sender', written by report_bug() in the database. Their
  `detail` holds a short SHA-256 of the forwarded IP and nothing else —
  enough to spot one phone flooding, not enough to identify anybody, and
  it ages out of usefulness in sixty seconds.
*/

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
  // A body of literally `null` parses fine and then throws below.
  if (!body || typeof body !== 'object') {
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

  /*
    Two brakes, and the important one is PER SENDER.

    There used to be one global counter — twenty bug reports a minute
    from anybody at all — which meant a single stranger hammering this
    endpoint locked every real reporter out with a 429 while their own
    twenty rows landed on the work board. The narrow brake now counts
    only this sender; the global one stays as a much higher backstop
    against a distributed flood.

    The sender is identified by a HASH of the forwarded IP, never the
    address itself: this is a 4+ game and there is no reason to keep a
    log of who reported what from where. The hash is stored in the
    activity row so it can be counted, and it identifies nobody.
  */
  const hashOfSender = senderHash(request.headers);

  /*
    Count and file in ONE step, under one lock: report_bug() in
    supabase/migrations/20261018_audit_fixes.sql (applied 18 Oct 2026).

    This used to be two counts and then an insert, as separate calls, so
    fifty requests arriving together all read "none so far" and all got
    in. The function takes a lock, counts this sender's reports in the
    last minute and every report in the last minute, and only then files
    the idea and its two activity rows, with the UNTRUSTED marker on the
    decision note. Five a minute per sender; twenty a minute in all,
    because every report lands as an APPROVED idea.

    A call that FAILED is a refusal, never "no reports yet".
  */
  const { data, error } = await supabase.rpc('report_bug', {
    p_sender: hashOfSender,
    p_message: message,
    p_device: device,
    p_per_sender: 5,
    p_global: 20,
  });
  if (error || !data || typeof data !== 'object') {
    return NextResponse.json(
      { error: 'Cannot take a report right now — please try again shortly.' },
      { status: 503 },
    );
  }
  const status = (data as { status?: string }).status;
  if (status === 'sender_limit') {
    return NextResponse.json(
      { error: 'That is a lot of reports in one minute — please try again shortly.' },
      { status: 429 },
    );
  }
  if (status === 'global_limit') {
    return NextResponse.json(
      { error: 'Getting a lot of reports right now — please try again shortly.' },
      { status: 429 },
    );
  }
  if (status !== 'ok') {
    return NextResponse.json(
      { error: 'Cannot take a report right now — please try again shortly.' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
