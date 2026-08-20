<p align="center">
  <a href="https://www.imbrace.co">
    <img alt="iMBrace" src="imbrace-logo.png" width="96">
  </a>
</p>

<h1 align="center">iMBrace</h1>

<p align="center">
  <b>The Governed AI Operating System — self-hosted, and now open source.</b>
  <br>
  <sub>Harness enterprise AI with <b>context</b>, <b>compliance</b>, and <b>confidence</b>.</sub>
</p>

<p align="center">
  <a href="LICENSE.md"><img alt="License: Sustainable Use v1.0" src="https://img.shields.io/badge/License-Sustainable%20Use%20v1.0-1a73e8?style=flat"></a>
  <img alt="Deploy: Docker Compose" src="https://img.shields.io/badge/Deploy-Docker%20Compose-1a73e8?style=flat&logo=docker&logoColor=white">
  <a href="CONTRIBUTING.md"><img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-1a73e8?style=flat"></a>
  <img alt="Stars" src="https://img.shields.io/github/stars/imbraceltd/iMBrace?style=flat&color=1a73e8&label=stars">
</p>

<p align="center">
  <a href="https://www.imbrace.co"><b>Website</b></a>
  &nbsp;·&nbsp;
  <a href="#quick-start--run-imbrace-with-docker-compose">Quick start</a>
  &nbsp;·&nbsp;
  <a href="#repositories">Repositories</a>
  &nbsp;·&nbsp;
  <a href="#license--please-read-first">License</a>
  &nbsp;·&nbsp;
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<br>

> [!NOTE]
> ### iMBrace Community Edition is now open source
> Build context-aware AI on **your own** infrastructure — with your knowledge, models, data, and tools.
> **100% self-hosted. Zero external data sharing.**

**iMBrace** is an AI-native workspace that turns disconnected data into dynamic business
intelligence — **agents, omnichannel conversations, data boards, document intelligence, and
workflow automation**, all on infrastructure you control. This repository is the **front door**:
it explains how the pieces fit together, how they are licensed, and how to run the whole stack.

---

## ✨ Why iMBrace

<table>
  <tr>
    <td align="center" width="25%">
      <br>🔒<br><br><b>Data Sovereignty</b><br>
      <sub>Your data never leaves your own infrastructure.</sub><br><br>
    </td>
    <td align="center" width="25%">
      <br>🔀<br><br><b>DAG Workflows</b><br>
      <sub>Orchestrate complex automation as directed graphs.</sub><br><br>
    </td>
    <td align="center" width="25%">
      <br>🔌<br><br><b>Native MCP Gateway</b><br>
      <sub>Connect any tool through the Model Context Protocol.</sub><br><br>
    </td>
    <td align="center" width="25%">
      <br>🧠<br><br><b>Multi-LLM Freedom</b><br>
      <sub>Bring your own model — local or hosted, your choice.</sub><br><br>
    </td>
  </tr>
</table>

---

## 🧩 The iMBrace platform

A suite of focused products working as one governed system:

| | Product | What it does |
|:--:|---|---|
| 💬 | **CommsIQ** | Omnichannel conversations across every customer touchpoint |
| 📄 | **DocIQ** | Document intelligence, extraction, and understanding |
| 📊 | **InsightsIQ** | Data boards and dynamic business intelligence |
| 🔀 | **FlowOps** | DAG-based workflow automation |
| 🧠 | **OntoCore** | The knowledge and ontology core |
| 🛡️ | **GovernCore** | Governance, security, and access control |

---

## Quick start — run iMBrace with Docker Compose

The whole stack runs from one file: [`deploy/docker-compose.yml`](deploy/docker-compose.yml).
Every sidecar config (nginx, Garage, Postgres init, Loki/Alloy/Prometheus/Grafana) is
inlined as a Compose `config`, so that single file *is* the deployment — 21 long-running
containers plus 10 one-shot DB init/migrate jobs, from 27 images. All images are public
(`docker.io/imbraceltd`), so no registry token is required.

### Requirements

Docker Engine 24+ and **Docker Compose v2.23.1+** (for inline `configs[].content`), on a
host sized for the workload:

