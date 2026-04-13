import {
  companionHealthUrl,
  DEFAULT_CONTROL_PLANE_URL,
  formatPopupError,
} from "../../lib/popup-utils.js";

const output = document.querySelector<HTMLPreElement>("#output");

function setOutput(value: unknown) {
  if (!output) {
    return;
  }

  output.textContent =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

document
  .querySelector<HTMLButtonElement>("#ping")
  ?.addEventListener("click", async () => {
    try {
      const response = await fetch(companionHealthUrl());
      const data = await response.json();
      setOutput(data);
    } catch (error) {
      setOutput({
        error: formatPopupError(error),
      });
    }
  });

document
  .querySelector<HTMLButtonElement>("#open-control-plane")
  ?.addEventListener("click", async () => {
    await browser.tabs.create({ url: DEFAULT_CONTROL_PLANE_URL });
  });
