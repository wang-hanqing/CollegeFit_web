// Step 4 ordering, ported from RecommendationEngine and CollegeRecommendation (Java).
// No overall score: colleges are grouped by type, and each group is ordered by the student's
// priorities in turn. Close values count as a tie so the next priority decides, and missing or
// not-comparable values go last instead of getting a false advantage.
// tests/explore.test.mjs checks the results against the Java version.

export const GROUPS = ["COMMUNITY_COLLEGE", "PUBLIC_FOUR_YEAR", "PRIVATE"];
const COST_STEP = 1000, RATE_STEP = 5, ADMIT_STEP = 10;
const INCOME_KEYS = { UNDER_30K: "NPT41", FROM_30K_TO_48K: "NPT42", FROM_48K_TO_75K: "NPT43", FROM_75K_TO_110K: "NPT44", OVER_110K: "NPT45" };

// The student's answers in the shape the ordering needs.
export function profileFrom(answers) {
  const pathway = { two: "ASSOCIATE", four: "BACHELOR" }[answers.degree] || "NOT_SURE";
  return {
    programs: [...answers.fields],          // 2-digit fields or 4-digit programs
    pathway,
    home: answers.home || "",
    states: answers.home && answers.scope === "state" ? [answers.home] : [], // empty = anywhere
    priorities: [...answers.priorities],
    income: answers.income || null,         // not asked yet on the "not sure" path
  };
}

export function levels(pathway) {
  return pathway === "ASSOCIATE" ? [2] : pathway === "BACHELOR" ? [3] : [2, 3];
}

// Keeps a college unless the data shows it awards only the other degree level.
function offersPathway(pathway, c) {
  const offers = { 2: c.offers2, 3: c.offers3 };
  if (levels(pathway).some((l) => offers[l])) return true;
  return !(c.offers2 || c.offers3);
}

// Degrees awarded in the latest year (or the year before if missing) in programs starting with code
function recentDegrees(c, code, level) {
  let total = 0;
  for (const p of c.programs) {
    if (p.CREDLEV !== level || !p.CIPCODE.startsWith(code)) continue;
    const v = p.IPEDSCOUNT2 ?? p.IPEDSCOUNT1;
    if (v != null && v > 0) total += v;
  }
  return total;
}

function awardedAt(c, code, level) {
  return c.programs.some((p) => p.CREDLEV === level && p.CIPCODE.startsWith(code)
    && ((p.IPEDSCOUNT1 ?? 0) > 0 || (p.IPEDSCOUNT2 ?? 0) > 0));
}

// One college through the program check (CollegeRecommendation.java)
export function evaluate(profile, c) {
  const lv = levels(profile.pathway);
  const r = { college: c };
  if (!profile.programs.length) {
    r.programsAwarded = 0;
    r.recentDegrees = lv.reduce((sum, l) => sum + recentDegrees(c, "", l), 0);
    r.associateAwarded = c.offers2 && lv.includes(2);
    r.bachelorAwarded = c.offers3 && lv.includes(3);
    r.awardedNames = [];
  } else {
    const families = new Set(profile.programs.filter((p) => p.length === 2));
    let awarded = 0, degrees = 0, anyAssociate = false, anyBachelor = false;
    r.awardedNames = [];
    for (const code of profile.programs) {
      let isAwarded = false;
      for (const level of lv) {
        if (!awardedAt(c, code, level)) continue;
        isAwarded = true;
        if (level === 2) anyAssociate = true; else anyBachelor = true;
        // a program inside a chosen field is already counted by the field
        if (code.length === 2 || !families.has(code.slice(0, 2))) degrees += recentDegrees(c, code, level);
      }
      if (isAwarded) { awarded++; r.awardedNames.push(code); }
    }
    r.programsAwarded = awarded;
    r.recentDegrees = degrees;
    r.associateAwarded = anyAssociate;
    r.bachelorAwarded = anyBachelor;
  }
  r.hasProgramEvidence = !profile.programs.length || r.programsAwarded > 0;
  // Campus matches: only the preferences the student stated (states for now)
  r.campusConsidered = profile.states.length ? 1 : 0;
  r.campusMatched = profile.states.length && profile.states.includes(c.STABBR) ? 1 : 0;
  return r;
}

