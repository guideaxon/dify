# How the walkthrough video was made, and how to make it again

This document records exactly how the narrated walkthrough video of the CRM workflows was produced, so it can be reproduced on a different machine. It is a runbook for the *video*; the stack it films is set up in `setupRunbook.md`, and the scene design is explained in `videoWalkthrough.md` and `docker/crm-local/playwright/video/README.md`.

## 1. What the video is

- A screen recording of the real Dify UI, driven by scripts, with a text-to-speech voice-over, joined into one MP4.
- **Format:** 1600x900, 30 fps, H.264 video, AAC audio, one file (`walkthrough.mp4`).
- **Length:** 9 minutes 13 seconds (553 s, about 33 MB). The narration alone is about 7 minutes (27 clips, 428 s); the rest is time the screen waits for the AI models.
- **Scene lengths:** introduction 51 s, wiring 59 s, before the call 93 s, during the call 55 s, after the call 235 s, real CRM 35 s, recap 25 s. They add up to the 553 s total.
- **Content:** an introduction and legend, then five numbered parts: (1) checking the wiring, (2) before the call, (3) during the call (simulated), (4) after the call with review, approve, reject and timeout, (5) what changes with a real CRM, then a recap.
- **On every step:** a numbered header ("Step 3 of 5"), a coloured tag saying who does the work (**YOU DO THIS**, **AUTOMATIC**, **AI STEP**, **HUMAN APPROVAL**, **LOOK HERE**), and a one or two sentence on-screen explanation. The same text is spoken.
- **Not a live recording:** nobody operates the mouse. A script does, so the result is repeatable.

## 2. How it works, in one page

```
scene scripts (steps: title, tags, on-screen text, narration, browser actions)
        |
        v
tts.ps1      Windows voice (offline)  -> one WAV per step      [cached by text+voice+rate]
        |
        v
build.js     headless Chromium, video recording on, one scene at a time:
             for each step: show the info bar, run the actions, then wait until the narration
             for that step is over (so the screen never moves faster than the voice)
        |
        v
ffmpeg       trims the blank lead-in, places each narration clip at the moment its step began,
             encodes one MP4 per scene, then joins the scenes
```

Key design choices (and why):

- **Playwright script, not a screen recorder:** repeatable takes; a bad take or a UI change is fixed by re-running.
- **Playwright's own video recording:** needs no screen-capture tool and works headless. It records a context it creates, so the recorder logs in with a saved browser profile (section 5).
- **Narration paces the screen, not the other way round:** each step lasts at least as long as its narration, so audio and picture cannot drift apart.
- **Selectors are stable:** workflow nodes are found by `data-id` (set by the workflow generators), buttons by accessible names ("Checklist", "Environment Variables"), so scripts do not depend on screen positions.
- **Overlay drawn inside the page:** the red cursor ring, highlight outline and the info bar are injected DOM, so they are captured in the video.

## 3. What you need

**Hardware and OS used for the original run:** Windows 11, an NVIDIA GPU with 12 GB (the two local models used about 6 GB), 64 GB RAM. Any machine that can run the stack in `setupRunbook.md` works.

**Software (versions seen on the original machine; later versions are likely fine but untested):**

| Tool | Used | Notes |
|---|---|---|
| Docker Desktop (WSL2 backend) | Compose v5.3.0 (Docker 29.6.1) | Compose v2.24 or later |
| Node.js | v22.23.2 | with npm |
| Python | 3.x | standard library only, for the mock CRM |
| PowerShell | Windows PowerShell 5.1 | built in; used for the scripts and the voices |
| ffmpeg and ffprobe | 9.0.2 (full build, with libx264 and AAC) | on PATH |
| llama.cpp `llama-server` | build 11160 (Unsloth build), CUDA | chat and embeddings |
| playwright-core | 1.57.0 (exact) | matches the Chromium build below |
| Chromium for Playwright | `chromium-1200` (Chrome 143) in `%LOCALAPPDATA%\ms-playwright` | `npx playwright install chromium` if missing |
| Windows voices | Microsoft Zira Desktop (default), Microsoft David Desktop | check with `tts.ps1 -List` |

Models (chat: Qwen3.5-9B Q4_K_M, thinking off; embeddings: nomic-embed-text-v1.5 Q4_K_M) are described in `setupRunbook.md`. The video does not need different models, but the on-screen AI output will differ from the original in wording.

## 4. Reproduction steps

Do these in order. Each has a check. Commands are PowerShell from the repository root unless noted.

### Step 1. Get the files
Check out the repository (or copy `docker/crm-local/` and `docs/`). Nothing else from the original machine is needed: the `.env`, the browser profile and the output folder are generated.

