import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // "X-Powered-By: Next.js" tells a scanner what to try. Nothing reads it.
  poweredByHeader: false,
  /*
    The Apps page became the Games page on 23 Oct 2026 (David: "change
    the apps tab to say Games"). Old links to /apps land on it. Only the
    page itself: Dice Battles keeps /apps/dice-battles-color-rush, which
    the game and the App Store listing link to.

    The board lived at /hq until 18 Aug 2026 and old bookmarks still say
    so; they were landing on the 404 page. They go to /admin now, which
    sends anyone not signed in to /login like every other admin path.
  */
  async redirects() {
    return [
      { source: '/apps', destination: '/games', permanent: true },
      { source: '/hq', destination: '/admin', permanent: true },
      { source: '/hq/:path*', destination: '/admin/:path*', permanent: true },
    ];
  },
  /*
    Three groups, in this order because Next lets a LATER rule override an
    earlier one for the same header key (its docs, "Header Overriding
    Behavior"): the whole site first, then the private pages tightening a
    few of those values, then the one file that needs its own type.

    EVERY PAGE gets the headers that cost nothing and that the 9 Nov 2026
    pre-submission audit found missing on the public half of the site:
    - X-Content-Type-Options: nosniff — a browser must take a file for
      what the server says it is, never guess a script out of an image.
    - Referrer-Policy: strict-origin-when-cross-origin — a link out (the
      App Store, geography.papershipstudio.com) learns we sent them, not
      which page or which friend code was in the address bar.
    - Permissions-Policy — the site never asks for the camera, the
      microphone or where somebody is, so say so; a script that ever
      tried would be refused.
    - frame-ancestors / X-Frame-Options — nobody else's page gets to put
      ours inside a frame and paint over it. Only `frame-ancestors` is set
      from Content-Security-Policy on purpose: a full script policy needs
      a nonce on every inline script Next emits, which is a bigger change
      than an audit should make unasked.
    No X-Robots-Tag here: noindex on `/`, `/games`, `/support`,
    `/privacy` or `/terms` would take the studio's own site out of Google.

    THE PRIVATE PAGES — the admin, the sign-in page and the password
    page — are also kept out of search results and out of every frame,
    ours included. These were scoped to `/hq/:path*`, which is where the
    board used to live. It moved to `/admin` on 18 Aug 2026 and this did
    not follow, so for three weeks the pages these exist to protect
    received none of them and the path that did receive them was a 404.
  */
  async headers() {
    const everyPage = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
    ];
    const privatePages = [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
      { key: 'Referrer-Policy', value: 'same-origin' },
    ];
    return [
      { source: '/:path*', headers: everyPage },
      ...['/admin/:path*', '/login', '/password'].map((source) => ({
        source,
        headers: privatePages,
      })),
      /*
        Apple's universal-link file, and the one line that makes it work.

        iOS fetches https://papershipstudio.com/.well-known/apple-app-site-association
        before it will ever open the app from a link, and it REFUSES
        anything not served as application/json. The file has no
        extension — Apple's own requirement, it must not be .json — so
        nothing downstream can guess the type and it goes out as
        application/octet-stream by default. iOS then silently declines
        to associate the domain: no error, no log, links just keep
        opening Safari.
      */
      {
        source: '/.well-known/apple-app-site-association',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
    ];
  },
};

export default nextConfig;
