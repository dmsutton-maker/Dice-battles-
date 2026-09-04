const { chromium } = require('playwright');
const path = require('path');
const jobs = JSON.parse(process.argv[2]);
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  for (const j of jobs) {
    const page = await browser.newPage({ viewport: { width: j.w, height: j.h } });
    page.on('pageerror', (e) => console.log('THROW:', e.message));
    const q = Object.entries(j).map(([k, v]) => `${k}=${v}`).join('&');
    await page.goto('file://' + path.resolve(__dirname, 'index.html') + '?' + q);
    await page.waitForFunction('window.__ready === true', { timeout: 25000 }).catch(() => {});
    await page.screenshot({ path: `/tmp/hero-${j.name}.png`, omitBackground: true });
    await page.close();
    console.log('hero', j.name);
  }
  await browser.close();
})();
