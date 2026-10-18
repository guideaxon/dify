const { openApp, sleep } = require('./_common');

module.exports = {
  id: '06-real-crm',
  part: 'Part 5 · Using a real CRM',
  async setup({ page, apps }) {
    await openApp(page, apps.precall);
  },
  steps: [
    {
      title: 'One address to change',
      kinds: ['info', 'manual'],
      what: 'The workflows only know an address, held in one setting called CRM_BASE_URL. Open Environment Variables at the top to see it. Pointing at a real CRM starts here.',
      say: 'The workflows only know one address for the CRM, kept in a single setting. Open the environment variables at the top to see it. Pointing the workflows at a real CRM starts with changing this address.',
      async run({ h, page }) {
        await h.click(page.getByRole('button', { name: 'Environment Variables' }));
        await sleep(1500);
        await h.pointAt(page.getByText('CRM_BASE_URL').first());
        await sleep(2000);
      },
    },
    {
      title: 'What else a real CRM needs',
      kinds: ['info'],
      what: 'A real CRM also needs its own login token, its own field names, and often a refresh step because tokens expire. This video does not set one up. Use a test account, never real customer data.',
      say: 'A real CRM also needs its own login token, its own field names, and often a step to refresh the token, because tokens expire. We have not set one up here. When you do, use a test account first, and never real customer data.',
      async run({ h, page }) {
        await page.keyboard.press('Escape');
        await sleep(500);
        await h.click(page.locator('.react-flow__node[data-id="crm_history"]'));
        await sleep(3500);
      },
    },
  ],
};
