const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({
    // Playwright finds its own bundled Chromium unless CHROME_PATH
    // says otherwise. This used to be one hard-coded container path,
    // so every one of these tools failed on any other machine.
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 920, height: 1400 } });
  page.on('pageerror', (e) => console.log('PAGE THROW:', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'index.html'));
  await page.waitForFunction('window.__ready === true', { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: process.argv[2] || '/tmp/icons.png', fullPage: true });
  console.log('shot');
  await browser.close();
})();
