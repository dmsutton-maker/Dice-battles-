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
 */
export function pageMetadata(
  page: string,
  defaults: { title: string; description: string },
): () => Promise<Metadata> {
  return async () => {
    const content = await getSiteContent();
    return {
      title: text(content, `${page}.metaTitle`, defaults.title),
      description: text(content, `${page}.metaDescription`, defaults.description),
    };
  };
}
