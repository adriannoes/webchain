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
  const page = {
    goto: mockGoto,
    url: mockUrl,
    title: mockTitle,
    content: mockContent,
    locator: vi.fn(() => ({
      first: () => ({
        click: mockClick,
        fill: mockFill,
      }),
    })),
  };
  const contextClose = vi.fn().mockResolvedValue(undefined);
  const context = {
    newPage: vi.fn(async () => page),
    close: contextClose,
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

  it("snapshots HTML with summarizeHtml", async () => {
    const { browser } = createMockBrowserTree();
    mockChromiumLaunch.mockResolvedValueOnce(browser);

    const rt = new BrowserRuntime({ headless: true });
    const { sessionId } = await rt.createSession();
    const snap = await rt.snapshot({ action: "snapshot", sessionId });
    expect(snap.htmlSnippet.length).toBeLessThanOrEqual(1600);
    await rt.shutdown();
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
