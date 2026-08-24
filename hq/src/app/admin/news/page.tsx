import { supabaseAdmin } from '@/lib/supabase/server';
import { deleteNewsPost, saveNewsPost } from '../actions';
import { ContentForm } from '../content/ContentForm';

/**
 * Writing news that appears inside the game.
 *
 * The game ships with its own list of posts and layers these on top, so
 * anything written here reaches players without waiting for a release —
 * and if nothing is written here, the game is no worse off than before.
 *
 * Drafting and publishing are two separate acts. A post sits here
 * invisible until Show in the game is ticked, because the alternative is
 * writing straight onto every player's phone with no chance to read it
 * back first.
 */

export const dynamic = 'force-dynamic';

interface NewsRow {
  id: string;
  slug: string;
  shown_date: string;
  title: string;
  emoji: string;
  body: string;
  version: string | null;
  published: boolean;
}

export default async function NewsAdminPage() {
  const { data } = await supabaseAdmin()
    .from('game_news')
    .select('id, slug, shown_date, title, emoji, body, version, published')
    .order('created_at', { ascending: false })
    .limit(50);

  const posts = (data ?? []) as NewsRow[];
  const live = posts.filter((p) => p.published).length;

  return (
    <>
      <p className="muted">
        Posts written here show up in the game&rsquo;s <strong>News</strong> tab,
        above the ones the game came with. Players see them the next time they
        open the tab — there is nothing to install and nothing to wait for.
      </p>

      <div className="notice" style={{ marginBottom: 18 }}>
        {live === 0
          ? 'Nothing is showing in the game yet. Write a post and tick "Show in the game".'
          : `${live} post${live === 1 ? '' : 's'} showing in the game right now.`}
      </div>

      <h2>Write a new post</h2>
      <ContentForm action={saveNewsPost}>
        <label htmlFor="new-title">TITLE</label>
        <input id="new-title" name="title" placeholder="A new battlefield to unlock" required />

        <label htmlFor="new-body">WHAT HAPPENED</label>
        <textarea
          id="new-body"
          name="body"
          style={{ minHeight: 130 }}
          placeholder="In plain words, the way you would tell someone at the kitchen table."
          required
        />

        <label htmlFor="new-emoji">PICTURE (ONE EMOJI)</label>
        <input id="new-emoji" name="emoji" defaultValue="📣" maxLength={4} />

        <label htmlFor="new-date">DATE, AS YOU WANT IT WRITTEN</label>
        <input id="new-date" name="shown_date" placeholder="Leave empty for today" />
        <p className="faint">
          Printed in the game exactly as typed, so it reads the same on every
          phone whatever language it is set to.
        </p>

        <label htmlFor="new-version">VERSION, IF IT IS ABOUT ONE</label>
        <input id="new-version" name="version" placeholder="v1.30.0 — or leave empty" />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" name="published" />
          Show in the game
        </label>
        <p className="faint">
          Leave this off to save a draft and read it back before anyone sees it.
        </p>
      </ContentForm>

      <h2 style={{ marginTop: 30 }}>Posts</h2>
      {posts.length === 0 && (
        <p className="faint">Nothing written yet.</p>
      )}
      {posts.map((post) => (
        <div
          key={post.id}
          className="idea"
          style={{ borderLeftColor: post.published ? 'var(--go, #2a9c55)' : 'var(--rule, #c7c0dd)' }}
        >
          <h3>
            {post.emoji} {post.title}{' '}
            <span className="faint" style={{ fontWeight: 400 }}>
              {post.published ? '· showing in the game' : '· draft'}
            </span>
          </h3>
          <p className="faint" style={{ margin: '2px 0 10px' }}>
            {post.shown_date}
            {post.version ? ` · ${post.version}` : ''}
          </p>

          <ContentForm action={saveNewsPost}>
            <input type="hidden" name="id" value={post.id} />
            <label htmlFor={`t-${post.id}`}>TITLE</label>
            <input id={`t-${post.id}`} name="title" defaultValue={post.title} required />

            <label htmlFor={`b-${post.id}`}>WHAT HAPPENED</label>
            <textarea
              id={`b-${post.id}`}
              name="body"
              defaultValue={post.body}
              style={{ minHeight: 110 }}
              required
            />

            <label htmlFor={`e-${post.id}`}>PICTURE</label>
            <input id={`e-${post.id}`} name="emoji" defaultValue={post.emoji} maxLength={4} />

            <label htmlFor={`d-${post.id}`}>DATE</label>
            <input id={`d-${post.id}`} name="shown_date" defaultValue={post.shown_date} />

            <label htmlFor={`v-${post.id}`}>VERSION</label>
            <input id={`v-${post.id}`} name="version" defaultValue={post.version ?? ''} />

            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" name="published" defaultChecked={post.published} />
              Show in the game
            </label>
          </ContentForm>

          {/* Its own form so deleting cannot be confused with saving —
              ContentForm's Save button is the only button in a form. */}
          <ContentForm action={deleteNewsPost}>
            <input type="hidden" name="id" value={post.id} />
            <p className="faint" style={{ margin: 0 }}>
              Saving below <strong>deletes</strong> this post for good.
            </p>
          </ContentForm>
        </div>
      ))}

      <div className="notice" style={{ marginTop: 22 }}>
        <strong>Editing a post that is already showing is safe.</strong> The game
        recognises a post by an id that never changes, so a correction replaces
        what players saw rather than appearing as a second post next to it.
      </div>
    </>
  );
}
