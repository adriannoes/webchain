# Webchain

Webchain is a **runtime-first browser kernel for the agentic web**: a small execution layer that owns browser sessions, structured actions, and clear boundaries—so agents and operators can integrate without stuffing long-lived browsers into serverless hosts.

## What is Webchain?

Today, agent products need **real browser execution**, but the stack is often fragmented: chat-first AI browsers, ad-hoc automation scripts, or cloud APIs that do not fit **stateful, replayable, permissioned** agent workflows. **Serverless web hosting** is a poor place for long-running Playwright sessions; execution belongs **next to the user or on dedicated infrastructure**, while the **web app stays a control plane**.

Webchain’s bet is **open, neutral infrastructure** below the assistant layer and above raw automation:

- **Local or dedicated runtime** — The [`packages/runtime`](packages/runtime) Playwright-backed engine drives sessions; [`services/companion`](services/companion) exposes them over HTTP with a local token and structured errors.
- **MCP-native** — [`services/mcp`](services/mcp) surfaces the same capabilities as tools for agent frameworks.
- **Hosted control, not hosted browsers** — [`apps/control-plane`](apps/control-plane) (Next.js, Vercel-oriented) is for onboarding and operator UX; it talks to the companion instead of owning the browser process.
- **Bridge in the browser** — [`apps/extension`](apps/extension) helps validate the local companion and connect the loop.
- **ASAP-ready** — [`packages/adapters/asap`](packages/adapters/asap) maps runtime commands toward distributed orchestration semantics when you need them.

**What Webchain is not (by design):** a consumer browser with a chat sidebar, a single-vendor agent shell, or a place to run persistent browser farms inside Vercel functions.

**Who it’s for:** builders wiring **LangGraph, Agents SDK, CrewAI**, or custom stacks who want a **clear contract** (protocol schemas, health, commands) and a path from **local proof** toward **orchestrated** deployments.

For day-to-day repo conventions (scripts, packages, AI contributor notes), see **[`AGENTS.md`](AGENTS.md)**.

## Prerequisites

