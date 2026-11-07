// Starts CollegeFit and connects the pieces: address, language, answers, data and the screen.
import { STEPS } from "./config.js";
import { setLanguage, detectLanguage, findLanguage, currentLanguage, t } from "./i18n.js";
import { readAddress, address, goTo, replaceAddress, stepIndex, stepAt } from "./router.js";
import { emptyAnswers, encodeAnswers, decodeAnswers, saveSession, loadSession } from "./state.js";
import { loadData } from "./data.js";
import { header, stepLine, footer, loading, loadError, helpContent, escapeHtml } from "./ui.js";
import { views } from "./views.js";

const app = {
  step: STEPS[0].id,
  page: null,
  answers: emptyAnswers(),
  data: null,
  failed: false,
};

const $ = (id) => document.getElementById(id);

// ---------- Rendering ----------

function render({ focus = false } = {}) {
  const index = stepIndex(app.step);
  document.title = `${t(STEPS[index].label)} | ${t("app.title")}`;
  $("skip").textContent = t("web.skip");
  $("journey").setAttribute("aria-label", t("web.steps"));
  $("top").innerHTML = header(app.answers.kept.length);
  $("help").innerHTML = helpContent();

  if (app.failed) {
    $("journey").innerHTML = "";
    $("moves").innerHTML = "";
    $("main").innerHTML = loadError();
    return;
  }
  if (!app.data) return; // still loading; the progress bar is in place

  $("journey").innerHTML = stepLine(index);
  $("main").innerHTML = views[app.step].render(context());
  $("moves").innerHTML = footer(index, pagesOf(app.step).indexOf(app.page));
  if (focus) $("page-title")?.focus();
}

function context() {
  return { data: app.data, answers: app.answers, page: app.page, update, rerender };
}

// Redraw the current page after a change, keeping keyboard focus on the same control.
function rerender() {
  const active = document.activeElement;
  const selector = active?.id ? `#${CSS.escape(active.id)}`
    : active?.name ? `[name="${CSS.escape(active.name)}"]` : null;
  render();
  if (selector) document.querySelector(`#main ${selector}`)?.focus();
}

// Pages inside a step (most steps have one). The first page is used when none is given.
function pagesOf(step) {
  return views[step].pages?.(app.answers) || [null];
}

function validPage(step, page) {
  const pages = pagesOf(step);
  return pages.includes(page) ? page : pages[0];
}

// Steps call this when a student changes an answer.
function update(changes) {
  Object.assign(app.answers, changes);
  saveSession(app.answers);
  $("top").innerHTML = header(app.answers.kept.length);
}

function setStatus(html) {
  const status = document.querySelector(".save-status");
  if (status) status.innerHTML = html;
}

// ---------- Address changes (links, back button, language) ----------

async function onAddressChange() {
  const target = readAddress();
  let linkFailed = false;
  if (target.answers) {
    const saved = decodeAnswers(target.answers);
    if (saved) {
      app.answers = saved;
      saveSession(saved);
    } else {
      linkFailed = true;
    }
  }
  if (target.lang && target.lang !== currentLanguage().code && findLanguage(target.lang)) {
    await setLanguage(target.lang);
  }
  const page = validPage(target.step, target.page);
  const moved = target.step !== app.step || page !== app.page;
  app.step = target.step;
  app.page = page;
  replaceAddress(app.step, currentLanguage().code, app.page); // keeps answers out of the address bar
  render({ focus: moved });
  if (moved) window.scrollTo(0, 0);
  if (linkFailed) setStatus(escapeHtml(t("web.save.invalid")));
}

// ---------- Clicks and changes ----------

async function onClick(event) {
  if (app.data && event.target.closest("#main")) views[app.step].onClick?.(event, context());
  const target = event.target.closest("[data-action]");
  if (!target || target.tagName === "SELECT") return;
  const action = target.dataset.action;
  const lang = currentLanguage().code;
  const index = stepIndex(app.step);

  if (target.tagName === "A") event.preventDefault();

  switch (action) {
    case "skip": $("main-content").focus(); break;
    case "home": goTo(STEPS[0].id, lang); break;
    case "step": goTo(target.dataset.step, lang); break;
    case "back": {
      const pages = pagesOf(app.step);
      const at = pages.indexOf(app.page);
      if (at > 0) goTo(app.step, lang, pages[at - 1]);
      else if (index > 0) goTo(stepAt(index - 1), lang, pagesOf(stepAt(index - 1)).at(-1));
      break;
    }
    case "continue": {
      const problem = views[app.step].check?.(app.answers, app.page);
      if (problem) {
        const error = $("step-error");
        error.textContent = problem;
        error.scrollIntoView({ block: "center", behavior: "smooth" });
        document.querySelector("#main input")?.focus({ preventScroll: true });
        break;
      }
      const pages = pagesOf(app.step);
      const at = pages.indexOf(app.page);
      if (at < pages.length - 1) goTo(app.step, lang, pages[at + 1]);
      else goTo(stepAt(index + 1), lang);
      break;
    }
    case "mine": goTo("compare", lang); break;
    case "help": $("help").showModal(); break;
    case "reload": location.reload(); break;
    case "save": await copySavedLink(); break;
  }
}

async function onChange(event) {
  if (event.target.closest("#main")) {
    views[app.step].onChange?.(event, context());
    return;
  }
  if (event.target.dataset.action !== "language") return;
  const language = await setLanguage(event.target.value);
  replaceAddress(app.step, language.code, app.page);
  render();
  document.querySelector('[data-action="language"]')?.focus();
}

async function copySavedLink() {
  const link = location.origin + location.pathname +
    address(app.step, currentLanguage().code, encodeAnswers(app.answers), app.page);
  try {
    await navigator.clipboard.writeText(link);
    setStatus(`${escapeHtml(t("web.save.copied"))} ${escapeHtml(t("web.save.hint"))}`);
  } catch {
    // Clipboard blocked (some phones, older browsers): show the link to copy by hand
    setStatus(`
      <label>${escapeHtml(t("web.save.manual"))}
        <input type="text" readonly value="${escapeHtml(link)}">
      </label>
      ${escapeHtml(t("web.save.hint"))}`);
    const input = document.querySelector(".save-status input");
    input?.addEventListener("focus", () => input.select());
    input?.focus();
  }
}

// ---------- Start ----------

async function start() {
  const target = readAddress();

  let linkFailed = false;
  if (target.answers) {
    const saved = decodeAnswers(target.answers);
    if (saved) app.answers = saved;
    else linkFailed = true;
  } else {
    app.answers = loadSession() || emptyAnswers();
  }
  saveSession(app.answers);

  const language = await setLanguage(findLanguage(target.lang) ? target.lang : detectLanguage());
  app.step = target.step;
  app.page = validPage(app.step, target.page);
  replaceAddress(app.step, language.code, app.page);

  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
  window.addEventListener("hashchange", onAddressChange);

  render();
  $("main").innerHTML = loading();
  try {
    app.data = await loadData((done, total) => ($("main").innerHTML = loading(done, total)));
  } catch (error) {
    console.error(error);
    app.failed = true;
  }
  render();
  if (linkFailed) setStatus(escapeHtml(t("web.save.invalid")));

  app.update = update;
  window.CollegeFit = app; // for checking in the browser console
}

start();
