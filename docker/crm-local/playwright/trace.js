// Clicks the TRACING tab of the open Test Run panel and prints the executed node list.
// usage: node trace.js <out.png>
const { chromium } = require('playwright-core');
(async () => {
  const out = process.argv[2];
  const b = await chromium.connectOverCDP('http://localhost:9222');
  const page = b.contexts()[0].pages()[0];
  await page.getByText('TRACING', { exact: true }).click();
  await page.waitForTimeout(1500);
  if (out) await page.screenshot({ path: out });
  const t = await page.locator('body').innerText();
  console.log(t.slice(t.indexOf('Test Run'), t.indexOf('Test Run') + 900));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
