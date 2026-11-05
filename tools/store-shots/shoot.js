/*
 * Renders the board shots in shots.json into $SHOTS_TMP (default
 * /tmp/store-shots), as transparent PNGs named after each shot.
 *
 *   node tools/store-shots/shoot.js            # every shot
 *   node tools/store-shots/shoot.js hero season # only these
 *   SHOTS_JSON=/path/to/other.json ...           # try a camera out
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.env.SHOTS_TMP || '/tmp/store-shots';
const only = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(process.env.SHOTS_JSON || path.join(__dirname, 'shots.json'), 'utf8'))
  .filter((j) => only.length === 0 || only.includes(j.name));
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    // Playwright finds its own bundled Chromium unless CHROME_PATH
    // says otherwise. This used to be one hard-coded container path,
    // so every one of these tools failed on any other machine.
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  for (const j of jobs) {
    const page = await browser.newPage({ viewport: { width: j.w, height: j.h } });
    page.on('pageerror', (e) => console.log('THROW:', e.message));
    const q = 'cfg=' + encodeURIComponent(JSON.stringify(j));
    await page.goto('file://' + path.resolve(__dirname, 'index.html') + '?' + q);
    await page.waitForFunction('window.__ready === true', { timeout: 40000 }).catch(() => {});
    await page.screenshot({ path: path.join(OUT, `${j.name}.png`), omitBackground: true });
    await page.close();
    console.log('rendered', j.name, `${j.w}x${j.h}`);
  }
  await browser.close();
})();
