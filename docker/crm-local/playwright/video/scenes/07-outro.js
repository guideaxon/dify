const { titleCard, setActiveChip, sleep } = require('./_common');

module.exports = {
  id: '07-outro',
  part: 'Wrap-up',
  resetCrm: false,
  async setup({ page }) {
    await titleCard(page, {
      title: 'A person stays in control',
      subtitle: 'The AI drafts and the software moves data; people approve what leaves the building',
      chips: ['Before: brief', 'During: suggestions', 'After: reviewed update'],
    });
  },
  steps: [
    {
      title: 'Recap',
      kinds: ['info'],
      what: 'Before: an AI brief from the CRM record. During: suggestions the rep may use. After: drafts that a person reviews before anything is written.',
      say: 'To recap. Before the call, an AI brief built from the CRM record. During the call, suggestions the rep can use or ignore. After the call, drafts that a person reviews before anything is written. Check the wiring with the checklist, keep an approval in front of every write, and read what the AI wrote.',
      async run({ page }) {
        for (let i = 0; i < 3; i++) { await setActiveChip(page, i); await sleep(1700); }
      },
    },
  ],
};
