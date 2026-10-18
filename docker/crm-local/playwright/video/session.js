// Opens a headless browser on the saved Dify login profile (the one launch.js created), optionally
// recording video. Close any browser started by launch.js first: two browsers cannot share a profile.
//
//   DIFY_PROFILE   profile folder (default: ../.profile, next to launch.js)
//   DIFY_URL       Dify base URL (default http://localhost)
const { chromium } = require('playwright-core');
const path = require('path');

const PROFILE = process.env.DIFY_PROFILE || path.join(__dirname, '..', '.profile');
const BASE = process.env.DIFY_URL || 'http://localhost';

async function openSession({ record = null, width = 1600, height = 900 } = {}) {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    viewport: { width, height },
    deviceScaleFactor: 1,
    ...(record ? { recordVideo: { dir: record, size: { width, height } } } : {}),
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  const t0 = Date.now();
  return { ctx, page, t0 };
}

// Runs fn(page) in a throwaway session and closes it.
async function withPage(fn, opts) {
  const s = await openSession(opts);
  try {
    return await fn(s.page, s);
  } finally {
    await s.ctx.close();
  }
}

module.exports = { openSession, withPage, PROFILE, BASE };
