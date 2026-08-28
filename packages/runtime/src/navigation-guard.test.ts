import { describe, expect, it, vi } from "vitest";
import {
  assertAllowedPageUrl,
  blockedPageUrlError,
  enforceAllowedPageUrl,
  installSessionRequestGuard,
  isIdleBrowserUrl,
  restoreAllowedPageUrl,
  shouldAllowSessionRequest,
} from "./navigation-guard.js";

describe("isIdleBrowserUrl", () => {
  it("accepts about:blank only", () => {
    expect(isIdleBrowserUrl("about:blank")).toBe(true);
    expect(isIdleBrowserUrl("about:blank?foo")).toBe(true);
    expect(isIdleBrowserUrl("https://example.com")).toBe(false);
  });
});

describe("assertAllowedPageUrl", () => {
  it("allows about:blank, data, and public http(s)", () => {
    expect(() => assertAllowedPageUrl("about:blank")).not.toThrow();
    expect(() => assertAllowedPageUrl("data:text/html,hi")).not.toThrow();
    expect(() => assertAllowedPageUrl("https://example.com")).not.toThrow();
  });

  it("rejects loopback after a click-driven navigation", () => {
    expect(() => assertAllowedPageUrl("http://127.0.0.1/secret")).toThrow(
      "not allowed",
    );
  });
});

describe("shouldAllowSessionRequest", () => {
  it("allows public http, data, blob, and about", () => {
    expect(shouldAllowSessionRequest("https://cdn.example/app.js")).toBe(true);
    expect(shouldAllowSessionRequest("data:text/plain,hi")).toBe(true);
    expect(shouldAllowSessionRequest("blob:https://example.com/uuid")).toBe(
      true,
    );
    expect(shouldAllowSessionRequest("about:blank")).toBe(true);
  });

  it("blocks file and internal http targets", () => {
    expect(shouldAllowSessionRequest("file:///etc/passwd")).toBe(false);
    expect(shouldAllowSessionRequest("http://127.0.0.1/secret")).toBe(false);
    expect(shouldAllowSessionRequest("not a url")).toBe(false);
  });
});

describe("installSessionRequestGuard", () => {
  it("continues allowed requests and aborts internal ones", async () => {
    const continueFn = vi.fn().mockResolvedValue(undefined);
    const abort = vi.fn().mockResolvedValue(undefined);
    let handler:
      | ((route: {
          request: () => { url: () => string };
          continue: () => Promise<void>;
          abort: (reason: string) => Promise<void>;
        }) => unknown)
      | undefined;
    const context = {
      route: vi.fn(async (_pattern: string, routeHandler: typeof handler) => {
        handler = routeHandler;
      }),
    };

    await installSessionRequestGuard(context as never);
    expect(handler).toBeDefined();
    if (handler === undefined) {
      throw new Error("expected route handler");
    }

    await handler({
      request: () => ({ url: () => "https://example.com/index.html" }),
      continue: continueFn,
      abort,
    });
    expect(continueFn).toHaveBeenCalledTimes(1);
    expect(abort).not.toHaveBeenCalled();

    await handler({
      request: () => ({ url: () => "http://127.0.0.1/secret" }),
      continue: continueFn,
      abort,
    });
    expect(abort).toHaveBeenCalledWith("blockedbyclient");
    expect(continueFn).toHaveBeenCalledTimes(1);
  });
});

describe("blockedPageUrlError", () => {
  it("includes the host and uses COMMAND_FAILED", () => {
    const err = blockedPageUrlError("http://127.0.0.1:9/secret?token=1");
    expect(err.code).toBe("COMMAND_FAILED");
    expect(err.message).toContain("127.0.0.1:9");
    expect(err.message).not.toContain("token=1");
  });

  it("uses a fallback host label for unparseable urls", () => {
    const err = blockedPageUrlError("::");
    expect(err.message).toContain("invalid-url");
  });
});

describe("restoreAllowedPageUrl", () => {
  it("goes back to a public previous url", async () => {
    const goto = vi.fn().mockResolvedValue(undefined);
    const page = {
      url: () => "http://127.0.0.1/secret",
      goto,
    };
    await restoreAllowedPageUrl(page as never, "https://page.example/path");
    expect(goto).toHaveBeenCalledWith("https://page.example/path", {
      waitUntil: "domcontentloaded",
    });
  });

  it("falls back to about:blank when previous url is also blocked", async () => {
    const goto = vi.fn().mockResolvedValue(undefined);
    const page = {
      url: () => "http://127.0.0.1/secret",
      goto,
    };
    await restoreAllowedPageUrl(page as never, "http://192.168.0.1/");
    expect(goto).toHaveBeenCalledWith("about:blank", {
      waitUntil: "domcontentloaded",
    });
  });

  it("skips goto when already on the restore target", async () => {
    const goto = vi.fn();
    await restoreAllowedPageUrl(
      { url: () => "https://page.example/path", goto } as never,
      "https://page.example/path",
    );
    expect(goto).not.toHaveBeenCalled();
  });

  it("falls back to about:blank when restore goto fails", async () => {
    const goto = vi
      .fn()
      .mockRejectedValueOnce(new Error("nav fail"))
      .mockResolvedValueOnce(undefined);
    await restoreAllowedPageUrl(
      { url: () => "http://127.0.0.1/secret", goto } as never,
      "https://page.example/path",
    );
    expect(goto).toHaveBeenNthCalledWith(2, "about:blank", {
      waitUntil: "domcontentloaded",
    });
  });
});

describe("enforceAllowedPageUrl", () => {
  it("is a no-op on a public url", async () => {
    const goto = vi.fn();
    await enforceAllowedPageUrl(
      { url: () => "https://example.com", goto } as never,
      "about:blank",
    );
    expect(goto).not.toHaveBeenCalled();
  });

  it("restores and throws on a loopback url", async () => {
    const goto = vi.fn().mockResolvedValue(undefined);
    await expect(
      enforceAllowedPageUrl(
        { url: () => "http://127.0.0.1/secret", goto } as never,
        "https://page.example/",
      ),
    ).rejects.toMatchObject({
      code: "COMMAND_FAILED",
      message: expect.stringContaining("127.0.0.1"),
    });
    expect(goto).toHaveBeenCalled();
  });
});
