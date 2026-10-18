// Starts a Phase 1-style app, does NOT click anything on the review form, and waits for the run to
// leave the paused state (used with a scratch copy whose Human Input timeout is 0).
// usage: node run-timeout.js <app-id> <out-prefix>
const { chromium } = require('playwright-core');
(async () => {
  const [appId, prefix] = process.argv.slice(2);
  if (!appId || !prefix) throw new Error('usage: node run-timeout.js <app-id> <out-prefix>');
  const b = await chromium.connectOverCDP('http://localhost:9222');
  const page = b.contexts()[0].pages()[0];
  await page.goto(`http://localhost/app/${appId}/workflow`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await page.getByRole('button', { name: /Test Run/ }).first().click();
  await page.waitForTimeout(1000);
  await page.getByPlaceholder('Lead name').fill('Priya Tester1');
  await page.getByPlaceholder('Lead email').fill('priya.tester1@example.com');
  await page.getByPlaceholder('Inquiry').fill('Can you tell me how your route planning works and what it costs?');
  await page.getByRole('button', { name: 'Start Run' }).click();
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < 300000) {
    const title = await page.getByText(/^Test Run \(/).first().innerText().catch(() => '');
    if (title !== last) { console.log(Math.round((Date.now() - t0) / 1000) + 's:', title); last = title; }
    if (title && !/Running|Paused/.test(title)) break;
    await page.waitForTimeout(3000);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: prefix + '_end.png' });
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
