// Runs the Live call helper (chatflow) in Preview: sets the call, sends buyer lines, prints the replies.
// usage: node run-duringcall.js <app-id> <out-prefix> [email] [call type]
const { chromium } = require('playwright-core');

const LINES = [
  "Procurement is asking for twelve percent off. Our CFO won't sign otherwise.",
  'We have a competitor quote about ten percent below you.',
];

(async () => {
  const [appId, prefix, email = 'aisha.tester5@example.com', callType = 'Negotiation'] = process.argv.slice(2);
  if (!appId || !prefix) throw new Error('usage: node run-duringcall.js <app-id> <out-prefix> [email] [call type]');
  const b = await chromium.connectOverCDP('http://localhost:9222');
  const page = b.contexts()[0].pages()[0];
  await page.goto(`http://localhost/app/${appId}/workflow`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await page.getByRole('button', { name: /Preview/ }).first().click();
  await page.waitForTimeout(1000);
  await page.getByPlaceholder('Contact email').fill(email);
  await page.getByText('Please select').click();
  await page.getByText(callType, { exact: true }).click();
  const box = page.getByPlaceholder('Talk to Bot');
  for (let i = 0; i < LINES.length; i++) {
    await box.fill(LINES[i]);
    await box.press('Enter');
    await page.waitForTimeout(3000);
    // wait for the response to finish: the "stop responding" control disappears
    for (let t = 0; t < 60; t++) {
      const busy = await page.getByText(/Stop responding/i).count();
      if (!busy) break;
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${prefix}_${i + 1}.png` });
  }
  const text = await page.locator('body').innerText();
  const start = text.indexOf('Paste what the buyer');
  console.log(text.slice(start, start + 2500));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
