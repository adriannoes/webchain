import type { RuntimeErrorCode } from "@webchain/protocol";

const INSTALL_HINT =
  "Playwright browser binaries are missing. Run: pnpm --filter @webchain/runtime exec playwright install chromium";

export class WebchainRuntimeError extends Error {
  readonly code: RuntimeErrorCode;

  constructor(
    code: RuntimeErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "WebchainRuntimeError";
    this.code = code;
  }
}

export function isWebchainRuntimeError(
  error: unknown,
): error is WebchainRuntimeError {
  return error instanceof WebchainRuntimeError;
}

export function mapPlaywrightLaunchError(error: unknown): WebchainRuntimeError {
  if (isWebchainRuntimeError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  if (isExecutableMissingMessage(message)) {
    return new WebchainRuntimeError("BROWSER_NOT_INSTALLED", INSTALL_HINT, {
      cause: error,
    });
  }

  return new WebchainRuntimeError(
    "BROWSER_LAUNCH_FAILED",
    message || "Browser launch failed.",
    { cause: error },
  );
}

export function isExecutableMissingMessage(message: string) {
  return (
    message.includes("Executable doesn't exist") ||
    message.includes("Could not find browser")
  );
}

/** Maps Playwright / page errors from command paths to a stable companion-facing code. */
export function mapCommandFailure(error: unknown): WebchainRuntimeError {
  if (isWebchainRuntimeError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  return new WebchainRuntimeError(
    "COMMAND_FAILED",
    message || "Command failed.",
    { cause: error },
  );
}
