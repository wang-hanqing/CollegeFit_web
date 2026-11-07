// Shared pieces of the page around each step.
import { LANGUAGES, STEPS } from "./config.js";
import { t, currentLanguage, formatNumber } from "./i18n.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function header(keptCount) {
  const options = LANGUAGES.map((l) =>
    `<option value="${l.code}" lang="${l.html}"${l.code === currentLanguage().code ? " selected" : ""}>${escapeHtml(l.name)}</option>`
  ).join("");
  return `
    <a class="brand" href="#" data-action="home" title="${escapeHtml(t("nav.home.tip"))}">${escapeHtml(t("app.title"))}</a>
    <div class="header-tools">
      <label class="language">
        <span class="visually-hidden">${escapeHtml(t("web.lang.label"))}</span>
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>
        <select data-action="language">${options}</select>
      </label>
      <button type="button" class="quiet mine-button" data-action="mine" aria-label="${escapeHtml(t("nav.mine", formatNumber(keptCount)))}">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>
        <span class="mine-text" aria-hidden="true">${escapeHtml(t("nav.mine", formatNumber(keptCount)))}</span>
        <span class="mine-count" aria-hidden="true">${escapeHtml(formatNumber(keptCount))}</span>
      </button>
      <button type="button" class="quiet help-button" data-action="help" aria-label="${escapeHtml(t("nav.help"))}">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 16.8v.2"/></svg>
        <span class="help-text">${escapeHtml(t("nav.help"))}</span>
      </button>
    </div>`;
}

// The journey as a line with six stops. Finished stops can be revisited.
export function stepLine(currentIndex) {
  const stops = STEPS.map((step, i) => {
    const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "ahead";
    const label = escapeHtml(t(step.label));
    const number = formatNumber(i + 1);
    const inner = `<span class="stop" aria-hidden="true">${number}</span><span class="stop-label">${label}</span>`;
    const content = state === "done"
      ? `<a href="#" data-action="step" data-step="${step.id}">${inner}</a>`
      : `<span${state === "current" ? ' aria-current="step"' : ""}>${inner}</span>`;
    return `<li class="${state}">${content}</li>`;
  }).join("");
  const counter = t("web.step.of", formatNumber(currentIndex + 1), formatNumber(STEPS.length));
  return `<p class="step-counter">${escapeHtml(counter)}</p><ol class="line">${stops}</ol>`;
}

export function footer(currentIndex) {
  const back = currentIndex > 0
    ? `<button type="button" class="secondary" data-action="back"><svg class="icon directional" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>${escapeHtml(t("nav.back"))}</button>`
    : "<span></span>";
  const next = currentIndex < STEPS.length - 1
    ? `<button type="button" class="primary" data-action="continue">${escapeHtml(t("web.continue"))}<svg class="icon directional" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>`
    : "";
  return `
    <div class="save">
      <button type="button" class="link" data-action="save">${escapeHtml(t("web.save.button"))}</button>
      <p class="save-status" role="status" aria-live="polite"></p>
    </div>
    <div class="moves">${back}${next}</div>`;
}

export function loading(done = 0, total = 1) {
  const percent = Math.round((done / total) * 100);
  return `
    <div class="loading" role="status">
      <p>${escapeHtml(t("web.loading"))}</p>
      <progress max="100" value="${percent}">${percent}%</progress>
    </div>`;
}

export function loadError() {
  return `
    <div class="notice" role="alert">
      <p>${escapeHtml(t("web.loading.error"))}</p>
      <button type="button" class="primary" data-action="reload">${escapeHtml(t("web.reload"))}</button>
    </div>`;
}

export function helpContent() {
  const paragraphs = t("help.data").split("\n").map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  return `
    <h2>${escapeHtml(t("nav.help"))}</h2>
    ${paragraphs}
    <form method="dialog"><button class="primary">${escapeHtml(t("web.close"))}</button></form>`;
}