- **Node.js** 22.x or newer (`>=22` in root [`package.json`](package.json) `engines`).
- **pnpm** **10.30.3** — matches root `packageManager`; enable [Corepack](https://nodejs.org/api/corepack.html) (`corepack enable`) so the correct pnpm is used after clone.

## Why runtime-first

- MCP-native execution for agent frameworks and local runtimes.
- Lightweight browser integration through an extension plus a local companion.
- ASAP-ready gateway layer for orchestration, state, discovery, and future marketplace flows.
- Playwright-first runtime with CDP available as an escape hatch.

## Monorepo layout

- `apps/control-plane`: Next.js app for onboarding, session control, and operator UX.
- `apps/extension`: Chromium extension built with WXT.
- `services/companion`: local daemon that owns browser sessions and privileged actions.
- `services/mcp`: MCP server exposing the browser runtime as tools.
- `packages/protocol`: shared schemas, command contracts, and trace helpers.
- `packages/runtime`: Playwright-backed browser runtime.
- `packages/adapters/asap`: mapping layer from runtime commands to ASAP task semantics.

## Product and strategy docs

Extended strategy, ADRs, and PRDs are maintained in some contributor setups under a `product/` directory (not always shipped with this tree). This README and **[`AGENTS.md`](AGENTS.md)** describe how to build and run the code in this repository.

## Browser / integration (Phase 1)

Phase 1 in this codebase proves a reproducible **local browser loop**: **launch → session → navigate → snapshot → close**, with an integration test against the real companion HTTP API.

- **Runtime package:** [`packages/runtime`](packages/runtime) owns the Playwright dependency and browser sessions; install browsers against that package’s pinned Playwright version.
- **One-time Chromium install (local):** from the repo root:

  `pnpm --filter @webchain/runtime exec playwright install chromium`

- **Playwright docs:** [Installing browsers](https://playwright.dev/docs/browsers) (channels, CI, troubleshooting).

**Integration test (real browser):** after installing Chromium, run `pnpm test:integration` from the repo root: companion HTTP loop ([`services/companion`](services/companion)) **and** MCP stdio conformance ([`services/mcp`](services/mcp)). You can run only MCP conformance with `pnpm test:mcp-conformance`. Unit tests (`pnpm test`) stay fast and mostly mocked.

## MCP integrations (Phase 2)

The MCP server **delegates** to the companion over HTTP (see [ADR-0001](product/ADRs/0001-session-authority-boundary.md)). Start **`pnpm dev:companion`** before **`pnpm dev:mcp`**.

- **`WEBCHAIN_COMPANION_ORIGIN`** — default `http://127.0.0.1:8787` (see [`.env.example`](.env.example)).
- **`WEBCHAIN_LOCAL_TOKEN`** — must match the companion process.

Details: [`services/mcp/README.md`](services/mcp/README.md). Example integration notes for agent frameworks: [`examples/integrations/README.md`](examples/integrations/README.md).

**macOS vs Linux (Phase 1 baseline):** local development is primarily **macOS**; **Linux** (including GitHub `ubuntu-latest` CI) runs **headless Chromium** with Playwright’s defaults. If the browser is missing, the runtime reports a **`BROWSER_NOT_INSTALLED`**-style error with the install hint; sandbox-specific issues on some Linux setups are rare on hosted runners but can be diagnosed from Playwright logs.

## CI

Workflow: **CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

- **Triggers:** pushes to **`main`** and **pull requests**.
- **Runner:** **`ubuntu-latest`**, **Node 22**, **pnpm 10.30.3** (via `pnpm/action-setup`); `actions/setup-node` uses the **pnpm** cache for dependencies.
- **Steps:** checkout → `pnpm install --frozen-lockfile` → restore **`~/.cache/ms-playwright`** when cached → **`pnpm --filter @webchain/runtime exec playwright install chromium`** → `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm test:coverage` (Vitest **lines ≥ 90%** per package per FR11) → **`pnpm test:integration`** (real Chromium via companion) → `pnpm build`.
- **Channel:** Chromium, **headless** on Linux CI; baseline **OS** is `ubuntu-latest`.

## Linux and non-macOS development

Use the same commands as CI for parity: `pnpm install`, install Playwright Chromium (see **Browser / integration** above), then `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`, `pnpm test:integration`, and `pnpm build`. No macOS-only steps are required for those gates. For an environment close to CI, use Node 22 and pnpm 10.30.3 (see root `packageManager` and the workflow file); a plain Linux shell or a Node 22 container both work.

## First vertical slice

The initial slice focuses on a single loop:

1. `control-plane` asks the companion for health or a new session.
2. `companion` creates and manages a browser session.
3. `control-plane` issues `navigate` and `snapshot` commands.
4. `mcp` exposes the same runtime through MCP tooling.
5. `asap-adapter` translates runtime commands into ASAP-ready task payloads.

## Local development

1. Copy `.env.example` to `.env`.
2. Install dependencies: `pnpm install` (from the repo root).
3. Install Chromium for the runtime once — see **Browser / integration (Phase 1)** earlier in this file.
4. Start the local companion with `pnpm dev:companion`.
5. Start the control plane with `pnpm dev:web`.
6. Optionally run the extension with `pnpm dev:extension` (load unpacked from `apps/extension/.output/chrome-mv3`; companion must be up for **Ping companion** — see [`apps/extension/README.md`](apps/extension/README.md)).
7. Optionally run the MCP server with `pnpm dev:mcp` (requires the companion running — see **MCP integrations** above).

### Companion ↔ control plane (health)

The control plane (browser) calls the companion over HTTP:

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Health and advertised runtime capabilities (no token required). |
| `POST /sessions` | Create a session (`x-webchain-token` required). |
| `POST /commands` | Dispatch runtime commands (`x-webchain-token` required). |

**URLs and tokens**

- **`NEXT_PUBLIC_COMPANION_URL`** — Base URL the UI uses (default `http://127.0.0.1:8787`). Companion listens on **`WEBCHAIN_COMPANION_PORT`** (default `8787`).
- **`WEBCHAIN_LOCAL_TOKEN`** — Companion process secret; **`NEXT_PUBLIC_WEBCHAIN_LOCAL_TOKEN`** must match for protected routes (see [`.env.example`](.env.example)).

**CORS:** the companion allows `http://localhost:*` and `http://127.0.0.1:*` origins so the Next.js dev server can call it from the browser.

**Errors (sessions/commands):** Failed responses include JSON with `error`, a `trace` object (`traceId`, `runId`, `createdAt`) for correlation, and an optional machine-readable `code` when the runtime classified the failure (`SESSION_NOT_FOUND`, `COMMAND_FAILED`, `BROWSER_NOT_INSTALLED`, etc.). HTTP status reflects the class of failure (for example **404** / **502** / **503**).

**Verify:** With companion and `pnpm dev:web` running, use **Ping companion** on the home page; a healthy daemon returns JSON including `"status": "ok"`.

Details: [`apps/control-plane/README.md`](apps/control-plane/README.md); implementation: [`services/companion/src/index.ts`](services/companion/src/index.ts).

## Deployment split

- `apps/control-plane` is intended for Vercel.
- `services/companion` and `services/mcp` should run as local or dedicated Node services.
- Long-lived browser sessions should not live inside Vercel functions.

## ASAP integration strategy

Webchain uses `MCP` for local execution and `ASAP` for distributed orchestration.

The MVP direction is a stable `browser-gateway` agent that owns trust, registry, auth, observability, and state snapshots while the browser runtime stays behind that boundary.
