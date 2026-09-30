import type { MetadataRoute } from 'next';

/**
 * What a crawler may look at.
 *
 * The private half of the site is already noindexed by the headers in
 * next.config.ts; this is the same fact said in the other place
 * crawlers look, and it carries the sitemap so the public pages are
 * found rather than stumbled upon.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/login', '/password', '/api'],
    },
    sitemap: 'https://papershipstudio.com/sitemap.xml',
  };
}
