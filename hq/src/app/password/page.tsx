import { redirect } from 'next/navigation';
import { currentMember } from '@/lib/supabase/server';
import { changeMyPassword } from '../admin/actions';
import { PasswordField } from '@/components/PasswordField';

export const metadata = {
  title: 'Choose a password — Dice Battles HQ',
  robots: { index: false, follow: false },
};

/**
 * The wall in front of the HQ for anyone still using a password somebody
 * else chose for them.
 *
 * Deliberately its own route rather than a page inside /admin: the HQ
 * layout redirects here, so if this lived under /admin it would redirect to
 * itself forever. There is no navigation and no way past it except
 * setting a password.
 */
export default async function PasswordPage() {
  const member = await currentMember();
  if (!member) redirect('/login?next=/password');
  // Already sorted — nothing to do here.
  if (!member.must_change_password) redirect('/admin');

  return (
    <main className="wrap wrap-narrow">
      <h1>Choose your own password</h1>
      <p className="muted">
        Hello {member.display_name}. The password you just used was set for
        you by someone else, which means it is not really yours — pick one
        only you know before going in.
      </p>

      <form className="card" action={changeMyPassword}>
        <PasswordField
          id="password"
          name="password"
          label="YOUR NEW PASSWORD"
          autoComplete="new-password"
          minLength={8}
          autoFocus
        />
        <p className="faint" style={{ marginTop: 6 }}>
          At least 8 characters. Something you will remember without writing
          it down — a short sentence works well.
        </p>
        <div style={{ marginTop: 14 }}>
          <button type="submit">Save it and go in</button>
        </div>
      </form>

      <p className="faint">
        Forgotten it later? David can set you a new one from the People
        page, and you will land back here to choose your own again.
      </p>
    </main>
  );
}
