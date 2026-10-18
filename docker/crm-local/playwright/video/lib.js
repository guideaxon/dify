// Helpers for scripted, narrated screen recordings of the Dify UI.
//  - overlay: visible cursor, red highlight ring and an info bar (step number, who does it, what is happening)
//  - paced actions: smooth mouse moves, short pauses, typing at readable speed
//  - app helpers: import a DSL file as a new app, delete an app by id, find an app id by name
const path = require('path');
const { BASE } = require('./session');

const OVERLAY_CSS = `
#__cur{position:fixed;z-index:2147483647;width:26px;height:26px;border-radius:50%;border:3px solid #ff3b30;
  background:rgba(255,59,48,.18);pointer-events:none;transform:translate(-50%,-50%);transition:transform .08s;left:-100px;top:-100px}
#__cur.down{transform:translate(-50%,-50%) scale(.7);background:rgba(255,59,48,.5)}
.__hl{outline:4px solid #ff3b30 !important;outline-offset:4px !important;border-radius:6px;
  box-shadow:0 0 0 9999px rgba(0,0,0,0) !important;animation:__pulse 1.1s ease-in-out infinite}
@keyframes __pulse{0%,100%{outline-color:#ff3b30}50%{outline-color:#ffb3ad}}
#__bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483646;background:rgba(11,20,40,.95);color:#fff;
  font-family:system-ui,Segoe UI,Arial;padding:12px 28px 14px;pointer-events:none;display:none;
  border-top:3px solid #3b82f6;box-shadow:0 -6px 24px rgba(0,0,0,.35)}
#__bar .row1{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
#__bar .part{font-size:15px;letter-spacing:.06em;text-transform:uppercase;color:#9db4d8;font-weight:600}
#__bar .num{background:#fff;color:#0b1428;border-radius:999px;font-weight:800;font-size:17px;padding:3px 14px}
#__bar .title{font-size:25px;font-weight:700}
#__bar .chip{font-size:15px;font-weight:800;letter-spacing:.05em;padding:4px 12px;border-radius:8px;color:#fff}
#__bar .chip.manual{background:#2563eb}
#__bar .chip.automated{background:#16a34a}
#__bar .chip.ai{background:#7c3aed}
#__bar .chip.approval{background:#d97706}
#__bar .chip.info{background:#64748b}
#__bar .what{margin-top:7px;font-size:21px;line-height:1.35;color:#e5ecf8}
`;

