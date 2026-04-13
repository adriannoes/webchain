import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCompanionJson,
  formatCompanionHttpError,
  formatInvalidJsonResponse,
  formatUnreachableCompanion,
} from "./companion-fetch";

const baseOpts = {
  companionUrl: "http://127.0.0.1:8787",
  localToken: "tok",
} as const;

describe("formatUnreachableCompanion", () => {
  it("includes URL and bullet hints", () => {
    const msg = formatUnreachableCompanion("http://127.0.0.1:8787");
    expect(msg).toContain("127.0.0.1:8787");
    expect(msg).toContain("pnpm dev:companion");
    expect(msg).toContain("NEXT_PUBLIC_COMPANION_URL");
  });
});

describe("formatCompanionHttpError", () => {
  it("adds token hint for 401", () => {
    const msg = formatCompanionHttpError(
      401,
      "Missing or invalid local token.",
      "http://x",
    );
    expect(msg).toContain("Missing or invalid");
    expect(msg).toContain("WEBCHAIN_LOCAL_TOKEN");
    expect(msg).toContain("NEXT_PUBLIC_WEBCHAIN_LOCAL_TOKEN");
  });

  it("uses default 401 copy when body message is empty", () => {
    const msg = formatCompanionHttpError(401, "", "http://x");
    expect(msg).toContain("Missing or invalid local token");
  });

  it("returns body message for other statuses", () => {
    expect(formatCompanionHttpError(400, "Bad request", "http://x")).toBe(
      "Bad request",
    );
  });

  it("falls back to HTTP status text when body is empty", () => {
    expect(formatCompanionHttpError(503, "", "http://x")).toContain("503");
  });

  it("falls back when status is zero", () => {
    expect(formatCompanionHttpError(0, "", "http://x")).toBe(
      "Companion request failed.",
    );
  });
});

describe("formatInvalidJsonResponse", () => {
  it("mentions non-JSON and troubleshooting", () => {
    const msg = formatInvalidJsonResponse(502, "http://127.0.0.1:8787");
    expect(msg).toContain("non-JSON");
    expect(msg).toContain("502");
  });
});

describe("fetchCompanionJson", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ a: 1 }), { status: 200 }),
      ),
    );

    const data = await fetchCompanionJson<{ a: number }>("/health", baseOpts);
    expect(data.a).toBe(1);
  });

  it("throws when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("net down");
      }),
    );

    await expect(fetchCompanionJson("/health", baseOpts)).rejects.toThrow(
      /Cannot reach the companion/,
    );
  });

  it("throws on invalid JSON body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not-json", { status: 200 })),
    );

    await expect(fetchCompanionJson("/health", baseOpts)).rejects.toThrow(
      /non-JSON/,
    );
  });

  it("throws on error responses with string error field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "nope" }), { status: 500 }),
      ),
    );

    await expect(fetchCompanionJson("/x", baseOpts)).rejects.toThrow("nope");
  });

  it("throws on error responses with object error field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: 1 } }), { status: 500 }),
      ),
    );

    await expect(fetchCompanionJson("/x", baseOpts)).rejects.toThrow(
      /"code":1/,
    );
  });

  it("throws on error responses with non-string non-object error values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: null }), { status: 500 }),
      ),
    );

    await expect(fetchCompanionJson("/x", baseOpts)).rejects.toThrow("null");
  });

  it("handles error JSON without error field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "no error key" }), {
            status: 502,
          }),
      ),
    );

    await expect(fetchCompanionJson("/x", baseOpts)).rejects.toThrow(/502/);
  });

  it("sends JSON content-type for POST bodies", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchCompanionJson("/sessions", {
      ...baseOpts,
      method: "POST",
      body: "{}",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/sessions",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-webchain-token": "tok",
        }),
      }),
    );
  });
});
