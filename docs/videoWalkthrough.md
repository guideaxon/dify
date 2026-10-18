# Video Walkthrough: Wiring and Running the Agentic CRM Workflows

A shot-by-shot plan for a 10 to 12 minute beginner video: how to check that agentic steps are wired correctly, and what the workflows do **before, during and after** a sales call. Everything runs locally (Dify in Docker Desktop, llama-server for models, the mock CRM). Setup is in `designAgenticCRM.md`, editing in `customizingWorkflows.md`, sales context in `sales101.md`.

Status: this is a plan. The scripts and recording described in section 2 have **not** been built yet, and the workflows have not been run end to end in the UI.

## 1. Cast and data

| Asset | File (in `docker/crm-local/`) | Used in scene |
|---|---|---|
| Pre-call brief workflow | `agentic_crm_precall_brief.yml` | 3 |
| Live call helper (simulated, chat app) | `agentic_crm_duringcall.yml` | 4 |
| Post-call update workflow | `agentic_crm_postcall.yml` | 5, 6 |
| Inbound reply workflow (Phase 1) | `agentic_crm_phase1.yml` | 2 (wiring demo) |
| Mock CRM with 6 seeded contacts | `mock_crm.py`, `seed_data.json` | all |
| Sample call transcript | `sample_transcripts/aisha_tester5_negotiation.txt` | 5 |
| Reset between takes | `reset_mock_crm.ps1` | before every take |

Main demo contact: **Aisha Tester5** (`aisha.tester5@example.com`), stage Negotiation, a 310k deal with open redlines and a discount request. She makes the pre-call brief, the live helper and the post-call update all interesting, and the discount request shows why approvals matter. Secondary contact for the cold start: **Priya Tester1** (Lead, thin history), to show how the brief handles missing information.

## 2. How the video gets made

**Recommended approach: scripted Playwright for the UI, with a human or TTS voice-over added afterwards. A browser-control MCP server is optional and not needed.**

| Option | Verdict |
|---|---|
| **Playwright script** (Node or Python) | Best for repeatable takes. Every run clicks the same things in the same order, so you re-record after a UI change or a bad take by re-running. Playwright can record the browser tab to video, take screenshots at key moments, and keep a trace for debugging. |
| **MCP browser tool** (a Playwright MCP server, driven by Claude) | Useful for **authoring**: exploring the live UI interactively to find reliable selectors. Not ideal for the final recording because each run is a fresh set of model decisions, so timing and clicks vary. I have no browser MCP server configured in this session. |
| **Mix** | Use MCP (if you add one) to discover selectors, then freeze them into the Playwright script. The script is the thing you record with. |

What's already on this machine: Playwright browser downloads (Chromium headless builds), `ffmpeg`, and `espeak-ng`. OBS is not installed. Playwright's built-in recording is fine for a tutorial but lower quality than a real screen recorder. For better quality, run the script in a headed browser at 1920x1080 and capture with OBS or `ffmpeg` screen capture.

**Pipeline:**
1. A Playwright script per scene, each starting from a known state (reset CRM, import fresh workflow copies).
2. Each script pauses on the moments that matter (for example 2 seconds on an error message) and highlights elements with an injected outline or zoom, so viewers can follow.
3. Record per scene, then join scenes and add voice-over and captions with `ffmpeg`.
4. Voice-over: your own voice reading the narration below will sound best. `espeak-ng` works for a draft but sounds robotic.
5. If a model call is slow, record the real run and speed up the waiting part in the edit with a visible "sped up" label, instead of faking output.

## 3. Pre-flight checklist (before every take)

- [ ] Docker Desktop running and all Dify containers healthy (`docker compose ps`).
- [ ] `start-llama.ps1` run: chat on :8080 and embeddings on :8081 answering.
- [ ] `python mock_crm.py` running, then `reset_mock_crm.ps1` run.
- [ ] Admin account created; OpenAI-API-compatible model plugin installed; chat model `qwen3.5-9b` registered.
- [ ] The four workflows imported as fresh apps; model reselected in each LLM node if the import asked.
- [ ] Browser at 1920x1080, notifications off, a clean profile with no unrelated tabs.
- [ ] A second pristine copy of each app ("-backup") to restore after the scene that breaks something.

