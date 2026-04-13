# Webchain browser extension

Chromium (MV3) extension built with [WXT](https://wxt.dev/). It provides a small **popup** to validate connectivity to the **local companion** and open the control plane.

## Prerequisites

Same as the monorepo root: **Node.js ≥22**, **pnpm** (see root [`README.md`](../../README.md) and [`package.json`](../../package.json)).

## Install and run (development)

From the **repository root**:

1. `pnpm install`
2. Start the companion (required for “Ping companion” to succeed): `pnpm dev:companion`
3. In another terminal, start the extension dev build: `pnpm dev:extension`

WXT writes an unpacked MV3 build under **`apps/extension/.output/chrome-mv3`**.

### Load unpacked in Chromium

1. Open `chrome://extensions` (or Edge: `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `apps/extension/.output/chrome-mv3` directory.

After code changes, use **Reload** on the extension card (or let WXT rebuild and reload as configured).

### Production-like build

From the repo root:

`pnpm --filter @webchain/extension build`

Then load unpacked from the same `.output/chrome-mv3` path (or pack with `pnpm --filter @webchain/extension zip` if you use WXT’s zip output).

## Extension ↔ companion handshake

The companion listens on **`http://127.0.0.1:8787`** by default (`WEBCHAIN_COMPANION_PORT` in [`.env.example`](../../.env.example)). The popup’s **Ping companion** action calls **`GET /health`** on that origin. **Health does not require a token.**

| Item | Value |
| --- | --- |
| Default base URL | `http://127.0.0.1:8787` |
| Health (popup uses this) | `GET http://127.0.0.1:8787/health` |
| Protected routes | `POST /sessions`, `POST /commands` — header `x-webchain-token` must match the companion’s `WEBCHAIN_LOCAL_TOKEN` |

**Healthy response:** JSON parsed by the companion includes `"status": "ok"` and `"service": "webchain-companion"` (see `@webchain/protocol` `CompanionHealthSchema`).

**If Ping fails:** ensure the companion is running (`pnpm dev:companion`), nothing else is bound to port **8787**, and the extension’s **host permissions** include `http://127.0.0.1/*` (already declared in `wxt.config.ts`).

**Control plane:** the popup’s **Open control plane** uses `http://localhost:3000` by default (`DEFAULT_CONTROL_PLANE_URL` in `src/lib/popup-utils.ts`), matching typical `pnpm dev:web`.

## Manual verification checklist

For Phase 1 closure (**FR5** / **P1-B5**), use the signed checklist: [`engineering/tasks/checklist-extension-companion-handshake.md`](../../engineering/tasks/checklist-extension-companion-handshake.md).

## Tests

`pnpm --filter @webchain/extension test`

Coverage: `pnpm --filter @webchain/extension test:coverage`
