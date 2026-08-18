import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { SitePage } from '@/components/site/SitePage';
import styles from './site.module.css';
import { colors, fonts, heroGradient } from '@/components/site/tokens';

export const metadata: Metadata = {
  title: 'Paper Ship Studio — Games your whole family will actually love',
  description:
    'Paper Ship Studio is an independent studio building simple, well-made games for players of any age — starting with Dice Battles: Color Rush.',
};

export default function HomePage() {
  return (
    <SitePage active="Home">
      <main>
        <section
          className="psg-wrap"
          style={{ padding: '0 56px', maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
        >
          <div
            className="psg-hero"
            style={{
              borderRadius: 24,
              overflow: 'hidden',
              background: heroGradient,
              position: 'relative',
              display: 'flex',
              alignItems: 'stretch',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -40,
                right: 60,
                width: 160,
                height: 160,
                borderRadius: '50%',
                background: colors.orange,
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: -50,
                right: -30,
                width: 130,
                height: 130,
                borderRadius: '50%',
                background: colors.yellow,
              }}
            />
            <div
              className="psg-hero-text"
              style={{
                flex: 1,
                padding: '64px 24px 64px 56px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                maxWidth: 560,
                zIndex: 1,
                boxSizing: 'border-box',
              }}
            >
              <h1
                className="psg-hero-h1"
                style={{
                  font: `800 44px/1.15 ${fonts.heading}`,
                  margin: 0,
                  color: '#fff',
                  textWrap: 'pretty',
                }}
              >
                Games your whole family will actually love.
              </h1>
              <p
                style={{
                  font: `600 16px/1.6 ${fonts.body}`,
                  color: 'rgba(255,255,255,0.92)',
                  margin: 0,
                  maxWidth: 440,
                }}
              >
                Paper Ship Studio is an independent studio building simple, well-made games for
                players of any age.
              </p>
              <Link
                href="/apps"
                className={styles.pillButton}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  marginTop: 8,
                  padding: '13px 26px',
                  background: '#fff',
                  color: colors.cyan,
                  font: `800 15px ${fonts.body}`,
                  borderRadius: 999,
                  textDecoration: 'none',
                }}
              >
                See our apps &rarr;
              </Link>
            </div>
          </div>
        </section>

        <section
          className="psg-wrap"
          style={{
            padding: '60px 56px 8px',
            maxWidth: 1200,
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span
              style={{
                font: `800 12px ${fonts.body}`,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: colors.orange,
              }}
            >
              Who we are
            </span>
            <p
              style={{
                font: `600 17px/1.65 ${fonts.body}`,
                color: colors.body,
                margin: 0,
                textWrap: 'pretty',
              }}
            >
              We&apos;re a small, independent studio making colorful, considered games for every
              age — friendly enough that kids as young as five can jump in on their own. No ads,
              no accounts, no analytics. Nothing to sign up for, nothing tracked.
            </p>
          </div>
        </section>

        <section
          className="psg-wrap"
          style={{
            padding: '40px 56px 80px',
            maxWidth: 1200,
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <span
              style={{
                font: `800 12px ${fonts.body}`,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: colors.orange,
              }}
            >
              Our apps
            </span>
            <div
              className="psg-row-wrap"
              style={{
                borderRadius: 20,
                background: colors.cream,
                border: `2px solid ${colors.yellow}`,
                padding: 32,
                display: 'flex',
                alignItems: 'center',
                gap: 32,
                flexWrap: 'wrap',
              }}
            >
              <Image
                src="/images/dice-battles-icon.png"
                alt="Dice Battles: Color Rush icon"
                width={120}
                height={120}
                style={{
                  borderRadius: 24,
                  objectFit: 'cover',
                  flexShrink: 0,
                  boxShadow: '0 10px 26px rgba(0,0,0,0.18)',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 220 }}>
                <span style={{ font: `800 24px ${fonts.heading}`, color: colors.ink }}>
                  Dice Battles: Color Rush
                </span>
                <span style={{ font: `700 14.5px ${fonts.body}`, color: colors.yellowDeepText }}>
                  Colors, not numbers — quick to learn, fun at any age
                </span>
                <span
                  style={{
                    font: `600 13.5px ${fonts.body}`,
                    color: colors.yellowDeepText2,
                    marginTop: 4,
                  }}
                >
                  Our first game. More battles are already in the works.
                </span>
              </div>
              <Link
                href="/apps/dice-battles-color-rush"
                className={styles.pillButton}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '12px 22px',
                  background: colors.ink,
                  color: '#fff',
                  font: `700 13.5px ${fonts.body}`,
                  borderRadius: 999,
                  flexShrink: 0,
                  textDecoration: 'none',
                }}
              >
                View app &rarr;
              </Link>
            </div>
          </div>
        </section>
      </main>
    </SitePage>
  );
}
