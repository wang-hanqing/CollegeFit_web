// One function per step. Each returns the HTML for the main area.
// For now they are placeholders; each will move to its own file as it is ported from Java.
import { t } from "./i18n.js";
import { escapeHtml } from "./ui.js";

function placeholder(labelKey, extra = "") {
  return `
    <h1 id="page-title" tabindex="-1">${escapeHtml(t(labelKey))}</h1>
    ${extra}
    <p class="placeholder">${escapeHtml(t("web.placeholder"))}</p>`;
}

export const views = {
  start: () => placeholder("step.1", `<p class="lede">${escapeHtml(t("app.tagline"))}</p>`),
  direction: () => placeholder("step.2"),
  priorities: () => placeholder("step.3"),
  explore: () => placeholder("step.4"),
  compare: () => placeholder("step.5"),
  next: () => placeholder("step.6"),
};
