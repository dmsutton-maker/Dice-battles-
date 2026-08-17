import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Use — Dice Battles: Color Rush',
  description: 'The terms you agree to by playing Dice Battles: Color Rush.',
};

const UPDATED = '17 August 2026';

/**
 * Terms of use.
 *
 * Apple's own standard licence (the "Licensed Application End User
 * Licence Agreement") applies to every App Store app unless the developer
 * supplies their own. This page is the plain-English version of the
 * arrangement plus the parts specific to this game — mainly that David
 * owns it, and what in-game coins are and are not.
 */
export default function TermsPage() {
  return (
    <main className="wrap wrap-narrow policy">
      <h1>Terms of Use</h1>
      <p className="faint">Last updated: {UPDATED}</p>

      <h2>The deal</h2>
      <p>
        Dice Battles: Color Rush is made by <strong>Paper Ship Studio</strong>,
        David Sutton&apos;s studio. Downloading it gives you a personal,
        non-exclusive licence to play it on devices you own or control. It
        does not transfer ownership of the game to you.
      </p>
      <p>
        Because the app comes from the App Store, Apple&apos;s standard{' '}
        <a
          href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
          rel="noopener noreferrer"
          target="_blank"
        >
          Licensed Application End User Licence Agreement
        </a>{' '}
        also applies. Where these terms and Apple&apos;s conflict on a
        point Apple&apos;s covers, Apple&apos;s wins.
      </p>

      <h2>Who owns the game</h2>
      <p>
        The game, its rules, its name, its artwork, its music arrangement
        and its code belong to David Sutton, who invented the original
        physical game this is based on and makes it under the name Paper
        Ship Studio. You may not copy it, sell it, take it apart to rebuild
        it, or publish your own version of it.
      </p>
      <p>
        Recording or streaming your own play — videos, screenshots, showing
        friends — is welcome and needs no permission.
      </p>

      <h2>Coins, trophies and anything you unlock</h2>
      <p>
        Coins and trophies are part of the game, not property and not
        money. They have no cash value, cannot be exchanged for money, and
        cannot be transferred to another player or another device. They
        live in the app&apos;s storage on your device, so deleting the app
        deletes them, and there is no way to restore them afterwards.
      </p>
      <p>
        If paid items are ever offered, purchases will go through
        Apple&apos;s App Store and Apple&apos;s refund rules apply — refund
        requests go to Apple, not to us, because we never see your payment
        details.
      </p>

      <h2>Fair use of the game</h2>
      <p>Please do not:</p>
      <ul>
        <li>modify the app or use it with tools intended to cheat;</li>
        <li>
          try to break, overload, or gain unauthorised access to any part of
          the game or this website;
        </li>
        <li>redistribute the app or its files.</li>
      </ul>

      <h2>No promises we cannot keep</h2>
      <p>
        This is a game made by one family, provided as it is. We cannot
        promise it is free of bugs, that it will run on every device, or
        that it will stay available forever. To the fullest extent the law
        allows, we are not liable for any loss arising from using it — and
        nothing here removes rights the law gives you that cannot be
        removed by agreement.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may change as the game grows. The date at the top will
        change with them. Continuing to play after a change means the new
        terms apply.
      </p>

      <h2>Privacy</h2>
      <p>
        Handled separately and in more detail on the{' '}
        <Link href="/privacy">privacy policy</Link>. In short: the game
        collects nothing.
      </p>

      <h2>Contact</h2>
      <p>
        Paper Ship Studio — <Link href="/support">the contact form</Link>
      </p>
    </main>
  );
}
