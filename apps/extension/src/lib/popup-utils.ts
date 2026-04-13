/**
 * Shared helpers for the extension popup (kept out of entrypoints for unit tests).
 */

export function formatPopupError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

/** Default companion origin; keep in sync with `WEBCHAIN_COMPANION_PORT` / `.env.example` (8787). */
export const DEFAULT_COMPANION_ORIGIN = "http://127.0.0.1:8787";

/** Unauthenticated health probe used by the popup (“Ping companion”). */
export function companionHealthUrl(): string {
  return `${DEFAULT_COMPANION_ORIGIN}/health`;
}

export const DEFAULT_CONTROL_PLANE_URL = "http://localhost:3000";
