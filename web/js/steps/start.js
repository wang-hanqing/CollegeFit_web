// Step 1: Get started. Ported from StartPanel.java.
// New in the web version: the grade question, so next steps can match the student's year.
//
// answers.start  "subject" | "place" | "pathway" | "not_sure"   (Step 2 shows a different page for "not_sure")
// answers.grade  9 | 10 | 11 | 12 | "none" | null (not answered; it is optional)
import { t, formatNumber } from "../i18n.js";
import { escapeHtml } from "../ui.js";
import { optionCards, choiceChips, stepError, privacyNote } from "../components.js";

const STARTS = [
  { value: "subject",  key: "SUBJECT",  icon: "cap" },
  { value: "place",    key: "PLACE",    icon: "pin" },
  { value: "pathway",  key: "PATHWAY",  icon: "paths" },
  { value: "not_sure", key: "NOT_SURE", icon: "compass" },
];

const GRADES = [9, 10, 11, 12];

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

  const grades = choiceChips({
    name: "grade",
    legend: t("web.grade.question"),
    hint: t("web.grade.hint"),
    selected: answers.grade,
    options: [
      ...GRADES.map((g) => ({ value: g, label: t("web.grade.option", formatNumber(g)) })),
      { value: "none", label: t("web.grade.none") },
    ],
  });

  return `
    <h1 id="page-title" tabindex="-1">${escapeHtml(t("start.title"))}</h1>
    <p class="lede">${escapeHtml(t("start.subtitle"))}</p>
    ${starts}
    ${stepError()}
    ${grades}
    ${privacyNote(t("start.privacy"))}`;
}

export function onChange(event, { update }) {
  const { name, value } = event.target;
  if (name === "start") {
    update({ start: value });
    clearError();
  }
  if (name === "grade") update({ grade: value === "none" ? "none" : Number(value) });
}

// Returns the text to show when the student cannot continue yet, or null.
export function check(answers) {
  return answers.start ? null : t("web.start.error");
}

function clearError() {
  const error = document.getElementById("step-error");
  if (error) error.textContent = "";
}
