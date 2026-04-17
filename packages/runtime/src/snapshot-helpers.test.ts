import { afterEach, describe, expect, it, vi } from "vitest";
import { extractLandmarks, extractPageLinks } from "./snapshot-helpers.js";

describe("extractPageLinks", () => {
  it("maps anchors and trims text, skipping empty href", async () => {
    const page = {
      $$eval: vi.fn(
        async (
          _sel: string,
          fn: (anchors: unknown[], max: number) => unknown,
          max: number,
        ) =>
          fn(
            [
              { href: "https://a.test/x", textContent: "  hi  " },
              { href: "", textContent: "skip" },
            ],
            max,
          ),
      ),
    };
    const links = await extractPageLinks(page as never, 80);
    expect(links).toEqual([{ href: "https://a.test/x", text: "hi" }]);
    expect(page.$$eval).toHaveBeenCalledWith(
      "a[href]",
      expect.any(Function),
      80,
    );
  });

  it("stops at limit", async () => {
    const anchors = Array.from({ length: 5 }, (_, i) => ({
      href: `https://x.test/${i}`,
      textContent: `t${i}`,
    }));
    const page = {
      $$eval: vi.fn(
        async (
          _sel: string,
          fn: (a: unknown[], m: number) => unknown,
          m: number,
        ) => fn(anchors, m),
      ),
    };
    const links = await extractPageLinks(page as never, 2);
    expect(links).toHaveLength(2);
  });
});

describe("extractLandmarks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("collects roles when elements exist", async () => {
    const q = vi.fn((sel: string) => {
      if (sel.includes("main")) {
        return {
          getAttribute: (a: string) => (a === "aria-label" ? "Main" : null),
        };
      }
      if (sel.includes("navigation")) {
        return { getAttribute: () => null };
      }
      return null;
    });
    vi.stubGlobal("document", { querySelector: q });

    const page = {
      evaluate: <T>(fn: () => T) => Promise.resolve(fn()),
    };
    const lm = await extractLandmarks(page as never);
    expect(lm.find((x) => x.role === "main")).toEqual({
      role: "main",
      name: "Main",
    });
    expect(lm.find((x) => x.role === "navigation")).toEqual({
      role: "navigation",
    });
  });

  it("returns empty when no landmarks", async () => {
    vi.stubGlobal("document", { querySelector: vi.fn(() => null) });
    const page = { evaluate: <T>(fn: () => T) => Promise.resolve(fn()) };
    const lm = await extractLandmarks(page as never);
    expect(lm).toEqual([]);
  });
});
