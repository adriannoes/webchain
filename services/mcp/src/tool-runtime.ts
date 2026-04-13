import { NavigateArgsSchema, SessionIdArgsSchema } from "@webchain/protocol";
import type { BrowserRuntime } from "@webchain/runtime";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const createSessionInputSchema = z.object({}).strict();

const navigateInputJson = mcpToolInputSchema(NavigateArgsSchema);
const sessionIdInputJson = mcpToolInputSchema(SessionIdArgsSchema);
const createSessionInputJson = mcpToolInputSchema(createSessionInputSchema);

export function getMcpToolDefinitions() {
  return [
    {
      name: "create_session",
      description: "Create a new browser session owned by Webchain.",
      inputSchema: createSessionInputJson,
    },
    {
      name: "navigate",
      description: "Navigate an existing session to a URL.",
      inputSchema: navigateInputJson,
    },
    {
      name: "snapshot",
      description: "Capture a lightweight semantic snapshot from a session.",
      inputSchema: sessionIdInputJson,
    },
    {
      name: "close_session",
      description: "Close a browser session and release resources.",
      inputSchema: sessionIdInputJson,
    },
  ];
}

export async function executeMcpToolCall(
  name: string,
  rawArgs: unknown,
  runtime: BrowserRuntime,
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  try {
    switch (name) {
      case "create_session": {
        createSessionInputSchema.parse(rawArgs ?? {});
        const session = await runtime.createSession();
        return {
          content: [{ type: "text", text: JSON.stringify(session, null, 2) }],
        };
      }
      case "navigate": {
        const args = NavigateArgsSchema.parse(rawArgs ?? {});
        const result = await runtime.navigate({ action: "navigate", ...args });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }
      case "snapshot": {
        const args = SessionIdArgsSchema.parse(rawArgs ?? {});
        const result = await runtime.snapshot({ action: "snapshot", ...args });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }
      case "close_session": {
        const args = SessionIdArgsSchema.parse(rawArgs ?? {});
        const result = await runtime.closeSession({
          action: "closeSession",
          ...args,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }
      default:
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
        };
    }
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : "Unknown MCP error.",
        },
      ],
    };
  }
}

/** zod-to-json-schema is typed against Zod 3; object schemas are compatible at runtime with Zod 4. */
function mcpToolInputSchema(schema: z.ZodTypeAny) {
  const json = zodToJsonSchema(schema as never, {
    target: "jsonSchema7",
    $refStrategy: "none",
  }) as Record<string, unknown>;
  const { $schema: _schema, definitions: _defs, ...rest } = json;
  return rest;
}
