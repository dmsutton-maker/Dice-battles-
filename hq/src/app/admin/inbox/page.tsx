import { supabaseServer } from '@/lib/supabase/server';
import { markHandled } from '../actions';

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
 * What players have sent through the contact form on the public site.
 *
 * Replying happens from your own mail app — the button just opens it
 * with the address filled in. Nothing is sent from the website, so no
 * mail service to pay for and no way for the site to send anything in
 * your name.
 */
export default async function InboxPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  const messages = (data ?? []) as Message[];
  const unread = messages.filter((m) => !m.handled);

  return (
    <>
      <p className="muted">
        {messages.length === 0
          ? 'Nothing yet. Messages sent through the support page land here.'
          : `${unread.length} still to deal with, ${messages.length} in total.`}
      </p>

      {messages.map((message) => (
        <div
          key={message.id}
          className="card"
          style={{
            borderLeft: `5px solid ${message.handled ? 'rgba(255,255,255,0.16)' : '#fc8403'}`,
            opacity: message.handled ? 0.65 : 1,
          }}
        >
          <div className="spread">
            <h3 style={{ margin: 0 }}>
              {message.subject || '(no subject)'}
            </h3>
            <span className="faint">
              {new Date(message.created_at).toLocaleString()}
            </span>
          </div>
          <p className="faint" style={{ marginTop: 4 }}>
            {message.name || 'Anonymous'}
            {message.email ? ` · ${message.email}` : ' · no reply address'}
            {message.device ? ` · ${message.device}` : ''}
          </p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{message.body}</p>

          <div className="row">
            {message.email && (
              <a
                className="button button-small"
                href={`mailto:${message.email}?subject=${encodeURIComponent(
                  `Re: ${message.subject || 'Dice Battles'}`,
                )}`}
              >
                ✉️ Reply
              </a>
            )}
            <form action={markHandled}>
              <input type="hidden" name="id" value={message.id} />
              <input
                type="hidden"
                name="handled"
                value={message.handled ? 'false' : 'true'}
              />
              <button className="button-quiet button-small" type="submit">
                {message.handled ? '↩︎ Mark unread' : '✓ Mark done'}
              </button>
            </form>
          </div>
        </div>
      ))}
    </>
  );
}
