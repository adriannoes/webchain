import cors from "@fastify/cors";
import {
  CompanionApiErrorBodySchema,
  CompanionHealthSchema,
  createTraceContext,
  RUNTIME_ACTIONS,
  RuntimeCommandSchema,
  type RuntimeErrorCode,
  SessionCreatedSchema,
  type TraceContext,
} from "@webchain/protocol";
import { type BrowserRuntime, isWebchainRuntimeError } from "@webchain/runtime";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { z } from "zod";

function httpStatusForRuntimeCode(code: RuntimeErrorCode): number {
  switch (code) {
    case "SESSION_NOT_FOUND":
      return 404;
    case "BROWSER_NOT_INSTALLED":
    case "BROWSER_LAUNCH_FAILED":
      return 503;
    case "COMMAND_FAILED":
      return 502;
  }
}

function sendRuntimeFailure(
  reply: FastifyReply,
  error: unknown,
  trace: TraceContext,
) {
  if (error instanceof z.ZodError) {
    const body = CompanionApiErrorBodySchema.parse({
      error: "Invalid request body.",
      trace,
      details: error.flatten(),
    });
    return reply.code(400).send(body);
  }

  if (isWebchainRuntimeError(error)) {
    const status = httpStatusForRuntimeCode(error.code);
    const body = CompanionApiErrorBodySchema.parse({
      error: error.message,
      trace,
      code: error.code,
    });
    return reply.code(status).send(body);
  }

  const body = CompanionApiErrorBodySchema.parse({
    error: error instanceof Error ? error.message : "Unknown runtime error.",
    trace,
  });
  return reply.code(500).send(body);
}

export type CreateCompanionAppOptions = {
  runtime: BrowserRuntime;
  localToken?: string;
  logger?: boolean;
};

export async function createCompanionApp(
  options: CreateCompanionAppOptions,
): Promise<{ app: FastifyInstance; localToken: string }> {
  const localToken =
    options.localToken ??
    process.env.WEBCHAIN_LOCAL_TOKEN ??
    "change-me-in-local-dev";

  const app = Fastify({ logger: options.logger ?? true });

  await app.register(cors, {
    origin(origin, callback) {
      if (
        !origin ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed."), false);
    },
  });

  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "GET" && request.url === "/health") {
      return;
    }

    const token = request.headers["x-webchain-token"];

    if (token !== localToken) {
      return reply.code(401).send({
        error: "Missing or invalid local token.",
      });
    }
  });

  app.get("/health", async () => {
    return CompanionHealthSchema.parse({
      status: "ok",
      service: "webchain-companion",
      version: "0.1.0",
      capabilities: [...RUNTIME_ACTIONS],
    });
  });

  app.post("/sessions", async (_request, reply) => {
    const trace = createTraceContext();
    try {
      const session = await options.runtime.createSession();
      return SessionCreatedSchema.parse(session);
    } catch (error) {
      return sendRuntimeFailure(reply, error, trace);
    }
  });

  app.post("/commands", async (request, reply) => {
    const trace = createTraceContext();
    try {
      const command = RuntimeCommandSchema.parse(request.body);
      const runtime = options.runtime;

      switch (command.action) {
        case "navigate":
          return { trace, result: await runtime.navigate(command) };
        case "snapshot":
          return { trace, result: await runtime.snapshot(command) };
        case "click":
          return { trace, result: await runtime.click(command) };
        case "type":
          return { trace, result: await runtime.type(command) };
        case "closeSession":
          return { trace, result: await runtime.closeSession(command) };
      }
    } catch (error) {
      return sendRuntimeFailure(reply, error, trace);
    }
  });

  return { app, localToken };
}
