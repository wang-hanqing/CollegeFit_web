// Addresses look like  #/direction/fields?lang=ar  (a saved link adds &a=<answers>).
// Some steps have several pages; the page is the second part of the path.
// Everything after # stays in the browser, so GitHub Pages only ever sees the page itself.
import { STEPS } from "./config.js";

const STEP_IDS = STEPS.map((s) => s.id);

export function readAddress() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = hash.split("?");
  const [step, page = null] = path.split("/");
  const params = new URLSearchParams(query);
  const known = STEP_IDS.includes(step);
  return {
    step: known ? step : STEP_IDS[0],
    page: known ? page : null,
    lang: params.get("lang"),
    answers: params.get("a"),
  };
}

export function address(step, lang, answers, page) {
  const params = new URLSearchParams({ lang });
  if (answers) params.set("a", answers);
  return `#/${step}${page ? `/${page}` : ""}?${params}`;
}

// New history entry, so the browser's back button returns to the previous page
export function goTo(step, lang, page) {
  location.hash = address(step, lang, null, page);
}

// Same history entry: used after reading a saved link or changing language
export function replaceAddress(step, lang, page) {
  history.replaceState(null, "", address(step, lang, null, page));
}

export function stepIndex(step) {
  return STEP_IDS.indexOf(step);
}

export function stepAt(index) {
  return STEP_IDS[index] || null;
}
