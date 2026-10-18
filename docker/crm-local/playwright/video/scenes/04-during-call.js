const { openApp, selectCallType, sleep } = require('./_common');

// Counts how many suggestions the helper has produced so far.
async function suggestions(page) {
  const t = await page.locator('body').innerText();
  return (t.match(/Next question:/g) || []).length;
}
async function waitForSuggestion(page, n, timeout = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const busy = await page.getByText(/Stop responding/i).count();
    if (!busy && (await suggestions(page)) >= n) return;
    await sleep(1000);
  }
  throw new Error('no suggestion #' + n);
}

module.exports = {
  id: '04-during-call',
  part: 'Part 3 · During the call',
  async setup({ page, apps }) {
    await openApp(page, apps.duringcall);
  },
  steps: [
    {
      title: 'A helper you chat with',
      kinds: ['info'],
      what: 'Real-time audio is outside this setup, so the call is simulated: you paste what the buyer just said and the helper replies. The rep stays in control of the call.',
      say: 'Live audio is outside what this setup does, so we simulate the call. You paste what the buyer just said, and the helper suggests a reply. The rep stays in control of the call.',
      async run({ h, page }) {
        await h.click(page.getByRole('button', { name: /Preview/ }).first());
        await sleep(600);
      },
    },
    {
      title: 'Set up the call',
      kinds: ['manual'],
      what: 'You tell the helper who is on the call and what kind of call it is, so it can read that customer\'s record from the CRM.',
      say: 'First we tell it who is on the call and what kind of call it is. That lets it read the customer record.',
      async run({ h, page }) {
        await h.type(page.getByPlaceholder('Contact email'), 'aisha.tester5@example.com', 30);
        await selectCallType(h, page, 'Negotiation');
      },
    },
    {
      title: 'The buyer asks for a discount',
      kinds: ['manual', 'ai'],
      what: 'You paste what the buyer said. The AI step names the signal and suggests a reply. Notice the rule it follows: it never agrees to a discount, it starts with "Hold: needs approval".',
      say: 'The buyer says procurement wants twelve percent off. The helper names the signal, a price objection, and suggests a reply. Notice it starts with hold, needs approval. It is built never to agree to a discount on the call.',
      async run({ h, page }) {
        const box = page.getByPlaceholder('Talk to Bot');
        await h.type(box, "Procurement is asking for twelve percent off. Our CFO won't sign otherwise.", 28);
        await box.press('Enter');
        await sleep(2500);
        await waitForSuggestion(page, 1);
        await sleep(1500);
      },
    },
    {
      title: 'The buyer mentions a competitor',
      kinds: ['manual', 'ai'],
      what: 'A second line from the buyer. The helper asks what is in the competitor\'s quote and gives a next question. It does not run the competitor down.',
      say: 'Next the buyer mentions a competitor quote. The helper suggests asking what is included in that quote, and gives a good next question. Again, you choose what to say.',
      async run({ h, page }) {
        const box = page.getByPlaceholder('Talk to Bot');
        await h.type(box, 'We have a competitor quote about ten percent below you.', 28);
        await box.press('Enter');
        await sleep(2500);
        await waitForSuggestion(page, 2);
        await sleep(2500);
      },
    },
  ],
};
