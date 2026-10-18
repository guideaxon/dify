// Clicks "Approve and log to CRM" (or another button by name) on the open Test Run review form.
// usage: node approve.js <out.png> [button name]
const { chromium } = require('playwright-core');

(async () => {
  const [out, button = 'Approve and log to CRM'] = process.argv.slice(2);
  if (!out) throw new Error('usage: node approve.js <out.png> [button name]');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];
  await page.getByRole('button', { name: button, exact: true }).click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: out });
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
