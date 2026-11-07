// Every step has the same shape:
//   render(ctx)          -> HTML for the main area           (required)
//   onChange(event, ctx)    when an input inside it changes  (optional)
//   onClick(event, ctx)     when something inside it is clicked (optional)
//   check(answers, page) -> text to show if the student can't continue yet, or null (optional)
//   pages(answers)       -> page names when a step has several pages, in order (optional)
//   continueLabel(answers, page) -> text for the Continue button (optional)
//   onToggle(event, ctx)    when a <details> inside it opens or closes (optional)
// ctx = { data, answers, page, update, rerender, go(step, page), reset() }
import { t } from "./i18n.js";
import { escapeHtml } from "./ui.js";
import * as start from "./steps/start.js";
import * as direction from "./steps/direction.js";
import * as priorities from "./steps/priorities.js";
import * as explore from "./steps/explore.js";
import * as compare from "./steps/compare.js";
import * as next from "./steps/next.js";

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
  explore,
  compare,
  next,
};