### Step 2. Bring up the stack
Follow `setupRunbook.md` sections 3 to 8: `bootstrap.ps1`, `start-llama.ps1`, `python mock_crm.py`, `docker compose up -d`, create the Dify admin account, install the OpenAI-API-compatible plugin, register the two models, import the four workflows.

Check: the four apps are in Studio with these exact names (the video builder finds apps by name): **Pre-call brief**, **Post-call update**, **Live call helper (simulated)**, **Agentic CRM - Phase 1**. Run the pre-call brief and the post-call update once by hand as in `setupRunbook.md` section 8; both must work before you record anything.

### Step 3. Install the recording tools
```powershell
cd docker\crm-local\playwright
npm install            # installs playwright-core 1.57.0
ffmpeg -version        # must work; also ffprobe
```
If Chromium for Playwright is missing: `npx playwright install chromium`.
Check: `node -e "require('playwright-core')"` prints nothing and exits cleanly.

### Step 4. Save a Dify login for the recorder [manual]
The recorder runs headless and cannot type your password, so it reuses a browser profile:
```powershell
node launch.js         # opens a visible Chromium on the Dify sign-in page
```
Sign in to Dify in that window, confirm you see Studio, then **close the window** (or stop the script). The session is stored in `docker\crm-local\playwright\.profile` (git-ignored). Two browsers cannot share a profile, so close it before building. To keep the profile elsewhere, set the environment variable `DIFY_PROFILE` to a folder before running both commands.

Check: the build's first lines (Step 6) do not say "Not logged in".

