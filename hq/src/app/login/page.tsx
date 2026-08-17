'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

/**
 * Sign in with a link sent to your email — no password.
 *
 * Deliberate, because half the people using this are children: there is
 * no password for a kid to forget, write on a sticky note, or reuse from
 * somewhere else. Only invited addresses work; anyone else gets an email
 * that does nothing, because the database refuses to create the account.
 */
function LoginForm() {
  const params = useSearchParams();
  const next = params.get('next') ?? '/hq';
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  );
  const [message, setMessage] = useState('');

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setState('sending');
    const site =
      process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setState('error');
      setMessage(error.message);
    } else {
      setState('sent');
    }
  }

  return (
    <main className="wrap wrap-narrow">
      <h1>Dice Battles HQ</h1>
      <p className="muted">
        The private side: ideas, approvals, phases and timeline. Invitation
        only.
      </p>

      {state === 'sent' ? (
        <div className="notice">
          <strong>Check your email.</strong>
          <p style={{ margin: '6px 0 0' }}>
            A sign-in link is on its way to {email}. It works once and
            expires after an hour. If nothing arrives, check the spam
            folder — and make sure this address has been invited.
          </p>
        </div>
      ) : (
        <form className="card" onSubmit={send}>
          <label htmlFor="email">YOUR EMAIL</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <div style={{ marginTop: 16 }}>
            <button type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </div>
          {state === 'error' && (
            <div className="notice notice-bad" style={{ marginTop: 14 }}>
              {message}
            </div>
          )}
        </form>
      )}

      <p className="faint">
        Not expecting to be here? This is the workshop behind a dice game.
        Nothing on it concerns anyone outside the family.
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="wrap wrap-narrow">Loading…</main>}>
      <LoginForm />
    </Suspense>
  );
}
