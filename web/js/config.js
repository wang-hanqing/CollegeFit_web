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

// Replaced with the commit id when the site is published (pipeline/stamp_version.py), so browsers
// fetch new files after each update instead of mixing old and new ones. "dev" while previewing locally.
export const VERSION = "dev";

export const DATA_FILES = ["colleges", "programs", "cip", "interest_links", "meta"];

// Home state picked when a student first opens CollegeFit (IRC's students are in New York).
// "" would start with "Not sure" instead.
export const DEFAULT_HOME_STATE = "NY";

// Common first fields for students who are not sure what they enjoy (2-digit CIP families).
// A design choice carried over from the Java version, not something the data decides.
export const COMMON_FIELDS = ["52", "51", "11", "50", "24", "26", "42", "45"];
export const LIBERAL_ARTS = "24";
export const MAX_INTERESTS = 2;
export const FIELDS_SHOWN = 4;
export const PROGRAMS_SHOWN = 5;   // programs listed in a field card before "Show all"

export const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii",
  ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico", GU: "Guam",
  VI: "U.S. Virgin Islands", AS: "American Samoa", MP: "Northern Mariana Islands", FM: "Micronesia",
  MH: "Marshall Islands", PW: "Palau",
};
