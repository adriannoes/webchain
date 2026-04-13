import type { BrowserRuntime } from "@webchain/runtime";
import { describe, expect, it, vi } from "vitest";
import { executeMcpToolCall, getMcpToolDefinitions } from "./tool-runtime.js";

function mockRuntime(): BrowserRuntime {
  return {
    createSession: vi.fn(async () => ({
      sessionId: "sid",
      pageId: "pid",
      createdAt: new Date().toISOString(),
    })),
    navigate: vi.fn(async (c) => ({
      sessionId: c.sessionId,
      url: "https://example.com",
      title: "t",
    })),
    snapshot: vi.fn(async (c) => ({
      sessionId: c.sessionId,
      url: "https://example.com",
      title: "t",
      htmlSnippet: "<p/>",
    })),
    closeSession: vi.fn(async (c) => ({
      sessionId: c.sessionId,
      closed: true as const,
    })),
    click: vi.fn(),
    type: vi.fn(),
    shutdown: vi.fn(),
  } as unknown as BrowserRuntime;
}

describe("getMcpToolDefinitions", () => {
  it("lists four tools with input schemas", () => {
    const tools = getMcpToolDefinitions();
    expect(tools.map((t) => t.name)).toEqual([
      "create_session",
      "navigate",
      "snapshot",
      "close_session",
    ]);
    for (const t of tools) {
      expect(t.inputSchema).toBeDefined();
      expect(typeof t.inputSchema).toBe("object");
    }
  });
});

describe("executeMcpToolCall", () => {
  it("rejects unknown tools", async () => {
    const out = await executeMcpToolCall("nope", {}, mockRuntime());
    expect(out.isError).toBe(true);
    expect(out.content[0]?.text).toContain("Unknown tool");
  });

  it("creates a session", async () => {
    const runtime = mockRuntime();
    const out = await executeMcpToolCall("create_session", {}, runtime);
    expect(out.isError).toBeUndefined();
    expect(runtime.createSession).toHaveBeenCalledOnce();
    expect(out.content[0]?.text).toContain("sessionId");
  });

  it("rejects extra keys on create_session", async () => {
    const out = await executeMcpToolCall(
      "create_session",
      { extra: 1 },
      mockRuntime(),
    );
    expect(out.isError).toBe(true);
  });

  it("navigates with valid args", async () => {
    const runtime = mockRuntime();
    const out = await executeMcpToolCall(
      "navigate",
      {
        sessionId: "s1",
        url: "https://example.com",
      },
      runtime,
    );
    expect(out.isError).toBeUndefined();
    expect(runtime.navigate).toHaveBeenCalled();
  });

  it("returns zod error text for bad navigate args", async () => {
    const out = await executeMcpToolCall(
      "navigate",
      { sessionId: "", url: "not-a-url" },
      mockRuntime(),
    );
    expect(out.isError).toBe(true);
  });

  it("snapshots and closes sessions", async () => {
    const runtime = mockRuntime();
    const snap = await executeMcpToolCall(
      "snapshot",
      { sessionId: "s1" },
      runtime,
    );
    expect(snap.isError).toBeUndefined();
    const closed = await executeMcpToolCall(
      "close_session",
      { sessionId: "s1" },
      runtime,
    );
    expect(closed.isError).toBeUndefined();
  });
});
