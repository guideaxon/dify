// DESTRUCTIVE: permanently deletes one app, chosen by its id (app "..." menu > Delete > Autofill > Confirm).
// Several apps can share a name, so the id in the URL is the only safe way to pick one.
// usage: node delete-app.js <app-id> <screenshot-prefix>
const { chromium } = require('playwright-core');
const { deleteApp } = require('./video/lib');

(async () => {
  const [appId, prefix] = process.argv.slice(2);
  if (!appId || !prefix) throw new Error('usage: node delete-app.js <app-id> <screenshot-prefix>');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];
  await deleteApp(page, appId);
  await page.screenshot({ path: prefix + '_after.png' });
  console.log('after:', page.url());
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
