const { chromium } = require('playwright');
const path = require('path');
const IDS = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({
    // Playwright finds its own bundled Chromium unless CHROME_PATH
    // says otherwise. This used to be one hard-coded container path,
    // so every one of these tools failed on any other machine.
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()); });
  page.on('pageerror', (e) => console.log('PAGE THROW:', e.message));
  for (const id of IDS) {
    const top = process.env.TOP === '1' ? '&top=1' : '';
    // MODE=classic|ultimate|skirmish|colorwar paints the retreat pads
    // with that round's colours, which is the only way to see them.
    const mode = process.env.MODE ? '&mode=' + process.env.MODE : '';
    await page.goto('file://' + path.resolve(__dirname, 'index.html') + '?id=' + id + top + mode);
    await page.waitForFunction('window.__ready === true', { timeout: 20000 }).catch(() => {});
    const tag = `${top ? '-top' : ''}${process.env.MODE ? '-' + process.env.MODE : ''}`;
    await page.screenshot({ path: `/tmp/arena-${id}${tag}.png` });
    console.log('shot', id);
  }
  await browser.close();
})();
