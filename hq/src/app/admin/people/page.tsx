import { currentMember, supabaseServer } from '@/lib/supabase/server';
import type { Member } from '@/lib/types';
import {
  changeMyPassword,
  invitePerson,
  setSomeonesPassword,
  updatePersonEmail,
} from '../actions';

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

      <div className="card">
        <h3>Your password</h3>
        <p className="faint" style={{ marginTop: -4 }}>
          Change it to something you will remember. At least 8 characters.
        </p>
        <form action={changeMyPassword}>
          <label htmlFor="my-password">NEW PASSWORD</label>
          <input
            id="my-password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <div style={{ marginTop: 14 }}>
            <button className="button-quiet" type="submit">
              Change my password
            </button>
          </div>
        </form>
      </div>

      {isOwner && (
        <div className="card">
          <h3>Set someone else&apos;s password</h3>
          <p className="faint" style={{ marginTop: -4 }}>
            For when one of the boys forgets theirs. Type their email and a
            new password, tell them what it is, and they are back in. If
            they have never signed in before, this creates their login.
          </p>
          <form action={setSomeonesPassword}>
            <div className="grid">
              <div>
                <label htmlFor="their-email">THEIR EMAIL</label>
                <input
                  id="their-email"
                  name="email"
                  type="email"
                  required
                  placeholder="marcsutton2010@gmail.com"
                />
              </div>
              <div>
                <label htmlFor="their-password">NEW PASSWORD</label>
                <input
                  id="their-password"
                  name="password"
                  type="text"
                  required
                  minLength={8}
                  placeholder="at least 8 characters"
                />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <button type="submit">Set their password</button>
            </div>
          </form>
        </div>
      )}

      {isOwner && (
        <div className="card">
          <h3>Change someone&apos;s email</h3>
          <p className="faint" style={{ marginTop: -4 }}>
            Moves their login to a new address — for switching the family
            from personal addresses to @papershipstudio.com ones. Their
            password stays the same; only what they sign in with changes.
          </p>
          <form action={updatePersonEmail}>
            <div className="grid">
              <div>
                <label htmlFor="old_email">WHO</label>
                <select id="old_email" name="old_email" required defaultValue="">
                  <option value="" disabled>
                    — choose someone —
                  </option>
                  {((invites ?? []) as Invite[]).map((invite) => (
                    <option key={invite.email} value={invite.email}>
                      {invite.display_name} — {invite.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="new_email">NEW EMAIL</label>
                <input
                  id="new_email"
                  name="new_email"
                  type="email"
                  required
                  placeholder="marc@papershipstudio.com"
                />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <button type="submit">Change their email</button>
            </div>
          </form>
        </div>
      )}

      {isOwner ? (
        <div className="card">
          <h3>Invite someone</h3>
          <p className="faint" style={{ marginTop: -4 }}>
            Add them here first, then set them a password above — the
            database refuses to create a login for an address that is not
            on this list.
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
