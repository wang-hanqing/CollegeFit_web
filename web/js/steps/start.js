// Step 1: Get started. Ported from StartPanel.java.
// The grade question (new in the web version) is in the sidebar on every page; see sidebar() in ui.js.
//
// answers.start  "subject" | "place" | "pathway" | "not_sure"   (Step 2 shows a different page for "not_sure")
import { t } from "../i18n.js";
import { escapeHtml } from "../ui.js";
import { optionCards, stepError, privacyNote } from "../components.js";

const STARTS = [
  { value: "subject",  key: "SUBJECT",  icon: "cap" },
  { value: "place",    key: "PLACE",    icon: "pin" },
  { value: "pathway",  key: "PATHWAY",  icon: "paths" },
  { value: "not_sure", key: "NOT_SURE", icon: "compass" },
];

export function render({ answers }) {
  const starts = optionCards({
    name: "start",
    legend: t("web.start.legend"),
    selected: answers.start,
    options: STARTS.map((s) => ({
      value: s.value,
      icon: s.icon,
      title: t(`start.${s.key}`),
      description: t(`start.${s.key}.desc`),
    })),
  });

  return `
    <h1 id="page-title" tabindex="-1">${escapeHtml(t("start.title"))}</h1>
    <p class="lede">${escapeHtml(t("start.subtitle"))}</p>
    ${starts}
    ${stepError()}
    ${privacyNote(t("start.privacy"))}`;
}

export function onChange(event, { update }) {
  const { name, value } = event.target;
  if (name === "start") {
    update({ start: value });
    clearError();
  }
}

// Returns the text to show when the student cannot continue yet, or null.
export function check(answers) {
  return answers.start ? null : t("web.start.error");
}

function clearError() {
  const error = document.getElementById("step-error");
  if (error) error.textContent = "";
}
