import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * "There's a new update" — sent to every phone that asked to be told.
 *
 * David, 25 Sep 2026: "make push notifications for when there's a new
 * update." This is the sending end. It is called once, by hand or by
 * whoever publishes the update, straight after `eas update` — so the
 * notification and the update it announces cannot get out of step.
 *
 * BEHIND THE HQ TOKEN, not the device secret. Everything else the game
 * touches is authenticated per device because it is called BY the game;
 * this is called by us, and it is the one endpoint in the system that
 * can put words on every family's lock screen. A token compiled into a
 * public binary would not do.
 *
 * ONE MESSAGE TO EVERYBODY. There is deliberately no way to send to one
 * player: nothing in this game needs it, and an endpoint that could
 * would be an endpoint that could be made to.
 */

export const dynamic = 'force-dynamic';

/** Expo takes up to a hundred messages per request. */
const CHUNK = 100;
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

function authorised(request: NextRequest): boolean {
  const expected = process.env.HQ_API_TOKEN;
  if (!expected) return false;
  const header = request.headers.get('authorization') ?? '';
  const supplied =
    request.headers.get('x-hq-token') ??
    (header.startsWith('Bearer ') ? header.slice(7) : '');
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json(
      { error: 'Send the HQ token in an x-hq-token header.' },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'expected JSON' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const message = typeof body.body === 'string' ? body.body.trim() : '';
  if (!title || !message) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 });
  }
  /*
    LENGTHS, because a lock screen truncates and nobody sees where.
    Apple shows roughly this much before the ellipsis, and a sentence
    that ends mid-word is worse than a shorter one.
  */
  if (title.length > 40 || message.length > 140) {
    return NextResponse.json(
      { error: 'title must be 40 characters or fewer, body 140' },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin()
    .from('push_tokens')
    .select('token')
    .limit(2000);
  if (error) {
    return NextResponse.json({ error: 'could not read the tokens' }, { status: 500 });
  }
  const tokens = (data ?? []).map((r) => r.token as string);
  if (tokens.length === 0) {
    return NextResponse.json({ sent: 0, dropped: 0, note: 'nobody has registered yet' });
  }

  /*
    A DRY RUN IS THE DEFAULT-ADJACENT OPTION, not the default.

    `dryRun: true` reports who WOULD be told without telling them, which
    is how this gets tested against the real table without putting a
    notification on a child's phone at eleven at night. It is opt-in
    rather than the default because a send that silently did nothing
    would be the worse failure of the two.
  */
  if (body.dryRun === true) {
    return NextResponse.json({ wouldSend: tokens.length, dryRun: true });
  }

  let sent = 0;
  const dropped: string[] = [];
  for (let i = 0; i < tokens.length; i += CHUNK) {
    const batch = tokens.slice(i, i + CHUNK).map((to) => ({
      to,
      title,
      body: message,
      sound: 'default',
      priority: 'normal',
    }));
    try {
      const response = await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(batch),
      });
      const result = (await response.json()) as { data?: { status: string }[] };
      (result.data ?? []).forEach((r, n) => {
        if (r.status === 'ok') sent += 1;
        else dropped.push(batch[n].to);
      });
    } catch {
      // A batch that never left is not a batch of dead tokens. Counted
      // as neither sent nor dropped, so a network blip cannot quietly
      // delete everybody's address.
    }
  }

  /*
    Tokens Expo refused are gone for good — the app was deleted, or iOS
    rotated the address. Clearing them keeps the table from growing a
    tail of phones nobody owns any more. Only the ones Expo actually
    named: a failed request above reaches this list at all.
  */
  if (dropped.length > 0) {
    await supabaseAdmin().from('push_tokens').delete().in('token', dropped);
  }

  return NextResponse.json({ sent, dropped: dropped.length });
}
