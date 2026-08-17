import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Support — Dice Battles: Color Rush',
  description:
    'Help with Dice Battles: Color Rush, and how to reach a real person about it.',
};

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'dmsutton@gmail.com';

/**
 * The support page. Apple requires a working support URL on every App
 * Store listing, and it has to be a page a player can actually get help
 * from — not a placeholder.
 */
export default function SupportPage() {
  return (
    <main className="wrap wrap-narrow policy">
      <h1>Support</h1>
      <p>
        Something wrong, or an idea for the game? Write to{' '}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. A person reads every
        message — this game is made by one family, so it may take a day or
        two, but you will get a reply.
      </p>
      <p className="muted">
        It helps enormously if you say which device you are on (iPhone 13,
        iPad, and so on), what happened, and what you expected instead.
      </p>

      <h2>Common questions</h2>

      <h3>My trophies and coins disappeared.</h3>
      <p>
        Everything the game remembers is stored on the device itself and
        never sent to a server. Deleting the app, or moving to a new phone,
        starts you fresh — there is no account to restore from. This is the
        cost of the game collecting nothing about you.
      </p>

      <h3>The dice feel wrong / a roll got stuck.</h3>
      <p>
        Rolls are real physics, so a die can occasionally end up somewhere
        odd. The game gives up on a stuck roll after a few seconds and
        calls it. If you are seeing it often, please write in with your
        device model.
      </p>

      <h3>Is there a way to play against my friend?</h3>
      <p>
        Two of you can play right now on one device — pick{' '}
        <strong>Split Screen</strong> on the home screen. Playing against
        someone on a different phone is planned, not built.
      </p>

      <h3>Can my colour-blind child play?</h3>
      <p>
        Yes. The six dice colours were chosen and checked to stay
        distinguishable under the common forms of colour blindness, and
        every colour is also named out loud by the announcer.
      </p>

      <h3>How do I turn the sound down?</h3>
      <p>
        The ⚙️ Settings button on the home screen has separate sliders for
        everything, music, sound effects and the announcer. Sliding one all
        the way down switches that sound off completely.
      </p>

      <h3>Does the game collect anything about my child?</h3>
      <p>
        No. There is no account, no login, no analytics, no advertising and
        no chat. The details are on the{' '}
        <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2>Report a problem</h2>
      <p>
        Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. If it is a bug,
        it goes on the board and gets fixed in a numbered update, and every
        update is recorded so a change can be undone if it makes things
        worse.
      </p>
    </main>
  );
}
