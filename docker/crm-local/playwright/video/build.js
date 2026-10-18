#!/usr/bin/env node
// Builds the walkthrough video: narration (Windows text-to-speech) + scripted screen recording + ffmpeg.
//
//   node build.js                      build every scene -> out/walkthrough.mp4
//   node build.js --scenes 03,05       only some scenes (ids start with the number)
//   node build.js --shots              also save a screenshot after each step (out/<scene>/shots/)
//   node build.js --only-tts           just synthesize the narration and print its length
//   node build.js --voice "Microsoft David Desktop" --rate 0
//   node build.js --keep-broken        keep the "DEMO broken wiring" app created for part 1 (a pre-existing one is never deleted)
//
// Needs: Dify and the mock CRM running, a saved Dify login (see ../README.md), ffmpeg on PATH.
// Close any browser started by launch.js first: two browsers cannot share one profile.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { openSession, withPage, BASE } = require('./session');
const lib = require('./lib');

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

const OUT = path.resolve(opt('out', path.join(__dirname, 'out')));
const VOICE = opt('voice', 'Microsoft Zira Desktop');
const RATE = parseInt(opt('rate', '-1'), 10);
const ONLY = (opt('scenes', '') || '').split(',').filter(Boolean);
const CRM = 'http://localhost:8090';
const APP_NAMES = {
  precall: 'Pre-call brief',
  postcall: 'Post-call update',
  duringcall: 'Live call helper (simulated)',
  phase1: 'Agentic CRM - Phase 1',
};
const BROKEN_NAME = 'DEMO broken wiring';

function run(cmd, cmdArgs, { quiet = false } = {}) {
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`${cmd} failed (${r.status}): ${(r.stderr || r.stdout || '').slice(-1500)}`);
  if (!quiet && r.stdout) process.stdout.write(r.stdout);
  return r.stdout;
}
const duration = (file) => parseFloat(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { quiet: true }));

// A usable narration clip is readable audio at least this long. Anything else (empty or truncated file from an
// interrupted run) must not be mixed into the video, where it would silently produce a silent step.
const MIN_CLIP_SECONDS = 0.5;
function clipDuration(file) {
  try {
    const d = duration(file);
    return Number.isFinite(d) && d >= MIN_CLIP_SECONDS ? d : null;
  } catch {
    return null;
  }
}

function loadScenes() {
  const dir = path.join(__dirname, 'scenes');
  return fs.readdirSync(dir)
    .filter((f) => /^\d\d-.*\.js$/.test(f))
    .sort()
    .map((f) => require(path.join(dir, f)))
    .filter((s) => !ONLY.length || ONLY.some((o) => s.id.startsWith(o)));
}

// ---- narration ----
function wavPath(text) {
  const key = crypto.createHash('sha1').update(`${VOICE}|${RATE}|${text}`).digest('hex').slice(0, 14);
  return path.join(OUT, 'tts', `${VOICE.replace(/\W+/g, '')}_${RATE}_${key}.wav`);
}
function synthesize(scenes) {
  const jobs = [];
  for (const s of scenes) for (const st of s.steps) jobs.push({ text: st.say, out: wavPath(st.say) });
  fs.mkdirSync(path.join(OUT, 'tts'), { recursive: true });
  for (const j of jobs) {
    if (fs.existsSync(j.out) && clipDuration(j.out) === null) {
      console.warn(`discarding invalid cached clip, will re-synthesize: ${path.basename(j.out)}`);
      fs.rmSync(j.out, { force: true });
    }
  }
  const jobsFile = path.join(OUT, 'tts_jobs.json');
  fs.writeFileSync(jobsFile, JSON.stringify(jobs));
  run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'tts.ps1'),
    '-Jobs', jobsFile, '-Voice', VOICE, '-Rate', String(RATE)]);
  let total = 0;
  for (const s of scenes) {
    for (const st of s.steps) {
      st.wav = wavPath(st.say);
      st.dur = clipDuration(st.wav);
      if (st.dur === null) throw new Error(`narration clip is missing or invalid for step "${st.title}" (${st.wav}); delete it and re-run`);
      total += st.dur;
    }
  }
  console.log(`narration: ${scenes.reduce((n, s) => n + s.steps.length, 0)} clips, ${total.toFixed(0)} s`);
}

