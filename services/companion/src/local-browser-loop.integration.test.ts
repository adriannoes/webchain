import { BrowserRuntime } from "@webchain/runtime";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCompanionApp } from "./server.js";

const token = "integration-test-token";

describe("local browser loop (integration)", () => {
  let app: FastifyInstance;
  let runtime: BrowserRuntime;

  beforeAll(async () => {
    runtime = new BrowserRuntime({ headless: true });
    const { app: companion } = await createCompanionApp({
      runtime,
      localToken: token,
      logger: false,
    });
    app = companion;
  });

  afterAll(async () => {
    await runtime.shutdown();
    await app.close();
  });

  it("GET /health → POST /sessions → navigate → snapshot → closeSession", async () => {
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);

    const sessionRes = await app.inject({
      method: "POST",
      url: "/sessions",
      headers: { "x-webchain-token": token },
    });
    expect(sessionRes.statusCode).toBe(200);
    const { sessionId } = JSON.parse(sessionRes.body) as { sessionId: string };

    const nav = await app.inject({
      method: "POST",
      url: "/commands",
      headers: { "x-webchain-token": token },
      payload: {
        action: "navigate",
        sessionId,
        url: "https://example.com",
      },
    });
    expect(nav.statusCode).toBe(200);

    const snap = await app.inject({
      method: "POST",
      url: "/commands",
      headers: { "x-webchain-token": token },
      payload: { action: "snapshot", sessionId },
    });
    expect(snap.statusCode).toBe(200);
    const snapBody = JSON.parse(snap.body) as {
      result: { htmlSnippet: string; title: string };
    };
    expect(snapBody.result.htmlSnippet.length).toBeGreaterThan(0);
    expect(snapBody.result.title.length).toBeGreaterThan(0);

    const close = await app.inject({
      method: "POST",
      url: "/commands",
      headers: { "x-webchain-token": token },
      payload: { action: "closeSession", sessionId },
    });
    expect(close.statusCode).toBe(200);

    const closeAgain = await app.inject({
      method: "POST",
      url: "/commands",
      headers: { "x-webchain-token": token },
      payload: { action: "closeSession", sessionId },
    });
    expect(closeAgain.statusCode).toBe(404);
    const errBody = JSON.parse(closeAgain.body) as {
      code: string;
      trace: { traceId: string };
    };
    expect(errBody.code).toBe("SESSION_NOT_FOUND");
    expect(errBody.trace.traceId.length).toBeGreaterThan(0);
  });
});
