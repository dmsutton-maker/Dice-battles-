import { pageMetadata } from '@/lib/metadata';
import { VECTOR_FACES_APP_STORE_URL, VECTOR_FACES_LIVE } from '@/lib/appStore';
import Image from 'next/image';
import Link from 'next/link';
import { SitePage } from '@/components/site/SitePage';
import { colors, fonts } from '@/components/site/tokens';
import styles from '../../site.module.css';
import {
  VECTOR_FACES_DESCRIPTION,
  VECTOR_FACES_FAQ,
  VECTOR_FACES_HIGHLIGHTS,
  VECTOR_FACES_PILLS,
  VECTOR_FACES_SCREENSHOTS,
} from '@/lib/vectorFaces';
import { VECTOR_FACES_GALLERY } from '@/lib/vectorFacesGallery';

/*
  Vector Faces, our Apple Watch app (11 Nov 2026). Laid out like the Dice
  Battles page, but its copy lives in code (lib/vectorFaces.ts), not in
  the admin. Only the search title and description can be overridden
  from `site_content` (as `vector_faces.metaTitle` / `.metaDescription`),
  the way every page's can; nothing in the admin writes those yet.
*/
export const generateMetadata = pageMetadata('vector_faces', {
  title: 'Vector Faces for Apple Watch — Paper Ship Studio',
  description:
    'Retro, glowing vector watch faces for Apple Watch: dozens of animated faces drawn in lines of light, like old radar screens, cockpit displays and arcade cabinets.',
  path: '/apps/vector-faces',
  card: { url: '/images/vector-faces/icon.png', width: 256, height: 256, alt: 'Vector Faces' },
});

// The metadata above reads `site_content` on each request, like every
// other public page, so it is never frozen from a past build.
export const dynamic = 'force-dynamic';

const HIGHLIGHT_TINTS = [colors.cyanTint, colors.cream, colors.orangeTint, colors.yellowTint];

/** Badge colours, cycled so any number of badges still reads as a set. */
const PILL_TINTS = [
  { bg: colors.cyanTint, ink: colors.cyanText },
  { bg: colors.cream, ink: colors.yellowDeepText },
  { bg: colors.orangeTint, ink: colors.orangeText },
];

const section = {
  maxWidth: 1200,
  margin: '0 auto',
  width: '100%',
  boxSizing: 'border-box' as const,
};

