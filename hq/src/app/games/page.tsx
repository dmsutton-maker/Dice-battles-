import { pageMetadata } from '@/lib/metadata';
import Image from 'next/image';
import Link from 'next/link';
import { SitePage } from '@/components/site/SitePage';
import { colors, fonts, heroGradient } from '@/components/site/tokens';
import styles from '../site.module.css';
import { getSiteContent, text } from '@/lib/content';

/*
  The Games page. It was "Apps" at /apps until 23 Oct 2026, when David
  asked: "change the apps tab to say Games and then make an Apps section
  and a Web Games section. Dice Battles will be under apps and Geography
  Quizzez will be under Web Games." /apps redirects here (next.config.ts),
  and Dice Battles' own page stays at /apps/dice-battles-color-rush, where
  the game and the App Store listing already link.

  The content keys are still `apps.*`, so what the family already edited
  in the admin carries over unchanged.
*/
export const generateMetadata = pageMetadata('apps', {
  title: 'Our Games — Paper Ship Studio',
  description: 'The games we make at Paper Ship Studio: apps for your phone, and games you play in your browser.',
});

export const dynamic = 'force-dynamic';

const wrap = {
  maxWidth: 1200,
  margin: '0 auto',
  width: '100%',
  boxSizing: 'border-box' as const,
};

function SectionHeading({ children, note }: { children: React.ReactNode; note: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
      <h2 style={{ font: `800 24px/1.2 ${fonts.heading}`, margin: 0, color: colors.ink }}>{children}</h2>
      <p style={{ font: `600 14.5px/1.5 ${fonts.body}`, color: colors.secondary, margin: 0 }}>{note}</p>
    </div>
  );
}

const kickerStyle = {
  font: `700 12px ${fonts.body}`,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  color: 'rgba(255,255,255,0.75)',
};

const buttonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '13px 24px',
  background: '#fff',
  font: `800 14px ${fonts.body}`,
  borderRadius: 999,
  flexShrink: 0,
};

export default async function GamesPage() {
  const content = await getSiteContent();
  const intro = text(
    content,
    'apps.intro',
    'Simple, well-made games for players of any age.',
  );
  const cardKicker = text(content, 'apps.card_kicker', 'Dice game');
  const cardDescription = text(
    content,
    'apps.card_description',
    'Roll two color dice. Match them and a prisoner runs free — first to free all six wins. Nothing to read, nothing to count.',
  );

  return (
    <SitePage active="Games">
      <main>
        <section className="psg-wrap" style={{ padding: '32px 56px 12px', ...wrap }}>
          <h1 style={{ font: `800 36px/1.2 ${fonts.heading}`, margin: 0, color: colors.ink }}>Our games</h1>
          <p style={{ font: `600 15.5px/1.6 ${fonts.body}`, color: colors.secondary, margin: '10px 0 0', maxWidth: 560 }}>
            {intro}
          </p>
        </section>

        <section className="psg-wrap" style={{ padding: '28px 56px 12px', ...wrap }} aria-labelledby="apps">
          <SectionHeading note="For your phone, from the App Store.">
            <span id="apps">Apps</span>
          </SectionHeading>
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
                <span style={kickerStyle}>{cardKicker}</span>
                <span style={{ font: `800 26px ${fonts.heading}`, color: '#fff' }}>Dice Battles: Color Rush</span>
                <span style={{ font: `600 14.5px/1.5 ${fonts.body}`, color: 'rgba(255,255,255,0.9)' }}>
                  {cardDescription}
                </span>
              </div>
              <span style={{ ...buttonStyle, color: colors.cyanText }}>View app &rarr;</span>
            </div>
          </Link>
        </section>

        <section className="psg-wrap" style={{ padding: '36px 56px 90px', ...wrap }} aria-labelledby="web-games">
          <SectionHeading note="Free to play in your browser, on any phone or computer.">
            <span id="web-games">Web Games</span>
          </SectionHeading>
          {/*
            Geography Quizzes is its own site on its own subdomain
            (geography.papershipstudio.com, hosted on Netlify), so this
            card links straight to the game rather than to a page here.
          */}
          <a
            href="https://geography.papershipstudio.com"
            className={styles.pillButton}
            style={{
              display: 'block',
              borderRadius: 24,
              background: 'linear-gradient(135deg, #13273f 0%, #1d6b55 100%)',
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
                background: 'rgba(255,255,255,0.10)',
              }}
            />
            <div
              className="psg-row-wrap"
              style={{ display: 'flex', alignItems: 'center', gap: 36, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}
            >
              <Image
                src="/images/geography-quizzes-icon.png"
                alt="Geography Quizzes icon"
                width={110}
                height={110}
                style={{ borderRadius: 22, objectFit: 'cover', flexShrink: 0, boxShadow: '0 10px 26px rgba(0,0,0,0.25)' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 220 }}>
                <span style={kickerStyle}>Play in your browser</span>
                <span style={{ font: `800 26px ${fonts.heading}`, color: '#fff' }}>Geography Quizzes</span>
                <span style={{ font: `600 14.5px/1.5 ${fonts.body}`, color: 'rgba(255,255,255,0.9)' }}>
                  Timed geography quizzes on maps, flags and capitals for every country, US state and more. Free in
                  your browser.
                </span>
              </div>
              <span style={{ ...buttonStyle, color: '#13273f' }}>Play now &rarr;</span>
            </div>
          </a>
        </section>
      </main>
    </SitePage>
  );
}
