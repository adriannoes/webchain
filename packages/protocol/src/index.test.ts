import { describe, expect, it } from "vitest";
import {
  ActionResultSchema,
  CloseSessionResultSchema,
  CompanionApiErrorBodySchema,
  CompanionHealthSchema,
  CompanionRuntimeErrorBodySchema,
  createTraceContext,
  isMutationCommand,
  NavigateArgsSchema,
  NavigateCommandSchema,
  RuntimeCommandSchema,
  RuntimeErrorCodeSchema,
  SessionCreatedSchema,
  SessionIdArgsSchema,
  SnapshotResultSchema,
} from "./index.js";

describe("RuntimeCommandSchema", () => {
  it("parses a valid navigate command", () => {
    const command = NavigateCommandSchema.parse({
      action: "navigate",
      sessionId: "session-1",
      url: "https://example.com",
    });

    expect(command.url).toBe("https://example.com");
  });

  it("marks mutation commands correctly", () => {
    expect(
      isMutationCommand({
        action: "click",
        sessionId: "session-1",
        selector: "#submit",
      }),
    ).toBe(true);

    expect(
      isMutationCommand({
        action: "snapshot",
        sessionId: "session-1",
      }),
    ).toBe(false);
  });

  it("creates stable trace metadata", () => {
    const trace = createTraceContext();

    expect(trace.traceId).toBeTruthy();
    expect(trace.runId).toBeTruthy();
    expect(trace.createdAt).toContain("T");
  });

  it("parses MCP-aligned navigate args without action discriminant", () => {
    const args = NavigateArgsSchema.parse({
      sessionId: "s1",
      url: "https://example.com",
    });

    expect(args.sessionId).toBe("s1");
    expect(args.url).toBe("https://example.com");
  });

  it("parses session-only args for snapshot and close_session tools", () => {
    const args = SessionIdArgsSchema.parse({ sessionId: "s1" });
    expect(args.sessionId).toBe("s1");
  });

  it("parses close-session results", () => {
    const result = CloseSessionResultSchema.parse({
      sessionId: "s1",
      closed: true,
    });
    expect(result.closed).toBe(true);
  });
});

describe("RuntimeCommandSchema", () => {
  it("accepts every runtime command shape", () => {
    const samples = [
      {
        action: "navigate" as const,
        sessionId: "s",
        url: "https://example.com",
      },
      { action: "snapshot" as const, sessionId: "s" },
      {
        action: "click" as const,
        sessionId: "s",
        selector: "#a",
      },
      {
        action: "type" as const,
        sessionId: "s",
        selector: "#a",
        text: "x",
      },
      { action: "closeSession" as const, sessionId: "s" },
    ];

    for (const body of samples) {
      const parsed = RuntimeCommandSchema.parse(body);
      expect(parsed.action).toBe(body.action);
    }
  });

  it("rejects invalid commands", () => {
    expect(() =>
      RuntimeCommandSchema.parse({ action: "navigate", sessionId: "" }),
    ).toThrow();
  });
});

describe("runtime error schemas", () => {
  it("parses companion runtime error bodies", () => {
    const body = CompanionRuntimeErrorBodySchema.parse({
      error: "msg",
      code: "SESSION_NOT_FOUND",
    });
    expect(body.code).toBe("SESSION_NOT_FOUND");

    expect(RuntimeErrorCodeSchema.safeParse("invalid").success).toBe(false);
  });

  it("parses companion API error bodies with trace", () => {
    const trace = createTraceContext();
    const parsed = CompanionApiErrorBodySchema.parse({
      error: "x",
      trace,
      code: "COMMAND_FAILED",
    });
    expect(parsed.trace.traceId).toBe(trace.traceId);
  });
});

describe("result and health schemas", () => {
  it("parses snapshot and action results", () => {
    SnapshotResultSchema.parse({
      sessionId: "s",
      url: "https://a.com",
      title: "t",
      htmlSnippet: "<p/>",
    });
    ActionResultSchema.parse({
      sessionId: "s",
      url: "https://a.com",
      title: "t",
    });
  });

  it("parses session created and companion health", () => {
    SessionCreatedSchema.parse({
      sessionId: "s",
      pageId: "p",
      createdAt: new Date().toISOString(),
    });
    CompanionHealthSchema.parse({
      status: "ok",
      service: "webchain-companion",
      version: "0.1.0",
      capabilities: ["navigate", "snapshot", "click", "type", "closeSession"],
    });
  });
});
