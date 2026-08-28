import { assertAllowedNavigateUrl } from "@webchain/protocol";
import type { BrowserContext, Page, Route } from "playwright";
import { WebchainRuntimeError } from "./runtime-error.js";

/** Initial Playwright documents are not agent navigations and must keep working. */
export function isIdleBrowserUrl(url: string): boolean {
  return url === "about:blank" || url.startsWith("about:blank?");
}

/**
 * Allow data/blob/about subresources; block file and internal http(s) targets.
 *
 * @example
 * shouldAllowSessionRequest("https://example.com/app.js"); // true
 * shouldAllowSessionRequest("http://127.0.0.1/secret"); // false
 */
export function shouldAllowSessionRequest(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  if (scheme === "about" || scheme === "data" || scheme === "blob") {
    return true;
  }
  try {
    assertAllowedNavigateUrl(url);
    return true;
  } catch {
    return false;
  }
}

/** Same policy as session requests: public http(s), about/data/blob; not file or internal. */
export function assertAllowedPageUrl(url: string): void {
  if (shouldAllowSessionRequest(url)) {
    return;
  }
  assertAllowedNavigateUrl(url);
}

/** Abort in-session requests whose URL would reach files or internal networks. */
export async function installSessionRequestGuard(
  context: BrowserContext,
): Promise<void> {
  await context.route("**/*", (route: Route) => {
    if (shouldAllowSessionRequest(route.request().url())) {
      return route.continue();
    }
    return route.abort("blockedbyclient");
  });
}

export function blockedPageUrlError(url: string): WebchainRuntimeError {
  let host = "invalid-url";
  try {
    host = new URL(url).host;
  } catch {
    host = "invalid-url";
  }
  return new WebchainRuntimeError(
    "COMMAND_FAILED",
    `Blocked navigation to disallowed url host: ${host}`,
  );
}

function isSafeRestoreTarget(url: string): boolean {
  try {
    assertAllowedPageUrl(url);
    return true;
  } catch {
    return false;
  }
}

export async function restoreAllowedPageUrl(
  page: Page,
  previousUrl: string,
): Promise<void> {
  const target = isSafeRestoreTarget(previousUrl) ? previousUrl : "about:blank";
  if (page.url() === target) {
    return;
  }
  try {
    await page.goto(target, { waitUntil: "domcontentloaded" });
  } catch {
    await page
      .goto("about:blank", { waitUntil: "domcontentloaded" })
      .catch(() => undefined);
  }
}

/** Throw and leave the page on `restoreUrl` (or about:blank) if the current URL is blocked. */
export async function enforceAllowedPageUrl(
  page: Page,
  restoreUrl: string,
): Promise<void> {
  const url = page.url();
  try {
    assertAllowedPageUrl(url);
  } catch {
    await restoreAllowedPageUrl(page, restoreUrl);
    throw blockedPageUrlError(url);
  }
}
