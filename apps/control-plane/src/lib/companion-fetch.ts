/**
 * Browser-side companion HTTP client with actionable errors for operators.
 * Env: NEXT_PUBLIC_COMPANION_URL, NEXT_PUBLIC_WEBCHAIN_LOCAL_TOKEN (see root README).
 */

export const COMPANION_TROUBLESHOOTING_LINES = [
  "Start the companion: `pnpm dev:companion` from the repo root.",
  "If it runs on another host/port, set `NEXT_PUBLIC_COMPANION_URL` in `.env` (default `http://127.0.0.1:8787`).",
  "For `POST /sessions` and `POST /commands`, `NEXT_PUBLIC_WEBCHAIN_LOCAL_TOKEN` must match the companion process `WEBCHAIN_LOCAL_TOKEN`.",
] as const;

export function formatUnreachableCompanion(companionUrl: string): string {
  return [
    `Cannot reach the companion at ${companionUrl}.`,
    "",
    ...COMPANION_TROUBLESHOOTING_LINES.map((line) => `• ${line}`),
  ].join("\n");
}

export function formatCompanionHttpError(
  status: number,
  bodyMessage: string,
  _companionUrl: string,
): string {
  if (status === 401) {
    return [
      bodyMessage || "Missing or invalid local token.",
      "",
      "Token mismatch: use the same value for `WEBCHAIN_LOCAL_TOKEN` (companion) and `NEXT_PUBLIC_WEBCHAIN_LOCAL_TOKEN` (control plane; restart `pnpm dev:web` after changing `.env`).",
    ].join("\n");
  }

  return (
    bodyMessage ||
    (status
      ? `Companion request failed with HTTP ${status}.`
      : "Companion request failed.")
  );
}

export function formatInvalidJsonResponse(
  status: number,
  companionUrl: string,
): string {
  return [
    `The companion at ${companionUrl} returned a non-JSON response (HTTP ${status}).`,
    "",
    ...COMPANION_TROUBLESHOOTING_LINES.map((line) => `• ${line}`),
  ].join("\n");
}

type JsonRecord = Record<string, unknown>;

function errorField(data: unknown): string | undefined {
  if (data && typeof data === "object" && "error" in data) {
    const err = (data as JsonRecord).error;
    if (typeof err === "string") {
      return err;
    }
    return JSON.stringify(err);
  }
  return undefined;
}

export async function fetchCompanionJson<T>(
  path: string,
  options: {
    method?: string;
    body?: string;
    companionUrl: string;
    localToken: string;
  },
): Promise<T> {
  const { companionUrl, localToken, method = "GET", body } = options;
  const url = `${companionUrl}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      body,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        "x-webchain-token": localToken,
      },
    });
  } catch (error) {
    console.error("[control-plane] Companion fetch failed:", error);
    throw new Error(formatUnreachableCompanion(companionUrl));
  }

  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      throw new Error(formatInvalidJsonResponse(response.status, companionUrl));
    }
  }

  if (!response.ok) {
    const bodyMessage =
      errorField(data) ??
      `Companion request failed with HTTP ${response.status}.`;
    throw new Error(
      formatCompanionHttpError(response.status, bodyMessage, companionUrl),
    );
  }

  return data as T;
}
