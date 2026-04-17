import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { createCompanionApp } from "@webchain/companion/server";
import { BrowserRuntime } from "@webchain/runtime";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const token = "mcp-conformance-token";
const mcpPackageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("MCP stdio conformance (real companion + Chromium)", () => {
  let app: FastifyInstance;
  let runtime: BrowserRuntime;
  let companionPort: number;
  let client: Client;
  let stdioTransport: StdioClientTransport;

  beforeAll(async () => {
    runtime = new BrowserRuntime({ headless: true });
    const { app: companion } = await createCompanionApp({
      runtime,
      localToken: token,
      logger: false,
    });
    app = companion;
    await app.listen({ host: "127.0.0.1", port: 0 });
    const addr = app.server.address();
    companionPort =
      typeof addr === "object" && addr && "port" in addr ? addr.port : 8787;

    stdioTransport = new StdioClientTransport({
      command: "pnpm",
      args: ["exec", "tsx", "src/index.ts"],
      cwd: mcpPackageRoot,
      env: {
        ...getDefaultEnvironment(),
        WEBCHAIN_COMPANION_ORIGIN: `http://127.0.0.1:${companionPort}`,
        WEBCHAIN_LOCAL_TOKEN: token,
      },
      stderr: "pipe",
    });

    client = new Client({ name: "webchain-mcp-conformance", version: "0.0.1" });
    await client.connect(stdioTransport);
  });

  afterAll(async () => {
    await stdioTransport.close();
    await runtime.shutdown();
    await app.close();
  });

  it("lists tools and runs create_session → navigate → snapshot → type → click → close_session", async () => {
    const { tools } = await client.listTools();
    const names = tools?.map((t) => t.name).sort() ?? [];
    expect(names).toEqual([
      "click",
      "close_session",
      "create_session",
      "navigate",
      "snapshot",
      "type",
    ]);

    const created = await client.callTool({
      name: "create_session",
      arguments: {},
    });
    expect(created.isError).not.toBe(true);
    const createdText =
      created.content?.find((c) => c.type === "text")?.text ?? "{}";
    const session = JSON.parse(createdText) as {
      sessionId: string;
      trace: { traceId: string };
    };
    expect(session.sessionId.length).toBeGreaterThan(0);
    expect(session.trace.traceId.length).toBeGreaterThan(0);

    const html =
      '<!DOCTYPE html><html><body><input id="t" type="text" /><p id="p">x</p></body></html>';
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

    const nav = await client.callTool({
      name: "navigate",
      arguments: { sessionId: session.sessionId, url: dataUrl },
    });
    expect(nav.isError).not.toBe(true);

    const snap = await client.callTool({
      name: "snapshot",
      arguments: { sessionId: session.sessionId },
    });
    expect(snap.isError).not.toBe(true);
    const snapText = snap.content?.find((c) => c.type === "text")?.text ?? "";
    const snapJson = JSON.parse(snapText) as {
      result: {
        htmlSnippet?: string;
        accessibilityTree?: unknown;
        domSummary?: string;
        traceId?: string;
      };
    };
    expect(snapJson.result.htmlSnippet?.length).toBeGreaterThan(0);
    expect(snapJson.result.traceId?.length).toBeGreaterThan(0);
    // data: URLs may omit an accessibility tree in some Chromium builds; require html + correlation + layered hint.
    expect(
      snapJson.result.accessibilityTree != null ||
        (snapJson.result.domSummary != null &&
          snapJson.result.domSummary.length > 0),
    ).toBe(true);

    const typed = await client.callTool({
      name: "type",
      arguments: {
        sessionId: session.sessionId,
        selector: "#t",
        text: "hello",
      },
    });
    expect(typed.isError).not.toBe(true);

    const clicked = await client.callTool({
      name: "click",
      arguments: { sessionId: session.sessionId, selector: "#p" },
    });
    expect(clicked.isError).not.toBe(true);

    const closed = await client.callTool({
      name: "close_session",
      arguments: { sessionId: session.sessionId },
    });
    expect(closed.isError).not.toBe(true);
  });
});
