// Shared helpers for the scene files.
const { BASE, sleep } = require('../lib');

async function openApp(page, appId) {
  await page.goto(`${BASE}/app/${appId}/workflow`, { waitUntil: 'domcontentloaded' });
  await page.locator('.react-flow__node').first().waitFor({ timeout: 30000 });
  await sleep(1500);
  // always start from the whole canvas (Dify's "fit view" shortcut), whatever view was saved last
  await page.mouse.click(800, 140);
  await page.keyboard.press('Control+1');
  await sleep(1200);
}

// Highlights each node in turn (nodes carry the ids from the generators, e.g. data-id="review").
async function tour(h, page, ids, hold = 900) {
  for (const id of ids) {
    const node = page.locator(`.react-flow__node[data-id="${id}"]`);
    await h.highlight(node);
    await h.pointAt(node);
    await sleep(hold);
  }
  await h.unhighlight();
}

async function openTestRun(h, page) {
  await h.click(page.getByRole('button', { name: /Test Run/ }).first());
  await sleep(700);
}

async function selectCallType(h, page, option) {
  await h.click(page.getByText('Please select'));
  await h.click(page.getByText(option, { exact: true }), { pause: 250 });
}


// While `until` (a promise) is pending, keeps highlighting the given nodes one after another, so the screen
// is never static during a slow model call. Nodes that are hidden behind a panel are skipped.
async function tourWhile(h, page, ids, until, hold = 2600) {
  let done = false;
  const wrapped = until.finally(() => { done = true; });
  let i = 0;
  while (!done) {
    const node = page.locator(`.react-flow__node[data-id="${ids[i % ids.length]}"]`);
    try {
      const box = await node.first().boundingBox({ timeout: 1000 });
      if (box && box.x > 0 && box.x + box.width < 1180) { await h.highlight(node); await h.pointAt(node); }
    } catch { /* node not visible; try the next one */ }
    i++;
    await Promise.race([wrapped.catch(() => {}), h.sleep(hold)]);
  }
  await h.unhighlight();
  await wrapped;
}

// "Test Run (Running)" -> "Test Run (Paused)" -> "Test Run (07:01:41 PM)"
async function runTitle(page) {
  return page.getByText(/^Test Run \(/).first().innerText().catch(() => '');
}
async function waitRunState(page, predicate, timeout = 240000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const t = await runTitle(page);
    if (t && predicate(t)) return t;
    await sleep(1000);
  }
  throw new Error('timed out waiting for the run state; last title: ' + (await runTitle(page)));
}
const waitFinished = (page, timeout) => waitRunState(page, (t) => !/Running|Paused/.test(t), timeout);
const waitPaused = (page, timeout) => waitRunState(page, (t) => /Paused/.test(t), timeout);

// A simple full-screen title card (no Dify needed).
async function titleCard(page, { title, subtitle, chips = [], active = -1, legend = false }) {
  const chipHtml = chips
    .map((c, i) => `<div class="chip ${i === active ? 'on' : ''}" id="chip${i}">${c}</div>`)
    .join('');
  const legendHtml = legend
    ? `<div class="legend">
         <div><span class="k manual">YOU DO THIS</span> a person clicks, types or decides</div>
         <div><span class="k automated">AUTOMATIC</span> software does it, no AI involved</div>
         <div><span class="k ai">AI STEP</span> the language model writes or analyses</div>
         <div><span class="k approval">HUMAN APPROVAL</span> the workflow stops and waits for a person</div>
       </div>`
    : '';
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;background:linear-gradient(135deg,#0b1b3a,#16345f);color:#fff;font-family:system-ui,Segoe UI,Arial}
    .wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 80px}
    h1{font-size:60px;margin:0 0 18px;font-weight:700}
    p{font-size:28px;margin:0 0 44px;color:#c7d6ee}
    .chips{display:flex;gap:28px}
    .chip{padding:18px 34px;border-radius:14px;background:rgba(255,255,255,.1);font-size:30px;border:3px solid transparent;transition:all .4s}
    .chip.on{background:rgba(255,255,255,.28);border-color:#ffb020}
    .legend{margin-top:46px;display:grid;grid-template-columns:auto auto;gap:14px 40px;text-align:left;font-size:23px;color:#dbe6f7}
    .k{display:inline-block;min-width:190px;text-align:center;font-weight:800;font-size:18px;letter-spacing:.05em;padding:5px 12px;border-radius:8px;margin-right:12px;color:#fff}
    .k.manual{background:#2563eb}.k.automated{background:#16a34a}.k.ai{background:#7c3aed}.k.approval{background:#d97706}
  </style><div class="wrap"><h1>${title}</h1><p>${subtitle}</p><div class="chips">${chipHtml}</div>${legendHtml}</div>`);
}
async function setActiveChip(page, index) {
  await page.evaluate((i) => document.querySelectorAll('.chip').forEach((c, k) => c.classList.toggle('on', k === i)), index);
}

module.exports = { openApp, tour, tourWhile, openTestRun, selectCallType, waitFinished, waitPaused, runTitle, titleCard, setActiveChip, sleep };
