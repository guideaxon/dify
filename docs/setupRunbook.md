# Setup Runbook: Agentic CRM stack on a new Windows machine

Goal: go from a clean machine to the four workflows imported and tested in Dify, using local models and a mock CRM. Design background is in `designAgenticCRM.md`. Every step has a check, so you know it worked before moving on.

This runbook was written from one working setup (Windows 11, Docker Desktop, NVIDIA GPU). Steps marked **[manual]** can't be scripted, and anything not exercised is listed in the last section.

## 0. What you end up with

| Piece | Where it runs |
|---|---|
| Dify 1.17.1 (api, worker, web, plugin daemon, sandbox, Postgres, pgvector, Redis, nginx, SSRF proxy) | Docker Compose, pinned images |
| Chat model (default Qwen3.5-9B) on :8080, embedding model (nomic-embed-text) on :8081 | `llama-server` on the Windows host |
| Mock CRM with six seeded contacts on :8090 | Python script on the host |
| Four workflows: pre-call brief, live call helper (simulated), post-call update, Phase 1 inbound reply | Imported into Dify from `docker/crm-local/*.yml` |

## 1. Prerequisites

- **Docker Desktop** (WSL2 backend) with Compose v2.24 or later. Check: `docker compose version`.
- **Optional, recommended:** move Docker's disk image off `C:`: Docker Desktop, Settings, Resources, Advanced, **Disk image location**. This moves everything Docker holds and restarts Docker. Do it before the first pull.
- **llama.cpp `llama-server`** build that can load your models, plus two `.gguf` files: a chat model and an embedding model. This setup used `nomic-embed-text-v1.5.Q4_K_M.gguf` (LM Studio bundles it) and a Qwen3.5-9B Q4_K_M chat model. The `embeddinggemma-2` model did not load in the builds tried.
- **GPU:** the chat model plus embeddings used about 6 GB of a 12 GB card here.
- **Python 3** (standard library only) for the mock CRM.
- **Node 22 and npm**, only if you will use the Playwright helpers.
- **PowerShell 5.1** (built into Windows) for the scripts.
- Internet access once, for Docker images and the Dify marketplace plugin.

## 2. Get the files

The CRM files live in the repo checkout: `docker/crm-local/` (scripts, workflows, seed data, compose layer) and `docs/`. They are **untracked until someone commits them**, so copy them or commit them before moving machines. `docker/.env` is deliberately git-ignored and is generated per machine in step 3.

## 3. Prepare `docker/.env`

```powershell
cd docker\crm-local
.\bootstrap.ps1
```

What it does: creates `docker/.env` from `.env.example` if missing; applies `crm-local.env.example` (pgvector, local URLs, SSRF allowlist for `host.docker.internal`); generates `SECRET_KEY` and `N8N_ENCRYPTION_KEY` if blank; sets `COMPOSE_FILE` so plain `docker compose` includes `crm-local/docker-compose.crm.yaml`; creates `volumes/mcp-shared`. Re-running keeps your existing values (use `-Force` to overwrite).

Check, from `docker/`: `docker compose config --images` lists 16 images, each with an `@sha256:` digest.

Optional hardening: change the default DB and Redis passwords (`difyai123456`). They aren't published to the host, but each appears in more than one place.

## 4. Start the local models

```powershell
cd docker\crm-local
.\start-llama.ps1 -LlamaServer <path\to\llama-server.exe> -ChatModel <chat.gguf> -EmbedModel <embed.gguf>
```

Or set `LLAMA_SERVER_EXE`, `LLAMA_CHAT_MODEL`, `LLAMA_EMBED_MODEL` once and run with no arguments. `.\start-llama.ps1 -Stop` stops both. The chat server runs with `--jinja` and **`--reasoning off`**, which matters: with thinking on, each call spent 5,000 to 6,000 tokens reasoning and took 100+ seconds, and some calls ran out of output budget with no answer.

Check: `curl http://127.0.0.1:8080/health` and `:8081/health` both return `{"status":"ok"}`. Logs are in `docker/crm-local/logs/` (git-ignored).

## 5. Start the mock CRM

```powershell
cd docker\crm-local
python mock_crm.py          # leave running; listens on :8090
```

Check: `curl http://localhost:8090/crm/contacts` lists six contacts (Priya Tester1 to Tom Tester6). Reset between runs: `.\reset_mock_crm.ps1`.

## 6. Start Dify

```powershell
cd docker
docker compose up -d
```

Check: `docker compose ps` shows the services running or healthy, and `http://localhost` loads. Known issue: `local_sandbox` crash-loops with the released 1.17.1 image because this checkout's compose passes a flag the image doesn't know. It only backs agent shell workspaces, which this setup doesn't use. Stop it with `docker compose stop local_sandbox`.

## 7. First-time Dify setup [manual]

1. Open `http://localhost`, create the admin account.
2. **Marketplace** (left sidebar), search **OpenAI-API-compatible** (publisher `langgenius`), **Install**.
3. Register the models (Integrations, or your name at bottom-left, then Settings, then Model Provider; labels vary by version). Use the OpenAI-API-compatible provider, **Add model**:

   | | Chat model | Embedding model |
   |---|---|---|
   | Model type | LLM | Text Embedding |
   | Model name | `qwen3.5-9b` | `nomic-embed-text` |
   | API base URL | `http://host.docker.internal:8080/v1` | `http://host.docker.internal:8081/v1` |
   | API key | anything | anything |
   | Context size | 16384 | 8192 |
   | Function calling | optional | n/a |

   The names must match the `--alias` the servers were started with, because the workflows reference `qwen3.5-9b`. If you use a different chat model, change `MODEL` in `docker/crm-local/dsl_common.py` and regenerate (section 9), or reselect the model in each LLM node after import.

