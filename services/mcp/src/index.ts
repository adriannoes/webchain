import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { CompanionHttpClient } from "./companion-client.js";
import { executeMcpToolCall, getMcpToolDefinitions } from "./tool-runtime.js";

const baseUrl =
  process.env.WEBCHAIN_COMPANION_ORIGIN ?? "http://127.0.0.1:8787";
const token = process.env.WEBCHAIN_LOCAL_TOKEN ?? "change-me-in-local-dev";

const client = new CompanionHttpClient({ baseUrl, token });

try {
  await client.checkHealth();
} catch (error) {
  console.error(
    `[webchain-mcp] Companion not reachable at ${baseUrl}. Start the companion (e.g. pnpm dev:companion) and align WEBCHAIN_COMPANION_ORIGIN and WEBCHAIN_LOCAL_TOKEN with the daemon.`,
  );
  console.error(error);
  process.exit(1);
}

const server = new Server(
  {
    name: "webchain-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: getMcpToolDefinitions(),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return executeMcpToolCall(
    request.params.name,
    request.params.arguments ?? {},
    client,
  );
});

const transport = new StdioServerTransport();
await server.connect(transport);

const closeGracefully = () => {
  process.exit(0);
};

process.on("SIGINT", closeGracefully);
process.on("SIGTERM", closeGracefully);
