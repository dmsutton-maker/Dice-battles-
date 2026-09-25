import { formatFriendCode, normaliseFriendCode } from './friendCodes';
import { ANONYMOUS_NAME } from './playerIdentity';

/**
 * Sharing your friend code, and catching the link at the other end.
 *
 * David asked on 17 Sep 2026 for the Friends tab to have a share button
 * — the ordinary iOS share sheet, the one you get when you share a
 * video — carrying a written-out message, the code, and a link that
 * shows the game's logo as a picture and drops whoever taps it straight
 * into "add so-and-so as a friend?".
 *
 * That is four separate machines, and only two of them are in this
 * file. Worth knowing which is which before changing anything:
 *
 *   1. THE MESSAGE AND THE LINK — here. Pure strings and no I/O, so the
 *      suite can call every one of them directly rather than grepping
 *      the screen that uses them.
 *   2. THE SHARE SHEET — `FriendsScreen`, which owns the one call to
 *      `Share.share`. Deliberately not in here: a module the tests
 *      import should not drag a platform API in behind it.
 *   3. THE PICTURE IN THE TEXT — NOT here and not in the app at all.
 *      Messages fetches the link and reads the Open Graph tags off the
 *      web page, so the logo comes from `hq/src/app/add/[code]/page.tsx`
 *      and nowhere else. Changing this file cannot change the picture.
 *   4. THE LINK OPENING THE GAME — half here (`codeFromLink`) and half
 *      in the BINARY. A URL only reaches the app because `app.json`
 *      registers the scheme and the associated domain, and those are
 *      baked in by the build. On a binary made before that, every link
 *      here opens the web page and the app never hears about it — which
 *      is the right way to fail, and is why nothing in the app's
 *      JavaScript may assume a link will ever arrive.
 */

/**
 * The studio's own domain, not the vercel one.
 *
 * The API calls all go to `dice-battles-hq.vercel.app` because that is
 * where they were first written, and there is no reason to churn them.
 * A link a child texts to a cousin is different: it is READ by a person
 * before it is tapped, and "papershipstudio.com" says who is asking
 * where a deployment hostname says nothing.
 *
 * Both hosts serve the same site, so both are accepted coming back in —
 * see HOSTS. Only this one is ever sent out.
 */
export const INVITE_HOST = 'papershipstudio.com';

/**
 * Hosts whose /add links this app will act on.
 *
 * Deliberately a list and deliberately closed. A link is an instruction
 * arriving from outside the game — anybody can text anybody a URL — so
 * the app answers only to the two hostnames that actually serve the
 * invite page. A stranger's link to `evil.example/add/K7M2-9XPQ` is not
 * a friend request; it is a web address that happens to be shaped like
 * one, and it gets nothing.
 *
 * The confirmation in front of the actual friend request is the second
 * lock, not the first: nobody is ever added without a person tapping
 * "yes". This list means the question is not even asked.
 */
const HOSTS = ['papershipstudio.com', 'www.papershipstudio.com', 'dice-battles-hq.vercel.app'];

/**
 * The app's own URL scheme, registered in `app.json`.
 *
 * `dicebattles://add/K7M2-9XPQ` is what the web page's button opens,
 * for the case where the universal link did not take — an old binary, a
 * browser that swallowed it, a link pasted rather than tapped.
 */
export const INVITE_SCHEME = 'dicebattles';

/** The path both forms share. */
const PATH = 'add';

/** The https link that goes in the message. */
export function inviteUrl(code: string): string {
  return `https://${INVITE_HOST}/${PATH}/${formatFriendCode(code)}`;
}

/** The `dicebattles://` form, for the web page's own button. */
export function inviteDeepLink(code: string): string {
  return `${INVITE_SCHEME}://${PATH}/${formatFriendCode(code)}`;
}

/**
 * What the text message says.
 *
 * Written for a FAMILY rather than for children — the house rule for
 * anything public-facing. It is also going to be read by whoever
 * receives it before they decide to tap a link from a game they have
 * never heard of, so it says plainly what the link does.
 *
 * The name is included only when there is a real one. Before Game
 * Center answers, every player is called "New Player", and a text
 * saying "I'm New Player" reads like a bug because it is one.
 *
 * The URL is LAST on purpose. Messages, WhatsApp and the rest build
 * their preview card from the last link in the body, and a trailing
 * sentence after it pushes the card away from the text it belongs to.
 */
export function inviteMessage(name: string, code: string): string {
  const pretty = formatFriendCode(code);
  const known = name.trim() && name.trim() !== ANONYMOUS_NAME ? name.trim() : '';
  const who = known ? `It's ${known}. ` : '';
  return (
    `Come and play Dice Battles with me! ${who}` +
    `Tap the link and it'll offer to add me as a friend, ` +
    `or put my code in yourself: ${pretty}\n\n` +
    inviteUrl(code)
  );
}

/**
 * The code inside a link somebody tapped — or null, for everything else.
 *
 * Parsed with a regular expression rather than `new URL()`, and that is
 * not a style preference. React Native's `URL` is a polyfill with a
 * hole in exactly the place this needs: `pathname` is among the parts it
 * does not fill in, so `new URL(link).pathname` reads fine, passes in
 * node, and returns nothing on a phone. Anything that has to work on
 * Hermes parses the string itself.
 *
 * Forgiving about the shape of the code, because `normaliseFriendCode`
 * already is — dashes, lower case, and the four letters people type
 * instead of the right ones all arrive here and all come out clean.
 * Strict about the host, about the path, and about there being nothing
 * after the code.
 */
export function codeFromLink(link: string): string | null {
  if (typeof link !== 'string') return null;
  const trimmed = link.trim();

  /*
    `decodeURIComponent` THROWS on a malformed escape — "%zz" is not a
    hypothetical, it is what a mangled link looks like after a chat app
    has wrapped it. This runs on whatever arrives from outside the game,
    so a throw here would take the launch down with it.
  */
  const unescape = (raw: string): string | null => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  };

  // dicebattles://add/CODE — the host slot is the path's first segment,
  // so `dicebattles://add/X` and `dicebattles:///add/X` both arrive.
  const deep = new RegExp(`^${INVITE_SCHEME}://+${PATH}/+([^/?#]+)/*(?:[?#].*)?$`, 'i').exec(
    trimmed,
  );
  if (deep) {
    const raw = unescape(deep[1]);
    return raw === null ? null : normaliseFriendCode(raw);
  }

  const web = /^https?:\/\/+([^/?#]+)\/+([^?#]*)(?:[?#].*)?$/i.exec(trimmed);
  if (!web) return null;
  const host = web[1].toLowerCase().replace(/:\d+$/, '');
  if (!HOSTS.includes(host)) return null;
  const segments = web[2].split('/').filter((s) => s.length > 0);
  if (segments.length !== 2 || segments[0].toLowerCase() !== PATH) return null;
  const raw = unescape(segments[1]);
  return raw === null ? null : normaliseFriendCode(raw);
}
