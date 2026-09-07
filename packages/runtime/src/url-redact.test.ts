import { describe, expect, it } from "vitest";
import {
  stripUserinfoDeep,
  stripUserinfoFromLinks,
  stripUserinfoFromText,
  stripUserinfoFromUrl,
} from "./url-redact.js";

describe("stripUserinfoFromUrl", () => {
  it("removes user and password from http(s) URLs", () => {
    expect(
      stripUserinfoFromUrl("https://alice:s3cret@example.com/path?q=1"),
    ).toBe("https://example.com/path?q=1");
  });

  it("removes username-only userinfo", () => {
    expect(stripUserinfoFromUrl("https://alice@example.com/")).toBe(
      "https://example.com/",
    );
  });

  it("leaves URLs without userinfo unchanged", () => {
    expect(stripUserinfoFromUrl("https://example.com/x")).toBe(
      "https://example.com/x",
    );
  });

  it("omits data: payloads so embedded credentials cannot hide in page.url()", () => {
    const dataUrl =
      "data:text/html," +
      encodeURIComponent(
        '<a href="https://alice:pw-in-href@example.org/path">l</a>',
      );
    const redacted = stripUserinfoFromUrl(dataUrl);
    expect(redacted).toBe("data:text/html,");
    expect(redacted).not.toContain("pw-in-href");
  });

  it("falls back to text stripping for non-URL strings", () => {
    expect(
      stripUserinfoFromUrl("see https://bob:pw@example.net/a and more"),
    ).toBe("see https://example.net/a and more");
  });
});

describe("stripUserinfoFromText", () => {
  it("redacts credentials in HTML hrefs", () => {
    const html = '<a href="https://alice:pw-in-href@example.org/path">link</a>';
    expect(stripUserinfoFromText(html)).toBe(
      '<a href="https://example.org/path">link</a>',
    );
  });

  it("does not treat mailto addresses as userinfo URLs", () => {
    expect(stripUserinfoFromText("contact mailto:user@example.com")).toBe(
      "contact mailto:user@example.com",
    );
  });
});

describe("stripUserinfoFromLinks", () => {
  it("redacts href and preserves link text", () => {
    expect(
      stripUserinfoFromLinks([
        { href: "https://u:p@example.com/x", text: "x" },
      ]),
    ).toEqual([{ href: "https://example.com/x", text: "x" }]);
  });
});

describe("stripUserinfoDeep", () => {
  it("redacts nested strings", () => {
    expect(
      stripUserinfoDeep({
        url: "https://u:p@example.com/",
        items: ["https://a:b@example.net/"],
      }),
    ).toEqual({
      url: "https://example.com/",
      items: ["https://example.net/"],
    });
  });
});
