# iMBrace — Open Source

Central hub for the open-source repositories that make up the **iMBrace** platform: an
AI-native workspace with agents, omnichannel conversations, data boards, document
intelligence, and workflow automation.

This repository is the **front door** to the project — it explains how the pieces fit
together, how they are licensed, and how to contribute. Each component lives in its own
repository (linked below).

---

## Quick start — run iMBrace with one command

The fastest way to get a working IMbrace stack is the installer CLI. On a **fresh Linux
host** (Ubuntu/Debian recommended), run:

```bash
curl -fsSL https://imbrace-install-tool.s3.ap-east-1.amazonaws.com/install.sh | sudo bash -s -- deploy oss
```

That single command installs the `imbrace-installer` CLI and then runs the whole
deployment in four stages:

| Stage | What happens |
|---|---|
| `[1/4]` Install CLI | Downloads the CLI bundle to `/opt/imbrace-installer` and links it as `/usr/bin/imbrace-installer` |
| `[2/4]` Preflight | Checks CPU / RAM / free disk / CPU architecture / NVIDIA GPU |
| `[3/4]` Prepare host | Installs docker, kubectl, helm, **k3s**, Traefik (`:6868`) and Rancher |
| `[4/4]` Deploy | `helm upgrade --install` of the `imbrace-services-oss` chart into namespace `imbrace-services` |

### Host requirements

| | Minimum | Notes |
|---|---|---|
| CPU | 16 cores | `amd64` or `arm64` |
| RAM | 32 GB | 30 GB *available* if you self-host the LLM |
| Free disk on `/` | 20 GB | |
| GPU | optional | NVIDIA + ≥32 GB VRAM, only for the self-hosted `ai-vllm` (LLM/embedding) workloads. Without a GPU everything else deploys fine; the AI pods stay `Pending`. |

Add `--skip_preflight` to bypass the check (the deploy may then fail or run degraded):

```bash
curl -fsSL https://imbrace-install-tool.s3.ap-east-1.amazonaws.com/install.sh \
  | sudo bash -s -- deploy oss --skip_preflight
```

### What the installer asks

The deploy collects every answer up front, then runs unattended:

1. **Public host** — the IP or domain the browser will use (`IMBRACE_PUBLIC_HOST`).
2. **Email service** — Imbrace Mail Service (default) · built-in SMTP · AWS SES / Mailgun · skip.
3. **LLM / VLM provider** — self-host `ai-vllm` (needs a GPU) · an existing external vLLM URL · AWS Bedrock · skip.
4. **Embedding provider** (chat-ai RAG) — self-hosted `ai-vllm-embedding` subchart · external URL · reuse the chat vLLM.
5. **Super Admin** — seed organization + admin account (defaults to `admin@imbrace.co` / `ChangeMe@12345`; **change it**).
6. **Force Update** — optional systemd timer that re-runs `helm upgrade` every 5 min when a new chart version is published.

### Unattended install

Every prompt has an environment-variable equivalent; presetting one skips its question:

```bash
curl -fsSL https://imbrace-install-tool.s3.ap-east-1.amazonaws.com/install.sh | sudo \
  IMBRACE_PUBLIC_HOST=10.0.0.5 \
  IMBRACE_ADMIN_EMAIL=admin@example.com \
  IMBRACE_ADMIN_PASSWORD='<strong-password>' \
  IMBRACE_EMAIL_MODE=skip \
  IMBRACE_LLM_MODE=selfhost \
  IMBRACE_EMBEDDING_MODE=reuse \
  bash -s -- deploy oss
```

Common variables — run `sudo imbrace-installer --help` (or read the header of
`install.sh`) for the full list:

| Variable | Purpose |
|---|---|
| `IMBRACE_PUBLIC_HOST` | Browser-facing IP/domain |
| `IMBRACE_PUBLIC_SCHEME` | `http` (default) or `https` |
| `IMBRACE_ORG_NAME` | Seed organization name |
| `IMBRACE_ADMIN_EMAIL` / `IMBRACE_ADMIN_PASSWORD` | Super-admin credentials |
| `IMBRACE_EMAIL_MODE` | `imbrace` · `smtp` · `ses-mailgun` · `skip` |
| `IMBRACE_LLM_MODE` | `selfhost` · `external` · `bedrock` · `skip` |
| `IMBRACE_VLLM_URL` / `IMBRACE_VLLM_MODEL` | External vLLM endpoint (OpenAI-compatible) |
| `IMBRACE_EMBEDDING_MODE` | `subchart` · `external` · `reuse` |
| `IMBRACE_NAMESPACE` | Target namespace (default `imbrace-services`) |
| `IMBRACE_SKIP_PREFLIGHT=1` | Same as `--skip_preflight` |

### After the install

```
Dashboard   http://<host>:6868
Rancher     https://<host>:<auto-assigned NodePort>
Logs        http://<host>:36868          # Grafana
```

```bash
sudo kubectl get pods -n imbrace-services     # watch the rollout
sudo imbrace-installer version                # chart / app version
```

### Manage the deployment

```bash
# Install the CLI only, without deploying
curl -fsSL https://imbrace-install-tool.s3.ap-east-1.amazonaws.com/install.sh | sudo bash

sudo imbrace-installer gpu 590.48.01       # add NVIDIA driver + k8s device plugin later
sudo imbrace-installer force-update --setup   # enable the auto-upgrade timer
sudo imbrace-installer uninstall              # remove the release, KEEP the data (PVCs)
sudo imbrace-installer uninstall --remove-storage   # remove the release AND destroy data
```

> The one-liner deploys the **`oss`** edition (public images). `deploy lenovo` and
> `deploy standard` follow the same flow but pull commercial artifacts and require a
> registry token.

---

## License — please read first

IMbrace source is **dual-licensed**, split by file path:

| If a file path… | It is licensed under | Meaning |
|---|---|---|
| does **NOT** contain `.ee.` (the vast majority of the code) | [**Sustainable Use License v1.0**](LICENSE.md) | Source-available. You may use, copy, and modify it, subject to the usage limits in the license (e.g. no reselling it as a competing product). |
| **DOES** contain `.ee.` in its path (e.g. `x.ee.ts`, `packages/ee/…`) | [**Enterprise License**](LICENSE_EE.md) | Commercial feature. A paid IMbrace license is required to use it in production. |

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

## Contributing

We welcome contributions. Please read:

- [CONTRIBUTING.md](CONTRIBUTING.md) — how to set up, branch, and open a PR, and the
  **license boundary** you must respect.
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — the standards we hold each other to.

## Security

To report a vulnerability, please **do not** open a public issue — email
`security@imbrace.co` (see [SECURITY.md](SECURITY.md)).
