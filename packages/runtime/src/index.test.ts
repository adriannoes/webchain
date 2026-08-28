import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BrowserRuntime,
  shouldFallbackToWebkit,
  summarizeHtml,
} from "./index.js";

const mockChromiumLaunch = vi.fn();
const mockWebkitLaunch = vi.fn();

vi.mock("playwright", () => ({
  chromium: {
    launch: (opts: unknown) => mockChromiumLaunch(opts),
  },
  webkit: {
    launch: (opts: unknown) => mockWebkitLaunch(opts),
  },
}));

function createMockBrowserTree() {
  const mockClick = vi.fn().mockResolvedValue(undefined);
  const mockFill = vi.fn().mockResolvedValue(undefined);
  const mockGoto = vi.fn().mockResolvedValue(undefined);
  const mockUrl = vi.fn(() => "https://page.example/path");
  const mockTitle = vi.fn(() => Promise.resolve("Page title"));
  const mockContent = vi.fn(() =>
    Promise.resolve("  <html>  <body> x </body>  "),
  );
  const mockAriaSnapshot = vi.fn(() =>
    Promise.resolve('- heading "mock" [level=1]'),
  );
  const mockEvaluate = vi.fn((fn: unknown) => {
    if (typeof fn !== "function") {
      return Promise.resolve(undefined);
    }
    const src = Function.prototype.toString.call(fn);
    if (src.includes("innerText")) {
      return Promise.resolve("hello summary");
    }
    if (src.includes("querySelector") && src.includes("role")) {
      return Promise.resolve([]);
    }
    return Promise.resolve(undefined);
  });
  const mockEvalAnchors = vi.fn(
    async (
      _selector: string,
      pageFunction: (anchors: unknown[], max: number) => unknown,
      max: number,
    ) => pageFunction([], max),
  );
  const page = {
    goto: mockGoto,
    url: mockUrl,
    title: mockTitle,
    content: mockContent,
    evaluate: mockEvaluate,
    $$eval: mockEvalAnchors,
    locator: vi.fn(() => ({
      first: () => ({
        click: mockClick,
        fill: mockFill,
      }),
      ariaSnapshot: mockAriaSnapshot,
    })),
  };
  const contextClose = vi.fn().mockResolvedValue(undefined);
  const mockRoute = vi.fn().mockResolvedValue(undefined);
  const context = {
    newPage: vi.fn(async () => page),
    close: contextClose,
    route: mockRoute,
  };
  const browserClose = vi.fn().mockResolvedValue(undefined);
  const browser = {
    newContext: vi.fn(async () => context),
    close: browserClose,
  };
  return {
    browser,
    page,
    context,
    mockGoto,
    mockClick,
    mockFill,
    mockContent,
    mockUrl,
    mockRoute,
    contextClose,
    browserClose,
  };
}

describe("summarizeHtml", () => {
  it("compacts whitespace and respects the limit", () => {
    const summary = summarizeHtml("<div>  hello\n   world  </div>", 18);

    expect(summary).not.toContain("  ");
    expect(summary.length).toBeLessThanOrEqual(18);
  });
});

describe("shouldFallbackToWebkit", () => {
  it("returns true for missing Playwright browser executables", () => {
    const error = new Error("browserType.launch: Executable doesn't exist");

    expect(shouldFallbackToWebkit(error)).toBe(true);
  });

  it("returns false for generic launch errors", () => {
    const error = new Error("Target page, context or browser has been closed");

    expect(shouldFallbackToWebkit(error)).toBe(false);
  });
});

