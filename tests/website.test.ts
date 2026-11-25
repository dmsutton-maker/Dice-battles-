import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { assert, note, suite, test } from './harness';

/**
 * The website loads nothing from anybody else.
 *
 * David, 13 Oct 2026, asked whether the site needs an "accept" button,
 * and if so to make sure no tracking pixels, analytics or third-party
 * tracking load until somebody clicks it. Checked the live site the same
 * day: no cookies on any public page, no third-party hosts in any page,
 * fonts self-hosted. A consent banner is for consent to OPTIONAL
 * tracking, and there is none — so the honest answer is no banner, and
 * these tests are what keeps that answer true. The day one of them has
 * to change, a banner that blocks it until consent has to come first.
 */

const SITE = 'hq/src';
const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?|css)$/.test(name)) files.push(p);
  }
};
walk(SITE);

const TRACKERS = [
  'googletagmanager', 'google-analytics', 'gtag(', 'analytics.js', '@vercel/analytics',
  '@vercel/speed-insights', 'plausible', 'posthog', 'mixpanel', 'segment.com', 'hotjar',
  'connect.facebook', 'fbq(', 'tiktok', 'clarity.ms', 'doubleclick', 'youtube.com/embed',
  'player.vimeo', 'fonts.googleapis.com',
];

suite('website · nothing from anybody else', () => {
  test('no analytics, pixels or third-party embeds anywhere in the site', () => {
    note(`${files.length} site files checked`);
    for (const f of files) {
      const code = readFileSync(f, 'utf8');
      for (const t of TRACKERS) {
        assert(!code.includes(t), `${f} loads ${t} — that needs a consent banner first`);
      }
    }
  });

  test('no script, iframe or stylesheet from another host', () => {
    for (const f of files) {
      const code = readFileSync(f, 'utf8');
      const external = code.match(/<(script|iframe|link)[^>]*(src|href)=["']https?:\/\//g);
      assert(!external, `${f} pulls in ${external?.[0]} from another site`);
    }
  });
});

suite('website · the trailer', () => {
  const page = readFileSync('hq/src/app/apps/dice-battles-color-rush/page.tsx', 'utf8');

  test('it is self-hosted, and set up to play on an iPhone or iPad', () => {
    const video = page.slice(page.indexOf('<video'), page.indexOf('/>', page.indexOf('<video')));
    assert(video.length > 0, 'the trailer is not on the page');
    assert(/src="\/videos\/[^"]+\.mp4"/.test(video), 'the trailer is not a self-hosted MP4');
    // iOS Safari only autoplays inline when it is muted AND playsInline.
    for (const attr of ['muted', 'playsInline', 'autoPlay', 'controls', 'poster=']) {
      assert(video.includes(attr), `the trailer is missing ${attr}`);
    }
  });

  test('the file the page points at is really there', () => {
    for (const f of ['hq/public/videos/dice-battles-trailer.mp4', 'hq/public/videos/dice-battles-trailer.jpg']) {
      assert(existsSync(f), `${f} is missing`);
    }
    const mp4 = readFileSync('hq/public/videos/dice-battles-trailer.mp4');
    // An MP4 says "ftyp" four bytes in.
    assert(mp4.subarray(4, 8).toString() === 'ftyp', 'the trailer is not an MP4');
    const mb = mp4.length / 1e6;
    note(`trailer: ${mb.toFixed(1)} MB`);
    assert(mb < 15, `the trailer is ${mb.toFixed(1)} MB — too heavy for a phone on a slow connection`);
  });
});
