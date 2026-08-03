# IMbrace — Open Source

Central hub for the open-source repositories that make up the **IMbrace** platform: an
AI-native workspace with agents, omnichannel conversations, data boards, document
intelligence, and workflow automation.

This repository is the **front door** to the project — it explains how the pieces fit
together, how they are licensed, and how to contribute. Each component lives in its own
repository (linked below).

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
| [imbrace-ai-chatbot](https://github.com/imbraceltd/imbrace-ai-chatbot) | Conversational AI chatbot UI | Next.js 15 · Vercel AI SDK |
| [chrome-extension](https://github.com/imbraceltd/chrome-extension) | Chat with your InsightIQ agents on any on-prem deployment | Chrome MV3 |

### Backend services
| Repo | Description | Stack |
|---|---|---|
| [platform](https://github.com/imbraceltd/platform) | Auth, organizations, users, teams, SSO, licensing | Hono · Drizzle · PostgreSQL |
| [app-gateway](https://github.com/imbraceltd/app-gateway) | API gateway / reverse proxy — auth, license verification, routing | Express |
| [ai-agent](https://github.com/imbraceltd/ai-agent) | AI agent runtime — tools, MCP, chat orchestration | Node · TypeScript |
| [chat-ai](https://github.com/imbraceltd/chat-ai) | AI chat service | — |
| [channel](https://github.com/imbraceltd/channel) | Omnichannel messaging & conversations | Node · TypeScript |
| [data_board](https://github.com/imbraceltd/data_board) | Data boards, CRM boards, knowledge & document boards | Hono · Drizzle · PostgreSQL |
| [file](https://github.com/imbraceltd/file) | File service — upload, storage, presigned URLs | Node · TypeScript |
| [marketplace](https://github.com/imbraceltd/marketplace) | App marketplace & templates | Node · TypeScript |
| [auth](https://github.com/imbraceltd/auth) | Authentication service | — |

### Workflow
| Repo | Description | Stack |
|---|---|---|
| [ap-workflow](https://github.com/imbraceltd/ap-workflow) | Workflow automation engine (ActivePieces-based) | TypeScript · React |

> The IMbrace SDK and CLI are intentionally **not** listed here — they are distributed as
> packages and tracked separately.

---

## Getting started

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