describe("BrowserRuntime", () => {
  beforeEach(() => {
    mockChromiumLaunch.mockReset();
    mockWebkitLaunch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a session and navigates", async () => {
    const { mockGoto, browser } = createMockBrowserTree();
    mockChromiumLaunch.mockResolvedValueOnce(browser);

    const rt = new BrowserRuntime({ headless: true });
    const session = await rt.createSession();
    expect(session.sessionId).toBeTruthy();

    const nav = await rt.navigate({
      action: "navigate",
      sessionId: session.sessionId,
      url: "https://example.com",
    });
    expect(mockGoto).toHaveBeenCalled();
    expect(nav.url).toContain("page.example");
    await rt.shutdown();
  });

  it("snapshots HTML with summarizeHtml and layered fields", async () => {
    const { browser } = createMockBrowserTree();
    mockChromiumLaunch.mockResolvedValueOnce(browser);

    const rt = new BrowserRuntime({ headless: true });
    const { sessionId } = await rt.createSession();
    const snap = await rt.snapshot({ action: "snapshot", sessionId });
    expect(snap.htmlSnippet.length).toBeLessThanOrEqual(1600);
    expect(snap.domSummary).toBe("hello summary");
    expect(snap.accessibilityTree).toBe('- heading "mock" [level=1]');
    expect(snap.links).toEqual([]);
    expect(snap.landmarks).toEqual([]);
    await rt.shutdown();
  });

  it("installs a session request guard on createSession", async () => {
    const { browser, mockRoute } = createMockBrowserTree();
    mockChromiumLaunch.mockResolvedValueOnce(browser);

    const rt = new BrowserRuntime({ headless: true });
    await rt.createSession();
    expect(mockRoute).toHaveBeenCalledWith("**/*", expect.any(Function));
    await rt.shutdown();
  });

  it("rejects click navigation onto a loopback url and restores the prior page", async () => {
    const tree = createMockBrowserTree();
    let currentUrl = "https://page.example/path";
    tree.mockUrl.mockImplementation(() => currentUrl);
    tree.mockClick.mockImplementation(async () => {
      currentUrl = "http://127.0.0.1:65500/secret";
    });
    tree.mockGoto.mockImplementation(async (url: string) => {
      currentUrl = url;
    });
    mockChromiumLaunch.mockResolvedValueOnce(tree.browser);

    const rt = new BrowserRuntime({ headless: true });
    try {
      const { sessionId } = await rt.createSession();
      await expect(
        rt.click({
          action: "click",
          sessionId,
          selector: "#to-internal",
        }),
      ).rejects.toMatchObject({
        code: "COMMAND_FAILED",
        message: expect.stringContaining("127.0.0.1:65500"),
      });
      expect(tree.mockGoto).toHaveBeenCalledWith("https://page.example/path", {
        waitUntil: "domcontentloaded",
      });
      expect(currentUrl).toBe("https://page.example/path");
    } finally {
      await rt.shutdown();
    }
  });

  it("does not snapshot a loopback page and restores about:blank", async () => {
    const tree = createMockBrowserTree();
    tree.mockUrl.mockReturnValue("http://127.0.0.1/secret");
    mockChromiumLaunch.mockResolvedValueOnce(tree.browser);

    const rt = new BrowserRuntime({ headless: true });
    try {
      const { sessionId } = await rt.createSession();
      await expect(
        rt.snapshot({ action: "snapshot", sessionId }),
      ).rejects.toMatchObject({
        code: "COMMAND_FAILED",
        message: expect.stringContaining("127.0.0.1"),
      });
      expect(tree.mockContent).not.toHaveBeenCalled();
      expect(tree.mockGoto).toHaveBeenCalledWith("about:blank", {
        waitUntil: "domcontentloaded",
      });
    } finally {
      await rt.shutdown();
    }
  });

  it("clicks and types", async () => {
    const { mockClick, mockFill, browser } = createMockBrowserTree();
    mockChromiumLaunch.mockResolvedValueOnce(browser);

    const rt = new BrowserRuntime({ headless: true });
    const { sessionId } = await rt.createSession();
    await rt.click({
      action: "click",
      sessionId,
      selector: "#btn",
    });
    await rt.type({
      action: "type",
      sessionId,
      selector: "#in",
      text: "hi",
    });
    expect(mockClick).toHaveBeenCalled();
    expect(mockFill).toHaveBeenCalled();
    await rt.shutdown();
  });

  it("throws for unknown session", async () => {
    const { browser } = createMockBrowserTree();
    mockChromiumLaunch.mockResolvedValueOnce(browser);

    const rt = new BrowserRuntime({ headless: true });
    await expect(
      rt.navigate({
        action: "navigate",
        sessionId: "missing",
        url: "https://example.com",
      }),
    ).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });
    await rt.shutdown();
  });

  it("maps page errors to COMMAND_FAILED", async () => {
    const { mockGoto, browser } = createMockBrowserTree();
    mockGoto.mockRejectedValueOnce(new Error("net::ERR_FAILED"));
    mockChromiumLaunch.mockResolvedValueOnce(browser);

    const rt = new BrowserRuntime({ headless: true });
    const { sessionId } = await rt.createSession();
    await expect(
      rt.navigate({
        action: "navigate",
        sessionId,
        url: "https://example.com",
      }),
    ).rejects.toMatchObject({
      code: "COMMAND_FAILED",
      message: "net::ERR_FAILED",
    });
    await rt.shutdown();
  });

  it("maps snapshot content errors to COMMAND_FAILED", async () => {
    const { browser, mockContent } = createMockBrowserTree();
    mockContent.mockRejectedValueOnce(new Error("content-boom"));
    mockChromiumLaunch.mockResolvedValueOnce(browser);

    const rt = new BrowserRuntime({ headless: true });
    try {
      const { sessionId } = await rt.createSession();
      await expect(
        rt.snapshot({ action: "snapshot", sessionId }),
      ).rejects.toMatchObject({
        code: "COMMAND_FAILED",
        message: "content-boom",
      });
    } finally {
      await rt.shutdown();
    }
  });

  it("maps click errors to COMMAND_FAILED", async () => {
    const { browser, mockClick } = createMockBrowserTree();
    mockClick.mockRejectedValueOnce(new Error("click-boom"));
    mockChromiumLaunch.mockResolvedValueOnce(browser);

    const rt = new BrowserRuntime({ headless: true });
    try {
      const { sessionId } = await rt.createSession();
      await expect(
        rt.click({
          action: "click",
          sessionId,
          selector: "#x",
        }),
      ).rejects.toMatchObject({
        code: "COMMAND_FAILED",
        message: "click-boom",
      });
    } finally {
      await rt.shutdown();
    }
  });

  it("maps type (fill) errors to COMMAND_FAILED", async () => {
    const { browser, mockFill } = createMockBrowserTree();
    mockFill.mockRejectedValueOnce(new Error("fill-boom"));
    mockChromiumLaunch.mockResolvedValueOnce(browser);

    const rt = new BrowserRuntime({ headless: true });
    try {
      const { sessionId } = await rt.createSession();
      await expect(
        rt.type({
          action: "type",
          sessionId,
          selector: "#x",
          text: "a",
        }),
      ).rejects.toMatchObject({
        code: "COMMAND_FAILED",
        message: "fill-boom",
      });
    } finally {
      await rt.shutdown();
    }
  });

  it("maps closeSession context errors to COMMAND_FAILED", async () => {
    const { browser, contextClose } = createMockBrowserTree();
    contextClose.mockRejectedValueOnce(new Error("close-boom"));
    mockChromiumLaunch.mockResolvedValueOnce(browser);

    const rt = new BrowserRuntime({ headless: true });
    try {
      const { sessionId } = await rt.createSession();
      await expect(
        rt.closeSession({ action: "closeSession", sessionId }),
      ).rejects.toMatchObject({
        code: "COMMAND_FAILED",
        message: "close-boom",
      });
    } finally {
      await rt.shutdown();
    }
  });

  it("closes a session and shuts down the browser", async () => {
    const { browser, contextClose, browserClose } = createMockBrowserTree();
    mockChromiumLaunch.mockResolvedValueOnce(browser);

    const rt = new BrowserRuntime({ headless: true });
    const { sessionId } = await rt.createSession();
    await rt.closeSession({ action: "closeSession", sessionId });
    expect(contextClose).toHaveBeenCalled();
    await rt.shutdown();
    expect(browserClose).toHaveBeenCalled();
  });

  it("falls back to webkit when Chromium is not installed", async () => {
    const { browser } = createMockBrowserTree();
    mockChromiumLaunch.mockRejectedValueOnce(
      new Error("browserType.launch: Executable doesn't exist"),
    );
    mockWebkitLaunch.mockResolvedValueOnce(browser);

    const rt = new BrowserRuntime({ headless: true });
    await rt.createSession();
    expect(mockWebkitLaunch).toHaveBeenCalled();
    await rt.shutdown();
  });

  it("wraps Chromium non-install failures as BROWSER_LAUNCH_FAILED", async () => {
    mockChromiumLaunch.mockRejectedValueOnce(new Error("other failure"));

    const rt = new BrowserRuntime({ headless: true });
    await expect(rt.createSession()).rejects.toMatchObject({
      code: "BROWSER_LAUNCH_FAILED",
      message: "other failure",
    });
  });
});
