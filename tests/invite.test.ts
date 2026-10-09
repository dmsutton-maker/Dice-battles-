import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  INVITE_HOST,
  INVITE_SCHEME,
  codeFromLink,
  inviteDeepLink,
  inviteMessage,
  inviteUrl,
} from '../src/game/inviteLink';
import { ANONYMOUS_NAME } from '../src/game/playerIdentity';
import { makeFriendCode } from '../src/game/friendCodes';

const root = join(__dirname, '..');
const src = (p: string) => readFileSync(join(root, p), 'utf8');

/**
 * Sharing a friend code by text, and the link coming back the other way.
 *
 * David, 17 Sep 2026: a share button in the Friends tab, the message
 * written for the player, the code in it, a link carrying the game's
 * logo as a picture, and tapping that link offering to add whoever sent
 * it.
 *
 * The half of that which is a STRING is tested here. The half that is a
 * PICTURE lives on the website and the half that is a LINK REGISTRATION
 * lives in the binary, so each has its own check further down — because
 * the feature is only whole when all three agree, and two of them are
 * files this suite can read but never execute.
 */

suite('invites · the link', () => {
  test('the shared link is on the studio domain, with the code in it', () => {
    assertEqual(
      inviteUrl('K7M29XPQ'),
      'https://papershipstudio.com/add/K7M2-9XPQ',
      'the link people are texted',
    );
    assertEqual(INVITE_HOST, 'papershipstudio.com', 'not the deployment hostname');
  });

  test('a link made here is read back here', () => {
    /*
      The round trip is the only property that actually matters, so it
      is checked on real codes rather than one hand-picked example.
      Both shapes, because the web page offers the scheme as its fallback
      and a fallback nobody parses is a dead button.
    */
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 200; i++) {
      const code = makeFriendCode(random);
      assertEqual(codeFromLink(inviteUrl(code)), code, `https round trip for ${code}`);
      assertEqual(codeFromLink(inviteDeepLink(code)), code, `scheme round trip for ${code}`);
    }
    note('200 codes survived both the https link and the dicebattles:// one');
  });

  test('the forms a link arrives in are all accepted', () => {
    const want = 'K7M29XPQ';
    const forms = [
      'https://papershipstudio.com/add/K7M2-9XPQ',
      'https://www.papershipstudio.com/add/K7M2-9XPQ',
      'https://dice-battles-hq.vercel.app/add/K7M2-9XPQ',
      'http://papershipstudio.com/add/K7M2-9XPQ',
      // No dash, lower case, and a trailing slash: all the same code.
      'https://papershipstudio.com/add/k7m29xpq',
      'https://papershipstudio.com/add/K7M29XPQ/',
      // Whatever a chat app hangs off the end.
      'https://papershipstudio.com/add/K7M2-9XPQ?utm_source=messages',
      'https://papershipstudio.com/add/K7M2-9XPQ#top',
      '  https://papershipstudio.com/add/K7M2-9XPQ  ',
      'HTTPS://PaperShipStudio.com/add/K7M2-9XPQ',
      'dicebattles://add/K7M2-9XPQ',
      'dicebattles://add/K7M2-9XPQ/',
      // The percent-encoded dash, which is what some clients send.
      'https://papershipstudio.com/add/K7M2%2D9XPQ',
    ];
    for (const form of forms) {
      assertEqual(codeFromLink(form), want, `should read the code out of ${form.trim()}`);
    }
  });

  test('the confusable letters are fixed on the way in', () => {
    /*
      Crockford's own rule, already in normaliseFriendCode: O is 0, I
      and L are 1, U is V. A link is more likely than a keyboard to
      carry them, because somebody read the code off a screen and typed
      it into a message by hand.
    */
    assertEqual(
      codeFromLink('https://papershipstudio.com/add/OIL2-9XPV'),
      '01129XPV',
      'O, I and L corrected',
    );
  });
});

