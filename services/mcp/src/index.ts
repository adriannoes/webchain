import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { BrowserRuntime } from "@webchain/runtime";
import { executeMcpToolCall, getMcpToolDefinitions } from "./tool-runtime.js";

const runtime = new BrowserRuntime({
  headless: process.env.WEBCHAIN_HEADLESS !== "false",
});

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
    runtime,
  );
});

const transport = new StdioServerTransport();
await server.connect(transport);

const closeGracefully = async () => {
  await runtime.shutdown();
  process.exit(0);
};

process.on("SIGINT", closeGracefully);
process.on("SIGTERM", closeGracefully);
