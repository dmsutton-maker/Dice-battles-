#!/usr/bin/env node
/**
 * Look at the website the way a person would, and measure what they would
 * complain about.
 *
 * Every layout bug reported on this project so far has been one of three
 * things: text spilling outside its box, text you cannot read against what
 * is behind it, or something too small to tap. All three are measurable, so
 * they should be measured rather than spotted by eye after shipping.
 *
 *   node check.mjs http://localhost:3000/            # a local dev server
 *   node check.mjs --live https://example.com/       # a deployed page
 *
 * --live exists because this container's proxy will not carry Chromium's
 * TLS: the browser cannot reach the internet, though curl can. So --live
 * fetches the HTML and its stylesheets with curl and hands them to the
 * browser inline. Layout, colour and overflow are all faithful that way;
 * anything that only appears after client-side JavaScript runs is not, so
 * prefer a local server when the page is interactive.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
];

const args = process.argv.slice(2);
const live = args.includes('--live');
const target = args.find((a) => !a.startsWith('--'));
const outDir = (args.find((a) => a.startsWith('--out=')) ?? '--out=./site-check').slice(6);

if (!target) {
  console.error('usage: node check.mjs [--live] <url> [--out=DIR]');
  process.exit(2);
}

const curl = (url) =>
  execFileSync('curl', ['-sSL', '--max-time', '60', url], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });

/** Fetch a page and inline its stylesheets, so the browser can render it offline. */
function fetchInlined(url) {
  let html = curl(url);
  const base = new URL(url);
  const links = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)];
  for (const [tag] of links) {
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      const css = curl(new URL(href, base).toString());
      html = html.replace(tag, `<style>${css}</style>`);
    } catch {
      // A stylesheet that will not fetch is worth knowing about, but not
      // worth aborting for — the rest of the page still tells us plenty.
      console.warn(`  ! could not fetch stylesheet ${href}`);
    }
  }
  return html;
}

/** Relative luminance, per WCAG. */
function luminance([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Everything the page can tell us about itself, gathered in the browser. */
const COLLECT = () => {
  const parseRgb = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((n) => parseFloat(n));
    return { rgb: [p[0], p[1], p[2]], alpha: p.length > 3 ? p[3] : 1 };
  };

  const out = { overflow: [], text: [], targets: [], docWidth: document.documentElement.scrollWidth };

  for (const el of document.querySelectorAll('body *')) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;

    const label = (() => {
      const id = el.id ? `#${el.id}` : '';
      const cls = typeof el.className === 'string' && el.className
        ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
        : '';
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    })();

    const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);

    // Spilling past the right edge of the viewport, or out of its own parent.
    if (box.right > window.innerWidth + 1) {
      out.overflow.push({ label, text, right: Math.round(box.right), kind: 'viewport' });
    } else if (el.scrollWidth > el.clientWidth + 1 && style.overflowX === 'visible') {
      out.overflow.push({
        label, text, kind: 'own box',
        content: el.scrollWidth, box: el.clientWidth,
      });
    }

    // Only leaf nodes that actually carry text get a contrast reading —
    // a wrapper's colour is inherited and would be counted many times.
    const hasOwnText = [...el.childNodes].some(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
    );
    if (hasOwnText) {
      const fg = parseRgb(style.color);
      /*
        Walk up for the first ancestor that actually paints something behind
        this text. A gradient or an image counts and STOPS the walk without
        yielding a colour: the first version of this only looked at
        background-color, so white hero text over a blue gradient came back
        as "#ffffff on #ffffff, 1.00:1" — a false alarm on the most
        prominent heading on the site. Guessing an average colour out of a
        gradient would just be a quieter way of being wrong, so those are
        reported as unknown and left for a human to look at.
      */
      let bg = null;
      let painted = null;
      for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
        const cs = getComputedStyle(node);
        if (cs.backgroundImage && cs.backgroundImage !== 'none') { painted = 'image or gradient'; break; }
        const c = parseRgb(cs.backgroundColor);
        if (c && c.alpha > 0.05) { bg = c; break; }
      }
      if (!bg && !painted) {
        bg = parseRgb(getComputedStyle(document.body).backgroundColor) ?? { rgb: [255, 255, 255], alpha: 1 };
      }
      if (fg && painted) {
        out.text.push({ label, text, painted, alpha: fg.alpha, fg: fg.rgb, bg: null,
          size: parseFloat(style.fontSize), weight: style.fontWeight });
      } else if (fg) {
        out.text.push({
          label,
          text,
          fg: fg.rgb, bg: bg.rgb,
          alpha: fg.alpha,
          size: parseFloat(style.fontSize),
          weight: style.fontWeight,
        });
      }
    }

    // Anything you are meant to press.
    if (['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
      out.targets.push({ label, text, w: Math.round(box.width), h: Math.round(box.height) });
    }
  }
  return out;
};

