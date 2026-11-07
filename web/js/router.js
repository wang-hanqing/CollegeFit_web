// Addresses look like  #/explore?lang=ar  (a saved link adds &a=<answers>).
// Everything after # stays in the browser, so GitHub Pages only ever sees the page itself.
import { STEPS } from "./config.js";

const STEP_IDS = STEPS.map((s) => s.id);

export function readAddress() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = hash.split("?");
  const params = new URLSearchParams(query);
  return {
    step: STEP_IDS.includes(path) ? path : STEP_IDS[0],
    lang: params.get("lang"),
    answers: params.get("a"),
  };
}

export function address(step, lang, answers) {
  const params = new URLSearchParams({ lang });
  if (answers) params.set("a", answers);
  return `#/${step}?${params}`;
}

// New history entry, so the browser's back button returns to the previous step
export function goTo(step, lang) {
  location.hash = address(step, lang);
}

// Same history entry: used after reading a saved link or changing language
export function replaceAddress(step, lang) {
  history.replaceState(null, "", address(step, lang));
}

export function stepIndex(step) {
  return STEP_IDS.indexOf(step);
}

export function stepAt(index) {
  return STEP_IDS[index] || null;
}
