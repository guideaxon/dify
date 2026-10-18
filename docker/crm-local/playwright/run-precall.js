// Runs the Pre-call brief app through Test Run and prints/screenshots the result.
// usage: node run-precall.js <app-id> <out-prefix> [name] [email] [company] [call type]
const { chromium } = require('playwright-core');

(async () => {
  const [appId, prefix, name = 'Aisha Tester5', email = 'aisha.tester5@example.com',
    company = 'Harborview Test Financial', callType = 'Negotiation'] = process.argv.slice(2);
  if (!appId || !prefix) throw new Error('usage: node run-precall.js <app-id> <out-prefix> [name] [email] [company] [call type]');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];
  await page.goto(`http://localhost/app/${appId}/workflow`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await page.getByRole('button', { name: /Test Run/ }).first().click();
  await page.waitForTimeout(1000);
  await page.getByPlaceholder('Contact name').fill(name);
  await page.getByPlaceholder('Contact email').fill(email);
  await page.getByPlaceholder('Company', { exact: true }).fill(company);
  await page.getByText('Please select').click();
  await page.getByText(callType, { exact: true }).click();
  await page.screenshot({ path: prefix + '_filled.png' });
  await page.getByRole('button', { name: 'Start Run' }).click();

  // Wait for the panel title to leave "Running".
  const start = Date.now();
  while (Date.now() - start < 240000) {
    const title = await page.getByText(/^Test Run \(/).first().innerText().catch(() => '');
    if (title && !/Running/.test(title)) { console.log('finished:', title); break; }
    await page.waitForTimeout(2000);
  }
  console.log('seconds:', Math.round((Date.now() - start) / 1000));
  await page.getByText('RESULT', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: prefix + '_result.png' });
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
