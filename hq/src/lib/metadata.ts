import type { Metadata } from 'next';
import { getSiteContent, text } from './content';

/**
 * The title and description a search result or a link preview shows.
 *
 * These were `export const metadata` literals in each page file, which
 * meant the one part of the site nobody could edit was the part Google
 * and every chat app quote. The admin's own content index promises
 * "everything written on the public site", and this closes the gap: the
 * copy in the page file is the default, a `site_content` row overrides
 * it, exactly like every other line on the site.
 *
 * Next.js needs `generateMetadata` rather than a constant for that, so
 * each page exports one line calling this.
 *
 * `path` is the page's own address, and it does two jobs the 9 Nov 2026
 * audit found undone:
 * - the CANONICAL link. The same deployment answers at
 *   dice-battles-hq.vercel.app (the game's API still calls that host,
 *   so it cannot be redirected), and without a canonical Google sees
 *   two copies of every page and picks one itself.
 * - the Open Graph and Twitter card. Only /add had one; a link to the
 *   home page or the game's page pasted into Messages or WhatsApp came
 *   out as a bare blue line. The card is the same 1200x630 picture the
 *   invite page already uses, and `metadataBase` in layout.tsx turns
 *   these relative paths into the absolute URLs those apps insist on.
 *
 * `card` swaps that picture for a page's own. Vector Faces brings its icon:
 * a link to the watch app should not preview as the dice game. A square
 * card gets Twitter's small `summary` layout, which is made for one; a
 * wide one keeps the large layout.
 */
export interface LinkCard {
  url: string;
  width: number;
  height: number;
  alt: string;
}

const STUDIO_CARD: LinkCard = {
  url: '/images/dice-battles-card.png',
  width: 1200,
  height: 630,
  alt: 'Dice Battles: Color Rush',
};

export function pageMetadata(
  page: string,
  defaults: { title: string; description: string; path: string; card?: LinkCard },
): () => Promise<Metadata> {
  const card = defaults.card ?? STUDIO_CARD;
  return async () => {
    const content = await getSiteContent();
    const title = text(content, `${page}.metaTitle`, defaults.title);
    const description = text(content, `${page}.metaDescription`, defaults.description);
    return {
      title,
      description,
      alternates: { canonical: defaults.path },
      openGraph: {
        title,
        description,
        url: defaults.path,
        type: 'website',
        siteName: 'Paper Ship Studio',
        images: [card],
      },
      twitter: {
        card: card.width > card.height ? 'summary_large_image' : 'summary',
        title,
        description,
        images: [card.url],
      },
    };
  };
}
