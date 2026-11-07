# AGENTS.md

Dify is an open-source platform for building LLM applications, agentic workflows, and RAG pipelines. This monorepo contains the backend API (`api/`), frontend application (`web/`), deployment assets (`docker/`), standalone agent backend (`dify-agent/`), CLI (`cli/`), and end-to-end suite (`e2e/`). Follow the nearest scoped `AGENTS.md` for the files being changed. Apply its guidance within the user's requested scope; explicit user instructions take precedence over workflow defaults.

## Repository Gotchas

- Run backend commands through `uv run --project api <command>`.
- Backend integration tests are CI-only and are not expected to run locally.
- Keep `docker/.env.example` limited to variables required for a default Docker Compose deployment to start. Put optional and provider-specific settings in the matching `docker/envs/*.env.example` file; `docker/.env` overrides those service-specific env files.

## Browser Automation Safety

- **Own apps / CI tests:** the pinned Playwright/Puppeteer browser is fine. Keep the packages and browsers updated regularly (`npx playwright install chromium` after each upgrade), and keep each project on the latest Playwright release, not just the newest one already in the repo.
- **Untrusted or open-web browsing and scraping:** always launch with `chromiumSandbox: true`. Never pass `--no-sandbox`.
- **Don't use the system Chrome for Playwright.** Always use Playwright's own bundled browsers, and keep them current by upgrading `playwright` / `@playwright/mcp` and re-running `npx playwright install`. Why:
  - **Isolation:** Playwright launches with a fresh, throwaway profile. System Chrome sits next to your real profile (logins, cookies, saved passwords), so a compromised automation browser could reach them.
  - **Version match:** each Playwright release is tested against its own Chromium build. System Chrome auto-updates on Google's schedule and can break the DevTools protocol or Playwright's patches without warning, which makes failures hard to diagnose.
  - **Reproducibility:** everyone on the team and CI gets the same browser. System Chrome gives every machine a different build.
  - **Fewer restrictions:** branded Chrome has been tightening automation flags and extension loading; bundled Chromium doesn't have those limits (verify for current versions).
  - **The tradeoff:** system Chrome auto-updates, so it is rarely stale. Don't switch browsers to solve that. Fix it with regular upgrades of `playwright*`, `chromiumSandbox: true`, container isolation, and a Dependabot/Renovate rule or scheduled run of this audit.
  - **Exception:** use a system browser only for human-in-the-loop work that needs a real logged-in session. Even then, use a dedicated Chrome profile created just for automation, never your daily profile, and never for open-web agents.
- **Chrome CDP (`connectOverCDP`, remote debugging port):** use it to attach to an existing browser, not as the default way to launch one. Acceptable for:
  - debugging and profiling (e.g. Chrome DevTools MCP, traces, heap snapshots);
  - a human-driven session, using a dedicated automation profile (`--user-data-dir`), never the daily profile;
  - remote or cloud browsers and containers that expose a CDP endpoint (good for isolation);
  - Electron/embedded Chromium that Playwright can't launch directly.
  Rules:
  - A debugging port is full remote control (cookies, JS on any tab). Bind to `127.0.0.1` only, never expose it on a network, and treat it like a credential.
  - Newer Chrome versions refuse the debugging port on the default profile, so use a separate profile (verify for current versions).
  - `connectOverCDP` has lower fidelity than Playwright's own protocol, and it is Chromium-only.
  - For tests against our own apps use bundled Chromium via `launch()`. For untrusted web or AI agents use bundled Chromium with `chromiumSandbox: true` in a container, or a remote CDP browser in a throwaway environment.
- **AI agents that navigate the open web:** run them in a non-root container or throwaway VM/profile so the host is isolated. Give them no access to personal files, `.env` files and API keys, SSH keys, cloud credentials or the daily browser profile. Prompt injection from a page can steer the agent, so assume anything the agent can reach can be leaked.
- **Patched is not safe:** even the latest Playwright bundles a Chromium major that lags current Stable, and Google stops patching older majors. For agents and scrapers, an up-to-date Playwright is never a green light on its own. It must be paired with the enabled sandbox and strict containerization.
- **Docker/CI:** never run Playwright or Puppeteer as root. Use a non-root user so the Chromium sandbox stays active, and don't add `--no-sandbox` to make a container work.
- **Don't rely on defaults:** Playwright's `chromiumSandbox` default is off (verify for current versions). Set `chromiumSandbox: true` explicitly on every launch, and always for anything that browses untrusted sites, so the setting doesn't depend on a default that may differ by version or config.
- **Don't weaken the browser to make a test pass:** no `--disable-web-security`, `--disable-site-isolation-trials` or `ignoreHTTPSErrors` by default. If one specific test needs one, scope it to that test and comment why.
- **Check the latest version, don't copy one:** find the latest Playwright with `npm view playwright version` and read its Chromium from `browsers.json`. Never rely on a version number written in a doc, an earlier report or another repo; they go stale within weeks.
- **Playwright has two Chromium builds per revision:** the full browser and the headless shell. Both are downloaded by `npx playwright install chromium`; `--no-shell` skips the shell if no test runs headless without a `channel`.
- **Persistent browser profiles hold logins and cookies.** Keep them in a git-ignored folder, never in a tracked path, and delete them when the test is finished. A signed-in test account in a profile is a live session.
- **Test servers bind to `127.0.0.1`,** never all interfaces.
- **Secrets stay out of git:** API keys, signing keys and `.env` files with credentials are git-ignored, and a key that was ever committed is revoked, not just deleted.
- **In-app WebViews:** treat route params and deep links as untrusted input. Allow https only, accept no raw `html` param, and let only the app's own pages send navigation messages.
- **Remotion and similar:** these ship their own headless shell in each project's `node_modules`. Upgrade them with the project, since a global browser update won't fix them.
- Never run delete or uninstall commands from an audit without human review.
