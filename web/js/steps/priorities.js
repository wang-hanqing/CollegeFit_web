// Step 3: What matters most to you? Ported from PrioritiesPanel.java.
// Up to three priorities, ranked in the order the student picks them. Skipping is fine.
//
// answers.priorities  e.g. ["COSTS", "GRADUATION"]  (#1 first)
import { t, formatNumber, currentLanguage } from "../i18n.js";
import { escapeHtml } from "../ui.js";
import { icon, stepError } from "../components.js";
import { STATE_NAMES } from "../config.js";
import { familyName } from "./direction.js";

const PRIORITIES = [
  { id: "COSTS", icon: "dollar" },
  { id: "GRADUATION", icon: "book" },
  { id: "ADMISSION", icon: "door" },
  { id: "STUDY", icon: "cap" },
  { id: "CAMPUS", icon: "pin" },
];
const MAX = 3;

export function render({ answers }) {
  const cards = PRIORITIES.map((p) => card(p, answers.priorities.indexOf(p.id) + 1)).join("");
  const clear = answers.priorities.length
    ? `<button type="button" class="link" data-action="clear-priorities">${escapeHtml(t("pri.clear"))}</button>`
    : "";
  return `
    <h1 id="page-title" tabindex="-1">${escapeHtml(t("pri.title"))}</h1>
    <p class="lede">${escapeHtml(t("web.pri.subtitle"))}</p>
    <p class="context">${escapeHtml(t("pri.topic", topic(answers), place(answers)))}</p>
    ${stepError()}
    <fieldset class="priority-list">
      <legend class="visually-hidden">${escapeHtml(t("pri.title"))}</legend>
      ${cards}
    </fieldset>
    <div class="priority-tools">${clear}</div>
    <details class="how">
      <summary>${escapeHtml(t("pri.how.title"))}</summary>
      <p>${escapeHtml(t("web.pri.how"))}</p>
    </details>`;
}

function card(p, rank) {
  const id = `priority-${p.id}`;
  return `
    <div class="field-card priority${rank ? " is-chosen" : ""}">
      <label class="field-head" for="${id}">
        <input type="checkbox" id="${id}" name="priority" value="${p.id}"${rank ? " checked" : ""}
          aria-describedby="${id}-desc">
        <span class="option-icon">${icon(p.icon)}</span>
        <span class="option-text">
          <span class="option-title">${escapeHtml(t(`Priority.${p.id}`))}</span>
          <span class="option-description" id="${id}-desc">${escapeHtml(t(`pri.desc.${p.id}`))}</span>
        </span>
        <span class="rank${rank ? " on" : ""}" aria-hidden="true">${rank ? `#${formatNumber(rank)}` : ""}</span>
        ${rank ? `<span class="visually-hidden">${escapeHtml(t("web.pri.rank", formatNumber(rank)))}</span>` : ""}
      </label>
      <details class="programs basis">
        <summary>${escapeHtml(t("web.pri.basis"))}</summary>
        <p>${escapeHtml(t(`pri.basis.${p.id}`))}</p>
      </details>
    </div>`;
}

export function onChange(event, { answers, update, rerender }) {
  if (event.target.name !== "priority") return;
  const { value, checked } = event.target;
  let list = answers.priorities.filter((p) => p !== value);
  if (checked) {
    if (list.length >= MAX) {
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

export function onClick(event, { update, rerender }) {
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

function topic(answers) {
  const names = answers.fields.map(familyName);
  if (!names.length) return t("options.topic.all");
  const list = new Intl.ListFormat(currentLanguage().html, { type: "conjunction" });
  if (names.length > 2) return `${names.slice(0, 2).join(", ")} ${t("options.topic.more", formatNumber(names.length - 2))}`;
  return list.format(names);
}

function place(answers) {
  return answers.home && answers.scope === "state"
    ? t("options.in", STATE_NAMES[answers.home] || answers.home)
    : t("options.anywhere");
}
