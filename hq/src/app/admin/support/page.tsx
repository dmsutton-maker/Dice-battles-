import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';

interface Message {
  id: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  device: string;
  handled: boolean;
  created_at: string;
}

/**
 * What players have sent through the contact form on the public site —
 * a ticket list. Open one to read the whole thread and reply from right
 * here, instead of leaving for your own mail app.
 */
export default async function SupportListPage() {
  const supabase = await supabaseServer();
  const [{ data }, { data: draftRows }] = await Promise.all([
    supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('message_replies').select('message_id').eq('is_draft', true),
  ]);

  const messages = (data ?? []) as Message[];
  const unread = messages.filter((m) => !m.handled);
  const withDrafts = new Set(
    ((draftRows ?? []) as { message_id: string }[]).map((r) => r.message_id),
  );

  return (
    <>
      <p className="muted">
        {messages.length === 0
          ? 'Nothing yet. Messages sent through the support page land here.'
          : `${unread.length} still to deal with, ${messages.length} in total.`}
        {withDrafts.size > 0 &&
          ` ${withDrafts.size} ${withDrafts.size === 1 ? 'has' : 'have'} a suggested reply waiting for you to check.`}
      </p>

      {messages.map((message) => (
        <Link
          key={message.id}
          href={`/admin/support/${message.id}`}
          className="idea"
          style={{
            borderLeftColor: message.handled ? 'var(--line)' : 'var(--orange)',
            opacity: message.handled ? 0.7 : 1,
          }}
        >
          <div className="spread">
            <h3>{message.subject || '(no subject)'}</h3>
            <span className="faint">{new Date(message.created_at).toLocaleString()}</span>
          </div>
          <p className="faint" style={{ margin: '4px 0 6px' }}>
            {message.name || 'Anonymous'}
            {message.email ? ` · ${message.email}` : ' · no reply address'}
            {message.device ? ` · ${message.device}` : ''}
          </p>
          <p
            className="muted"
            style={{
              margin: 0,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {message.body}
          </p>
          <div className="row" style={{ marginTop: 6 }}>
            {withDrafts.has(message.id) && (
              <span className="pill" style={{ background: 'var(--orange)' }}>
                ✍️ Reply suggested — check it
              </span>
            )}
            {message.handled && <span className="pill pill-outline">✓ Handled</span>}
          </div>
        </Link>
      ))}
    </>
  );
}
