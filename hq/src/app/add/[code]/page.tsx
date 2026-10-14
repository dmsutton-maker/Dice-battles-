import type { Metadata } from 'next';
import Link from 'next/link';
import { SitePage } from '@/components/site/SitePage';
import { colors, fonts } from '@/components/site/tokens';
import styles from '../../site.module.css';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * "Come and play with me" — the page a shared friend code lands on.
 *
 * David asked for this on 17 Sep 2026, as the far end of the share
 * button in the game's Friends tab. A player taps share, picks Messages,
 * and what arrives is a sentence, their code, and a link that shows the
 * game's logo. Tapping it opens the game already asking "add so-and-so
 * as a friend?".
 *
 * THIS PAGE IS WHERE THE LOGO IN THE MESSAGE COMES FROM, and that is
 * worth stating plainly because it is the least obvious thing here.
 * An app cannot put a picture into somebody else's text message.
 * Messages fetches the link, reads the Open Graph tags off the HTML, and
 * draws its own card. So `generateMetadata` below IS the picture: delete
 * `openGraph` and the message goes out as a bare blue link.
 *
 * MOST PEOPLE WILL NEVER SEE THE PAGE ITSELF. With the game installed,
 * iOS matches the URL against the association file at
 * `/.well-known/apple-app-site-association`, opens the app, and this
 * HTML is never rendered. The page is what happens when it cannot: the
 * game is not installed, it is an older build with no associated domain
 * in it, the link was opened on a laptop, or somebody pasted it into a
 * browser bar. Every one of those is a real person holding a code, so
 * the page's whole job is to get them to the game with the code intact.
 */

export const dynamic = 'force-dynamic';

const ORIGIN = 'https://papershipstudio.com';
const CARD = `${ORIGIN}/images/dice-battles-card.png`;

/**
 * Crockford base32 minus I, L, O and U — the same alphabet the game
 * makes codes from, written out rather than imported because `src/` is
 * the game and this is the website. Metro is told to ignore `hq/`, and
 * the dependency has never gone the other way either.
 */
const FRIEND_CODE = /^[0-9A-HJKMNP-TV-Z]{8}$/;

/** "k7m2-9xpq", "K7M29XPQ", "K7M2 9XPQ" — all the same code. */
function cleanCode(raw: string): string | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // A mangled escape is not a code. Fall through with the raw text,
    // which the shape test below will refuse anyway.
  }
  const stripped = decoded.toUpperCase().replace(/[^0-9A-Z]/g, '');
  // The four letters the alphabet drops, corrected the way the game
  // corrects them: O is 0, I and L are 1, U is V.
  const fixed = stripped.replace(/[OILU]/g, (c) => (c === 'O' ? '0' : c === 'U' ? 'V' : '1'));
  return FRIEND_CODE.test(fixed) ? fixed : null;
}

/** "K7M29XPQ" -> "K7M2-9XPQ". */
const pretty = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/**
 * Whose code this is, if it is anybody's.
 *
 * Reads the same two public columns the game's own lookup does — a name
 * and a trophy count, never the collection and never the friend code
 * back again. Anyone holding the code can already ask the API for this,
 * so putting it on the page gives away nothing new; it just means the
 * message says "Marc" instead of "somebody".
 *
 * Returns null on any failure. A database that is down must still leave
 * a page that says what the code is and where to get the game.
 */
