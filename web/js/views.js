// Every step has the same shape:
//   render(ctx)          -> HTML for the main area           (required)
//   onChange(event, ctx)    when an input inside it changes  (optional)
//   check(answers)       -> text to show if the student can't continue yet, or null (optional)
// ctx = { data, answers, update }
import { t } from "./i18n.js";
import { escapeHtml } from "./ui.js";
import * as start from "./steps/start.js";

function placeholder(labelKey) {
  return {
    render: () => `
      <h1 id="page-title" tabindex="-1">${escapeHtml(t(labelKey))}</h1>
      <p class="placeholder">${escapeHtml(t("web.placeholder"))}</p>`,
  };
}

export const views = {
  start,
  direction: placeholder("step.2"),
  priorities: placeholder("step.3"),
  explore: placeholder("step.4"),
  compare: placeholder("step.5"),
  next: placeholder("step.6"),
};
