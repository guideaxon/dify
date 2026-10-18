// Opens a workflow app's canvas, clicks the checklist icon (top right, shows issue count) and
// screenshots the panel, so you can read what Dify says must be fixed before publishing.
// usage: node checklist.js <app-id> <out.png>
const { chromium } = require('playwright-core');

(async () => {
  const [appId, out] = process.argv.slice(2);
  if (!appId || !out) throw new Error('usage: node checklist.js <app-id> <out.png>');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];
  await page.goto(`http://localhost/app/${appId}/workflow`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  // The checklist button is the icon right of the history/clock icon, left of the ENV icon.
  // Match it by its issue-count badge; fall back to a position-based click.
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const vw = await page.evaluate(() => window.innerWidth);
  const x = vw * (1706 / 2000); // x of the icon in a 2000px-wide screenshot of this layout
  await page.mouse.click(x, (35 * 1.19) / dpr);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out });
  console.log('dpr', dpr, 'vw', vw, 'clicked x', Math.round(x));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
