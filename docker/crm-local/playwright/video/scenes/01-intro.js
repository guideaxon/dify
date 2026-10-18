const { titleCard, setActiveChip, sleep } = require('./_common');

module.exports = {
  id: '01-intro',
  part: 'Introduction',
  resetCrm: false,
  async setup({ page }) {
    await titleCard(page, {
      title: 'AI help around a sales call',
      subtitle: 'Before, during and after, with a person approving every change',
      chips: ['Before the call', 'During the call', 'After the call'],
    });
  },
  steps: [
    {
      title: 'What you will see',
      kinds: ['info'],
      what: 'Three small workflows, one for each stage of a call. Everything runs on this laptop: local AI models, local Dify, and a practice CRM with made-up contacts.',
      say: 'In this video we will look at a sales workflow that helps before, during and after a call, and how to check that every step is wired up correctly. Everything you see runs on this laptop: local language models, a local copy of Dify, and a practice CRM with made up contacts.',
      async run({ page }) {
        for (let i = 0; i < 3; i++) { await setActiveChip(page, i); await sleep(1400); }
      },
    },
    {
      title: 'How to read the tags',
      kinds: ['info'],
      what: 'Every step has a numbered header and a coloured tag that shows who does the work: you, the software, the AI model, or a person approving.',
      say: 'On every step you will see a numbered header and a coloured tag. Blue means you do it. Green means the software does it automatically, with no AI. Purple means the AI model is writing or analysing. Amber means the workflow stops and waits for a person to approve. These workflows are not an autonomous agent: the steps are fixed, the AI writes inside them, and a person signs off.',
      async run({ page }) {
        await titleCard(page, {
          title: 'Who does the work?',
          subtitle: 'Look for the coloured tag at the bottom of the screen',
          chips: [],
          legend: true,
        });
        await sleep(500);
      },
    },
  ],
};
