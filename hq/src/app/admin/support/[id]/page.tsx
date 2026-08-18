import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { markHandled, replyToMessage } from '../../actions';

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

interface Reply {
  id: string;
  message_id: string;
  member_id: string | null;
  body: string;
  delivered: boolean;
  delivery_note: string;
  created_at: string;
}

interface Member {
  id: string;
  display_name: string;
}

/** One support ticket: the original message, every reply, and a box to send another. */
export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const [{ data: message }, { data: replies }, { data: members }] = await Promise.all([
    supabase.from('messages').select('*').eq('id', id).maybeSingle(),
    supabase.from('message_replies').select('*').eq('message_id', id).order('created_at'),
    supabase.from('members').select('id, display_name'),
  ]);

  if (!message) notFound();
  const item = message as Message;
  const byId = new Map((members ?? []).map((m: Member) => [m.id, m]));

  return (
    <>
      <Link href="/admin/support" className="faint">
        ← back to Support
      </Link>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="spread">
          <h2 style={{ margin: 0 }}>{item.subject || '(no subject)'}</h2>
          {item.handled && <span className="pill pill-outline">✓ Handled</span>}
        </div>
        <p className="faint" style={{ marginTop: 6 }}>
          {item.name || 'Anonymous'}
          {item.email ? ` · ${item.email}` : ' · no reply address given'}
          {item.device ? ` · ${item.device}` : ''}
          {' · '}
          {new Date(item.created_at).toLocaleString()}
        </p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{item.body}</p>
        <form action={markHandled}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="handled" value={item.handled ? 'false' : 'true'} />
          <button className="button-quiet button-small" type="submit">
            {item.handled ? '↩︎ Mark unread' : '✓ Mark done'}
          </button>
        </form>
      </div>

      {(replies ?? []).map((reply: Reply) => {
        const who = reply.member_id ? byId.get(reply.member_id) : null;
        return (
          <div key={reply.id} className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
            <p className="faint" style={{ margin: 0 }}>
              {who?.display_name ?? 'Someone'} replied · {new Date(reply.created_at).toLocaleString()}
            </p>
            <p style={{ whiteSpace: 'pre-wrap', marginBottom: reply.delivered ? 0 : 6 }}>{reply.body}</p>
            {reply.delivered ? (
              <span className="pill" style={{ background: 'var(--green)', color: '#0d2417' }}>
                ✓ Emailed to {item.email}
              </span>
            ) : (
              <p className="faint" style={{ margin: 0 }}>{reply.delivery_note}</p>
            )}
          </div>
        );
      })}

      <div className="card">
        <h3>Reply</h3>
        <p className="faint" style={{ marginTop: -4 }}>
          {item.email
            ? 'Sends from right here — nothing to copy into your own mail app.'
            : 'They didn’t leave an email address, so this is saved for the family to see rather than sent anywhere.'}
        </p>
        <form action={replyToMessage}>
          <input type="hidden" name="message_id" value={item.id} />
          <label htmlFor="body">YOUR REPLY</label>
          <textarea id="body" name="body" required style={{ minHeight: 110 }} />
          <div style={{ marginTop: 14 }}>
            <button type="submit">Send reply</button>
          </div>
        </form>
      </div>
    </>
  );
}
