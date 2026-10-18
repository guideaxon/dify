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
  await page.getByRole('button', { name: 'Checklist' }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out });
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
