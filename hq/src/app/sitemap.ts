import type { MetadataRoute } from 'next';

/** The five public pages, so a crawler does not have to guess. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://papershipstudio.com';
  return [
    '',
    '/apps',
    '/apps/dice-battles-color-rush',
    '/support',
    '/privacy',
    '/terms',
  ].map((path) => ({ url: `${base}${path}`, lastModified: new Date() }));
}
