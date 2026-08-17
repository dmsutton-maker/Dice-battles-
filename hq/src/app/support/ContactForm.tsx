'use client';

import { useActionState } from 'react';
import { sendMessage, type ContactResult } from './actions';

/**
 * The contact form. No email address appears anywhere on the public site
 * — an address on a privacy policy is harvested within days, and this
 * game is made by one family using their own accounts.
 */
export function ContactForm() {
  const [result, action, pending] = useActionState<ContactResult | null, FormData>(
    sendMessage,
    null,
  );

  if (result?.ok) {
    return (
      <div className="notice">
        <strong>Message sent.</strong>
        <p style={{ margin: '6px 0 0' }}>{result.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="card">
      <div className="grid">
        <div>
          <label htmlFor="name">YOUR NAME</label>
          <input id="name" name="name" maxLength={80} placeholder="Optional" />
        </div>
        <div>
          <label htmlFor="email">EMAIL — so we can reply</label>
          <input
            id="email"
            name="email"
            type="email"
            maxLength={160}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="device">WHICH DEVICE?</label>
          <input
            id="device"
            name="device"
            maxLength={80}
            placeholder="iPhone 15, iPad…"
          />
        </div>
      </div>

      <label htmlFor="subject">WHAT IS IT ABOUT?</label>
      <input
        id="subject"
        name="subject"
        maxLength={120}
        placeholder="A bug, an idea, a question…"
      />

      <label htmlFor="body">YOUR MESSAGE</label>
      <textarea
        id="body"
        name="body"
        required
        maxLength={4000}
        style={{ minHeight: 130 }}
        placeholder="What happened, and what you expected instead. The more detail the better."
      />

      {/* Hidden from people, catnip to bots. Anything typed here is a bot. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
        <label htmlFor="website">Leave this empty</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {result && !result.ok && (
        <div className="notice notice-bad" style={{ marginTop: 14 }}>
          {result.message}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send message'}
        </button>
      </div>

      <p className="faint" style={{ marginTop: 12, marginBottom: 0 }}>
        Your message and, if you give one, your email address are stored so
        we can read and reply. Nothing else, and nothing is passed on to
        anyone.
      </p>
    </form>
  );
}
