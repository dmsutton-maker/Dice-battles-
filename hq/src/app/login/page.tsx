'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { PasswordField } from '@/components/PasswordField';

/**
 * Sign in with an email address and a password.
 *
 * It used to be a link emailed to you, and that broke on phones: the
 * link carries a handshake that only works in the BROWSER THAT ASKED for
 * it, and a phone opens email links in whatever browser it feels like.
 * A password works everywhere, every time, and this is a private family
 * board rather than a public sign-up.
 *
 * The emailed link is still here as a fallback for anyone who would
 * rather not remember a password.
 */
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'That email and password do not match. Check for a stray capital letter.'
          : error.message,
      );
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function emailALink() {
    if (!email.trim()) {
      setError('Type your email address first.');
      return;
    }
    setBusy(true);
    setError(null);
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setLinkSent(true);
  }

  return (
    <main className="wrap wrap-narrow">
      <h1>Dice Battles HQ</h1>
      <p className="muted">
        Ideas, votes, and what is being built. Invitation only.
      </p>

      {linkSent ? (
        <div className="notice">
          <strong>Check your email.</strong>
          <p style={{ margin: '6px 0 0' }}>
            A sign-in link is on its way to {email}. Open it on the same
            device and in the same browser you asked from, or it will not
            work.
          </p>
        </div>
      ) : (
        <form className="card" onSubmit={signIn}>
          <label htmlFor="email">EMAIL</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />

          <PasswordField
            id="password"
            label="PASSWORD"
            value={password}
            onChange={setPassword}
          />

          {error && (
            <div className="notice notice-bad" style={{ marginTop: 14 }}>
              {error}
            </div>
          )}

          <div className="row" style={{ marginTop: 16 }}>
            <button type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <button
              type="button"
              className="button-quiet button-small"
              onClick={emailALink}
              disabled={busy}
            >
              Email me a link instead
            </button>
          </div>
        </form>
      )}

      <p className="faint">
        Forgotten your password? Ask David — he can set you a new one from
        the People page in seconds.
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
