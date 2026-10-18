// DESTRUCTIVE: permanently deletes one app, chosen by its id (app "..." menu > Delete > Autofill > Confirm).
// Several apps can share a name, so the id in the URL is the only safe way to pick one.
// usage: node delete-app.js <app-id> <screenshot-prefix>
const { chromium } = require('playwright-core');

(async () => {
  const [appId, prefix] = process.argv.slice(2);
  if (!appId || !prefix) throw new Error('usage: node delete-app.js <app-id> <screenshot-prefix>');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];
  await page.goto(`http://localhost/app/${appId}/workflow`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  if (!page.url().includes(appId)) throw new Error('not on the expected app page: ' + page.url());
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const vw = await page.evaluate(() => window.innerWidth);
  await page.mouse.click(vw * (264 / 2000), (103 * 1.19) / dpr); // "..." next to the app name
  await page.getByText('Delete', { exact: true }).first().click();
  await page.waitForTimeout(800);
  await page.getByText('Autofill', { exact: true }).click(); // fills the app name for the confirmation
  await page.waitForTimeout(500);
  await page.screenshot({ path: prefix + '_confirm.png' });
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: prefix + '_after.png' });
  console.log('after:', page.url());
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
