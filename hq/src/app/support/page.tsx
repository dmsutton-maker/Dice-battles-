import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { SitePage } from '@/components/site/SitePage';
import { colors, fonts } from '@/components/site/tokens';
import styles from '../site.module.css';
import { ContactForm } from './ContactForm';
import { faqList, getSiteContent, text } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Support — Paper Ship Studio',
  description: "We're a small studio, so support is just us — reading every message ourselves.",
};

export const dynamic = 'force-dynamic';

const DEFAULT_GAME_FAQS = [
  { q: 'Does the game have ads?', a: 'No. Dice Battles has never shown an ad and never will.' },
  { q: 'Do I need to create an account?', a: 'No sign-in, no account, nothing to lose. Open it and play.' },
  {
    q: 'Can my child play before they can read?',
    a: 'Yes — every dice face is a color, not a number, so pre-readers can play the whole game on their own.',
  },
];

export default async function SupportPage() {
  const content = await getSiteContent();
  const intro = text(
    content,
    'support.intro',
    "We're a small studio, so support is just us — reading every message ourselves.",
  );
  const gameFaqs = faqList(content, 'support.game_faq', DEFAULT_GAME_FAQS);

  return (
    <SitePage active="Support">
      <main>
        <section
          className="psg-wrap"
          style={{ padding: '32px 56px 0', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
        >
          <h1 style={{ font: `800 36px/1.2 ${fonts.heading}`, margin: 0, color: colors.ink }}>Support</h1>
          <p style={{ font: `600 15.5px/1.6 ${fonts.body}`, color: colors.secondary, margin: '12px 0 0' }}>
            {intro}
          </p>
        </section>

        <section
          className="psg-wrap"
          style={{ padding: '32px 56px 0', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
        >
          <ContactForm />
        </section>

        <section
          className="psg-wrap"
          style={{ padding: '56px 56px 0', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
        >
          <span style={{ font: `800 12px ${fonts.body}`, letterSpacing: '0.05em', textTransform: 'uppercase', color: colors.orange }}>
            FAQ by game
          </span>
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Image
                  src="/images/dice-battles-icon.png"
                  alt="Dice Battles: Color Rush icon"
                  width={36}
                  height={36}
                  style={{ borderRadius: 9, objectFit: 'cover' }}
                />
                <span style={{ font: `800 17px ${fonts.heading}`, color: colors.ink }}>Dice Battles: Color Rush</span>
              </div>
              {gameFaqs.map((item) => (
                <details
                  key={item.q}
                  className={styles.details}
                  style={{ padding: '16px 20px', borderRadius: 14, background: colors.offWhite }}
                >
                  <summary style={{ font: `700 14.5px ${fonts.body}`, color: colors.ink, cursor: 'pointer' }}>
                    {item.q}
                  </summary>
                  <p style={{ font: `600 13.5px/1.6 ${fonts.body}`, color: colors.secondary, margin: '10px 0 0' }}>
                    {item.a}
                  </p>
                </details>
              ))}
              <Link
                href="/apps/dice-battles-color-rush"
                className={styles.link}
                style={{ font: `700 13px ${fonts.body}`, color: colors.cyan, alignSelf: 'flex-start' }}
              >
                Full FAQ on the app page &rarr;
              </Link>
            </div>
            <div
              style={{
                padding: 20,
                borderRadius: 14,
                border: `2px dashed ${colors.hairline}`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ font: `600 13.5px ${fonts.body}`, color: colors.muted }}>
                Future games will get their own section here.
              </span>
            </div>
          </div>
        </section>

        <section
          className="psg-wrap"
          style={{ padding: '56px 56px 90px', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
        >
          <span style={{ font: `800 12px ${fonts.body}`, letterSpacing: '0.05em', textTransform: 'uppercase', color: colors.orange }}>
            Policies
          </span>
          <div style={{ marginTop: 16, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Link
              href="/privacy"
              className={styles.link}
              style={{ padding: '12px 20px', borderRadius: 999, background: colors.cyanTint, color: colors.cyan, font: `800 13.5px ${fonts.body}` }}
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className={styles.link}
              style={{ padding: '12px 20px', borderRadius: 999, background: colors.cream, color: colors.yellowDeepText2, font: `800 13.5px ${fonts.body}` }}
            >
              Terms of Use
            </Link>
          </div>
        </section>
      </main>
    </SitePage>
  );
}
