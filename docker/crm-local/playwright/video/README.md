# Walkthrough video builder

Records a narrated screen walkthrough of the CRM workflows in Dify, from scripts. Each step on screen has a **numbered header**, a **tag showing who does the work**, and a plain-language explanation; a voice reads the narration.

```
node build.js                 # all scenes -> out/walkthrough.mp4
node build.js --scenes 03,05  # only some scenes (out/walkthrough_03-05.mp4)
node build.js --shots         # also save a screenshot after every step (out/<scene>/shots/)
node build.js --only-tts      # just synthesize the narration and print its length
node build.js --voice "Microsoft David Desktop" --rate 0
node build.js --keep-broken   # keep the "DEMO broken wiring" app that part 1 uses
```

Step-by-step instructions for reproducing the whole video on another machine, with checks and the problems met along the way, are in `docs/videoReproduction.md`.

## What you need first

- Dify and the mock CRM running, the four workflows imported (see `docs/setupRunbook.md`).
- A saved Dify login. Run `node ../launch.js`, sign in in the window, then **close it**. Two browsers cannot share one profile, so close any browser started by `launch.js` before building. To use a different profile folder, set `DIFY_PROFILE`.
- `npm install` in the parent folder (`playwright-core` 1.57.0), `ffmpeg` and `ffprobe` on PATH, and Windows PowerShell (for the built-in voices).

## The tags on screen

| Tag | Meaning |
|---|---|
| **YOU DO THIS** (blue) | A person clicks, types or decides |
| **AUTOMATIC** (green) | Software does it, no AI involved (fetching the CRM record, writing to the CRM) |
| **AI STEP** (purple) | The language model writes or analyses |
| **HUMAN APPROVAL** (amber) | The workflow stops and waits for a person |
| **LOOK HERE** (grey) | Explanation only |

These workflows are fixed pipelines with AI steps inside them and a person approving; they are not an autonomous agent, and the video says so.

## Scenes

| File | Part | Steps |
|---|---|---|
| `scenes/01-intro.js` | Introduction and how to read the tags | 2 |
| `scenes/02-wiring.js` | Part 1: checking the wiring (including a deliberately broken copy and Dify's checklist) | 5 |
| `scenes/03-before-call.js` | Part 2: pre-call brief | 4 |
| `scenes/04-during-call.js` | Part 3: simulated live call helper | 4 |
| `scenes/05-after-call.js` | Part 4: post-call update with review, Approve, Reject and the timeout path | 9 |
| `scenes/06-real-crm.js` | Part 5: what changes with a real CRM | 2 |
| `scenes/07-outro.js` | Recap | 1 |

## How it works

1. `tts.ps1` turns each step's `say` text into a WAV with a built-in Windows voice (cached by text, voice and rate in `out/tts/`).
2. `build.js` records each scene in a headless browser with video on, running each step's `run()` and then waiting until the narration for that step has finished, so the screen never moves faster than the voice.
3. The narration clips are placed at the moment each step started, the blank lead-in is trimmed, and `ffmpeg` produces one MP4 per scene, then joins them.
4. `lib.js` draws the overlay (cursor ring, red highlight, the numbered info bar). Nodes are found by their `data-id` (set by the workflow generators), buttons by their accessible names, so scripts do not depend on screen positions.

## Writing or changing a step

A step in a scene file looks like this:

```js
{
  title: 'Edit, then approve',            // shown in the header
  kinds: ['manual', 'approval'],          // tags: manual | automated | ai | approval | info
  what: 'One or two sentences shown on screen explaining what is happening.',
  say: 'The narration, written to be spoken.',
  async run({ h, page, apps }) { /* drive the UI with h.click, h.type, h.fill, h.highlight, tourWhile ... */ },
}
```

Keep `what` short enough for two lines, put a slow operation inside `tourWhile(...)` so nodes are highlighted while the model works, and keep `say` long enough to cover it.

## Cleanup rules

Part 1 needs a deliberately broken copy of a workflow. The builder creates an app named **DEMO broken wiring** and deletes it at the end, but **only if that run created it**: one that already exists (for example left by `--keep-broken`) is reused and never deleted automatically, so remove it by hand when you no longer need it.

Narration clips are validated before use: an empty or truncated clip (for example from an interrupted run) is discarded and re-synthesized, and the build stops with a clear message if a clip is still unusable.

## Known limits

- The recorded browser is headless Chromium at 1600x900; the voice is a built-in Windows voice (clear but synthetic). For a human voice, record over the silent video instead.
- Model calls take 10 to 70 seconds, so some steps are longer than their narration. The scenes highlight nodes while waiting; there is no speed-up yet.
- Running a scene modifies Dify's saved canvas view and "last run" markers for the apps involved, and part 1 creates then deletes one demo app. It never publishes or edits workflow content.
- The timeout path is explained on the canvas; it is not waited out (the real timeout is a day).
- The overlay and some selectors target this Dify build's English UI.
