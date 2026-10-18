// Starts the Post-call update app through Test Run with the sample transcript and screenshots the
// state once it pauses at the review form (or finishes).
// usage: node run-postcall.js <app-id> <out-prefix> [transcript-file] [email] [call type]
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const [appId, prefix,
    transcriptFile = path.join(__dirname, '..', 'sample_transcripts', 'aisha_tester5_negotiation.txt'),
    email = 'aisha.tester5@example.com', callType = 'Negotiation'] = process.argv.slice(2);
  if (!appId || !prefix) throw new Error('usage: node run-postcall.js <app-id> <out-prefix> [transcript-file] [email] [call type]');
  const transcript = fs.readFileSync(transcriptFile, 'utf8');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];
  await page.goto(`http://localhost/app/${appId}/workflow`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await page.getByRole('button', { name: /Test Run/ }).first().click();
  await page.waitForTimeout(1000);
  await page.getByPlaceholder('Contact email').fill(email);
  await page.getByText('Please select').click();
  await page.getByText(callType, { exact: true }).click();
  await page.getByPlaceholder('Transcript').fill(transcript);
  await page.screenshot({ path: prefix + '_filled.png' });
  await page.getByRole('button', { name: 'Start Run' }).click();
  await page.waitForTimeout(45000); // three model calls, then the review pause
  await page.screenshot({ path: prefix + '_paused.png' });
  console.log(page.url());
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
