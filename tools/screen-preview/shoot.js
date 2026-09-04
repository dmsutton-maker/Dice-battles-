const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 393, height: 1400 } });
  page.on('pageerror', (e) => console.log('PAGE THROW:', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'index.html'));
  await page.waitForFunction('window.__ready === true', { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: process.argv[2] || '/tmp/screen.png', fullPage: true });
  console.log('shot');
  await browser.close();
})();