// ---------- values used for ordering and on the cards ----------

// Average paid after grants, comparable across colleges. Out-of-state publics are not comparable
// (their averages use in-state rates), so null.
export function comparableCost(profile, c) {
  if (c.isPublic && profile.home && profile.home !== c.STABBR) return null;
  return profile.income ? c[INCOME_KEYS[profile.income]] ?? null : c.NPT4 ?? null;
}

export function outOfStatePublic(profile, c) {
  return c.isPublic && profile.home && profile.home !== c.STABBR;
}

// Private two-year rates use a different measure than the four-year colleges they are grouped with.
export function comparableCompletion(c) {
  if (!c.isPublic && c.twoYear) return null;
  return c.completionRate;
}

// Open admission first (2), then admission rate; -1 = unknown
export function admissionAccess(c) {
  if (c.openAdmission === true) return 2;
  if (c.ADM_RATE != null && c.ADM_RATE > 0) return c.ADM_RATE;
  return -1;
}

function studyRelevance(profile, r) {
  if (!profile.programs.length) return 0;
  const fit = profile.pathway === "ASSOCIATE" ? r.associateAwarded
    : profile.pathway === "BACHELOR" ? r.bachelorAwarded
    : r.associateAwarded && r.bachelorAwarded;
  return r.programsAwarded * 2 + (fit ? 1 : 0);
}

// Smaller key = earlier; null = last. Close values share a key so the next priority decides.
function sortKey(priority, profile, r) {
  const c = r.college;
  switch (priority) {
    case "COSTS": {
      const cost = comparableCost(profile, c);
      return cost == null ? null : Math.floor(cost / COST_STEP);
    }
    case "GRADUATION": {
      const rate = comparableCompletion(c);
      return rate == null ? null : -Math.floor((rate * 100) / RATE_STEP);
    }
    case "ADMISSION": {
      const a = admissionAccess(c);
      return a < 0 ? null : -Math.floor((a * 100) / ADMIT_STEP);
    }
    case "STUDY":
      return -studyRelevance(profile, r);
    default:
      return -r.campusMatched;
  }
}

export function orderUsed(profile) {
  return profile.priorities.length ? profile.priorities : ["CAMPUS", "STUDY"];
}

function compareKeys(a, b) {
  if (a === b) return 0;
  if (a == null) return 1;   // nulls last
  if (b == null) return -1;
  return a < b ? -1 : 1;
}

// Java's String.CASE_INSENSITIVE_ORDER
function caseInsensitive(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    let x = a[i], y = b[i];
    if (x === y) continue;
    x = x.toUpperCase(); y = y.toUpperCase();
    if (x === y) continue;
    x = x.toLowerCase(); y = y.toLowerCase();
    if (x !== y) return x.charCodeAt(0) - y.charCodeAt(0);
  }
  return a.length - b.length;
}

export function recommend(data, profile) {
  const states = new Set(profile.states);
  const out = [];
  for (const c of data.colleges) {
    if (!offersPathway(profile.pathway, c)) continue;
    if (states.size && !states.has(c.STABBR)) continue;
    const r = evaluate(profile, c);
    if (!r.hasProgramEvidence) continue;
    out.push(r);
  }
  const order = orderUsed(profile);
  const byDegrees = order.includes("STUDY");
  const keys = new Map(out.map((r) => [r, order.map((p) => sortKey(p, profile, r))]));
  out.sort((a, b) => {
    const ka = keys.get(a), kb = keys.get(b);
    for (let i = 0; i < ka.length; i++) {
      const d = compareKeys(ka[i], kb[i]);
      if (d) return d;
    }
    if (byDegrees && a.recentDegrees !== b.recentDegrees) return b.recentDegrees - a.recentDegrees;
    return caseInsensitive(a.college.INSTNM, b.college.INSTNM);
  });
  return out;
}

export function groups(ranked) {
  const out = Object.fromEntries(GROUPS.map((g) => [g, []]));
  for (const r of ranked) out[r.college.type].push(r);
  return out;
}
