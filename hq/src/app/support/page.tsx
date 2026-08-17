import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactForm } from './ContactForm';

export const metadata: Metadata = {
  title: 'Support — Dice Battles: Color Rush',
  description:
    'Help with Dice Battles: Color Rush, and how to reach a real person about it.',
};

/**
 * The support page. Apple requires a working support URL on every App
 * Store listing, and it has to be a page a player can genuinely get help
 * from.
 *
 * The way to reach us is the form, not an address: this game is made by
 * one family on their own accounts, and an email address printed on a
 * public page is scraped within days.
 */
export default function SupportPage() {
  return (
    <main className="wrap wrap-narrow policy">
      <h1>Support</h1>
      <p>
        Something wrong, or an idea for the game? Send it here. A person
        reads every message — this game is made by one family, so it may
        take a day or two, but you will get a reply.
      </p>

      <ContactForm />

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
        calls it. If you are seeing it often, please write in and say which
        device you are on.
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

      <h3>The game will not start / it closes straight away.</h3>
      <p>
        If the game shows a screen saying it could not start, send us what
        it says using the form above — that text names the fault exactly
        and is the fastest way to get it fixed.
      </p>

      <h3>Does the game collect anything about my child?</h3>
      <p>
        No. There is no account, no login, no analytics, no advertising and
        no chat. The details are on the{' '}
        <Link href="/privacy">privacy policy</Link>.
      </p>
    </main>
  );
}
