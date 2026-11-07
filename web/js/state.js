// A student's answers and saved colleges. Nothing here is sent to a server.
//
// Three places the answers can live:
//   memory          while the page is open
//   sessionStorage  so a reload does not lose them; cleared when the tab closes,
//                   which matters on shared computers at school or at IRC
//   a saved link    only when the student asks for one; the answers sit after the # in the link,
//                   and browsers never send that part to the website

import { DEFAULT_HOME_STATE } from "./config.js";

const VERSION = 1;
const SESSION_KEY = "collegefit.answers";

export function emptyAnswers() {
  return {
    v: VERSION,
    grade: null,       // 9, 10, 11, 12, "none" (prefer not to say) or null (not answered)
    start: null,       // "subject", "place", "pathway" or "not_sure"
    home: DEFAULT_HOME_STATE, // state the student lives in, e.g. "NY"; "" = not sure
    scope: "state",    // explore colleges "state" (in the home state) or "anywhere"
    interests: [],     // O*NET interest types, up to 2, e.g. ["I", "C"]
    interestsUnsure: false, // "I'm not sure yet" on the interest page
    fields: [],        // program families (2-digit CIP), e.g. ["51", "52"]
    degree: "both",    // "both", "two" (two-year) or "four" (four-year)
    priorities: [],    // up to three, in order
    // Optional details that explain colleges but never filter them ("Add scores or cost details")
    satStatus: "NOT_SURE",   // "NOT_SURE", "NOT_YET", "PROVIDED" or "PREFER_NOT_TO_SAY"
    satReading: null,        // 200-800 when PROVIDED
    satMath: null,
    budgetStatus: "NOT_SURE", // "NOT_SURE", "KNOWN" or "PREFER_NOT_TO_SAY"
    budget: null,            // dollars a year when KNOWN
    income: "NOT_SURE",      // IncomeBracket value, e.g. "UNDER_30K"
    aid: "NOT_SURE",         // can apply for federal aid: "NOT_SURE", "YES", "NO", "PREFER_NOT_TO_SAY"
    settings: [],            // campus settings wanted, e.g. ["URBAN"]; empty = no preference
    sizes: [],               // college sizes wanted, e.g. ["LARGE"]
    kept: [],          // UNITIDs of colleges the student kept, in the order kept
    compare: [],       // up to 3 kept UNITIDs shown side by side
    notForMe: {},      // UNITID -> reason key ("" = no reason given)
    reasons: {},       // UNITID -> reasons for keeping, e.g. ["COSTS", "STUDY"]
  };
}

function cleanUp(data) {
  const answers = emptyAnswers();
  if (!data || typeof data !== "object" || data.v !== VERSION) return null;
  for (const key of Object.keys(answers)) {
    if (key in data && typeof data[key] === typeof answers[key]) answers[key] = data[key];
    else if (key in data && answers[key] === null) answers[key] = data[key];
  }
  return answers;
}

// Answers -> short text that is safe inside a link (base64url of UTF-8 JSON)
export function encodeAnswers(answers) {
  const bytes = new TextEncoder().encode(JSON.stringify(answers));
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeAnswers(text) {
  try {
    const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return cleanUp(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

export function saveSession(answers) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(answers));
  } catch {
    // private browsing or storage turned off: the app still works, answers just don't survive a reload
  }
}

export function loadSession() {
  try {
    return cleanUp(JSON.parse(sessionStorage.getItem(SESSION_KEY)));
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}
