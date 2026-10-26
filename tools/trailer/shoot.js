/*
  Renders the trailer one frame at a time and writes PNGs to OUT
  (default /tmp/trailer-frames). See README.md for the whole recipe.
*/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ORDER = ['open', 'storm', 'fire', 'ice', 'space', 'jungle', 'candy', 'reef', 'finale', 'end'];
const OUT = process.env.OUT || '/tmp/trailer-frames';
const ONLY = process.env.SHOT ? process.env.SHOT.split(',') : ORDER;
const SCALE = Number(process.env.SCALE || 1.5);
// EVERY=30 keeps one frame a second: a quick look before the full render.
const EVERY = Number(process.env.EVERY || 1);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });
  let n = 0;
  for (const shot of ORDER) {
    if (!ONLY.includes(shot)) continue;
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: SCALE });
    page.on('pageerror', (e) => console.log('PAGE THROW', shot, e.message));
    await page.goto('file://' + path.resolve(__dirname, 'index.html') + '?shot=' + shot);
    await page.waitForFunction('window.__ready === true', { timeout: 60000 });
    await page.waitForTimeout(1500); // textures painted, images decoded
    const frames = await page.evaluate('window.__frames()');
    const started = Date.now();
    for (let i = 0; i < frames; i++) {
      await page.evaluate((f) => window.__frame(f), i);
      if (i % EVERY !== 0) continue;
      const name = EVERY > 1 ? `${shot}-${String(i).padStart(3, '0')}.png` : `f${String(n).padStart(5, '0')}.png`;
      await page.screenshot({ path: path.join(OUT, name) });
      n++;
    }
    console.log(`${shot}: ${frames} frames in ${((Date.now() - started) / 1000).toFixed(0)}s`);
    await page.close();
  }
  await browser.close();
  console.log(`${n} frames in ${OUT}`);
})();
