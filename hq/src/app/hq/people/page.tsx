import { currentMember, supabaseServer } from '@/lib/supabase/server';
import type { Member } from '@/lib/types';
import { invitePerson } from '../actions';

interface Invite {
  email: string;
  display_name: string;
  role: string;
  invited_at: string;
}

/**
 * Who is allowed in. Adding someone here is the only way they can sign
 * in — the database refuses to create an account for an address that is
 * not on this list, so the URL leaking is not the same as the door
 * opening.
 */
export default async function PeoplePage() {
  const member = await currentMember();
  const supabase = await supabaseServer();

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from('members').select('*').order('created_at'),
    supabase.from('allowed_emails').select('*').order('invited_at'),
  ]);

  const signedIn = new Set((members ?? []).map((m: Member) => m.email.toLowerCase()));
  const isOwner = member?.role === 'owner';

  return (
    <>
      <div className="card">
        <h3>The team</h3>
        <table className="plain">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Can approve?</th>
              <th>Signed in yet</th>
            </tr>
          </thead>
          <tbody>
            {((invites ?? []) as Invite[]).map((invite) => (
              <tr key={invite.email}>
                <td>{invite.display_name}</td>
                <td className="muted">{invite.email}</td>
                <td>{invite.role === 'owner' ? 'Yes — owner' : 'No'}</td>
                <td>
                  {signedIn.has(invite.email.toLowerCase()) ? '✅' : '— not yet'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isOwner ? (
        <div className="card">
          <h3>Invite someone</h3>
          <p className="faint" style={{ marginTop: -4 }}>
            They can then go to the sign-in page, type this address, and get
            a link emailed to them. No password to set or forget.
          </p>
          <form action={invitePerson}>
            <div className="grid">
              <div>
                <label htmlFor="display_name">NAME</label>
                <input id="display_name" name="display_name" required placeholder="Marc" />
              </div>
              <div>
                <label htmlFor="email">EMAIL</label>
                <input id="email" name="email" type="email" required />
              </div>
              <div>
                <label htmlFor="role">CAN THEY APPROVE IDEAS?</label>
                <select id="role" name="role" defaultValue="contributor">
                  <option value="contributor">No — can add and discuss</option>
                  <option value="owner">Yes — full owner</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <button type="submit">Add them</button>
            </div>
          </form>
        </div>
      ) : (
        <p className="faint">Only an owner can invite people.</p>
      )}
    </>
  );
}
