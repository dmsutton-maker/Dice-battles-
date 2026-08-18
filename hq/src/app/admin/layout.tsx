import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentMember } from '@/lib/supabase/server';

export const metadata = {
  title: 'Admin — Paper Ship Studio',
  robots: { index: false, follow: false },
};

/**
 * The gate. Everything under /admin needs a signed-in member; someone who is
 * signed in but not on the guest list gets a plain explanation rather
 * than a broken page.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await currentMember();
  if (!member) redirect('/login?next=/admin');
  // Still on a password somebody else chose — nothing here opens until
  // they have picked their own.
  if (member.must_change_password) redirect('/password');

  return (
    <div className="wrap">
      <div className="spread" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ marginBottom: 2 }}>🛠️ Paper Ship Studio Admin</h1>
          <p className="faint" style={{ margin: 0 }}>
            Signed in as {member.display_name}
            {member.role === 'owner' ? ' · owner' : ''}
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="button-quiet button-small" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <div className="row" style={{ marginBottom: 20 }}>
        <Link className="button button-quiet button-small" href="/admin">
          💡 Ideas
        </Link>
        <Link className="button button-quiet button-small" href="/admin/vote">
          🗳️ Vote
        </Link>
        <Link className="button button-quiet button-small" href="/admin/content">
          ✏️ Website
        </Link>
        <Link className="button button-quiet button-small" href="/admin/schedule">
          🗓️ Schedule
        </Link>
        <Link className="button button-quiet button-small" href="/admin/timeline">
          🗓️ Timeline
        </Link>
        <Link className="button button-quiet button-small" href="/admin/people">
          👪 People
        </Link>
        <Link className="button button-quiet button-small" href="/admin/support">
          🎫 Support
        </Link>
        <Link className="button button-quiet button-small" href="/admin/activity">
          📜 History
        </Link>
      </div>

      {children}
    </div>
  );
}
