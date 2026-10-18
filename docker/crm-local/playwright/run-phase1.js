// Starts the Phase 1 (inbound reply) app through Test Run and stops at the review form.
// usage: node run-phase1.js <app-id> <out-prefix> [name] [email] [inquiry]
const { chromium } = require('playwright-core');
(async () => {
  const [appId, prefix, name = 'Priya Tester1', email = 'priya.tester1@example.com',
    inquiry = 'Hi, we run dispatch for about 180 drivers and do it by hand today. Can you tell me how your route planning works and roughly what it costs? We would like to start in the new year.'] = process.argv.slice(2);
  if (!appId || !prefix) throw new Error('usage: node run-phase1.js <app-id> <out-prefix> [name] [email] [inquiry]');
  const b = await chromium.connectOverCDP('http://localhost:9222');
  const page = b.contexts()[0].pages()[0];
  await page.goto(`http://localhost/app/${appId}/workflow`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await page.getByRole('button', { name: /Test Run/ }).first().click();
  await page.waitForTimeout(1000);
  await page.getByPlaceholder('Lead name').fill(name);
  await page.getByPlaceholder('Lead email').fill(email);
  await page.getByPlaceholder('Inquiry').fill(inquiry);
  await page.screenshot({ path: prefix + '_filled.png' });
  await page.getByRole('button', { name: 'Start Run' }).click();
  await page.getByRole('button', { name: 'Approve and send', exact: true }).waitFor({ timeout: 120000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: prefix + '_paused.png' });
  console.log('paused at the review form');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
