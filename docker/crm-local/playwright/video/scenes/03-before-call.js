const { openApp, tour, tourWhile, openTestRun, selectCallType, waitFinished, sleep } = require('./_common');

module.exports = {
  id: '03-before-call',
  part: 'Part 2 · Before the call',
  async setup({ page, apps }) {
    await openApp(page, apps.precall);
  },
  steps: [
    {
      title: 'The pre-call brief workflow',
      kinds: ['info'],
      what: 'Four steps: take the call details, fetch the customer record from the CRM, have the AI write a brief, show the result. It only reads the CRM; it never changes it, so it needs no approval.',
      say: 'Before a call, the rep wants a quick brief. This workflow takes the call details, fetches the customer record from the CRM, has the AI write a brief, and shows it. It only reads the CRM, so it needs no approval step.',
      async run({ h, page }) { await tour(h, page, ['start', 'crm_history', 'brief', 'end'], 1100); },
    },
    {
      title: 'Enter the call details',
      kinds: ['manual'],
      what: 'You choose who you are about to call: name, email, company, and the type of call. Here: Aisha Tester5, a negotiation call.',
      say: 'We start a test run and enter who we are about to call: Aisha Tester5, from Harborview, and this is a negotiation call.',
      async run({ h, page }) {
        await openTestRun(h, page);
        await h.type(page.getByPlaceholder('Contact name'), 'Aisha Tester5', 45);
        await h.type(page.getByPlaceholder('Contact email'), 'aisha.tester5@example.com', 30);
        await h.type(page.getByPlaceholder('Company', { exact: true }), 'Harborview Test Financial', 35);
        await selectCallType(h, page, 'Negotiation');
      },
    },
    {
      title: 'Start the run',
      kinds: ['manual', 'automated', 'ai'],
      what: 'You click Start Run. Then it runs by itself: the CRM record is fetched automatically (green), and the AI step writes the brief from that record (purple).',
      say: 'We click start run. From here it runs by itself. First, the software fetches the customer record from the CRM. That is an automatic step, with no AI involved. Then the AI step reads that record, together with our call details, and writes the brief. Watch the boxes on the canvas as each step finishes.',
      async run({ h, page }) {
        await h.click(page.getByRole('button', { name: 'Start Run' }));
        await tourWhile(h, page, ['start', 'crm_history', 'brief'], waitFinished(page, 120000));
        await sleep(800);
      },
    },
    {
      title: 'Read the brief',
      kinds: ['ai', 'info'],
      what: 'The brief matches what the CRM holds: the approved budget, who signs, the open contract points, and the unanswered 12% discount request. Always read AI output before you rely on it.',
      say: 'The brief matches what the CRM holds: the budget, who has to sign, the open contract points, and the discount request that has not been answered yet. As always with AI output, read it before you rely on it.',
      async run({ h, page }) {
        const panel = page.getByText('Objective').first();
        await h.pointAt(panel);
        await sleep(2500);
        await h.scroll(panel, 520, 14);
        await sleep(2500);
        await h.scroll(panel, 520, 14);
        await sleep(2000);
      },
    },
  ],
};
