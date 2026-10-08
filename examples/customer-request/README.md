# Customer request: wait for a reply, survive a restart, resume

A runnable iMBrace Workflow example. A service request arrives with missing fields, an AI agent classifies it, the workflow asks the customer for the missing information, then **waits** with no polling and no timer. When the customer's reply arrives (matched by `request_id`), the **same run** resumes and goes to human approval, then to a business system. The waiting run survives `docker compose restart`.

You do not write code. The Community Edition stack installs the example by itself; you add an LLM provider and run a few commands. Nothing has to be installed on your machine besides Docker.

## What it does

| # | Requirement | Where |
|---|---|---|
| 1 | Webhook receives a service request with missing fields | intake: *Service request received* |
| 2 | Create an instance, keep the correlation ID | each request is one run, tagged `request_id:<id>` |
| 3 | AI agent classifies the request | intake: *Classify request (AI agent)*, an iMBrace AI agent on your LLM provider (e.g. Amazon Bedrock) |
| 4 | Deterministic check of required fields | intake: *Check required fields* (code step) |
| 5 | HTTP "information required" message | intake: *Ask customer for missing information* → stub `/notify` |
| 6 | Wait and persist, no polling | intake: *Wait for customer reply*; the run is `PAUSED` in Postgres |
| 7 | Second webhook with the same `request_id` | reply router: *Customer reply received* |
| 8 | Match the reply to the waiting run and resume it | reply router looks up `request_id` and resumes that run |
| 9 | Human approval | intake: *Create approval task* / *Wait for approval* |
| 10 | After approval, call the business system | intake: *Create ticket in business system* → stub `/business-system` |
| 11 | Trace of the whole run, including the wait | FlowOps → Workflows → Runs |

```
 request ──► [intake] classify ─ check ─ notify ─ ⏸ wait ······ ▶ resume ─ approval ⏸ ··· ▶ business system
                                          │ Wait for Event (key = request_id)     ▲
 reply ─────► [reply router] Resume Waiting Run (key = request_id) ──────────────┘  (404 if nothing is waiting)
```

## Prerequisites

1. **iMBrace Community Edition running** from `deploy/docker-compose.yml` (`cd deploy && sh generate-env.sh && docker compose up -d`; `generate-env.sh` writes the per-install Workflow keys into `deploy/.env` once). The default `PUBLIC_HOST=localhost` works.

   On first start the stack installs this example (service `examples-seed`): the stub endpoints on `http://127.0.0.1:30800` (service `customer-request-stub`), the API key connection `imbrace-api-key` and both flows, published and enabled. `SEED_EXAMPLES=false` in `deploy/.env` turns that off. The seed never overwrites a flow that already exists, so your edits in the flow builder survive `docker compose up -d`.

   The image versions pinned in `deploy/docker-compose.yml` include everything the example needs (API keys through the gateway, the AI agent step, the Todos page, *Wait for Event* / *Resume Waiting Run*). Older pins do not.

2. **An LLM provider** for the organization: dashboard → LLM Provider → add one (this example was tested with Amazon Bedrock; another type: set `CLASSIFIER_PROVIDER_TYPE` / `CLASSIFIER_MODEL` in `deploy/.env`). Within 30 seconds the seed creates the AI agent *Customer Request Classifier* on it and points the intake flow at it (`docker logs -f imbrace-examples-seed` shows it, then the seed exits). The agent appears on the dashboard's **AI Agent** page, where you can edit its instructions or chat with it in the Preview tab. Until then a request stops at *Classify request (AI agent)*.
## Run it

In `deploy` (next to `docker-compose.yml`), from any shell — bash, cmd or PowerShell:

```bash
docker compose run --rm examples request REQ-1001   # steps 1-6: prints the "information required" message, the run then waits
docker compose run --rm examples reply   REQ-1001   # steps 7-8: HTTP 202 "resumed" (404 if nothing is waiting)
```

Step 9: open the dashboard → FlowOps → Workflows → **Todos**, open *Approve service request REQ-1001* and click **Mark as Approve** (or **Mark as Reject**). Without the UI: `docker compose run --rm examples approve REQ-1001` (`... approve REQ-1001 Reject` to reject).

Step 10: `docker compose run --rm examples result REQ-1001` shows what the business system received: the request, the reply, the AI classification and the approval, all with the same `run_id`.

Step 11: FlowOps → Workflows → **Runs**, open the *Customer request - intake* run to see every step with its input and output.

`examples` is a one-off container of the stack (profile `tools`, never started by `up`) running `scripts/cli.mjs`; it finds the two flows by name, so it needs no setup. Other commands: `calls [request_id]` (every call the stub recorded), `urls` (the two webhook URLs, to call them yourself), `help`.