## 4. Scene by scene

### Scene 1: Setup (about 1 min)

- **Show:** a simple diagram: before the call, the live call, after the call, with the CRM underneath. Then `docker compose ps` and the Dify home page.
- **Say:** "We have three small workflows. One prepares you for the call, one helps you during it, and one updates the CRM afterwards. The CRM is where they share what they know. Everything here runs on this laptop."
- **Checks:** none beyond the pre-flight list.

### Scene 2: Wiring basics (about 3 min)

Use the Phase 1 workflow (it has the most node types).

1. **Open the canvas.** Tour the nodes left to right: Start, LLM, Human Input, Code, HTTP Request, End. *Say:* "Each box is a step. Lines show the order."
2. **Variables.** Click the LLM node, click into the user prompt, type `{` and pick `start / inquiry` from the picker. Point out that the reference appears as `{{#start.inquiry#}}`. *Say:* "A step only knows what you explicitly connect to it."
3. **Test Run.** Click **Test Run**, enter Priya Tester1's details, run. Show the node results appearing and the **variable inspector**. The run will pause at the review form. *Say:* "It stopped on its own at the human step."
4. **Break it on purpose.** Delete the edge from the LLM node to the Human Input node. Show the node showing a warning, and the checklist or publish error. Undo (or reconnect) and show the warning clear. *Say:* "If a step has nothing feeding it, Dify tells you before you publish."
5. **Check every outcome has an exit.** Click the Human Input node and show its three outgoing handles: Approve, Reject and Timeout, each wired to an End. *Say:* "Every way this step can finish needs a line out."
- **Risk:** the exact warning wording and where it appears depend on the Dify version. Capture it once, then use that take.

### Scene 3: Before the call (about 2 min)

Workflow: Pre-call brief. Contact: Aisha Tester5, call type Negotiation.

- **Show:** the three nodes (inputs, CRM history, write brief). Run it from the published app or **Test Run**.
- **Expected result:** a brief with Objective, BANT as known/unknown, a history summary mentioning the open redlines and the 12 percent discount request, three discovery questions and risks.
- **Say:** "It reads the CRM record, then writes a brief. It's only allowed to use what's in the record. Where it doesn't know, it says so."
- **Contrast (30 s):** run it for Priya Tester1. The brief should be thin and say what is unknown.
- **Check:** the brief shouldn't invent facts. If the model adds invented details, tighten the prompt before recording. Nothing is written to the CRM in this scene.

### Scene 4: During the call, simulated (about 1 min)

App: Live call helper (a chat app). Setup fields: Aisha's email, call type Negotiation.

