import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { BrowserRuntime } from "@webchain/runtime";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCompanionApp } from "./server.js";

const token = "integration-test-token";

async function serveHtml(
  html: string,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((_req, res) => {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(html);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${addr.port}/`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

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
    const sessionBody = JSON.parse(sessionRes.body) as {
      sessionId: string;
      trace: { traceId: string };
    };
    const { sessionId } = sessionBody;
    expect(sessionBody.trace.traceId.length).toBeGreaterThan(0);

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
      result: {
        htmlSnippet: string;
        title: string;
        accessibilityTree?: unknown;
        domSummary?: string;
      };
      trace: { traceId: string };
    };
    expect(snapBody.result.htmlSnippet.length).toBeGreaterThan(0);
    expect(snapBody.result.title.length).toBeGreaterThan(0);
    expect(snapBody.result.accessibilityTree).toBeDefined();
    expect(snapBody.trace.traceId.length).toBeGreaterThan(0);

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

  it("redacts password field values from snapshot output", async () => {
    const filledSecret = "SuperSecretPw!42";
    const staticSecret = "StaticAttrSecret99";
    const loginHtml = `<!doctype html><html><head><title>Login</title></head><body>
<label>Password <input id="pw" type="password"></label>
<input id="static-pw" type="password" value="${staticSecret}">
</body></html>`;
    const page = await serveHtml(loginHtml);

    try {
      const sessionRes = await app.inject({
        method: "POST",
        url: "/sessions",
        headers: { "x-webchain-token": token },
      });
      expect(sessionRes.statusCode).toBe(200);
      const { sessionId } = JSON.parse(sessionRes.body) as {
        sessionId: string;
      };

      const nav = await app.inject({
        method: "POST",
        url: "/commands",
        headers: { "x-webchain-token": token },
        payload: { action: "navigate", sessionId, url: page.url },
      });
      expect(nav.statusCode).toBe(200);

      const typed = await app.inject({
        method: "POST",
        url: "/commands",
        headers: { "x-webchain-token": token },
        payload: {
          action: "type",
          sessionId,
          selector: "#pw",
          text: filledSecret,
        },
      });
      expect(typed.statusCode).toBe(200);

      const snap = await app.inject({
        method: "POST",
        url: "/commands",
        headers: { "x-webchain-token": token },
        payload: { action: "snapshot", sessionId },
      });
      expect(snap.statusCode).toBe(200);
      expect(snap.body).not.toContain(filledSecret);
      expect(snap.body).not.toContain(staticSecret);

      await app.inject({
        method: "POST",
        url: "/commands",
        headers: { "x-webchain-token": token },
        payload: { action: "closeSession", sessionId },
      });
    } finally {
      await page.close();
    }
  });
});