const browser = await chromium.launch();
mkdirSync(outDir, { recursive: true });

let html = null;
if (live) {
  console.log(`Fetching ${target} (and its stylesheets) …`);
  html = fetchInlined(target);
}

let problems = 0;

for (const vp of WIDTHS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

  if (html !== null) {
    await page.setContent(html, { waitUntil: 'load' });
  } else {
    await page.goto(target, { waitUntil: 'networkidle', timeout: 60000 });
  }

  const data = await page.evaluate(COLLECT);
  const shot = `${outDir}/${vp.name}.png`;
  await page.screenshot({ path: shot, fullPage: true });

  console.log(`\n${'='.repeat(58)}\n${vp.name}  ${vp.width}×${vp.height}   → ${shot}\n${'='.repeat(58)}`);

  // 1. Does the page itself scroll sideways?
  if (data.docWidth > vp.width + 1) {
    console.log(`✗ the whole page scrolls sideways: ${data.docWidth}px of content in ${vp.width}px`);
    problems++;
  }

  // 2. Anything spilling out of its box.
  const spills = data.overflow.slice(0, 12);
  if (spills.length) {
    console.log(`✗ ${data.overflow.length} element(s) overflow:`);
    for (const o of spills) {
      const detail = o.kind === 'viewport'
        ? `reaches ${o.right}px (viewport is ${vp.width}px)`
        : `${o.content}px of content in a ${o.box}px box`;
      console.log(`    ${o.label} — ${detail}${o.text ? `  "${o.text}"` : ''}`);
    }
    problems += data.overflow.length;
  } else {
    console.log('✓ nothing overflows its box');
  }

  // 3. Text you cannot read. WCAG AA: 4.5:1, or 3:1 for large text.
  const unreadable = [];
  const unmeasurable = [];
  for (const t of data.text) {
    if (t.painted) {
      // Sitting on a gradient or an image. Not judged — see the note in
      // COLLECT. Counted separately so it never inflates the problem count.
      if (t.alpha < 0.05) unreadable.push({ ...t, ratio: 0, need: 0, why: 'fully transparent' });
      else unmeasurable.push(t);
      continue;
    }
    const ratio = contrastRatio(t.fg, t.bg);
    const large = t.size >= 24 || (t.size >= 18.66 && Number(t.weight) >= 700);
    const need = large ? 3 : 4.5;
    if (t.alpha < 0.05) {
      unreadable.push({ ...t, ratio: 0, need, why: 'fully transparent' });
    } else if (ratio < need) {
      unreadable.push({ ...t, ratio, need, why: `${ratio.toFixed(2)}:1, needs ${need}:1` });
    }
  }
  if (unreadable.length) {
    console.log(`✗ ${unreadable.length} piece(s) of hard-to-read text:`);
    for (const u of unreadable.slice(0, 12)) {
      const hex = (c) => '#' + c.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
      console.log(
        `    ${u.label} ${hex(u.fg)} on ${hex(u.bg)} — ${u.why}${u.text ? `  "${u.text}"` : ''}`,
      );
    }
    problems += unreadable.length;
  } else {
    console.log('✓ all measurable text meets WCAG AA contrast');
  }
  if (unmeasurable.length) {
    console.log(
      `  · ${unmeasurable.length} piece(s) sit on a gradient or image — not judged, check the screenshot`,
    );
  }

  // 4. Things too small to tap. Apple asks for 44×44.
  const small = data.targets.filter((t) => t.w < 44 || t.h < 44);
  if (vp.name === 'phone' && small.length) {
    console.log(`✗ ${small.length} tap target(s) under 44×44:`);
    for (const s of small.slice(0, 10)) {
      console.log(`    ${s.label} ${s.w}×${s.h}${s.text ? `  "${s.text}"` : ''}`);
    }
    problems += small.length;
  } else if (vp.name === 'phone') {
    console.log('✓ every tap target is at least 44×44');
  }

  await page.close();
}

await browser.close();
console.log(`\n${problems === 0 ? '✅ nothing to fix' : `⚠️  ${problems} thing(s) worth looking at`}`);
process.exit(problems === 0 ? 0 : 1);