### Step 5. Make sure the stack is ready
- Dify answers: `curl http://localhost/console/api/setup` shows `"step":"finished"`.
- Mock CRM answers: `curl http://localhost:8090/crm/contacts` lists six contacts. (It must be the threaded version in this repo. The older single-threaded version froze when Chrome held an idle connection open, which timed out Dify's CRM lookup partway through a recording.)
- llama-server answers on ports 8080 and 8081 (`curl http://127.0.0.1:8080/health`), started with `--reasoning off`.
- Nothing else is using the profile (no leftover `launch.js` browser).
`build.js` checks Dify and the mock CRM itself and stops with a clear message if either is down.

### Step 6. Build the narration only (quick check)
```powershell
cd docker\crm-local\playwright\video
node build.js --only-tts
```
It synthesizes one WAV per step into `out\tts\` and prints the total narration length (27 clips, about 7 minutes: `narration: 27 clips, 428 s`). To change the voice: `--voice "Microsoft David Desktop"`; to change speed: `--rate 0` (range -10 to 10, default -1).
Check: the clip count and length print; `out\tts\` has WAV files. Clips are cached by text, voice and rate, so only changed lines are re-synthesized.

### Step 7. Try one scene with screenshots
```powershell
node build.js --scenes 03 --shots
```
This records only scene 03 and saves a screenshot after every step in `out\03-before-call\shots\`. Open them and check that the info bar (step number, tag, explanation) is visible and that nothing is cut off. Repeat for any scene (`01` to `07`). Scene 02 needs a deliberately broken copy of a workflow; the builder creates it, uses it and deletes it (it is named **DEMO broken wiring**; add `--keep-broken` to keep it while you iterate).

### Step 8. Build the whole video
```powershell
node build.js
```
Expect about 11 minutes on the original machine (measured with the narration already cached; the very first run adds the time to synthesize the 27 clips), mostly waiting for the AI models. It records the scenes in order and writes `out\walkthrough.mp4`. Add `--shots` if you want per-step screenshots. Progress prints one line per step, for example `05-after-call step 3/9 "The AI drafts, then the run pauses": ran 45.3s, narration 32.0s`.

### Step 9. Check the result
```powershell
ffprobe -v error -show_entries format=duration -of csv=p=0 out\walkthrough.mp4        # total seconds
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height -of csv=p=0 out\walkthrough.mp4
ffmpeg -ss 90 -i out\walkthrough.mp4 -frames:v 1 frame.png                          # look at a frame
```
Expected: one H.264 video stream (1600x900) and one AAC audio stream. Then watch the video once, with sound, and check: every step shows its numbered bar; the voice matches what is on screen; the AI output on screen is accurate to the CRM data (model output varies between runs); no error dialogs. If a scene is wrong, fix it and rebuild only that scene (`--scenes 05`); the final file for a partial build is named `walkthrough_<scenes>.mp4`, so re-run the full build, or join the per-scene files in `out\<scene>\`, to get a complete video again.

### Step 10. Clean up
- The mock CRM is reset at the start of every scene that needs it. Run `docker\crm-local\reset_mock_crm.ps1` after recording to leave it in its seed state.
- Studio should again list only the four real apps. The builder deletes the demo app only if that run created it, and not at all with `--keep-broken`; an older demo app from a previous run is reused and must be deleted by hand.
- The scenes change Dify's saved canvas view and "last run" markers for the real apps. They never edit workflow content or publish anything.
- `docker\crm-local\playwright\video\out\` is git-ignored and can be deleted to reclaim space.

## 5. How the pieces fit (for adapting it)

| File (under `docker/crm-local/playwright/video/`) | Role |
|---|---|
| `build.js` | Orchestrator: preflight, narration, record each scene, align audio, encode, join |
| `tts.ps1` | Text to WAV with the built-in Windows voices; `-List` shows voices |
| `session.js` | Opens the headless browser on the saved profile, optionally with video recording |
| `lib.js` | Overlay (cursor ring, highlight, info bar), paced clicks and typing, import/delete helpers |
| `scenes/_common.js` | Shared step helpers: open an app and fit the canvas, tour nodes, wait for a run state, title cards |
| `scenes/01-intro.js` ... `07-outro.js` | One file per scene, each a list of steps |
| `assets/broken_wiring.yml`, `make_broken_wiring.py` | The workflow copy with one connection removed, and the script that makes it |

A step is `{ title, kinds, what, say, run }`. `what` is the on-screen explanation, `say` is the narration, `kinds` picks the tags, and `run` drives the browser. The recorder holds each step on screen for the length of its narration plus a short pause.

**Audio alignment, in detail:** the recording starts when the browser launches, so the script notes the clock time each step starts. After the browser closes it reads the video's real length and uses the difference from its own clock to correct the start offsets. The blank lead-in before the first step is trimmed, and each narration clip is delayed to its step's start offset and mixed into one audio track.

## 6. Things that will differ between runs or machines

- **AI wording:** the model output on screen changes every run. The narration describes content the CRM data supports (budget, signer, open contract points, the discount request), but read each take.
- **Timing:** model calls took 10 to 70 seconds on the original GPU. A slower machine makes some steps longer; the scenes highlight nodes while waiting, there is no speed-up.
- **Voice:** Windows voices vary by installation; if Zira is missing, pass `--voice`.
- **Dify build:** button and menu names, and some layout, come from one Dify build (English). After a Dify upgrade, re-run Step 7 for each scene.
- **Window size:** the recorded browser is 1600x900 regardless of your screen.

## 7. Problems met while making it, and what fixed them

| Problem | Fix |
|---|---|
| Info bar missing on title-card scenes | The overlay script never ran on the initial blank page; `setStep` now injects it when absent |
| Canvas panned during the node tour; the side panel did not open | Pointing no longer scrolls the canvas; every scene starts with Dify's "fit view" shortcut (Ctrl+1) |
| Run failed with "timed out" in the CRM history step | The mock CRM was single-threaded and blocked by Chrome's idle connection; it is now threaded |
| Caption claimed the CRM showed the added email sentence | The mock now stores and shows the approved follow-up email, and the scene scrolls to it |
| Long static waits during model calls | Longer narration of what is happening, plus nodes highlighted in turn while waiting |
| Importing over an existing app lost the import | The open canvas auto-saved its old graph over it; use a fresh import and delete the old app |
| Slow, empty LLM output | Qwen3.5 was thinking; llama-server runs with `--reasoning off` |
| An interrupted narration run could leave a truncated clip that later builds reused | `tts.ps1` writes to a temporary name and renames when finished; `build.js` discards and re-synthesizes any invalid clip |
| Mock CRM could fail requests when a reset overlapped a read or write | One lock now guards all log access (480 concurrent mixed requests: no failures; the same test without the lock failed on 174 of 1,800) |
| Browser could not be reused for recording | Two browsers cannot share a profile: close `launch.js`'s window first |

## 8. What is manual, what is automated

| Manual (once per machine) | Automated by scripts |
|---|---|
| Install prerequisites; start Docker Desktop | Narration (`tts.ps1`), recording, audio alignment, encoding, joining |
| Create the Dify admin account, install the plugin, register the models | Importing the four workflows (`import.js`), creating and deleting the demo app |
| Sign in once in the `launch.js` window | Resetting the mock CRM, clicking through every scene |
| Watch the finished video and decide whether to re-record a scene | Screenshots of each step (`--shots`) |

## 9. Not verified

- This procedure has been run in full on one machine only. It has not been followed on a second machine.
- The video has been checked through extracted frames, audio level and per-step logs; sound-and-picture sync was derived by construction and measured offsets, not heard on a second device.
- The gate add/remove scene from the original plan is not part of this video; `customizingWorkflows.md` covers it in text.