### From a clone of the repo

`scripts/cli.mjs` also runs on the host (Node.js 18+), against the published ports on 127.0.0.1:

```bash
cd examples/customer-request
node scripts/cli.mjs request REQ-1001     # same commands: reply, approve, result, calls, urls
```

The bash scripts (`send-request.sh`, `send-reply.sh`, `approve.sh`, `acceptance-test.sh`) need **bash** and **curl** (Git Bash on Windows) and `node scripts/setup.mjs --state-only` once, which writes the two webhook URLs to `scripts/.state.json`. Step 10 without the CLI: `curl -s "http://127.0.0.1:30800/calls?path=/business-system&request_id=REQ-1001"`.

### Calling the webhooks yourself

`docker compose run --rm examples urls` prints them (so does `docker logs imbrace-examples-seed`). The bash scripts and `curl` lines are bash. On Windows run them in Git Bash; from cmd or PowerShell, quoting differs and the JSON body arrives mangled (the intake run then stops at *Validate request*). In PowerShell use `Invoke-RestMethod -Method Post -Uri <webhook URL> -ContentType 'application/json' -Body (@{ request_id = 'REQ-1001'; ... } | ConvertTo-Json)`, or keep the JSON in a file and send it with `curl.exe ... -H "content-type: application/json" --data-binary @request.json`.

Without the seed (`SEED_EXAMPLES=false`), install it by hand: `docker compose up -d customer-request-stub` in `deploy`, then `node scripts/setup.mjs` here, which creates the AI agent (an LLM provider must exist) and the API key connection, imports + publishes both flows and writes `scripts/.state.json`.

`setup.mjs` reads `IMBRACE_API` (default `http://127.0.0.1:6868/api`), `IMBRACE_EMAIL` / `IMBRACE_PASSWORD` (default: the Community Edition admin), `CLASSIFIER_PROVIDER_TYPE` (default `bedrock`) and `CLASSIFIER_MODEL` (default `qwen.qwen3-32b-v1:0`). Re-running it updates the flows in place (it overwrites edits made in the flow builder; `--seed` does not).

## Acceptance test

Needs a clone of the repo, bash, curl and Node.js (it restarts the stack with `docker compose`):

```bash
bash scripts/acceptance-test.sh
```

1. Posts a request and runs to the wait (step 6).
2. Runs `docker compose restart` on the whole stack and waits for it to come back (`COMPOSE_FILE` / `COMPOSE_PROJECT` when the stack runs from another file or project name).
3. Posts the reply webhook.
4. Checks that the **same run** resumes at step 7, gets approved and calls the business system with the reply data.

It prints `PASS` and exits 0, or prints the failing check and exits 1. A run takes about 1.5 minutes.

## How the correlation works

Two built-in Webhook actions do it, keyed by `request_id`:

- **Wait for Event** (intake) records "run X is waiting on key K" in the project store and pauses the run.
- **Resume Waiting Run** (reply router) looks the key up, removes the entry, and resumes that run with the reply as data. Its output says whether a run was waiting (`resumed`), and the reply router answers `202` or `404 no waiting request` from it.

Because the entry is removed before the run is resumed, a duplicate reply cannot resume the run twice.

## Files

```
stub/server.js              /notify /approvals /business-system, /calls to inspect them
flows/intake.json           flow 1
flows/reply-router.json     flow 2
agents/request-classifier.json   the AI agent (name, instructions)
payloads/                   sample request and reply
scripts/                    setup, cli (request/reply/approve/result), send-request, send-reply, approve, acceptance-test
scripts/sync-deploy.mjs     copies setup.mjs, cli.mjs, the flows, the agent, the payloads and the stub into deploy/docker-compose.yml
```

`deploy/docker-compose.yml` carries copies of `scripts/setup.mjs`, `scripts/cli.mjs`, `flows/*.json`, `agents/request-classifier.json`, `payloads/*.json` and `stub/server.js` (inline `configs:`, so the compose file stays self-contained). After changing any of them run `node scripts/sync-deploy.mjs`; `node scripts/sync-deploy.mjs --check` fails when the copies are out of date. A running stack does not pick the new copies up by itself (compose does not recreate a container when only a config's content changes): `docker compose up -d --no-deps --force-recreate examples-seed customer-request-stub` in `deploy`.

## Known limitations

- If a second request uses a `request_id` that is already waiting, the newer run takes over the key.
- The wait step itself shows a few milliseconds in the trace. The time spent waiting is in the run's total duration.

## Clean up

Disable or delete the two flows in FlowOps → Workflows if you no longer need them. The stub is part of the stack (`docker compose stop customer-request-stub` in `deploy`).