suite('invites · what a link is NOT allowed to do', () => {
  test('a link on somebody else’s domain is ignored', () => {
    /*
      THE POINT OF THIS TEST. Anybody on earth can text anybody a URL,
      and a URL that reaches the app is an instruction arriving from
      outside the game. The app answers only to the hosts that actually
      serve the invite page.

      Nothing here is catastrophic on its own — a person still has to
      tap "yes" — but a stranger who can make the game ask a child
      "add Somebody as a friend?" has got further than a stranger who
      cannot, and there is no reason to let them.
    */
    const strangers = [
      'https://evil.example/add/K7M2-9XPQ',
      'https://papershipstudio.com.evil.example/add/K7M2-9XPQ',
      'https://evil.example/papershipstudio.com/add/K7M2-9XPQ',
      'https://notpapershipstudio.com/add/K7M2-9XPQ',
    ];
    for (const link of strangers) {
      assertEqual(codeFromLink(link), null, `${link} must not produce a code`);
    }
  });

  test('anything that is not an invite link is ignored', () => {
    const junk = [
      '',
      '   ',
      'not a link at all',
      'https://papershipstudio.com/',
      'https://papershipstudio.com/support',
      // The right host and path, a code that is not one.
      'https://papershipstudio.com/add/TOOSHORT1',
      'https://papershipstudio.com/add/SHORT',
      'https://papershipstudio.com/add/',
      // Right shape, wrong path.
      'https://papershipstudio.com/remove/K7M2-9XPQ',
      // A deeper path than the page has: not this feature.
      'https://papershipstudio.com/add/K7M2-9XPQ/extra',
      'dicebattles://battle/K7M2-9XPQ',
      'dicebattles://',
      // A malformed escape. decodeURIComponent throws on this one, and
      // a throw on a cold launch is a game that does not start.
      'https://papershipstudio.com/add/%zz%zz%zz',
      'dicebattles://add/%e0%a4%a',
    ];
    for (const link of junk) {
      assertEqual(codeFromLink(link), null, `${JSON.stringify(link)} must produce nothing`);
    }
  });

  test('a non-string never throws', () => {
    for (const bad of [null, undefined, 42, {}, []]) {
      assertEqual(
        codeFromLink(bad as unknown as string),
        null,
        `${JSON.stringify(bad)} must be refused quietly`,
      );
    }
  });
});

suite('invites · the message', () => {
  test('the code and the link are both in it', () => {
    const message = inviteMessage('Marc', 'K7M29XPQ');
    assert(message.includes(inviteUrl('K7M29XPQ')), 'the link is in the text');
    assert(message.includes('Marc'), 'it says who is asking');
    /*
      The code is looked for in the message WITH THE LINK TAKEN OUT.

      The link ends in the code, so a plain `includes` passes even when
      the sentence naming the code has been deleted — which is how this
      test first passed against a message that had lost it. David asked
      for the code in the message as well as in the link, because a link
      is not something you can read down a phone or copy onto paper.
    */
    const words = message.replace(inviteUrl('K7M29XPQ'), '');
    assert(
      words.includes('K7M2-9XPQ'),
      `the readable code must be in the words, not only the link: ${JSON.stringify(words)}`,
    );
  });

  test('the link is the last thing in it', () => {
    /*
      Messages, WhatsApp and the rest build the preview card from the
      last link in the body. A sentence after it separates the card from
      the words it belongs to, so the URL goes last and stays last.
    */
    const message = inviteMessage('Marc', 'K7M29XPQ');
    assert(
      message.trimEnd().endsWith(inviteUrl('K7M29XPQ')),
      `the message should end with the link, ends with: ${JSON.stringify(message.slice(-40))}`,
    );
  });

  test('a player Game Center has not named is not introduced as "New Player"', () => {
    /*
      Every player is called "New Player" until Apple answers, and a
      text message reading "It's New Player" is the same bug David
      reported on the friends list, escaped into somebody else's phone.
    */
    const message = inviteMessage(ANONYMOUS_NAME, 'K7M29XPQ');
    assert(
      !message.includes(ANONYMOUS_NAME),
      `the default name must not reach a text message: ${message}`,
    );
    assert(message.includes('K7M2-9XPQ'), 'the code is still there without a name');
    for (const blank of ['', '   ']) {
      assert(
        !inviteMessage(blank, 'K7M29XPQ').includes("It's"),
        'no empty introduction when there is no name',
      );
    }
  });

  test('it is short enough to be one text message', () => {
    /*
      Not a hard limit anywhere — it is a judgement, pinned so a later
      edit that turns the invite into a paragraph has to be deliberate.
      A message somebody has to scroll is one they retype themselves.
    */
    const message = inviteMessage('Christopher', 'K7M29XPQ');
    assert(
      message.length <= 220,
      `the invite should stay short; it is ${message.length} characters`,
    );
    note(`the invite reads: ${JSON.stringify(inviteMessage('Marc', 'K7M29XPQ'))}`);
  });
});