// ---- preflight and app lookup ----
async function preflight(scenes) {
  const dify = await fetch(`${BASE}/console/api/setup`).then((r) => r.json()).catch(() => null);
  if (!dify || dify.step !== 'finished') throw new Error(`Dify is not answering at ${BASE}`);
  const crm = await fetch(`${CRM}/crm/contacts`).then((r) => r.ok).catch(() => false);
  if (!crm) throw new Error(`Mock CRM is not answering at ${CRM} (run: python mock_crm.py)`);

  const apps = {};
  let createdBroken = false;
  await withPage(async (page) => {
    let list = await lib.appIdsByName(page);
    if (page.url().includes('/signin') || page.url().includes('/install')) throw new Error('Not logged in: run launch.js, sign in, close it, retry.');
    const find = (name) => (list.find((a) => a.text.includes(name)) || {}).id;
    for (const [key, name] of Object.entries(APP_NAMES)) {
      apps[key] = find(name);
      if (!apps[key]) throw new Error(`App not found in Studio: "${name}"`);
    }
    if (scenes.some((s) => s.id.startsWith('02'))) {
      apps.broken = find(BROKEN_NAME);
      if (!apps.broken) {
        apps.broken = await lib.importDsl(page, path.join(__dirname, 'assets', 'broken_wiring.yml'));
        createdBroken = true;
      }
    }
  });
  return { apps, createdBroken };
}

// ---- recording one scene ----
async function recordScene(scene, apps) {
  const dir = path.join(OUT, scene.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'shots'), { recursive: true });
  if (scene.resetCrm !== false) await fetch(`${CRM}/crm/reset`, { method: 'POST' });

  const s = await openSession({ record: path.join(dir, 'rec') });
  await lib.installOverlay(s.ctx);
  const h = lib.makeHelpers(s.page);
  const ctx = { page: s.page, h, apps, base: BASE };
  const starts = [];
  let tClose;
  try {
    if (scene.setup) await scene.setup(ctx);
    for (let i = 0; i < scene.steps.length; i++) {
      const st = scene.steps[i];
      await h.setStep({ part: scene.part, n: i + 1, total: scene.steps.length, title: st.title, kinds: st.kinds, what: st.what });
      const t = Date.now();
      starts.push(t);
      await st.run(ctx);
      if (flag('shots')) await s.page.screenshot({ path: path.join(dir, 'shots', `step-${i + 1}.png`) });
      const need = st.dur * 1000 + 700;
      const elapsed = Date.now() - t;
      if (elapsed < need) await lib.sleep(need - elapsed);
      console.log(`  ${scene.id} step ${i + 1}/${scene.steps.length} "${st.title}": ran ${(elapsed / 1000).toFixed(1)}s, narration ${st.dur.toFixed(1)}s`);
    }
    await h.setStep(null);
    await lib.sleep(300);
  } catch (e) {
    await s.page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    throw e;
  } finally {
    tClose = Date.now();
    await s.ctx.close();
  }

  // Video and narration alignment. The recording starts at browser launch, so any gap between launch and the
  // first step is trimmed, and the gap between our clock and the video's own length is calibrated out.
  const webm = fs.readdirSync(path.join(dir, 'rec')).filter((f) => f.endsWith('.webm')).map((f) => path.join(dir, 'rec', f))[0];
  const videoLen = duration(webm);
  const lead = Math.max(0, videoLen - (tClose - s.t0) / 1000);
  const offsets = starts.map((t) => (t - s.t0) / 1000 + lead);
  const trim = Math.max(0, offsets[0] - 0.4);
  const mp4 = path.join(dir, `${scene.id}.mp4`);
  const inputs = ['-ss', trim.toFixed(2), '-i', webm];
  scene.steps.forEach((st) => inputs.push('-i', st.wav));
  const filters = scene.steps.map((st, i) => `[${i + 1}:a]adelay=${Math.round((offsets[i] - trim) * 1000)}:all=1[a${i}]`);
  const mix = scene.steps.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${scene.steps.length}:normalize=0:dropout_transition=0,apad[aout]`;
  run('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', [...filters, mix].join(';'),
    '-map', '0:v', '-map', '[aout]', '-t', (videoLen - trim).toFixed(2),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', mp4]);
  console.log(`  -> ${path.relative(process.cwd(), mp4)} (${(videoLen - trim).toFixed(0)} s)`);
  return mp4;
}

(async () => {
  const scenes = loadScenes();
  if (!scenes.length) throw new Error('no scenes matched');
  fs.mkdirSync(OUT, { recursive: true });
  synthesize(scenes);
  if (flag('only-tts')) return;

  const { apps, createdBroken } = await preflight(scenes);
  const clips = [];
  try {
    for (const scene of scenes) {
      console.log(`Recording ${scene.id}: ${scene.part}`);
      clips.push(await recordScene(scene, apps));
    }
  } finally {
    // only an app this run created is deleted; one that already existed is left alone
    if (apps.broken && createdBroken && !flag('keep-broken')) {
      await withPage(async (page) => lib.deleteApp(page, apps.broken)).catch((e) => console.warn('could not delete the demo app:', e.message));
    }
  }
  const list = path.join(OUT, 'concat.txt');
  fs.writeFileSync(list, clips.map((c) => `file '${c.replace(/\\/g, '/')}'`).join('\n'));
  const final = path.join(OUT, ONLY.length ? `walkthrough_${ONLY.join('-')}.mp4` : 'walkthrough.mp4');
  run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', final]);
  console.log(`Done: ${final} (${duration(final).toFixed(0)} s)`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
