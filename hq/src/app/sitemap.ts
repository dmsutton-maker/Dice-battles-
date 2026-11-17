import type { MetadataRoute } from 'next';

/** The seven public pages, so a crawler does not have to guess. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://papershipstudio.com';
  return [
    '',
    '/games',
    '/apps/dice-battles-color-rush',
    '/apps/vector-faces',
    '/support',
    '/privacy',
    '/terms',
  ].map((path) => ({ url: `${base}${path}`, lastModified: new Date() }));
}
