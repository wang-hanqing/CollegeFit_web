// Shared pieces of the page around each step.
import { LANGUAGES, STEPS } from "./config.js";
import { t, currentLanguage, formatNumber } from "./i18n.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// "CollegeFit" with "Fit" on a yellow mark. A translated name is shown as it is.
function brandName() {
  const title = t("app.title");
  return title === "CollegeFit"
    ? `College<span class="brand-fit">Fit</span>`
    : escapeHtml(title);
}

export function header(keptCount) {
  const options = LANGUAGES.map((l) =>
    `<option value="${l.code}" lang="${l.html}"${l.code === currentLanguage().code ? " selected" : ""}>${escapeHtml(l.name)}</option>`
  ).join("");
  return `
    <a class="brand" href="#" data-action="home" title="${escapeHtml(t("nav.home.tip"))}">${brandName()}</a>
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

// Grades offered in the sidebar menu. "none" is "Prefer not to say"; no choice at all is also fine.
const GRADES = [9, 10, 11, 12];

// The left sidebar on every page: the student's grade, the six steps, and the saved link.
// On narrow screens it folds into one row ("Step 1 of 6" and the step name) that opens the rest.
export function sidebar(currentIndex, grade, open = false) {
  const gradeOptions = [
    `<option value=""${grade == null ? " selected" : ""}>${escapeHtml(t("web.grade.select"))}</option>`,
    ...GRADES.map((g) =>
      `<option value="${g}"${grade === g ? " selected" : ""}>${escapeHtml(t("web.grade.option", formatNumber(g)))}</option>`),
    `<option value="none"${grade === "none" ? " selected" : ""}>${escapeHtml(t("web.grade.none"))}</option>`,
  ].join("");

  const tick = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
  const stops = STEPS.map((step, i) => {
    const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "ahead";
    const label = escapeHtml(t(step.label));
    const mark = state === "done" ? tick : formatNumber(i + 1);
    const inner = `<span class="stop" aria-hidden="true">${mark}</span><span class="stop-label">${label}</span>`;
    const content = state === "done"
      ? `<a href="#" data-action="step" data-step="${step.id}">${inner}</a>`
      : `<span${state === "current" ? ' aria-current="step"' : ""}>${inner}</span>`;
    return `<li class="${state}">${content}</li>`;
  }).join("");

  const counter = t("web.step.of", formatNumber(currentIndex + 1), formatNumber(STEPS.length));
  return `
    <button type="button" class="side-toggle" data-action="menu" aria-expanded="${open}" aria-controls="side-panel">
      <span class="side-toggle-text">
        <span class="side-counter">${escapeHtml(counter)}</span>
        <span class="side-step">${escapeHtml(t(STEPS[currentIndex].label))}</span>
      </span>
      <svg class="icon side-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
    </button>
    <div id="side-panel" class="side-panel">
      <label class="grade">
        <span class="grade-question">${escapeHtml(t("web.grade.question"))}</span>
        <select data-action="grade">${gradeOptions}</select>
      </label>
      <nav class="journey" aria-label="${escapeHtml(t("web.steps"))}">
        <ol class="line">${stops}</ol>
      </nav>
      <div class="save">
        <button type="button" class="link" data-action="save">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>
          ${escapeHtml(t("web.save.button"))}
        </button>
        <p class="save-status" role="status" aria-live="polite"></p>
      </div>
    </div>`;
}

export function footer(currentIndex, pageIndex = 0, continueText = null) {
  const back = currentIndex > 0 || pageIndex > 0
    ? `<button type="button" class="secondary" data-action="back"><svg class="icon directional" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>${escapeHtml(t("nav.back"))}</button>`
    : "<span></span>";
  const next = currentIndex < STEPS.length - 1
    ? `<button type="button" class="primary" data-action="continue">${escapeHtml(continueText || t("web.continue"))}<svg class="icon directional" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>`
    : "";
  return `<div class="moves">${back}${next}</div>`;
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
