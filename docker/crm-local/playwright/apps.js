// Lists the apps shown on the Studio page (id and name), read from the page links.
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9222');
  const page = b.contexts()[0].pages()[0];
  await page.goto('http://localhost/apps', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const rows = await page.$$eval('a[href^="/app/"]', as => as.map(a => `${a.getAttribute('href')}  ${a.innerText.split('\n')[0]}`));
  console.log([...new Set(rows)].join('\n'));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
