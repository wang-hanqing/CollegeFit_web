// Languages offered, in the order shown in the menu.
// code: translation file name (web/i18n/<code>.json); html: value for <html lang>; dir: text direction.
// Names are written in each language so students can find their own.
export const LANGUAGES = [
  { code: "en",  html: "en",      dir: "ltr", name: "English" },
  { code: "es",  html: "es",      dir: "ltr", name: "Español" },
  { code: "ar",  html: "ar",      dir: "rtl", name: "العربية" },
  { code: "prs", html: "fa-AF",   dir: "rtl", name: "دری" },
  { code: "uk",  html: "uk",      dir: "ltr", name: "Українська" },
  { code: "ru",  html: "ru",      dir: "ltr", name: "Русский" },
  { code: "fr",  html: "fr",      dir: "ltr", name: "Français" },
  { code: "zh",  html: "zh-Hans", dir: "ltr", name: "中文" },
  { code: "tr",  html: "tr",      dir: "ltr", name: "Türkçe" },
];

export const DEFAULT_LANGUAGE = "en";

// Browser language prefixes that should open a specific CollegeFit language.
export const LANGUAGE_ALIASES = { fa: "prs", prs: "prs" };

// The six steps of the journey. The id is used in the address (#/explore); the label key is in en.json.
export const STEPS = [
  { id: "start",      label: "step.1" },
  { id: "direction",  label: "step.2" },
  { id: "priorities", label: "step.3" },
  { id: "explore",    label: "step.4" },
  { id: "compare",    label: "step.5" },
  { id: "next",       label: "step.6" },
];

export const DATA_FILES = ["colleges", "programs", "cip", "interest_links", "meta"];
