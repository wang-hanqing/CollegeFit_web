// Every step has the same shape:
//   render(ctx)          -> HTML for the main area           (required)
//   onChange(event, ctx)    when an input inside it changes  (optional)
//   onClick(event, ctx)     when something inside it is clicked (optional)
//   check(answers, page) -> text to show if the student can't continue yet, or null (optional)
//   pages(answers)       -> page names when a step has several pages, in order (optional)
//   continueLabel(answers, page) -> text for the Continue button (optional)
// ctx = { data, answers, page, update, rerender }
import { t } from "./i18n.js";
import { escapeHtml } from "./ui.js";
import * as start from "./steps/start.js";
import * as direction from "./steps/direction.js";
import * as priorities from "./steps/priorities.js";

function placeholder(labelKey) {
  return {
    render: () => `
      <h1 id="page-title" tabindex="-1">${escapeHtml(t(labelKey))}</h1>
      <p class="placeholder">${escapeHtml(t("web.placeholder"))}</p>`,
  };
}

export const views = {
  start,
  direction,
  priorities,
  explore: placeholder("step.4"),
  compare: placeholder("step.5"),
  next: placeholder("step.6"),
};
