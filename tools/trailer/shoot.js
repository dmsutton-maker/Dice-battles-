/*
  Renders a reel one frame at a time and writes PNGs to OUT
  (default /tmp/trailer-frames). See README.md for the whole recipe.

  REEL=trailer (the default) is the website trailer, at 1280x720 x SCALE.
  REEL=header / iphone / ipad are the App Store videos: W and H are the
  page size in CSS pixels, and SCALE takes it to the video's size.
*/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REEL = process.env.REEL || 'trailer';
const SIZES = {
  trailer: [1280, 720, 1.5],
  header: [1920, 823, 2], // 3840 x 1646
  iphone: [443, 960, 2], // 886 x 1920
  ipad: [600, 800, 2], // 1200 x 1600
};
const [W, H, S] = SIZES[REEL];
const OUT = process.env.OUT || '/tmp/trailer-frames';
const SCALE = Number(process.env.SCALE || S);
// EVERY=30 keeps one frame a second: a quick look before the full render.
const EVERY = Number(process.env.EVERY || 1);
const FONTS = process.env.FONTS || '/tmp/fonts';
// UPTO=1 films only the first frame(s) of each shot; ARENA=sky tries a
// shot on another battlefield. Both are for probes.
const UPTO = Number(process.env.UPTO || Infinity);
const ARENA = process.env.ARENA ? `&arena=${process.env.ARENA}` : '';

const url = (q) =>
  'file://' + path.resolve(__dirname, 'index.html') +
  `?reel=${REEL}&w=${W}&h=${H}&fonts=${encodeURIComponent(FONTS)}` + (q ? `&${q}` : '') + ARENA;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist',
      '--allow-file-access-from-files'],
  });
  // The reel's own shot list, from the page (entry.tsx REELS).
  const first = await browser.newPage({ viewport: { width: W, height: H } });
  await first.goto(url('shot=p-end'));
  const reel = await first.evaluate('window.__reel');
  await first.close();
  const ORDER = reel.order;
  const ONLY = process.env.SHOT ? process.env.SHOT.split(',') : ORDER;

  let n = 0;
  const shots = [];
  for (const shot of ORDER) {
    if (!ONLY.includes(shot)) continue;
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
    page.on('pageerror', (e) => console.log('PAGE THROW', shot, e.message));
    page.on('console', (m) => { if (m.text().startsWith('roll:')) console.log(shot, m.text()); });
    await page.goto(url('shot=' + shot));
    await page.waitForFunction('window.__ready === true', { timeout: 120000 });
    await page.waitForTimeout(1500); // textures painted, images decoded
    const frames = Math.min(UPTO, await page.evaluate('window.__frames()'));
    const started = Date.now();
    const firstFrame = n;
    for (let i = 0; i < frames; i++) {
      await page.evaluate((f) => window.__frame(f), i);
      if (i % EVERY !== 0) continue;
      const name = EVERY > 1 ? `${shot}-${String(i).padStart(3, '0')}.png` : `f${String(n).padStart(5, '0')}.png`;
      await page.screenshot({ path: path.join(OUT, name) });
      n++;
    }
    shots.push({ shot, first: firstFrame, count: n - firstFrame });
    console.log(`${shot}: ${frames} frames in ${((Date.now() - started) / 1000).toFixed(0)}s`);
    await page.close();
  }
  await browser.close();
  // What compose.py needs to put the shots together.
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ reel: REEL, ...reel, fps: 30, shots }, null, 2));
  console.log(`${n} frames in ${OUT}`);
})();
