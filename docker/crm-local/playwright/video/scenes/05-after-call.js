const fs = require('fs');
const path = require('path');
const { openApp, tour, tourWhile, openTestRun, selectCallType, waitFinished, waitPaused, sleep } = require('./_common');

const EMAIL = 'aisha.tester5@example.com';
const TRANSCRIPT = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'sample_transcripts', 'aisha_tester5_negotiation.txt'), 'utf8');
const APPROVE = 'Approve and log to CRM';

async function startRun(h, page, { visible }) {
  await openTestRun(h, page);
  if (visible) await h.type(page.getByPlaceholder('Contact email'), EMAIL, 30);
  else await h.fill(page.getByPlaceholder('Contact email'), EMAIL);
  await selectCallType(h, page, 'Negotiation');
  await h.fill(page.getByPlaceholder('Transcript'), TRANSCRIPT);
  await h.click(page.getByRole('button', { name: 'Start Run' }));
  await tourWhile(h, page, ['crm_history', 'summary', 'bant', 'followup'], waitPaused(page, 180000));
  await page.getByRole('button', { name: APPROVE, exact: true }).waitFor({ timeout: 30000 });
  await sleep(800);
}

module.exports = {
  id: '05-after-call',
  part: 'Part 4 · After the call',
  async setup({ page, apps }) {
    await openApp(page, apps.postcall);
  },
  steps: [
    {
      title: 'The post-call workflow',
      kinds: ['info'],
      what: 'The call transcript goes in. The software fetches the CRM record, three AI steps write a summary, the field updates and a follow-up email, then the workflow stops for a person to review.',
      say: 'After the call, the transcript goes into this workflow. It fetches the customer record, then three AI steps write a summary, the updates to the record, and a follow up email. Then it stops, and waits for a person to review.',
      async run({ h, page }) {
        await tour(h, page, ['start', 'crm_history', 'summary', 'bant', 'followup', 'review'], 900);
      },
    },
    {
      title: 'Paste the transcript',
      kinds: ['manual'],
      what: 'You provide the transcript of the call, with who the customer is and the type of call. This sample is a negotiation call with Aisha Tester5.',
      say: 'We start a run, enter the customer, choose the type of call, and paste in the transcript of the call.',
      async run({ h, page }) {
        await openTestRun(h, page);
        await h.type(page.getByPlaceholder('Contact email'), EMAIL, 30);
        await selectCallType(h, page, 'Negotiation');
        await h.fill(page.getByPlaceholder('Transcript'), TRANSCRIPT);
      },
    },
    {
      title: 'The AI drafts, then the run pauses',
      kinds: ['manual', 'automated', 'ai', 'approval'],
      what: 'Start Run is your click. The CRM record is fetched automatically, then three AI steps draft the summary, the record updates and the email. The run then pauses on its own at the review step.',
      say: 'We click start run. The first step fetches the customer record from the CRM, automatically. Then three AI steps run one after another. The first writes a summary of the call. The second works out what should change in the customer record, and what the next steps are. The third drafts the follow up email. When they are done, the workflow pauses by itself at the review step. Nothing has been written to the CRM yet.',
      async run({ h, page }) {
        await h.click(page.getByRole('button', { name: 'Start Run' }));
        await tourWhile(h, page, ['crm_history', 'summary', 'bant', 'followup'], waitPaused(page, 180000));
        await page.getByRole('button', { name: APPROVE, exact: true }).waitFor({ timeout: 30000 });
        await sleep(1000);
      },
    },
    {
      title: 'Review what the AI wrote',
      kinds: ['approval', 'info'],
      what: 'The review form shows three drafts: the call summary, the BANT changes and next steps, and the follow-up email. Read them against the call. The AI can be wrong; this form is the safety net.',
      say: 'This is the review form. The call summary, the changes to the record and next steps, and the follow up email. This is where a person checks the AI against what really happened on the call. The model can make mistakes, which is exactly why this step exists.',
      async run({ h, page }) {
        const boxes = page.locator('textarea:visible');
        const n = await boxes.count();
        for (let i = 0; i < Math.min(n, 3); i++) {
          await h.highlight(boxes.nth(i));
          await h.pointAt(boxes.nth(i));
          await sleep(1800);
        }
        await h.unhighlight();
      },
    },
    {
      title: 'Edit, then approve',
      kinds: ['manual', 'approval'],
      what: 'You can change anything before it is saved. Here we add a sentence to the email. Then you click Approve. Approving is a human decision; the workflow cannot do it for you.',
      say: 'Anything can be edited. Here we add a short sentence to the follow up email. Then we approve. Only a person can do this, the workflow cannot approve itself.',
      async run({ h, page }) {
        const boxes = page.locator('textarea:visible');
        const last = boxes.nth((await boxes.count()) - 1);
        await h.pointAt(last);
        await last.click();
        await page.keyboard.press('Control+End');
        await last.pressSequentially('\n\nLooking forward to speaking on Friday.', { delay: 40 });
        await sleep(600);
        await h.click(page.getByRole('button', { name: APPROVE, exact: true }));
        await waitFinished(page, 120000);
        await sleep(800);
      },
    },
    {
      title: 'The CRM is updated',
      kinds: ['automated'],
      what: 'After approval, the software builds the record update and writes it to the CRM automatically. The green row is the new activity; the box under it is the approved follow-up email, with the sentence we added. This is a practice CRM.',
      say: 'After approval the software builds the update and writes it to the CRM automatically. The green row is the new activity. The box under it is the approved follow up email, with the sentence we added. This is a practice CRM with made up data.',
      async run({ h, page }) {
        await page.goto(`http://localhost:8090/crm/view?email=${EMAIL}`);
        await sleep(800);
        await h.highlight(page.locator('tr.logged'));
        await h.pointAt(page.locator('tr.logged'));
        await sleep(2200);
        const email = page.locator('.email');
        await email.scrollIntoViewIfNeeded();
        await h.highlight(email);
        await h.pointAt(email);
        await sleep(3200);
      },
    },
    {
      title: 'Run it again',
      kinds: ['manual', 'automated', 'ai', 'approval'],
      what: 'To see the other outcome we run the same call again. The record is fetched, the AI drafts everything again, and the run pauses at review. This time the answer will be no.',
      say: 'To see the other outcome, we run the same call again. The record is fetched, the three AI steps draft their sections again, and the workflow pauses at the review step. This time, the answer will be no.',
      async run({ h, page, apps }) {
        await openApp(page, apps.postcall);
        await startRun(h, page, { visible: false });
      },
    },
    {
      title: 'Reject: nothing is written',
      kinds: ['manual', 'approval'],
      what: 'We click Reject. The run ends without writing anything: the CRM still shows only the one green row from the approved run.',
      say: 'If the person clicks reject, the run ends and nothing is written. The CRM still shows only the one row from the approved run.',
      async run({ h, page }) {
        await h.click(page.getByRole('button', { name: 'Reject', exact: true }));
        await waitFinished(page, 60000);
        await sleep(500);
        await page.goto(`http://localhost:8090/crm/view?email=${EMAIL}`);
        await sleep(600);
        await h.highlight(page.locator('tr.logged'));
        await sleep(2200);
      },
    },
    {
      title: 'Timeout: also writes nothing',
      kinds: ['approval', 'automated'],
      what: 'If nobody reviews within the time limit (one day here), the workflow takes the Timeout exit and ends. Nothing is written. We show it on the canvas instead of waiting a day.',
      say: 'And if nobody reviews it in time, the workflow takes the timeout exit and ends, again with nothing written. In this workflow the limit is one day, so we show it on the canvas instead of waiting.',
      async run({ h, page, apps }) {
        await openApp(page, apps.postcall);
        await tour(h, page, ['review', 'end_timeout'], 1800);
      },
    },
  ],
};
