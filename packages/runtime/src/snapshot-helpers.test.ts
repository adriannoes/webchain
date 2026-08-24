import { afterEach, describe, expect, it, vi } from "vitest";
import {
  backupAndBlankPasswordFieldsInPage,
  extractLandmarks,
  extractPageLinks,
  PASSWORD_FIELD_SELECTOR,
  restorePasswordFieldsInPage,
  withPasswordFieldsRedacted,
} from "./snapshot-helpers.js";

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

function makePasswordInput(value: string, attrValue: string | null) {
  let attr = attrValue;
  return {
    value,
    getAttribute: (name: string) => (name === "value" ? attr : null),
    setAttribute: (name: string, next: string) => {
      if (name === "value") {
        attr = next;
      }
    },
    removeAttribute: (name: string) => {
      if (name === "value") {
        attr = null;
      }
    },
  };
}

describe("password snapshot redaction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("targets password and autocomplete password fields", () => {
    expect(PASSWORD_FIELD_SELECTOR).toContain('input[type="password"]');
    expect(PASSWORD_FIELD_SELECTOR).toContain("current-password");
    expect(PASSWORD_FIELD_SELECTOR).toContain("new-password");
    expect(PASSWORD_FIELD_SELECTOR).toContain("one-time-password");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blanks matching inputs and restores value plus attribute", () => {
    const pw = makePasswordInput("secret", "secret");
    vi.stubGlobal("document", {
      querySelectorAll: () => [pw],
    });

    const backups = backupAndBlankPasswordFieldsInPage();
    expect(pw.value).toBe("");
    expect(pw.getAttribute("value")).toBeNull();
    restorePasswordFieldsInPage(backups);
    expect(pw.value).toBe("secret");
    expect(pw.getAttribute("value")).toBe("secret");
  });

  it("blanks during capture and restores afterward", async () => {
    const pw = makePasswordInput("typed-secret", null);
    vi.stubGlobal("document", {
      querySelectorAll: () => [pw],
    });
    const page = {
      evaluate: (fn: (...args: never[]) => unknown, arg?: unknown) =>
        Promise.resolve(arg === undefined ? fn() : fn(arg as never)),
    };

    await withPasswordFieldsRedacted(page as never, async () => {
      expect(pw.value).toBe("");
      expect(pw.getAttribute("value")).toBeNull();
    });
    expect(pw.value).toBe("typed-secret");
  });

  it("restores fields when capture throws", async () => {
    const pw = makePasswordInput("keep-me", "keep-me");
    vi.stubGlobal("document", {
      querySelectorAll: () => [pw],
    });
    const page = {
      evaluate: (fn: (...args: never[]) => unknown, arg?: unknown) =>
        Promise.resolve(arg === undefined ? fn() : fn(arg as never)),
    };

    await expect(
      withPasswordFieldsRedacted(page as never, async () => {
        throw new Error("capture-boom");
      }),
    ).rejects.toThrow("capture-boom");
    expect(pw.value).toBe("keep-me");
    expect(pw.getAttribute("value")).toBe("keep-me");
  });
});
