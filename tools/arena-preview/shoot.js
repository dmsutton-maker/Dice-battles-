const { chromium } = require('playwright');
const path = require('path');
const IDS = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()); });
  page.on('pageerror', (e) => console.log('PAGE THROW:', e.message));
  for (const id of IDS) {
    const top = process.env.TOP === '1' ? '&top=1' : '';
    await page.goto('file://' + path.resolve(__dirname, 'index.html') + '?id=' + id + top);
    await page.waitForFunction('window.__ready === true', { timeout: 20000 }).catch(() => {});
    await page.screenshot({ path: `/tmp/arena-${id}${top ? '-top' : ''}.png` });
    console.log('shot', id);
  }
  await browser.close();
})();
