const { chromium } = require('playwright');
const path = require('path');

/**
 * One PNG of the dice, through entry.tsx — see the usage there.
 *
 *     OUT=/tmp/dice node tools/die-preview/shoot.js table ivory,gold,fire
 *     SYMBOLS=1 OUT=/tmp/dice node tools/die-preview/shoot.js close ivory
 *
 * Shot at deviceScaleFactor 3, which is what an iPhone draws at: a die
 * on the table is about 190 real pixels across, and judging a 64-texel
 * texture at the 60 CSS pixels a 1x shot gives would hide exactly the
 * softness this tool is for.
 */
const [view = 'table', skins = 'ivory'] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const w = view === 'table' ? 393 : 900;
  const h = view === 'table' ? 852 : 520;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 3 });
  page.on('pageerror', (e) => console.log('PAGE THROW:', e.message));
  const q = new URLSearchParams({
    view,
    skins,
    w: String(w),
    h: String(h),
    symbols: process.env.SYMBOLS === '1' ? '1' : '0',
    arena: process.env.ARENA ?? 'castle',
    fishT: process.env.FISH_T ?? '0',
  });
  await page.goto('file://' + path.resolve(__dirname, 'index.html') + '?' + q);
  await page.waitForFunction('window.__ready === true', { timeout: 30000 }).catch(() => {
    console.log('  (timed out waiting for ready)');
  });
  const tag =
    (process.env.SYMBOLS === '1' ? '-symbols' : '') +
    (process.env.FISH_T ? `-t${process.env.FISH_T}` : '');
  const out = path.join(process.env.OUT ?? '/tmp', `dice-${view}${tag}.png`);
  await page.screenshot({ path: out });
  console.log(out);
  await browser.close();
})();