export default function VectorFacesAppPage() {
  return (
    <SitePage active="Games">
      <main>
        <section className="psg-wrap" style={{ padding: '20px 56px 8px', ...section }}>
          {/* The padding is tap area on an 18px line (Apple asks for 44); it draws nothing. */}
          <Link href="/games" className={styles.link} style={{ font: `700 13px ${fonts.body}`, color: colors.yellowDeepText, padding: '13px 0' }}>
            &larr; All games
          </Link>
        </section>

        <section className="psg-wrap" style={{ padding: '20px 56px 0', ...section }}>
          <div className="psg-row-wrap" style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
            <Image
              src="/images/vector-faces/icon.png"
              alt="Vector Faces icon"
              width={128}
              height={128}
              style={{ borderRadius: 26, objectFit: 'cover', flexShrink: 0, boxShadow: '0 12px 30px rgba(0,0,0,0.14)' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 220 }}>
              <h1 style={{ font: `800 34px/1.15 ${fonts.heading}`, margin: 0, color: colors.ink }}>Vector Faces</h1>
              <p
                style={{
                  font: `600 16px/1.6 ${fonts.body}`,
                  color: colors.secondary,
                  margin: 0,
                  maxWidth: 520,
                  textWrap: 'pretty',
                }}
              >
                {VECTOR_FACES_DESCRIPTION}
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                {VECTOR_FACES_PILLS.map((label, i) => {
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
              {VECTOR_FACES_LIVE ? (
                <a
                  href={VECTOR_FACES_APP_STORE_URL}
                  className={styles.link}
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: 10,
                    padding: '12px 22px',
                    background: colors.ink,
                    color: '#fff',
                    borderRadius: 12,
                    font: `800 16px ${fonts.heading}`,
                    textDecoration: 'none',
                  }}
                >
                  Download on the App Store
                </a>
              ) : (
                /*
                  Plain words, not a button: there is nothing to press
                  until Apple has approved it. A link before then opens
                  Apple's "not available" page.
                */
                <span style={{ marginTop: 10, font: `800 16px ${fonts.heading}`, color: colors.ink }}>
                  Coming soon to the App Store
                </span>
              )}
            </div>
          </div>
        </section>

        {/*
          The faces as the watch draws them, with the watch screen's own
          rounded corners. Each file is exactly twice the size shown, and
          goes out as it is (`unoptimized`): the optimizer's WebP halves
          the colour detail, which smears exactly what these are made of,
          one-pixel lines of coloured light on black.
        */}
        <section className="psg-wrap" style={{ padding: '36px 56px 0', ...section }}>
          <div
            className="psg-faces"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 211px))', gap: 24 }}
          >
            {VECTOR_FACES_SCREENSHOTS.map((shot) => (
              <Image
                key={shot.src}
                src={shot.src}
                alt={shot.alt}
                width={211}
                height={257}
                unoptimized
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  borderRadius: '22% / 18%',
                  background: '#000',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.14)',
                }}
              />
            ))}
          </div>
        </section>

        <section className="psg-wrap" style={{ padding: '56px 56px 0', ...section }}>
          <h2 style={{ font: `800 12px ${fonts.body}`, letterSpacing: '0.05em', textTransform: 'uppercase', color: colors.orangeText, margin: 0 }}>
            Highlights
          </h2>
          <div className="psg-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginTop: 20 }}>
            {VECTOR_FACES_HIGHLIGHTS.map((h, i) => (
              <div key={h.title} style={{ padding: 26, borderRadius: 18, background: HIGHLIGHT_TINTS[i % HIGHLIGHT_TINTS.length], display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ font: `800 17px ${fonts.heading}`, color: colors.ink }}>{h.title}</span>
                <span style={{ font: `600 14px/1.55 ${fonts.body}`, color: colors.body }}>{h.body}</span>
              </div>
            ))}
          </div>
        </section>

        {/*
          Every face, grouped and ordered as the app shows them
          (lib/vectorFacesGallery.ts, generated from the app's own catalog).
          The chips jump to a group; the pictures load as they scroll in.
          No count is written anywhere: David wants "dozens", not a number.
        */}
        <section className="psg-wrap" style={{ padding: '56px 56px 0', ...section }}>
          <h2 style={{ font: `800 12px ${fonts.body}`, letterSpacing: '0.05em', textTransform: 'uppercase', color: colors.orangeText, margin: 0 }}>
            Every face
          </h2>
          <p style={{ font: `600 15px/1.6 ${fonts.body}`, color: colors.secondary, margin: '12px 0 0', maxWidth: 620 }}>
            Every face comes with the app, sorted the way the app sorts them. Each one has its own colors, and you choose what its three spots show.
          </p>
          <nav aria-label="Face groups" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
            {VECTOR_FACES_GALLERY.map((group, i) => {
              const tint = PILL_TINTS[i % PILL_TINTS.length];
              return (
                <a
                  key={group.id}
                  href={`#faces-${group.id}`}
                  className={styles.link}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: 44,
                    padding: '0 16px',
                    background: tint.bg,
                    color: tint.ink,
                    font: `700 13px ${fonts.body}`,
                    borderRadius: 999,
                    textDecoration: 'none',
                  }}
                >
                  {group.title}
                </a>
              );
            })}
          </nav>
          {VECTOR_FACES_GALLERY.map((group) => (
            <div key={group.id} id={`faces-${group.id}`} style={{ marginTop: 36, scrollMarginTop: 24 }}>
              <h3 style={{ font: `800 20px ${fonts.heading}`, color: colors.ink, margin: 0 }}>{group.title}</h3>
              <div
                className="psg-gallery"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 22, marginTop: 16 }}
              >
                {group.faces.map((face) => (
                  <figure key={face.key} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Image
                      src={`/images/vector-faces/gallery/${face.key}.webp`}
                      alt={`The ${face.title} watch face. ${face.summary}`}
                      width={211}
                      height={257}
                      unoptimized
                      loading="lazy"
                      style={{
                        display: 'block',
                        width: '100%',
                        height: 'auto',
                        borderRadius: '22% / 18%',
                        background: '#000',
                        boxShadow: '0 10px 24px rgba(0,0,0,0.13)',
                      }}
                    />
                    <figcaption style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ font: `800 15px ${fonts.heading}`, color: colors.ink }}>{face.title}</span>
                      <span style={{ font: `600 13px/1.45 ${fonts.body}`, color: colors.secondary }}>{face.summary}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="psg-wrap" style={{ padding: '56px 56px 0', ...section }}>
          <h2 style={{ font: `800 12px ${fonts.body}`, letterSpacing: '0.05em', textTransform: 'uppercase', color: colors.orangeText, margin: 0 }}>
            FAQ
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20, maxWidth: 720 }}>
            {VECTOR_FACES_FAQ.map((item) => (
              <details key={item.q} className={styles.details} style={{ padding: '18px 22px', borderRadius: 14, background: colors.offWhite }}>
                <summary style={{ font: `700 15px ${fonts.body}`, color: colors.ink, cursor: 'pointer' }}>{item.q}</summary>
                <p style={{ font: `600 14px/1.6 ${fonts.body}`, color: colors.secondary, margin: '10px 0 0' }}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="psg-wrap" style={{ padding: '56px 56px 90px', ...section }}>
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
              <span style={{ font: `800 18px ${fonts.heading}`, color: '#fff' }}>Questions or ideas for a new face?</span>
              <span style={{ font: `600 14px/1.5 ${fonts.body}`, color: 'rgba(255,255,255,0.7)' }}>
                We read every message ourselves — usually pretty quickly.
              </span>
            </div>
            <Link
              href="/support"
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
                // The keyboard focus ring is ink, which vanishes on this card.
                outlineColor: '#fff',
              }}
            >
              Write to us &rarr;
            </Link>
          </div>
        </section>
      </main>
    </SitePage>
  );
}