Check: both models save without error. The most common failure is putting the chat port (8080) on the embedding model, which returns `501 Not Implemented`.

## 8. Import and test the workflows

**By hand:** Studio, **Import DSL file**, then pick each file from `docker/crm-local/`: `agentic_crm_precall_brief.yml`, `agentic_crm_postcall.yml`, `agentic_crm_duringcall.yml`, `agentic_crm_phase1.yml`. Open each; the toolbar should show no orange warning badge, and each LLM node should show `qwen3.5-9b`.

**Scripted:** see `docker/crm-local/playwright/README.md`. In short: `npm install`, `node launch.js`, log in by hand in the window it opens, then `node import.js <file> <prefix>` per workflow. Import creates a **new** app each time; importing over an existing app in place did not work reliably.

Test:
- **Pre-call brief:** Test Run with Aisha Tester5, `aisha.tester5@example.com`, company Harborview Test Financial, call type Negotiation. Expect a brief mentioning budget 300 to 320k, the open data-residency and liability redlines, and the unanswered 12% discount, in about 10 to 15 seconds.
- **Post-call update:** Test Run with the same email, call type Negotiation, and the text of `sample_transcripts/aisha_tester5_negotiation.txt`. It pauses at **Review before CRM update** with three editable boxes. **Approve and log to CRM** should log a call activity: check `http://localhost:8090/crm/history?email=aisha.tester5@example.com`. Then run `.\reset_mock_crm.ps1`.

## 9. Regenerating the workflow files

The `.yml` files are generated by `make_dsl*.py` in `docker/crm-local/`. Edit those, not the YAML. They need PyYAML, which the Dify api container has:

```powershell
cd docker
docker cp crm-local docker-api-1:/tmp/crm
docker compose exec -T api python /tmp/crm/make_dsl_postcall.py > crm-local/agentic_crm_postcall.yml
```

`make_dsl_duringcall.py` and `make_dsl_postcall.py` use `dsl_common.py`. `make_dsl.py` (Phase 1) and `make_dsl_precall.py` are self-contained and read from stdin: `docker compose exec -T api python - < crm-local/make_dsl.py`. If you run these from Git Bash, set `MSYS_NO_PATHCONV=1` so `/tmp/...` isn't rewritten to a Windows path, and copy to a fresh folder because `docker cp` onto an existing folder nests it.

## 10. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `501 Not Implemented` for `.../v1/embeddings` when adding the embedding model | The base URL points at the chat server. Use port 8081. If the URL doesn't change after editing, cancel, reload the page and re-enter it. |
| Model calls from Dify time out or refuse | `localhost` inside a container is the container. Use `host.docker.internal`, and confirm llama-server binds `0.0.0.0`. |
| HTTP Request node to a local service fails or returns 403 | The SSRF proxy denies private destinations. `SSRF_PROXY_ALLOW_PRIVATE_DOMAINS`/`_IPS` in `docker/.env` must include the host (set by bootstrap). Confirm the host IP: `docker run --rm alpine getent hosts host.docker.internal`; this setup saw `192.168.65.254`. |
| LLM steps take minutes or return nothing | Thinking is on. Start the chat server with `--reasoning off`. |
| Workflow shows "Duplicate Output node variable" | Two End nodes use the same output name. Output variable names must be unique across End nodes. |
| `bootstrap.ps1` or `start-llama.ps1` health check hangs | Use `127.0.0.1`, not `localhost`, for health checks: `localhost` may try IPv6 first and the servers listen on IPv4. |
| `local_sandbox` restarts | Known mismatch between this checkout's compose and the 1.17.1 image; stop it (section 6). |
| Playwright scripts click the wrong thing | Selectors match this Dify build's English UI and the 1586px-wide window used here. Adjust after a Dify upgrade or a different window size. |

## 11. What has and has not been verified

Verified on the original machine, in Dify, with `qwen3.5-9b` (thinking off) and the mock CRM:

- **Pre-call brief:** ran in about 11 seconds; the content matched the seeded record.
- **Post-call update:** pauses at the review form; **Approve** logs the activity to the CRM; **Reject** ends at "Rejected (nothing logged)" and writes nothing (checked in the run trace and the CRM).
- **Timeout path:** exercised on a scratch copy with the timeout set to 0. The run left the paused state on its own after about 45 seconds and ended at "Timed out (no write)", with no CRM write. The real workflows use a 1-day timeout and were not waited out.
- **Live call helper:** the discount request produced "Hold: needs approval."; the competitor mention produced a question about what their quote includes.
- **Phase 1:** paused at the review form, **Approve and send** logged the reply (line breaks and quotes intact, idempotency key sent).
- **Scripts:** `bootstrap.ps1` (fresh and re-run) and `start-llama.ps1` (start, rerun, stop) were run on the original machine; plain `docker compose` resolves the same 16 pinned images through `COMPOSE_FILE` in `.env`.

Not verified:

- This runbook has not been followed from scratch on a second machine.
- Model output quality varies. In one Phase 1 draft the model made up product capabilities that were not in any input, which is why the knowledge base and the approval gate matter.
- The canvas can show green ticks left over from a previous run on nodes that did not run in the current one; use the Tracing tab to see what actually ran.
- Dify menu labels in sections 7 and 8 are from one Dify build and may differ in yours.
- The Playwright helpers depend on `playwright-core` 1.57.0 and its matching Chromium build.
