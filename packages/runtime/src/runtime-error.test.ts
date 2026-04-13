import { describe, expect, it } from "vitest";
import {
  isExecutableMissingMessage,
  mapCommandFailure,
  mapPlaywrightLaunchError,
  WebchainRuntimeError,
} from "./runtime-error.js";

describe("mapPlaywrightLaunchError", () => {
  it("maps missing executable messages to BROWSER_NOT_INSTALLED", () => {
    const err = mapPlaywrightLaunchError(
      new Error("browserType.launch: Executable doesn't exist for chromium"),
    );

    expect(err.code).toBe("BROWSER_NOT_INSTALLED");
    expect(err.message).toContain("playwright install chromium");
  });

  it("passes through WebchainRuntimeError", () => {
    const original = new WebchainRuntimeError("SESSION_NOT_FOUND", "nope");
    expect(mapPlaywrightLaunchError(original)).toBe(original);
  });

  it("maps other launch failures to BROWSER_LAUNCH_FAILED", () => {
    const err = mapPlaywrightLaunchError(new Error("other failure"));
    expect(err.code).toBe("BROWSER_LAUNCH_FAILED");
    expect(err.message).toBe("other failure");
  });
});

describe("mapCommandFailure", () => {
  it("passes through WebchainRuntimeError", () => {
    const inner = new WebchainRuntimeError("SESSION_NOT_FOUND", "gone");
    expect(mapCommandFailure(inner)).toBe(inner);
  });

  it("wraps unknown errors as COMMAND_FAILED", () => {
    const err = mapCommandFailure(new Error("click timed out"));
    expect(err.code).toBe("COMMAND_FAILED");
    expect(err.message).toContain("timed out");
  });
});

describe("isExecutableMissingMessage", () => {
  it("detects Playwright missing-browser wording", () => {
    expect(
      isExecutableMissingMessage(
        "browserType.launch: Executable doesn't exist at /path",
      ),
    ).toBe(true);
    expect(isExecutableMissingMessage("Could not find browser")).toBe(true);
    expect(isExecutableMissingMessage("random")).toBe(false);
  });
});
