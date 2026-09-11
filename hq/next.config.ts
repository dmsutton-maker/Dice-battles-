import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /*
    The private half of the site — the admin, the sign-in page and the
    password page — kept out of search results and out of other people's
    frames.

    These were scoped to `/hq/:path*`, which is where the board used to
    live. It moved to `/admin` on 18 Aug 2026 and this did not follow, so
    for three weeks the pages these exist to protect received none of
    them and the path that did receive them was a 404.

    The PUBLIC pages are deliberately not in this list: X-Robots-Tag
    noindex on `/`, `/apps`, `/support`, `/privacy` or `/terms` would
    take the studio's own site out of Google.
  */
  async headers() {
    const privatePages = [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'same-origin' },
    ];
    return ['/admin/:path*', '/login', '/password'].map((source) => ({
      source,
      headers: privatePages,
    }));
  },
};

export default nextConfig;
