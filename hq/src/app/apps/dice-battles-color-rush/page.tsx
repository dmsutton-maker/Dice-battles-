import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { SitePage } from '@/components/site/SitePage';
import { colors, fonts } from '@/components/site/tokens';
import styles from '../../site.module.css';
import { faqList, getSiteContent, highlightList, labelList, sectionList, text } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Dice Battles: Color Rush — Paper Ship Studio',
  description:
    'Roll color dice, march your army across the board, and take the other castle. Fast, colorful, and simple enough that a five-year-old can jump right in.',
};

export const dynamic = 'force-dynamic';

const HIGHLIGHT_TINTS = [colors.cyanTint, colors.cream, colors.orangeTint, colors.yellowTint];

/** Badge colours, cycled so any number of badges still reads as a set. */
const PILL_TINTS = [
  { bg: colors.cyanTint, ink: colors.cyan },
  { bg: colors.cream, ink: colors.yellowDeepText2 },
  { bg: colors.orangeTint, ink: colors.orangeDeep },
];

const DEFAULT_HIGHLIGHTS = [
  {
    title: 'Colors, not numbers',
    body: 'Every dice face is a color, so there are no pips to squint at and no numbers to read. Anyone can play from the first roll.',
  },
  {
    title: 'Two players, one phone',
    body: 'Pass and play on a single device — the board flips so each side always faces its own castle. No wifi, no second phone, nobody left out.',
  },
  {
    title: 'A battle in a few minutes',
    body: 'Roll, march, and clash. A full game wraps up fast, which makes it easy to say yes to one more.',
  },
  {
    title: 'Nothing to sign up for',
    body: 'No ads, no accounts, and no analytics — you download it, and that’s the whole relationship.',
  },
];

const DEFAULT_FAQS = [
  { q: 'Does the game have ads?', a: 'No. Dice Battles has never shown an ad and never will.' },
  { q: 'Do I need to create an account?', a: 'No sign-in, no account, nothing to lose. Open it and play.' },
  {
    q: 'Is any data collected about me or my family?',
    a: 'No analytics or tracking of any kind. See our Privacy Policy for the full picture.',
  },
  {
    q: 'Do I need to be able to read to play?',
    a: 'No. Every dice face is a color rather than a number or a pattern of pips, so nothing on the board needs reading — which suits pre-readers and anyone who would rather not squint.',
  },
  {
    q: 'Who is it for?',
    a: 'Anyone from about five upward. It was invented at a family kitchen table and it plays best that way — grandparents and grandchildren on the same board, nobody at a disadvantage.',
  },
];

export default async function DiceBattlesAppPage() {
  const content = await getSiteContent();
  const description = text(
    content,
    'dice_battles.description',
    'Roll color dice, march your army across the board, and take the other castle. Fast, colorful, and simple enough that a five-year-old can jump right in.',
  );
  const ctaSubhead = text(
    content,
    'dice_battles.cta_subhead',
    'We read every message ourselves — usually pretty quickly.',
  );
  const highlights = highlightList(content, 'dice_battles.highlights', DEFAULT_HIGHLIGHTS);
  const faqs = faqList(content, 'dice_battles.faq', DEFAULT_FAQS);
  const extraSections = sectionList(content, 'dice_battles.extra_sections', []);
  const pills = labelList(content, 'dice_battles.pills', [
    'No ads',
    'No accounts',
    'No tracking',
  ]);
  const ctaTitle = text(content, 'dice_battles.cta_title', 'Report a problem, or just say hi');

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
                {description}
              </p>
              {pills.length > 0 && (
                <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                  {pills.map((label, i) => {
                    const tint = PILL_TINTS[i % PILL_TINTS.length];
                    return (
                      <span
                        key={label}
                        style={{
                          padding: '8px 16px',
                          background: tint.bg,
                          color: tint.ink,
                          font: `700 12.5px ${fonts.body}`,
                          borderRadius: 999,
                        }}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              )}
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
            {highlights.map((h, i) => (
              <div key={h.title} style={{ padding: 26, borderRadius: 18, background: HIGHLIGHT_TINTS[i % HIGHLIGHT_TINTS.length], display: 'flex', flexDirection: 'column', gap: 8 }}>
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
            {faqs.map((item) => (
              <details key={item.q} className={styles.details} style={{ padding: '18px 22px', borderRadius: 14, background: colors.offWhite }}>
                <summary style={{ font: `700 15px ${fonts.body}`, color: colors.ink, cursor: 'pointer' }}>{item.q}</summary>
                <p style={{ font: `600 14px/1.6 ${fonts.body}`, color: colors.secondary, margin: '10px 0 0' }}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {extraSections.map((s) => (
          <section
            key={s.heading}
            className="psg-wrap"
            style={{ padding: '56px 56px 0', maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
          >
            <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 style={{ font: `800 20px ${fonts.heading}`, color: colors.ink, margin: 0 }}>{s.heading}</h2>
              <p style={{ font: `600 15px/1.6 ${fonts.body}`, color: colors.body, margin: 0 }}>{s.body}</p>
            </div>
          </section>
        ))}

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
              <span style={{ font: `800 18px ${fonts.heading}`, color: '#fff' }}>{ctaTitle}</span>
              <span style={{ font: `600 14px/1.5 ${fonts.body}`, color: 'rgba(255,255,255,0.7)' }}>
                {ctaSubhead}
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
