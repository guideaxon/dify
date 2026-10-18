# Playwright helpers for the Dify CRM workflows

Small scripts that drive a visible browser through the Dify UI, for importing the workflows and (later) recording the walkthrough video described in `docs/videoWalkthrough.md`. They attach to a browser you start and log in to yourself, so no password is ever passed to a script.

## One-time setup

```powershell
cd docker\crm-local\playwright
npm install                     # installs playwright-core 1.57.0
```

`playwright-core` 1.57.0 matches the Chromium builds already downloaded to `%LOCALAPPDATA%\ms-playwright`. If you change the version, the browser download may need to be repeated (`npx playwright install chromium`).

## Use

1. Start the browser (leave this running):
   ```powershell
   node launch.js
   ```
   Log in to Dify in the window that opens. The session lives in `.profile/` (git-ignored).
2. In another terminal:
   ```powershell
   node snap.js out.png http://localhost/apps          # screenshot a page
   node import.js ..\agentic_crm_precall_brief.yml pre  # import a workflow as a NEW app (pre_dialog.png, pre_result.png)
   node checklist.js <app-id> check.png                  # open the issues checklist (the badge on the toolbar)
   node run-precall.js <app-id> run                      # Test Run the pre-call brief for Aisha Tester5
   node run-postcall.js <app-id> run                     # Test Run the post-call app; stops at the review form
   node approve.js approved.png                          # click "Approve and log to CRM" on that form
   node approve.js rejected.png Reject                   # or click another button by name
   node run-duringcall.js <app-id> run                   # chat with the live call helper (Preview)
   node run-phase1.js <app-id> run                       # Test Run Phase 1; stops at its review form
   node run-timeout.js <app-id> run                      # wait for a paused run to time out (scratch copy with timeout 0)
   node trace.js out.png                                 # show which nodes actually ran (Tracing tab)
   node apps.js                                          # list app ids shown in Studio
   node delete-app.js <app-id> del                       # DESTRUCTIVE: delete one app by id
   ```
   Reset the mock CRM afterwards with `..\reset_mock_crm.ps1`. `<app-id>` is the UUID in the app's URL.

## Notes

- The scripts assume Dify at `http://localhost` and a debug port of 9222.
- UI text matching (button names such as "Import DSL file" and "Create") reflects the Dify version in this checkout and may need adjusting after an upgrade.
- Importing over an existing app (the app menu's "Import DSL") was unreliable in testing: the open canvas auto-saved its old graph over the import. Use `import.js`, which creates a new app, and remove the stale one with `delete-app.js`.
- Clicks that have no stable label (the app "..." menu, the toolbar checklist icon) are positioned by screen ratio and depend on the window size. They worked at about 1586 px wide.
- `.profile/` and `node_modules/` are not committed.