suite('invites · the three halves agree', () => {
  /*
    The feature is a string in the app, a page on the website and two
    lines in app.json. Any one of them alone does nothing, and each
    lives somewhere the other two cannot see, so this is where they are
    made to match.
  */

  test('app.json registers the scheme the app parses', () => {
    const appJson = JSON.parse(src('app.json')) as {
      expo: { scheme?: string; ios?: { associatedDomains?: string[] } };
    };
    assertEqual(
      appJson.expo.scheme,
      INVITE_SCHEME,
      'the binary must register the scheme codeFromLink reads',
    );
  });

  test('app.json claims the domain the link is on', () => {
    /*
      Without this entitlement a tap on the https link opens Safari and
      the app never hears about it. With it and no matching file on the
      website, iOS quietly stops trying — so the file is checked too,
      one test down.
    */
    const appJson = JSON.parse(src('app.json')) as {
      expo: { ios?: { associatedDomains?: string[] } };
    };
    const domains = appJson.expo.ios?.associatedDomains ?? [];
    assert(
      domains.includes(`applinks:${INVITE_HOST}`),
      `app.json should claim applinks:${INVITE_HOST}; it has ${JSON.stringify(domains)}`,
    );
  });

  test('the website serves an app-site-association naming this app', () => {
    const aasa = JSON.parse(src('hq/public/.well-known/apple-app-site-association')) as {
      applinks: { details: { appIDs?: string[]; appID?: string; paths?: string[] }[] };
    };
    const appJson = JSON.parse(src('app.json')) as {
      expo: { ios: { bundleIdentifier: string } };
    };
    const ids = aasa.applinks.details.flatMap((d) => d.appIDs ?? (d.appID ? [d.appID] : []));
    assert(
      ids.some((id) => id.endsWith(`.${appJson.expo.ios.bundleIdentifier}`)),
      `the association file should name ${appJson.expo.ios.bundleIdentifier}; it names ${JSON.stringify(ids)}`,
    );
    const paths = aasa.applinks.details.flatMap((d) => d.paths ?? []);
    assert(
      paths.some((p) => p.startsWith('/add')),
      `the association file should cover /add; it covers ${JSON.stringify(paths)}`,
    );
  });

  /*
    COMMENTS STRIPPED FIRST, on every one of these.

    That page's own prose explains what openGraph is for and names the
    scheme, so a test grepping the raw file passes on the explanation
    alone — the block could be deleted entirely and the sentence about
    it would keep the suite green. This project has been caught by that
    exact trap four times; it is not a hypothetical.
  */
  const page = src('hq/src/app/add/[code]/page.tsx')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    /*
      A line comment is `//` that is NOT preceded by a colon.

      Stripping every `//` to end of line instead — the obvious way —
      ate every URL in the file, "https:" and "dicebattles:" alike, and
      left three tests failing on a page that was perfectly correct.
      Which is the trap in miniature: a test that greps source can be
      wrong in both directions, not just the forgiving one.
    */
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  test('the invite page puts the logo in the link preview', () => {
    /*
      "The game logo as a picture in the text" is THIS and nothing else.
      The app cannot put a picture in a text message; Messages fetches
      the page and reads its Open Graph tags. So the picture is a line
      of metadata on a Next.js page, and a page without it sends a
      text with no card at all.

      Matched as a PROPERTY — `openGraph:` — rather than as a word
      anywhere in the file. A bare /openGraph/ passes on `notOpenGraph`,
      on a variable called openGraphDisabled, and on any mention in a
      string; it was doing exactly that when this test was first
      written.
    */
    assert(/(^|[^A-Za-z])openGraph\s*:/.test(page), 'the invite page needs openGraph metadata');
    assert(
      /images\s*:/.test(page),
      'the openGraph block needs an image, or the message shows no logo',
    );
    /*
      ABSOLUTE, not "/images/…". Every client fetches the preview from
      its own servers with no page to resolve a relative path against, so
      a relative og:image is the commonest reason a card comes out
      blank. The origin and the path may be composed — the page builds
      its URL from a shared ORIGIN constant — so both halves are looked
      for rather than one glued-together literal.
    */
    assert(/https:\/\/papershipstudio\.com/.test(page), 'the page needs an absolute origin');
    assert(
      /\/images\/[\w.-]+\.(png|jpg|jpeg|webp)/i.test(page),
      'the image must be an absolute https URL for Messages to fetch it',
    );
  });

  test('the preview image the page names actually exists', () => {
    /*
      A metadata line pointing at a 404 is a message with no picture in
      it, and nothing in the build would ever say so.
    */
    const named = /(\/images\/[\w.-]+\.(?:png|jpg|jpeg|webp))/i.exec(page);
    assert(named !== null, 'the page should name an image under /images/');
    const file = join(root, 'hq/public', named![1]);
    assert(
      readFileSync(file).length > 0,
      `${named![1]} is named by the page but not in hq/public`,
    );
    note(`the link preview shows ${named![1]}`);
  });

  test('the invite page offers the scheme as its fallback', () => {
    assert(
      new RegExp(`${INVITE_SCHEME}://`).test(page),
      'the page needs an Open-the-game button using the app scheme',
    );
  });
});

