import type { MetadataRoute } from 'next';

/**
 * The web app manifest: what a phone shows when somebody saves the site
 * to their home screen. David, 22 Oct 2026: "if someone saves it to
 * their phones home screen it should have a little icon logo." Android
 * and Chrome read the icons from here; iPhones read apple-icon.png next
 * to this file (Next.js links both automatically). The icon is the
 * paper ship from icon.svg, drawn on white so it is never shown on a
 * black square.
 *
 * `display: 'browser'` on purpose: this is a website with links out to
 * the App Store, not an app pretending to be one, so it keeps the
 * browser's own bar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Paper Ship Studio',
    short_name: 'Paper Ship',
    description: 'Simple, well-made games for players of any age.',
    start_url: '/',
    display: 'browser',
    background_color: '#ffffff',
    theme_color: '#0088b0',
    icons: [
      { src: '/icons/app-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/app-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/app-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
