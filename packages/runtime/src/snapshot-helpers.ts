import type { Page } from "playwright";

/** Collect up to `limit` anchor href/text pairs for agent navigation hints. */
export async function extractPageLinks(page: Page, limit: number) {
  return page.$$eval(
    "a[href]",
    (anchors, max) => {
      const out: { href: string; text: string }[] = [];
      for (let i = 0; i < anchors.length && out.length < max; i++) {
        const a = anchors[i] as HTMLAnchorElement;
        const href = a.href;
        const text = (a.textContent ?? "").trim().slice(0, 200);
        if (href) {
          out.push({ href, text });
        }
      }
      return out;
    },
    limit,
  );
}

/** Best-effort landmark roles for layered snapshots (ADR-0002). */
export async function extractLandmarks(page: Page) {
  return page.evaluate(() => {
    const roles = [
      "main",
      "navigation",
      "banner",
      "contentinfo",
      "complementary",
    ];
    const out: { role: string; name?: string }[] = [];
    for (const role of roles) {
      const el = document.querySelector(`[role="${role}"]`);
      if (el) {
        out.push({
          role,
          name: el.getAttribute("aria-label") ?? undefined,
        });
      }
    }
    return out;
  });
}
