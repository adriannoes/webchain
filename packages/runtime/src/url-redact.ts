/**
 * Strip URL userinfo so basic-auth credentials are not echoed to companion/MCP.
 * Playwright `page.url()` and `HTMLAnchorElement.href` preserve `user:pass@`.
 */

/** Matches `scheme://userinfo@` including `user@host` and `user:pass@host`. */
const USERINFO_IN_ABSOLUTE_URL =
  /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/\s"'<>@]+@)/g;

/**
 * Remove embedded credentials from a single URL.
 *
 * @example
 * stripUserinfoFromUrl("https://alice:pw@example.com/x")
 * // => "https://example.com/x"
 */
export function stripUserinfoFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "data:") {
      // data: URLs are the document; echoing the payload repeats href userinfo
      // in percent-encoded form (not matched by the userinfo regex).
      const comma = url.indexOf(",");
      const withoutPayload = comma === -1 ? url : url.slice(0, comma + 1);
      return stripUserinfoFromText(withoutPayload);
    }
    if (parsed.username !== "" || parsed.password !== "") {
      parsed.username = "";
      parsed.password = "";
    }
    return stripUserinfoFromText(parsed.href);
  } catch {
    return stripUserinfoFromText(url);
  }
}

/**
 * Remove `user:pass@` (or `user@`) from any absolute URLs inside free-form text.
 */
export function stripUserinfoFromText(text: string): string {
  return text.replace(USERINFO_IN_ABSOLUTE_URL, "$1");
}

/** Redact `href` on extracted snapshot links. */
export function stripUserinfoFromLinks(
  links: { href: string; text: string }[],
): { href: string; text: string }[] {
  return links.map((link) => ({
    ...link,
    href: stripUserinfoFromUrl(link.href),
  }));
}

/** Walk JSON-like snapshot trees and redact URLs in string leaves. */
export function stripUserinfoDeep(value: unknown): unknown {
  if (typeof value === "string") {
    return stripUserinfoFromText(value);
  }
  if (Array.isArray(value)) {
    return value.map(stripUserinfoDeep);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = stripUserinfoDeep(child);
    }
    return out;
  }
  return value;
}