- **Say first:** "Real-time audio is outside what this setup does. So we'll simulate it: paste what the buyer just said, and the helper suggests a response. You are always the one talking."
- **Paste 1:** "Procurement is asking for twelve percent off. Our CFO won't sign otherwise."
- **Expected:** a signal (price objection), a suggested response, a next question, and **"Hold: needs approval"** instead of agreeing to a discount.
- **Paste 2:** "We have a competitor quote about ten percent below you."
- **Expected:** a competitor signal, a LAER-style response, and a question about what the competitor lacks (the transcript later shows they don't consolidate all three tools).
- **Say:** "It never promises a discount. That decision stays with a person."
- **Risk:** replies must stay under about 120 words. If the reasoning model returns a long answer, reduce temperature or shorten the system prompt.

### Scene 5: After the call (about 3 min)

Workflow: Post-call update. Inputs: Aisha's email, call type Negotiation, transcript from `aisha_tester5_negotiation.txt`.

1. **Run.** Paste the transcript and run. Show the chain: CRM history, summary, BANT and next steps, follow-up email. *Say:* "Three drafts are being prepared from the transcript." (Speed up the wait in the edit.)
2. **Review form.** The workflow pauses at **Review before CRM update**, with three editable boxes: call summary, BANT changes and next steps, and the follow-up email.
3. **Edit visibly.** Fix one detail in the follow-up (for example make the Friday commitment explicit). *Say:* "You can change anything before it goes anywhere."
4. **Approve path.** Click **Approve and log to CRM**. Then show the mock CRM: `GET /crm/history?email=aisha.tester5@example.com` (or open `mock_crm_log.jsonl`) and show the new call activity with the edited text.
5. **Reject path.** Reset the CRM, rerun, click **Reject**. Show the run ended at "Rejected (nothing logged)" and that the CRM history is unchanged.
6. **Timeout path.** Show the Timeout edge on the canvas leading to "Timed out (nothing logged)". The timeout is at least one hour, so **don't wait for it on camera**: explain it with the canvas. *Say:* "If nobody reviews it, nothing is written."
- **Expected in the drafts (from the transcript):** residency in her region written into the contract; liability cap at 12 months of fees; discount request needs approval, nothing agreed; Dana (procurement lead) to be introduced; written answer by Friday; target signature before November 15; competitor quote about 10 percent lower. A follow-up that agrees to the discount or invents terms is a failed take, so fix the prompt and retake.

### Scene 6: Adding or removing a gate (about 1 min)

Use `customizingWorkflows.md`. Duplicate the Pre-call brief app (read-only, so it has no gate), then add approval before its output as an exercise, or remove the gate from a copy of the post-call workflow.

- **Remove:** delete the Human Input node and connect the follow-up node to the code node. Show the Reject and Timeout branches becoming orphaned and removing them.
- **Add back:** click **+** on the edge, add **Human Input**, set the form, add Approve and Reject, enable web app delivery, wire all three exits.
- **Say:** "A gate is just a step you put in front of the thing you want to control. Anything that changes the CRM or reaches a customer should have one."
- **Do not run** the gate-less copy against the CRM on camera. Delete it afterwards.

### Scene 7: Swapping in a real CRM (about 1 min)

- **Show:** the `CRM_BASE_URL` environment variable and the HTTP Request node's URL, headers and body.
- **Say:** "The workflow only knows an address and a payload shape. To use a real CRM you change those, add that CRM's authentication, and map the fields."
- **Be honest on screen:** a real CRM such as HubSpot needs its own API token, field mapping and (for some CRMs) a token refresh step. This video does not set one up. Use a separate test account, never real customer data.

## 5. What could go wrong on camera

| Risk | Mitigation |
|---|---|
| Model speed | Chat server runs with `--reasoning off` (about 2 to 5 seconds per step in a test of the prompts outside Dify), so real runs should need little or no speed-up. With thinking on, steps took 100+ seconds, so confirm the flag is active before recording. |
| Model output varies between takes, so a draft may be wrong or off-brand | Use low temperature, run a rehearsal, and keep the transcript fixed. Retake until the draft is acceptable, never edit model output in post. |
| The Human Input form placement and wording differ between app modes | Rehearse once in the published web app and capture exact steps before scripting. |
| Timeout path can't be shown live | Explain on the canvas, as planned. |
| Stale CRM state changes results | Run `reset_mock_crm.ps1` before every take. |
| UI changes after a Dify upgrade break selectors | Pin image versions (already done) and re-record from scripts if you upgrade. |

## 6. Status

- The four workflows are imported in Dify and have been run through the UI: pre-call brief, post-call (Approve and Reject), live helper, Phase 1, and the timeout path (on a scratch copy with timeout 0). Details are in `setupRunbook.md` section 11.
- Playwright helpers exist for launching a browser, importing, reading the checklist, running each app and clicking Approve or Reject (`docker/crm-local/playwright/`).
- **No video has been recorded and there are no per-scene recording scripts or voice-over yet.**
- Not yet handled: pacing and highlighting for the camera, and a decision on live narration versus text-to-speech.
- Caveats found while testing: the canvas can show stale green ticks from an earlier run (use the Tracing tab), and the timeout path is shown on a scratch copy, not waited out.
