import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — Dice Battles: Color Rush',
  description:
    'What Dice Battles: Color Rush collects: nothing. Everything the game remembers stays on your device.',
};

const UPDATED = '17 August 2026';

/**
 * The privacy policy. Apple requires a public URL for this before the app
 * can be released, and it has to match what the app actually does.
 *
 * Right now that is easy, because the game genuinely collects nothing:
 * there is no account system, no analytics SDK, no advertising SDK, and
 * no network call that sends anything about a player anywhere. If that
 * ever changes, this page changes FIRST — and the date at the top with it.
 */
export default function PrivacyPage() {
  return (
    <main className="wrap wrap-narrow policy">
      <h1>Privacy Policy</h1>
      <p className="faint">Last updated: {UPDATED}</p>

      <div className="notice">
        <strong>The short version:</strong> the game does not collect,
        store, or share any personal information. There is no account to
        create and no login. Everything the game remembers — your
        trophies, coins, dice and settings — is saved on your own device
        and never sent anywhere. The only information we ever hold is what
        you choose to type into the contact form on this website, and that
        is only so we can write back.
      </div>

      <h2>Who this is from</h2>
      <p>
        Dice Battles: Color Rush is made by <strong>Paper Ship Studio</strong>
        — David Sutton, an individual developer, as a personal project. If
        you have any question about privacy, write to{' '}
        <Link href="/support">the contact form</Link> and a person will
        read it.
      </p>

      <h2>What the app collects</h2>
      <p>
        Nothing. Specifically, the app does not collect or transmit:
      </p>
      <ul>
        <li>your name, email address, phone number, or date of birth;</li>
        <li>your location;</li>
        <li>your contacts, photos, microphone, or camera;</li>
        <li>
          any advertising identifier, device identifier, or tracking
          identifier;
        </li>
        <li>
          analytics about how you play — no session recording, no
          crash-reporting service, no usage statistics.
        </li>
      </ul>
      <p>
        The app asks for no permissions beyond what is needed to draw the
        game and make sound.
      </p>

      <h2>What the app saves on your device</h2>
      <p>
        So the game remembers you between sessions, it stores the following
        in the app&apos;s own private storage on your phone or iPad:
      </p>
      <ul>
        <li>your trophies, wins, and coin balance;</li>
        <li>which battlefield and dice you have equipped and unlocked;</li>
        <li>your sound, music and announcer volume settings.</li>
      </ul>
      <p>
        This information never leaves your device. It is not backed up to
        us, because there is no &quot;us&quot; server to back it up to. If
        you delete the app, it is gone; deleting the app is also how you
        delete everything the game holds.
      </p>

      <h2>Children</h2>
      <p>
        The game is designed to be playable by young children — the dice
        faces are colours rather than numbers so a child who cannot yet
        read can play. Because the app collects no personal information
        from anyone, it collects none from children either. There is no
        chat, no messaging, no user-generated content, no social feature,
        and no way for one player to contact another.
      </p>
      <p>
        We do not knowingly collect personal information from children
        under 13 (or the equivalent minimum age in your country), and we
        have nothing to delete if asked, because nothing is collected. If
        you believe that has somehow changed, please write to{' '}
        <Link href="/support">the contact form</Link> and it will be
        investigated.
      </p>

      <h2>This website, and the contact form</h2>
      <p>
        The website has no advertising, no analytics, and no tracking
        cookies. Reading these pages is not recorded or profiled.
      </p>
      <p>
        The one place information is collected is the contact form on the{' '}
        <Link href="/support">support page</Link>. If you use it, we store
        exactly what you typed — your message, and the name, email address
        and device you chose to give — in a private database, so that a
        person can read it and reply. It is used for nothing else: not a
        mailing list, not advertising, and never passed or sold to anyone.
      </p>
      <p>
        Only the family who make the game can read those messages. Ask us
        to delete yours and we will, and you do not have to give a reason.
        The form works without an email address if you would rather not
        leave one — we simply cannot reply then.
      </p>
      <p>
        The site is hosted by Vercel and the messages are stored with
        Supabase, both acting on our behalf under their own privacy terms.
      </p>

      <h2>Other companies</h2>
      <p>
        The app contains no third-party advertising network, no analytics
        provider, and no social-media software kit. Nothing about you is
        sold or shared, because nothing about you is held.
      </p>
      <p>
        The app is distributed through Apple&apos;s App Store and updates
        are delivered through Expo&apos;s update service. Those companies
        may record technical information about downloads and updates under
        their own privacy policies, which we do not control and do not
        receive personal data from. Their policies are{' '}
        <a
          href="https://www.apple.com/legal/privacy/"
          rel="noopener noreferrer"
          target="_blank"
        >
          Apple&apos;s
        </a>{' '}
        and{' '}
        <a
          href="https://expo.dev/privacy"
          rel="noopener noreferrer"
          target="_blank"
        >
          Expo&apos;s
        </a>
        .
      </p>

      <h2>If this ever changes</h2>
      <p>
        Features being considered for the future — advertising, an option
        to pay to remove advertising, online multiplayer, or world
        rankings — would involve other companies and, in some cases,
        information about you.
      </p>
      <p>
        Not one of those is in the app today. If any of them ships, this
        page will be rewritten to say exactly what is collected and by
        whom <em>before</em> the feature is released, the date at the top
        will change, and the app&apos;s App Store privacy labels will be
        updated to match. We will not quietly start collecting something
        under a policy that says we do not.
      </p>

      <h2>Your rights</h2>
      <p>
        Laws such as the GDPR and the CCPA give you rights to see, correct,
        export, or delete personal data a company holds about you. From the
        game itself we hold nothing at all, so there is nothing to produce
        or erase. The only thing we can hold about you is a message you
        sent us through the contact form — ask, and we will send you a copy
        of it or delete it. Either way you will get a straight answer, from
        a person.
      </p>

      <h2>Contact</h2>
      <p>
        Paper Ship Studio — <Link href="/support">the contact form</Link>
      </p>
    </main>
  );
}
