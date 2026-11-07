// Screen text in nine languages. English is always loaded and fills any gap in a translation.
import { LANGUAGES, DEFAULT_LANGUAGE, LANGUAGE_ALIASES } from "./config.js";

let english = null;
let active = {};
let current = LANGUAGES[0];
const reportedMissing = new Set();

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

export function findLanguage(code) {
  return LANGUAGES.find((l) => l.code === code) || null;
}

// First language in the browser's list that CollegeFit offers; English otherwise.
export function detectLanguage() {
  for (const tag of navigator.languages || [navigator.language]) {
    const prefix = String(tag).toLowerCase().split("-")[0];
    const code = LANGUAGE_ALIASES[prefix] || prefix;
    if (findLanguage(code)) return code;
  }
  return DEFAULT_LANGUAGE;
}

export async function setLanguage(code) {
  const language = findLanguage(code) || findLanguage(DEFAULT_LANGUAGE);
  if (!english) english = await fetchJson("i18n/en.json");
  if (language.code === "en") {
    active = {};
  } else {
    try {
      active = await fetchJson(`i18n/${language.code}.json`);
    } catch {
      active = {}; // missing file: show English rather than nothing
    }
  }
  current = language;
  document.documentElement.lang = language.html;
  document.documentElement.dir = language.dir;
  return language;
}

export function currentLanguage() {
  return current;
}

// t("prog.part.awarded", "Nursing", 120) fills {0}, {1}, ... in order.
export function t(key, ...values) {
  let text = active[key];
  if (text == null && english?.[key] != null) {
    text = english[key];
    // English shown inside Arabic or Dari: isolate it so its punctuation stays at the end
    if (current.dir === "rtl") text = `\u2066${text}\u2069`;
  }
  if (text == null) {
    if (!reportedMissing.has(key)) {
      reportedMissing.add(key);
      console.warn(`Missing text: ${key}`);
    }
    return key;
  }
  return text.replace(/\{(\d+)\}/g, (match, i) => (values[i] ?? match));
}

// Western digits in every language for now, so dollar amounts read the same everywhere.
// Pending decision: Arabic and Dari readers may prefer their own digits.
export function formatNumber(value, options = {}) {
  if (value == null) return "";
  return new Intl.NumberFormat(`${current.html}-u-nu-latn`, options).format(value);
}

export function formatMoney(value) {
  return formatNumber(value, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
