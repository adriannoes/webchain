import type { Page } from "playwright";

export type PasswordFieldBackup = {
  value: string;
  attrValue: string | null;
};

/**
 * CSS selector for fields whose values must not appear in snapshots.
 * Duplicated inside in-page evaluate helpers so Playwright can serialize them.
 */
export const PASSWORD_FIELD_SELECTOR =
  'input[type="password"], input[autocomplete="current-password"], input[autocomplete="new-password"], input[autocomplete="one-time-password"]';

/**
 * Blank password inputs in the page document. Must stay serializable for Playwright.
 *
 * @example
 * const backups = backupAndBlankPasswordFieldsInPage();
 */
export function backupAndBlankPasswordFieldsInPage(): PasswordFieldBackup[] {
  const selector =
    'input[type="password"], input[autocomplete="current-password"], input[autocomplete="new-password"], input[autocomplete="one-time-password"]';
  const inputs = Array.from(document.querySelectorAll(selector));
  const backups: PasswordFieldBackup[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const el = inputs[i] as HTMLInputElement;
    backups.push({
      value: el.value,
      attrValue: el.getAttribute("value"),
    });
    el.value = "";
    el.removeAttribute("value");
  }
  return backups;
}

/**
 * Restore values saved by backupAndBlankPasswordFieldsInPage.
 *
 * @example
 * restorePasswordFieldsInPage(backups);
 */
export function restorePasswordFieldsInPage(
  backups: PasswordFieldBackup[],
): void {
  const selector =
    'input[type="password"], input[autocomplete="current-password"], input[autocomplete="new-password"], input[autocomplete="one-time-password"]';
  const inputs = Array.from(document.querySelectorAll(selector));
  for (let i = 0; i < backups.length; i++) {
    const el = inputs[i] as HTMLInputElement | undefined;
    const backup = backups[i];
    if (!el || !backup) {
      continue;
    }
    el.value = backup.value;
    if (backup.attrValue === null) {
      el.removeAttribute("value");
    } else {
      el.setAttribute("value", backup.attrValue);
    }
  }
}

/**
 * Run a snapshot capture with password fields blanked, then restore them.
 *
 * @example
 * const snap = await withPasswordFieldsRedacted(page, () => page.content());
 */
export async function withPasswordFieldsRedacted<T>(
  page: Page,
  run: () => Promise<T>,
): Promise<T> {
  const backups = await page.evaluate(backupAndBlankPasswordFieldsInPage);
  try {
    return await run();
  } finally {
    try {
      await page.evaluate(restorePasswordFieldsInPage, backups);
    } catch {
      // Capture already finished; the page may have closed.
    }
  }
}

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