const OVERLAY_JS = `(() => {
  const css = ${JSON.stringify(OVERLAY_CSS)};
  function ensure() {
    if (!document.documentElement) return;
    if (!document.getElementById('__ovstyle')) {
      const s = document.createElement('style'); s.id = '__ovstyle'; s.textContent = css; document.documentElement.appendChild(s);
    }
    if (!document.getElementById('__cur')) { const c = document.createElement('div'); c.id = '__cur'; document.documentElement.appendChild(c); }
    if (!document.getElementById('__bar')) { const c = document.createElement('div'); c.id = '__bar'; document.documentElement.appendChild(c); }
  }
  window.__ensureOverlay = ensure;
  ensure();
  document.addEventListener('DOMContentLoaded', ensure);
  setInterval(ensure, 500);
  window.addEventListener('mousemove', e => { ensure(); const c = document.getElementById('__cur'); if (c) { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; } }, true);
  window.addEventListener('mousedown', () => { const c = document.getElementById('__cur'); if (c) c.classList.add('down'); }, true);
  window.addEventListener('mouseup', () => { const c = document.getElementById('__cur'); if (c) c.classList.remove('down'); }, true);
})();`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pacing/overlay helpers bound to a page.
function makeHelpers(page) {
  let mx = 800, my = 450;
  let current = null;
  const h = {
    page,
    sleep,
    // Shows the info bar: part title, "Step n of N", who does it (kinds), and a plain explanation.
    // kinds: 'manual' (you), 'automated' (software, no AI), 'ai' (the language model), 'approval' (waits for a person), 'info'.
    async setStep(info) {
      current = info || null;
      // the very first page (about:blank, or a setContent title card) never ran the init script
      if (!(await page.evaluate(() => typeof window.__ensureOverlay === 'function'))) await page.evaluate(OVERLAY_JS);
      await page.evaluate((i) => {
        if (window.__ensureOverlay) window.__ensureOverlay();
        const bar = document.getElementById('__bar');
        if (!bar) return;
        if (!i) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
        const labels = { manual: 'YOU DO THIS', automated: 'AUTOMATIC', ai: 'AI STEP', approval: 'HUMAN APPROVAL', info: 'LOOK HERE' };
        const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
        const chips = (i.kinds || []).map((k) => '<span class="chip ' + k + '">' + labels[k] + '</span>').join('');
        bar.innerHTML = '<div class="row1"><span class="part">' + esc(i.part || '') + '</span>'
          + '<span class="num">Step ' + i.n + ' of ' + i.total + '</span>'
          + '<span class="title">' + esc(i.title || '') + '</span>' + chips + '</div>'
          + '<div class="what">' + esc(i.what || '') + '</div>';
        bar.style.display = 'block';
      }, info || null);
    },
    async highlight(locator) {
      await h.unhighlight();
      await locator.first().evaluate((el) => el.classList.add('__hl'));
    },
    async unhighlight() {
      await page.evaluate(() => document.querySelectorAll('.__hl').forEach((e) => e.classList.remove('__hl')));
    },
    async moveTo(x, y, steps = 28) {
      await page.mouse.move(x, y, { steps });
      mx = x; my = y;
    },
    async pointAt(locator, dx = 0, dy = 0) {
      const el = locator.first();
      // scrolling a node into view would pan the canvas, so only scroll elements outside the flow canvas
      const inCanvas = await el.evaluate((e) => !!e.closest('.react-flow')).catch(() => false);
      if (!inCanvas) await el.scrollIntoViewIfNeeded().catch(() => {});
      const box = await el.boundingBox();
      if (!box) throw new Error('element not visible for pointing');
      await h.moveTo(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
      return box;
    },
    // Moves the cursor to the element, pauses briefly, then clicks it.
    async click(locator, { pause = 350, ring = true } = {}) {
      if (ring) await h.highlight(locator);
      await h.pointAt(locator);
      await sleep(pause);
      await page.mouse.down(); await sleep(70); await page.mouse.up();
      await sleep(250);
      if (ring) await h.unhighlight();
    },
    // Types visibly (a few characters per second) into the focused/located field.
    async type(locator, text, delay = 35) {
      await h.highlight(locator);
      await h.pointAt(locator);
      await locator.first().click();
      await locator.first().pressSequentially(text, { delay });
      await h.unhighlight();
    },
    // Fills quickly but shows where it happened.
    async fill(locator, text) {
      await h.highlight(locator);
      await h.pointAt(locator);
      await locator.first().fill(text);
      await sleep(400);
      await h.unhighlight();
    },
    async scroll(locator, dy, steps = 12) {
      await h.pointAt(locator);
      for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await sleep(60); }
    },
  };
  // the info bar lives in the page, so put it back after every navigation
  page.on('domcontentloaded', () => { if (current) h.setStep(current).catch(() => {}); });
  return h;
}

async function installOverlay(ctx) {
  await ctx.addInitScript(OVERLAY_JS);
}

// ---- app helpers (plain, unpaced) ----

async function importDsl(page, file) {
  await page.goto(`${BASE}/apps`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const direct = page.getByText('Import DSL file', { exact: true });
  if (await direct.count()) await direct.first().click();
  else {
    await page.getByRole('button', { name: /Create/ }).first().click();
    await page.getByText(/Import DSL file/).first().click();
  }
  await page.waitForTimeout(800);
  await page.locator('input[type=file]').first().setInputFiles(path.resolve(file));
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /^Create/ }).last().click();
  await page.waitForURL(/\/app\/[0-9a-f-]+\/(workflow|configuration)/, { timeout: 30000 });
  await page.waitForTimeout(2500);
  return page.url().match(/\/app\/([0-9a-f-]+)/)[1];
}

async function appIdsByName(page) {
  await page.goto(`${BASE}/apps`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  return page.$$eval('a[href^="/app/"]', (as) =>
    as.map((a) => ({ id: a.getAttribute('href').split('/')[2], text: a.innerText.split('\n').map((s) => s.trim()).filter(Boolean) })));
}

// DESTRUCTIVE: permanently deletes the app with this id.
async function deleteApp(page, appId) {
  await page.goto(`${BASE}/app/${appId}/workflow`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  if (!page.url().includes(appId)) throw new Error('not on the expected app page: ' + page.url());
  // the "..." menu button sits next to the app name in the left sidebar
  const box = await page.evaluate(() => {
    const cands = [...document.querySelectorAll('button')].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.left < 330 && r.top > 60 && r.top < 140 && r.width < 50;
    });
    const b = cands[cands.length - 1];
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!box) throw new Error('could not find the app menu button');
  await page.mouse.click(box.x, box.y);
  await page.getByText('Delete', { exact: true }).first().click();
  await page.waitForTimeout(800);
  await page.getByText('Autofill', { exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.waitForTimeout(3000);
}

module.exports = { makeHelpers, installOverlay, importDsl, appIdsByName, deleteApp, sleep, BASE };
