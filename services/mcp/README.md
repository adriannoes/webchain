# Webchain MCP server (`@webchain/mcp`)

Stdio MCP server that exposes the local [`@webchain/runtime`](../../packages/runtime) to agent frameworks. Tool names and arguments are validated with the same Zod schemas as [`@webchain/protocol`](../../packages/protocol) (`NavigateArgsSchema`, `SessionIdArgsSchema`, etc.).

## Tools (exported)

| MCP tool | Purpose |
| --- | --- |
| `create_session` | Create a browser session (`BrowserRuntime#createSession`). |
| `navigate` | Navigate the session to a URL (`#navigate`). |
| `snapshot` | Capture page snapshot (`#snapshot`). |
| `close_session` | Close the session (`#closeSession`). |

Phase 0 intentionally does **not** expose `click` or `type` as MCP tools; use the companion HTTP API (`POST /commands` with `RuntimeCommandSchema`) for the full command surface.

## Capability matrix: MCP vs runtime vs ASAP

| Command / action | `@webchain/protocol` | `BrowserRuntime` | MCP tools | `packages/adapters/asap` |
| --- | --- | --- | --- | --- |
| Create session | `SessionCreatedSchema` | `createSession()` | `create_session` | — (local execution primitive; not an ASAP skill id) |
| Navigate | `navigate` | `navigate()` | `navigate` | Skill `browse_page` (`supportedActions`: `navigate`, `snapshot`) |
| Snapshot | `snapshot` | `snapshot()` | `snapshot` | Skills `browse_page`, `capture_artifact` |
| Click | `click` | `click()` | — (Phase 0) | Skill `perform_flow` (`click`, `type`) |
| Type | `type` | `type()` | — (Phase 0) | Skill `perform_flow` |
| Close session | `closeSession` | `closeSession()` | `close_session` | Skill `capture_artifact` (`snapshot`, `closeSession`) |

ASAP remains a **strategic** mapping layer (skill ids `browse_page`, `perform_flow`, `capture_artifact`); it is not a full distributed browser gateway in Phase 0.

## Run locally

From the repo root (see root `README.md`):

```bash
pnpm dev:mcp
```

Optional: `WEBCHAIN_HEADLESS=false` to run headed Chromium/WebKit.