| | Minimum | Notes |
|---|---|---|
| CPU | 16 cores | `amd64` or `arm64` |
| RAM | 32 GB | 30 GB *available* if you self-host the LLM |
| Free disk on `/` | 20 GB | |
| GPU | optional | NVIDIA + ≥32 GB VRAM, only for the self-hosted `ai-vllm` (LLM/embedding) profiles. Without a GPU everything else runs fine — the AI features that call vLLM are the only ones that fail. |

Nothing enforces these numbers; below them the stack starts but runs degraded.

### Install

```bash
# grab just the one file — no clone, no submodules
curl -fsSLO https://raw.githubusercontent.com/imbraceltd/imbrace/main/deploy/docker-compose.yml

# start everything (defaults to localhost)
docker compose up -d

# or point it at the address browsers will use
PUBLIC_HOST=10.0.0.5 docker compose up -d
```

Startup order is encoded in the file: each DB init job waits for Postgres to be healthy,
every app waits for its init job to finish, the gateway waits for the backends, and the
frontends wait for the gateway. One `up -d` is enough.

```bash
docker compose ps            # status
docker compose logs -f app-gateway
docker compose down          # stop
docker compose down -v       # stop AND delete all data volumes
```

### Configuration

All values have defaults baked in, so a plain `up -d` works. Override with a `.env` file
next to the compose file, or inline on the command line:

| Variable | Default | Purpose |
|---|---|---|
| `PUBLIC_HOST` | `localhost` | Browser-facing IP/domain — no scheme, no port |
| `PUBLIC_SCHEME` | `http` | `http` or `https` |
| `WS_SCHEME` | `ws` | `ws` with http, `wss` with https |
| `POSTGRES_PASSWORD` | `changeme-postgres-pass` | Postgres superuser **and** the `imbrace` app role |
| `REDIS_PASSWORD` | `imbrace-dev-redis-pass` | Redis auth |
| `GARAGE_KEY_ID` / `GARAGE_KEY_SECRET` | empty | S3 keys, filled after the optional Garage bootstrap |
| `OPENAI_API_KEY` / `TAVILY_API_KEY` | empty | Optional external providers |

> ⚠️ **Before exposing the stack to a network,** change the seeded admin password
> (`NEW_ORG_PASSWORD`), the Grafana admin password, and the JWT / encryption keys
> (`AP_ENCRYPTION_KEY`, `AP_JWT_SECRET`, `AP_WORKER_TOKEN`, channel `JWT_SECRET`,
> `WEBUI_SECRET_KEY`, `ENCRYPTION_SECRET_KEY`, Garage `rpc_secret`). They ship as fixed
> defaults, which means **every** install shares them until you rotate.

### Optional add-ons (Compose profiles)

```bash
docker compose --profile logging up -d      # Loki + Alloy + Prometheus + Grafana
docker compose --profile qwen up -d         # self-hosted vLLM chat model
docker compose --profile gemma4 up -d
docker compose --profile embedding up -d    # self-hosted embedding model
```

The `qwen` / `gemma4` / `embedding` profiles need an NVIDIA GPU, the NVIDIA Container
Toolkit, and the model weights staged under `/opt/imbrace/hf_home` (bind-mounted into the
container). Skip them to use an external LLM instead.

Object storage is optional too: services default to local disk. To use the bundled Garage
S3 node, run the one-time bootstrap documented in the header of the compose file, then put
the printed key id/secret into `.env` as `GARAGE_KEY_ID` / `GARAGE_KEY_SECRET`.

### Access

| URL | Content |
|---|---|
| `http://<PUBLIC_HOST>:6868` | Dashboard — login `admin@imbrace.co` / `ChangeMe@12345` |
| `http://<PUBLIC_HOST>:6868/api` | app-gateway API |
| `http://<PUBLIC_HOST>:30700` | Workflow automation |
| `http://<PUBLIC_HOST>:30030` | insightIQ AI chat |
| `http://<PUBLIC_HOST>:30050` | Embeddable chat widget |
| `http://<PUBLIC_HOST>:30040` | AI agent (Next Best Action) |
| `http://<PUBLIC_HOST>:36868` | Grafana — `admin`/`admin`, with `--profile logging` |