suite('invites · the share button', () => {
  const screen = src('src/demo/FriendsScreen.tsx');
  /*
    Comments stripped before anything is looked for. This suite has been
    fooled by its own prose four times in this project — a test that
    greps source and matches the sentence explaining the rule passes
    whether or not the rule is implemented.
  */
  const code = screen.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  test('the Friends tab shares through the system sheet', () => {
    assert(/from 'react-native'/.test(code), 'the screen imports from react-native');
    assert(/\bShare\b/.test(code), 'the screen uses the Share API');
    assert(/Share\.share\(/.test(code), 'it opens the system share sheet');
  });

  test('it shares the written message, not just the bare code', () => {
    assert(/inviteMessage\(/.test(code), 'the message comes from inviteLink.ts');
    assert(/inviteUrl\(/.test(code), 'the url is passed separately so Messages draws the card');
  });

  test('the share button fills the card it sits on', () => {
    /*
      A style with `alignSelf` in it handed straight to PrimaryButton
      DOES NOTHING, and this is the test that remembers why.

      Card puts the style it is given on its inner face view, while the
      element the parent's flex actually lays out is the Pressable
      wrapped around that. The code card centres its children, so the
      button came out shrink-wrapped with "Share my code" touching both
      of its edges — next to a full-width "Find them" directly below it.
      Seen in tools/duo-preview rather than reasoned about; the stretch
      now lives on a wrapper.
    */
    const style = /shareButton:\s*\{([^}]*)\}/.exec(code);
    assert(style !== null, 'expected a shareButton style to inspect');
    assert(
      !/alignSelf/.test(style![1]),
      'alignSelf on a style passed to PrimaryButton is silently ignored — put it on a wrapper',
    );
    assert(
      /shareRow:\s*\{[^}]*alignSelf:\s*'stretch'/.test(code),
      'the wrapper around the share button must stretch, or the button shrink-wraps',
    );
  });

  test('a share that fails cannot take the screen down with it', () => {
    /*
      Share.share REJECTS when somebody dismisses the sheet on iOS. That
      is the ordinary path, not an error, and an unhandled rejection in
      a screen is a red box over a game.
    */
    const share = /Share\.share\(([\s\S]{0,400})/.exec(code);
    assert(share !== null, 'expected a Share.share call to inspect');
    assert(
      /catch/.test(share![1]),
      'the share call must handle the rejection a dismissed sheet produces',
    );
  });
});
