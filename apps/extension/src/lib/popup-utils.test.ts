import { describe, expect, it } from "vitest";
import {
  companionHealthUrl,
  DEFAULT_COMPANION_ORIGIN,
  DEFAULT_CONTROL_PLANE_URL,
  formatPopupError,
} from "./popup-utils.js";

describe("formatPopupError", () => {
  it("returns message for Error instances", () => {
    expect(formatPopupError(new Error("fail"))).toBe("fail");
  });

  it("falls back for non-errors", () => {
    expect(formatPopupError(null)).toBe("Unknown error");
  });
});

describe("DEFAULT_CONTROL_PLANE_URL", () => {
  it("is a localhost control plane URL", () => {
    expect(DEFAULT_CONTROL_PLANE_URL).toMatch(/^http:\/\/localhost:\d+/);
  });
});

describe("companion handshake defaults", () => {
  it("uses 127.0.0.1 and default companion port from env example", () => {
    expect(DEFAULT_COMPANION_ORIGIN).toBe("http://127.0.0.1:8787");
  });

  it("exposes health URL without auth token path segment", () => {
    expect(companionHealthUrl()).toBe("http://127.0.0.1:8787/health");
  });
});
