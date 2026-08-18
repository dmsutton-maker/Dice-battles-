import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { LogoPlaceholder } from '@/components/site/Logo';
import { SitePage } from '@/components/site/SitePage';
import { colors, fonts, heroGradient } from '@/components/site/tokens';
import styles from '../site.module.css';

export const metadata: Metadata = {
  title: 'Our Apps — Paper Ship Studio',
  description: 'One game so far — with more on the way from the same small studio.',
};

export default function AppsPage() {
  return (
    <SitePage active="Apps">
      <main>
        <section
          className="psg-wrap"
          style={{ padding: '32px 56px 12px', maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
        >
          <h1 style={{ font: `800 36px/1.2 ${fonts.heading}`, margin: 0, color: colors.ink }}>Our apps</h1>
          <p style={{ font: `600 15.5px/1.6 ${fonts.body}`, color: colors.secondary, margin: '10px 0 0', maxWidth: 560 }}>
            One game so far — with more on the way from the same small studio.
          </p>
        </section>

        <section
          className="psg-wrap"
          style={{ padding: '28px 56px 90px', maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
        >
          <Link
            href="/apps/dice-battles-color-rush"
            className={styles.pillButton}
            style={{
              display: 'block',
              borderRadius: 24,
              background: heroGradient,
              padding: '44px 48px',
              position: 'relative',
              overflow: 'hidden',
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 140,
                height: 140,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)',
              }}
            />
            <div
              className="psg-row-wrap"
              style={{ display: 'flex', alignItems: 'center', gap: 36, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}
            >
              <Image
                src="/images/dice-battles-icon.png"
                alt="Dice Battles: Color Rush icon"
                width={110}
                height={110}
                style={{ borderRadius: 22, objectFit: 'cover', flexShrink: 0, boxShadow: '0 10px 26px rgba(0,0,0,0.25)' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 220 }}>
                <span
                  style={{
                    font: `700 12px ${fonts.body}`,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.75)',
                  }}
                >
                  Our first game
                </span>
                <span style={{ font: `800 26px ${fonts.heading}`, color: '#fff' }}>Dice Battles: Color Rush</span>
                <span style={{ font: `600 14.5px/1.5 ${fonts.body}`, color: 'rgba(255,255,255,0.9)' }}>
                  Roll color dice, march your army and take the other castle — pick up and play, no reading
                  required.
                </span>
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '13px 24px',
                  background: '#fff',
                  color: colors.cyan,
                  font: `800 14px ${fonts.body}`,
                  borderRadius: 999,
                  flexShrink: 0,
                }}
              >
                View app &rarr;
              </span>
            </div>
          </Link>

          <div
            className="psg-row-wrap"
            style={{
              marginTop: 28,
              border: `2px dashed ${colors.hairline}`,
              borderRadius: 24,
              padding: '40px 48px',
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: colors.offWhite,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LogoPlaceholder size={24} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ font: `800 16px ${fonts.heading}`, color: colors.secondary2 }}>
                Our next game is already taking shape
              </span>
              <span style={{ font: `600 13.5px ${fonts.body}`, color: colors.muted }}>
                We&apos;ll add it here the day it ships.
              </span>
            </div>
          </div>
        </section>
      </main>
    </SitePage>
  );
}
