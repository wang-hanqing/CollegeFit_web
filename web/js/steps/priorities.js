// Step 3: What matters most to you? Ported from PrioritiesPanel.java.
// Up to three priorities, ranked in the order the student picks them. Skipping is fine.
// Web version: four priorities (no "My area of study"), in one compact list that fits on a laptop screen.
//
// answers.priorities  e.g. ["COSTS", "GRADUATION"]  (#1 first)
import { t, formatNumber, currentLanguage } from "../i18n.js";
import { escapeHtml } from "../ui.js";
import { icon, stepError } from "../components.js";
import { PRIORITIES, MAX_PRIORITIES } from "../config.js";
import { familyName, where } from "./direction.js";
import { profileFrom, statesOf } from "../logic/explore.js";

const ICONS = { COSTS: "dollar", ADMISSION: "door", GRADUATION: "book", CAMPUS: "pin" };
const openBasis = new Set(); // "What we use" panels that are open, kept across redraws

export function render({ answers, data }) {
  const campus = campusState(answers);
  const rows = PRIORITIES.map((id) => row(id, answers.priorities.indexOf(id) + 1, answers, campus)).join("");
  const clear = answers.priorities.length
    ? `<button type="button" class="link" data-action="clear-priorities">${escapeHtml(t("pri.clear"))}</button>`
    : "";
  return `
    <h1 id="page-title" tabindex="-1">${escapeHtml(t("pri.title"))}</h1>
    <p class="lede">${escapeHtml(t("web.pri.subtitle"))}</p>
    <p class="context">${escapeHtml(t("pri.topic", topic(answers, data), place(answers)))}</p>
    ${stepError()}
    <fieldset class="priority-list">
      <legend class="visually-hidden">${escapeHtml(t("pri.title"))}</legend>
      ${rows}
    </fieldset>
    <div class="priority-tools">${clear}</div>`;
}

// Campus environment orders colleges only by the setting and size chosen in Step 2.
//   "ready"        the student chose a setting or a size
//   "choose"       they did not; a link takes them back to Step 2
//   "unavailable"  the "I'm not sure yet" path, which does not ask about campus
function campusState(answers) {
  if ((answers.settings || []).length || (answers.sizes || []).length) return "ready";
  return answers.start === "not_sure" ? "unavailable" : "choose";
}

function row(id, rank, answers, campus) {
  const inputId = `priority-${id}`;
  const off = id === "CAMPUS" && campus !== "ready";
  const open = openBasis.has(id);
  const toggle = off ? "" : `
    <button type="button" class="basis-toggle" data-action="basis" data-priority="${id}"
      aria-expanded="${open}" aria-controls="${inputId}-basis">${escapeHtml(t("web.pri.basis"))}</button>`;
  const below = off
    ? `<p class="priority-off">${campus === "choose"
        ? `<button type="button" class="link" data-action="to-campus">${escapeHtml(t("web.pri.campus.choose"))}</button>`
        : escapeHtml(t("web.pri.campus.unavailable"))}</p>`
    : `<div class="basis" id="${inputId}-basis"${open ? "" : " hidden"}>
        ${basis(id, answers).map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
      </div>`;
  return `
    <div class="priority${rank ? " is-chosen" : ""}${off ? " is-off" : ""}">
      <label class="priority-head" for="${inputId}">
        <input type="checkbox" id="${inputId}" name="priority" value="${id}"${rank ? " checked" : ""}${off && !rank ? " disabled" : ""}
          aria-describedby="${inputId}-desc">
        <span class="option-icon">${icon(ICONS[id])}</span>
        <span class="option-text">
          <span class="option-title">${escapeHtml(t(`Priority.${id}`))}${toggle}</span>
          <span class="option-description" id="${inputId}-desc">${escapeHtml(t(`pri.desc.${id}`))}</span>
        </span>
        <span class="rank${rank ? " on" : ""}" aria-hidden="true">${rank ? `#${formatNumber(rank)}` : ""}</span>
        ${rank ? `<span class="visually-hidden">${escapeHtml(t("web.pri.rank", formatNumber(rank)))}</span>` : ""}
      </label>
      ${below}
    </div>`;
}

// "What we use": what the ordering uses and what to do next. College costs adds a line only when it applies.
function basis(id, answers) {
  const lines = [t(`pri.basis.${id}`)];
  if (id === "COSTS") {
    if (profileFrom(answers).income) lines.push(t("web.pri.basis.income"));
    const states = statesOf(answers);
    const outside = answers.home && (!states.length || states.some((s) => s !== answers.home));
    if (outside) lines.push(t("web.pri.basis.outOfState"));
  }
  return lines;
}

export function onChange(event, { answers, update, rerender }) {
  if (event.target.name !== "priority") return;
  const { value, checked } = event.target;
  let list = answers.priorities.filter((p) => p !== value);
  if (checked) {
    if (list.length >= MAX_PRIORITIES) {
      event.target.checked = false;
      const error = document.getElementById("step-error");
      if (error) error.textContent = t("error.priorities");
      return;
    }
    list = [...list, value];
  }
  update({ priorities: list });
  rerender();
}

export function onClick(event, { update, rerender, go }) {
  const toggle = event.target.closest('[data-action="basis"]');
  if (toggle) {
    const id = toggle.dataset.priority;
    const open = !openBasis.has(id);
    if (open) openBasis.add(id); else openBasis.delete(id);
    toggle.setAttribute("aria-expanded", String(open));
    document.getElementById(toggle.getAttribute("aria-controls"))?.toggleAttribute("hidden", !open);
    return;
  }
  if (event.target.closest('[data-action="to-campus"]')) {
    go("direction", "main");
    return;
  }
  if (event.target.closest('[data-action="clear-priorities"]')) {
    update({ priorities: [] });
    rerender();
    document.querySelector('[name="priority"]')?.focus();
  }
}

// "See colleges" once something is picked; "Skip for now" otherwise
export function continueLabel(answers) {
  return answers.priorities.length ? t("pri.next") : t("pri.skip");
}

// ---------- context line: what and where the student is exploring ----------

function topic(answers, data) {
  const names = answers.fields.map((code) => (code.length === 2 ? familyName(code) : (data.programNames[code] || code).split(",")[0]));
  if (!names.length) return t("options.topic.all");
  const list = new Intl.ListFormat(currentLanguage().html, { type: "conjunction" });
  if (names.length > 2) return `${names.slice(0, 2).join(", ")} ${t("options.topic.more", formatNumber(names.length - 2))}`;
  return list.format(names);
}

function place(answers) {
  const w = where(answers);
  return w === t("pathway.us") ? t("options.anywhere") : t("options.in", w);
}