async function lookup(code: string): Promise<{ name: string; trophies: number } | null> {
  try {
    const { data } = await supabaseAdmin()
      .from('player_profiles')
      .select('name, trophies')
      .eq('friend_code', code)
      .maybeSingle();
    return data ? { name: data.name, trophies: data.trophies } : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const code = cleanCode((await params).code);
  const who = code ? await lookup(code) : null;
  const title = who
    ? `${who.name} wants to play Dice Battles with you`
    : 'Come and play Dice Battles: Color Rush';
  const description = code
    ? `Open the game and it will offer to add them as a friend. Their code is ${pretty(code)}.`
    : 'Two dice, six colors, six prisoners to set free. Free to play, for anyone from about five upward.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Paper Ship Studio',
      /*
        ABSOLUTE, not "/images/…". Messages, WhatsApp and every other
        client fetch this from their own servers with no page context to
        resolve a relative path against, and a relative og:image is the
        single commonest reason a link preview comes out blank.
      */
      images: [{ url: CARD, width: 1200, height: 630, alt: 'Dice Battles: Color Rush' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [CARD] },
    // A private invitation with somebody's code in it has no business
    // in a search index.
    robots: { index: false, follow: false },
  };
}

export default async function AddFriendPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const code = cleanCode((await params).code);
  const who = code ? await lookup(code) : null;

  return (
    <SitePage active="none">
      <main>
        <section
          className="psg-wrap"
          style={{
            padding: '48px 24px 90px',
            maxWidth: 560,
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box',
            textAlign: 'center',
          }}
        >
          {code === null ? (
            <>
              <h1
                style={{
                  font: `800 30px/1.25 ${fonts.heading}`,
                  color: colors.ink,
                  margin: '0 0 12px',
                }}
              >
                That invite link isn&rsquo;t quite right
              </h1>
              <p
                style={{
                  font: `400 16px/1.7 ${fonts.body}`,
                  color: colors.body,
                  margin: '0 0 28px',
                }}
              >
                Friend codes are eight characters, like <strong>K7M2-9XPQ</strong>. Ask
                whoever sent this to share it again from the Friends tab, or type their
                code into the game yourself.
              </p>
            </>
          ) : (
            <>
              <h1
                style={{
                  font: `800 30px/1.25 ${fonts.heading}`,
                  color: colors.ink,
                  margin: '0 0 12px',
                }}
              >
                {who
                  ? `${who.name} wants to play Dice Battles with you`
                  : 'Someone wants to play Dice Battles with you'}
              </h1>
              <p
                style={{
                  font: `400 16px/1.7 ${fonts.body}`,
                  color: colors.body,
                  margin: '0 0 26px',
                }}
              >
                Open the game and it will offer to add them as a friend. If you haven&rsquo;t
                got Dice Battles yet, their code works just as well once you do.
              </p>

              {/* The code, big enough to read off the screen and copy by
                  hand — which is the fallback behind every other
                  fallback on this page. */}
              <div
                style={{
                  background: colors.cream,
                  border: `1px solid ${colors.fieldBorder}`,
                  borderRadius: 16,
                  padding: '18px 20px 20px',
                  marginBottom: 26,
                }}
              >
                <div
                  style={{
                    font: `700 12px ${fonts.body}`,
                    letterSpacing: '0.12em',
                    color: colors.muted,
                    marginBottom: 6,
                  }}
                >
                  THEIR FRIEND CODE
                </div>
                <div
                  style={{
                    font: `800 32px ${fonts.heading}`,
                    letterSpacing: '0.06em',
                    color: colors.ink,
                  }}
                >
                  {pretty(code)}
                </div>
              </div>

              {/*
                A plain anchor to the app's own scheme, not a script that
                tries it on load.

                An automatic attempt shows "Cannot Open Page" to everyone
                who does not have the game — which, on a link shared to
                someone new, is most of the people who ever see this
                page. A button they choose to press cannot be wrong.
              */}
              <a
                href={`dicebattles://add/${pretty(code)}`}
                className={styles.pillButton}
                style={{
                  display: 'inline-block',
                  background: colors.cyan,
                  color: colors.white,
                  font: `700 16px ${fonts.heading}`,
                  padding: '14px 30px',
                  borderRadius: 999,
                  textDecoration: 'none',
                }}
              >
                Open Dice Battles
              </a>
            </>
          )}

          <p
            style={{
              font: `400 15px/1.7 ${fonts.body}`,
              color: colors.body,
              margin: '26px 0 0',
            }}
          >
            Haven&rsquo;t got the game?{' '}
            <Link href="/apps/dice-battles-color-rush" className={styles.link}>
              Have a look at Dice Battles: Color Rush
            </Link>
            .
          </p>
        </section>
      </main>
    </SitePage>
  );
}
