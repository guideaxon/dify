// Imports a Dify DSL file through Studio > Import DSL file, in the browser started by launch.js.
// usage: node import.js <dsl-file> <screenshot-prefix>
// Writes <prefix>_dialog.png (before clicking Create) and <prefix>_result.png (after).
const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const [file, prefix] = process.argv.slice(2);
  if (!file || !prefix) throw new Error('usage: node import.js <dsl-file> <screenshot-prefix>');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];
  await page.goto('http://localhost/apps', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // The empty Studio page shows "Import DSL file" directly; otherwise it is under Create.
  const direct = page.getByText('Import DSL file', { exact: true });
  if (await direct.count()) {
    await direct.first().click();
  } else {
    await page.getByRole('button', { name: /Create/ }).first().click();
    await page.getByText(/Import DSL file/).first().click();
  }
  await page.waitForTimeout(1000);
  await page.locator('input[type=file]').first().setInputFiles(path.resolve(file));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: prefix + '_dialog.png' });

  await page.getByRole('button', { name: /^Create/ }).last().click();
  await page.waitForTimeout(6000); // import, plus any follow-up dialog
  await page.screenshot({ path: prefix + '_result.png' });
  console.log(page.url());
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
