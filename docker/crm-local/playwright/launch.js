// Launches a visible Chromium with a persistent profile and a Chrome DevTools port (9222),
// so the other scripts in this folder can attach. Log in to Dify by hand in the window that
// opens; credentials are never passed to or stored by these scripts (only the browser profile
// in ./.profile keeps the session cookie, and it is git-ignored).
//
// usage: node launch.js            (leave it running; close the window to stop)
const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  // same default and override as video/session.js, so the login saved here is the one the recorder reuses
  // The debug port is full remote control of this signed-in browser: keep it on loopback and close the window when done.
  const profile = process.env.DIFY_PROFILE || path.join(__dirname, '.profile');
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    chromiumSandbox: true,
    viewport: null,
    args: ['--remote-debugging-port=9222', '--remote-debugging-address=127.0.0.1', '--window-size=1600,1000', '--window-position=40,20'],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto(process.env.DIFY_URL || 'http://localhost/signin');
  console.log('BROWSER READY. Log in to Dify in the window, then run the other scripts.');
  await new Promise((resolve) => ctx.on('close', resolve));
})();
