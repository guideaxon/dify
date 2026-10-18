// Attach to the browser started by launch.js, optionally navigate, and save a screenshot.
// usage: node snap.js <out.png> [url]
const { chromium } = require('playwright-core');

(async () => {
  const [out, url] = process.argv.slice(2);
  if (!out) throw new Error('usage: node snap.js <out.png> [url]');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];
  if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out });
  console.log(page.url(), '|', await page.title());
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
