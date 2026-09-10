const { chromium } = require('playwright');
const path = require('path');

/**
 * One PNG per screen per shape.
 *
 * The viewport IS the phone: set it to 474x696 and react-native-web's
 * useWindowDimensions reports 474x696, which is the number every layout
 * rule in the game keys off. No scaling, no full-page capture — a
 * full-page shot would grow to fit the content and hide the very thing
 * being checked, which is what does and does not fit on one screen.
 */
const SHAPES = {
  folded: { w: 474, h: 696 },
  unfolded: { w: 640, h: 904 },
  // For comparison: the phone the family actually holds today.
  iphone: { w: 393, h: 852 },
};

(async () => {
  const screens = (process.argv[2] || 'inventory,store,leaderboard').split(',');
  const shapes = (process.argv[3] || 'folded,unfolded').split(',');
  const outDir = process.argv[4] || '/tmp/duo';
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--no-sandbox'],
  });
  for (const shapeName of shapes) {
    const shape = SHAPES[shapeName];
    if (!shape) throw new Error(`unknown shape ${shapeName} (have ${Object.keys(SHAPES)})`);
    for (const screen of screens) {
      const page = await browser.newPage({
        viewport: { width: shape.w, height: shape.h },
        deviceScaleFactor: 2,
      });
      page.on('pageerror', (e) => console.log('PAGE THROW:', e.message));
      await page.goto(
        'file://' + path.resolve(__dirname, 'index.html') + '?screen=' + screen,
      );
      await page
        .waitForFunction('window.__ready === true', { timeout: 30000 })
        .catch(() => console.log('  (timed out waiting for ready)'));
      const out = path.join(outDir, `${screen}-${shapeName}.png`);
      await page.screenshot({ path: out });
      console.log(`${out}  ${shape.w}x${shape.h}pt`);
      await page.close();
    }
  }
  await browser.close();
})();
