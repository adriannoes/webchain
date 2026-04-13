# Control plane (`@webchain/control-plane`)

Next.js operator UI. In local development it talks **directly from the browser** to the **companion** HTTP API (same machine by default).

## Environment (browser / build-time)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_COMPANION_URL` | Companion base URL (default `http://127.0.0.1:8787`). |
| `NEXT_PUBLIC_WEBCHAIN_LOCAL_TOKEN` | Must match the companion `WEBCHAIN_LOCAL_TOKEN` for `POST /sessions` and `POST /commands`. |

Copy root [`.env.example`](../../.env.example) to `.env` and adjust. Restart `pnpm dev:web` after changing public env vars.

## Companion endpoints used by this app

| Method | Path | Auth | Role |
| --- | --- | --- | --- |
| `GET` | `/health` | None (token header ignored) | Liveness + capabilities |
| `POST` | `/sessions` | `x-webchain-token` | Create browser session |
| `POST` | `/commands` | `x-webchain-token` | Runtime commands (`navigate`, `snapshot`, …) |

Implementation: [`../../services/companion/src/index.ts`](../../services/companion/src/index.ts).

## CORS

The companion allows origins on `http://localhost:*` and `http://127.0.0.1:*` so the control plane dev server can call it from the browser.

## Run locally

From repo root: `pnpm dev:web` (this app) and `pnpm dev:companion` (daemon). Then open the printed URL (default `http://127.0.0.1:3000`) and use **Ping companion**; a healthy companion returns JSON with `status: "ok"`.