---

## License — please read first

iMBrace source is **dual-licensed**, split by file path:

| If a file path… | It is licensed under | Meaning |
|---|---|---|
| does **NOT** contain `.ee.` (the vast majority of the code) | [**Sustainable Use License v1.0**](LICENSE.md) | Source-available. You may use, copy, and modify it, subject to the usage limits in the license (e.g. no reselling it as a competing product). |
| **DOES** contain `.ee.` in its path (e.g. `x.ee.ts`, `packages/ee/…`) | [**Enterprise License**](LICENSE_EE.md) | Commercial feature. A paid iMBrace license is required to use it in production. |

This is **not** an MIT/Apache project — check which of the two applies before you use or
contribute to a given file. See [CONTRIBUTING.md](CONTRIBUTING.md#license-boundary) for
what this means for contributors.

---

## Repositories

### Frontend
| Repo | Description | Stack |
|---|---|---|
| [imbrace-fe](https://github.com/imbraceltd/imbrace-fe) | Main webapp — admin / member workspace | Vite · React 18 · Redux Toolkit · PWA |
| [imbrace-ui](https://github.com/imbraceltd/imbrace-ui) | Shared UI component library (`@imbrace/ui`) | React · Storybook · Rollup |
| [imbrace-chat-widget](https://github.com/imbraceltd/imbrace-chat-widget) | Embeddable chat widget (`<script>` drop-in) | Vite · React |
| [imbrace-ai-chatbot](https://github.com/imbraceltd/imbrace-ai-chatbot) | AI chatbot single-page app | Vite · React 19 · AI SDK |


### Backend services
| Repo | Description | Stack |
|---|---|---|
| [platform](https://github.com/imbraceltd/platform) | Core platform — authentication, organizations, users, teams, SSO, licensing | Hono · Drizzle · PostgreSQL |
| [app-gateway](https://github.com/imbraceltd/app-gateway) | Self-hostable API gateway — auth, license verification, routing | Node · Express · TypeScript |
| [ai-agent](https://github.com/imbraceltd/ai-agent) | AI agent runtime (backend + web client) — tools, MCP, chat orchestration | Express · React · TypeScript |
| [chat-ai](https://github.com/imbraceltd/chat-ai) | AI chat service — runs OpenAPI/MCP tool-servers | Open WebUI-based |
| [channel](https://github.com/imbraceltd/channel) | Omnichannel service — channels, conversations, contacts, webhooks, WebSocket | Hono · TypeScript |
| [data_board](https://github.com/imbraceltd/data_board) | Data-board management — data / CRM / knowledge / document boards | Hono · Drizzle · PostgreSQL |
| [file](https://github.com/imbraceltd/file) | File service — upload, storage, presigned URLs | Hono · TypeScript |
| [marketplace](https://github.com/imbraceltd/marketplace) | Apps / templates / integrations hub | Node · TypeScript |
| [auth](https://github.com/imbraceltd/auth) | Self-hosted authentication server (OpenAuth-based) | Node · TypeScript |

### Workflow
| Repo | Description | Stack |
|---|---|---|
| [workflow](https://github.com/imbraceltd/workflow) | Workflow automation engine | TypeScript · React |

---

## Working on the code

Each repository is self-contained and has its own README with setup instructions. Clone
the component you want to work on and follow its local README. A typical on-prem stack is
composed of the backend services above plus `imbrace-fe`.

[`deploy/docker-compose.yml`](deploy/docker-compose.yml) pins the currently published image
tag of every component, so it doubles as the reference for which versions are known to work
together. To run your own build of one service against the rest of the stack, drop a
`docker-compose.override.yml` next to it — Compose merges it automatically:

```yaml
services:
  data-board:
    image: my-local/data_board:dev
```

## Contributing

We welcome contributions. Please read:

- [CONTRIBUTING.md](CONTRIBUTING.md) — how to set up, branch, and open a PR, and the
  **license boundary** you must respect.
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — the standards we hold each other to.

## Security

To report a vulnerability, please **do not** open a public issue — email
`security@imbrace.co` (see [SECURITY.md](SECURITY.md)).
