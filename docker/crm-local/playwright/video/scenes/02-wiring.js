const { openApp, tour, sleep } = require('./_common');

module.exports = {
  id: '02-wiring',
  part: 'Part 1 · Checking the wiring',
  async setup({ page, apps }) {
    await openApp(page, apps.phase1);
  },
  steps: [
    {
      title: 'The workflow canvas',
      kinds: ['info'],
      what: 'Each box is a step. The lines show the order the steps run in: collect the inquiry, draft a reply, wait for review, then write to the CRM.',
      say: 'This is the workflow canvas. Each box is a step, and the lines show the order the steps run in.',
      async run({ h, page }) { await tour(h, page, ['start', 'draft', 'review', 'build_payload', 'crm_write'], 1000); },
    },
    {
      title: 'Steps share values by name',
      kinds: ['info', 'ai'],
      what: 'The Draft reply step is an AI step. Its instructions pull in values from earlier steps, written in double curly brackets, like the lead name and the inquiry.',
      say: 'A step only knows what you explicitly connect to it. Open the draft step, and you can see that its instructions use values from earlier steps, written with double curly brackets, like the lead name and the inquiry.',
      async run({ h, page, apps }) {
        await openApp(page, apps.phase1); // reset the canvas view
        await h.click(page.locator('.react-flow__node[data-id="draft"]'));
        await sleep(1500);
        await h.moveTo(1340, 560);
        await sleep(2500);
      },
    },
    {
      title: 'Every exit needs a line',
      kinds: ['approval', 'automated'],
      what: 'The review step is a human approval. It has three exits: approve (goes on to write to the CRM), reject, and timeout. The last two end the run without writing anything.',
      say: 'The human review step has three exits: approve, reject, and timeout. Every way a step can finish needs a line leading out of it.',
      async run({ h, page }) {
        await page.mouse.click(700, 150); // click empty canvas to close the panel
        await sleep(700);
        await tour(h, page, ['review', 'build_payload', 'end_rejected', 'end_timeout'], 1300);
      },
    },
    {
      title: 'A deliberately broken copy',
      kinds: ['manual'],
      what: 'This copy has one connection removed. Click the Checklist button at the top to see what Dify reports.',
      say: 'Now let us see what happens when a line is missing. This is a copy of the workflow where one connection was removed. Open the checklist at the top.',
      async run({ h, page, apps }) {
        await h.unhighlight();
        await openApp(page, apps.broken);
        await h.click(page.getByRole('button', { name: 'Checklist' }));
        await sleep(1200);
      },
    },
    {
      title: 'Read the checklist',
      kinds: ['automated', 'info'],
      what: 'Dify checks the wiring by itself. It lists every step that is not connected and every value that can no longer be found. Fix these before you publish; the list should be empty.',
      say: 'Dify lists every step that is not connected to anything, and every value that can no longer be found. You fix these before publishing, and the list should be empty.',
      async run({ h, page }) {
        const panel = page.getByText('Resolve the following issues before publishing');
        await h.pointAt(panel);
        await sleep(1500);
        await h.scroll(panel, 220, 8);
        await sleep(1500);
      },
    },
  ],
};
