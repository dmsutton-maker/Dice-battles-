import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { SitePage } from '@/components/site/SitePage';
import { colors, fonts } from '@/components/site/tokens';
import styles from '../../site.module.css';

export const metadata: Metadata = {
  title: 'Dice Battles: Color Rush — Paper Ship Studio',
  description:
    'Roll color dice, march your army across the board, and take the other castle. Fast, colorful, and simple enough that a five-year-old can jump right in.',
};

const HIGHLIGHTS = [
  {
    bg: colors.cyanTint,
    title: 'Colors, not numbers',
    body: "Dice faces are colors, so kids who can't read numbers yet can still play — and win — on their own.",
  },
  {
    bg: colors.cream,
    title: 'Pass-and-play battles',
    body: 'Two players share one phone — the board flips so each side always faces its own castle. No wifi, no second device.',
  },
  {
    bg: colors.orangeTint,
    title: 'Quick castle battles',
    body: 'Roll, march, and clash — a full battle wraps up in a few minutes, perfect for a quick round or three in a row.',
  },
  {
    bg: colors.yellowTint,
    title: 'Nothing to sign up for',
    body: 'No ads, no accounts, and no analytics — you download it, and that’s the whole relationship.',
  },
];

const FAQS = [
  { q: 'Does the game have ads?', a: 'No. Dice Battles has never shown an ad and never will.' },
  { q: 'Do I need to create an account?', a: 'No sign-in, no account, nothing to lose. Open it and play.' },
  {
    q: 'Is any data collected about my child?',
    a: (
      <>
        No analytics or tracking of any kind. See our{' '}
        <Link href="/privacy" style={{ color: colors.cyan }}>
          Privacy Policy
        </Link>{' '}
        for the full picture.
      </>
    ),
  },
  {
    q: 'Can my child play before they can read?',
    a: 'Yes — every dice face is a color, not a number, so pre-readers can play the whole game on their own.',
  },
  {
    q: 'What ages is it good for?',
    a: 'Simple enough for kids around age 5 and up, and quick fun for older kids and adults too.',
  },
];

export default function DiceBattlesAppPage() {
  return (
    <SitePage active="Apps">
      <main>
        <section
          className="psg-wrap"
          style={{ padding: '20px 56px 8px', maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
        >
          <Link href="/apps" className={styles.link} style={{ font: `700 13px ${fonts.body}`, color: colors.yellowDeepText }}>
            &larr; All apps
          </Link>
        </section>

        <section
          className="psg-wrap"
          style={{ padding: '20px 56px 0', maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
        >
          <div className="psg-row-wrap" style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
            <Image
              src="/images/dice-battles-icon.png"
              alt="Dice Battles: Color Rush icon"
              width={128}
              height={128}
              style={{ borderRadius: 26, objectFit: 'cover', flexShrink: 0, boxShadow: '0 12px 30px rgba(0,0,0,0.14)' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 220 }}>
              <h1 style={{ font: `800 34px/1.15 ${fonts.heading}`, margin: 0, color: colors.ink }}>
                Dice Battles: Color Rush
              </h1>
              <p
                style={{
                  font: `600 16px/1.6 ${fonts.body}`,
                  color: colors.secondary,
                  margin: 0,
                  maxWidth: 480,
                  textWrap: 'pretty',
                }}
              >
                Roll color dice, march your army across the board, and take the other castle. Fast,
                colorful, and simple enough that a five-year-old can jump right in.
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ padding: '8px 16px', background: colors.cyanTint, color: colors.cyan, font: `700 12.5px ${fonts.body}`, borderRadius: 999 }}>
                  No ads
                </span>
                <span style={{ padding: '8px 16px', background: colors.cream, color: colors.yellowDeepText2, font: `700 12.5px ${fonts.body}`, borderRadius: 999 }}>
                  No accounts
                </span>
                <span style={{ padding: '8px 16px', background: colors.orangeTint, color: colors.orangeDeep, font: `700 12.5px ${fonts.body}`, borderRadius: 999 }}>
                  No tracking
                </span>
              </div>
            </div>
          </div>
        </section>

        <section
          className="psg-wrap"
          style={{ padding: '36px 56px 0', maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
        >
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <Image
              src="/images/game-screenshot-1.jpeg"
              alt="Dice Battles gameplay screenshot — battle in progress"
              width={260}
              height={565}
              style={{ borderRadius: 20, boxShadow: '0 12px 30px rgba(0,0,0,0.14)', objectFit: 'cover' }}
            />
            <Image
              src="/images/game-screenshot-2.jpeg"
              alt="Dice Battles two-player pass-and-play screenshot"
              width={260}
              height={565}
              style={{ borderRadius: 20, boxShadow: '0 12px 30px rgba(0,0,0,0.14)', objectFit: 'cover' }}
            />
          </div>
        </section>

        <section
          className="psg-wrap"
          style={{ padding: '56px 56px 0', maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
        >
          <span style={{ font: `800 12px ${fonts.body}`, letterSpacing: '0.05em', textTransform: 'uppercase', color: colors.orange }}>
            Highlights
          </span>
          <div className="psg-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginTop: 20 }}>
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} style={{ padding: 26, borderRadius: 18, background: h.bg, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ font: `800 17px ${fonts.heading}`, color: colors.ink }}>{h.title}</span>
                <span style={{ font: `600 14px/1.55 ${fonts.body}`, color: colors.body }}>{h.body}</span>
              </div>
            ))}
          </div>
        </section>

        <section
          className="psg-wrap"
          style={{ padding: '56px 56px 0', maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
        >
          <span style={{ font: `800 12px ${fonts.body}`, letterSpacing: '0.05em', textTransform: 'uppercase', color: colors.orange }}>
            FAQ
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20, maxWidth: 720 }}>
            {FAQS.map((item) => (
              <details key={item.q} className={styles.details} style={{ padding: '18px 22px', borderRadius: 14, background: colors.offWhite }}>
                <summary style={{ font: `700 15px ${fonts.body}`, color: colors.ink, cursor: 'pointer' }}>{item.q}</summary>
                <p style={{ font: `600 14px/1.6 ${fonts.body}`, color: colors.secondary, margin: '10px 0 0' }}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section
          className="psg-wrap"
          style={{ padding: '56px 56px 90px', maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
        >
          <div
            className="psg-row-wrap"
            style={{
              borderRadius: 20,
              background: colors.ink,
              padding: '40px 44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 24,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ font: `800 18px ${fonts.heading}`, color: '#fff' }}>Report a problem, or just say hi</span>
              <span style={{ font: `600 14px/1.5 ${fonts.body}`, color: 'rgba(255,255,255,0.7)' }}>
                We read every message ourselves — usually pretty quickly.
              </span>
            </div>
            <a
              href="mailto:support@papershipstudio.com"
              className={styles.pillButton}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '13px 24px',
                background: '#fff',
                color: colors.ink,
                font: `800 14px ${fonts.body}`,
                borderRadius: 999,
                flexShrink: 0,
                textDecoration: 'none',
              }}
            >
              support@papershipstudio.com
            </a>
          </div>
        </section>
      </main>
    </SitePage>
  );
}
