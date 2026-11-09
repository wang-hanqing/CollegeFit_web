// Compare (web step 5; "Compare and decide" in Java). Ported from Comparison.java.
// Marks a difference only when it is large and measured the same way, never calls one college "better",
// and writes a short trade-off summary in the order of the student's priorities.
// tests/compare.test.mjs checks the English text against the Java version.
import { t, formatNumber } from "../i18n.js";
import { comparableCost } from "./explore.js";
import { money } from "./evaluate.js";

export const ROWS = ["DEGREE", "COSTS", "GRADUATION", "ADMISSION", "STUDY", "CAMPUS"];
const COST_GAP = 2000, RATE_GAP = 5, ADMIT_GAP = 10, STUDY_RATIO = 2;

// Degree level first (it changes the path), then her priorities, then the remaining rows.
export function rowOrder(profile) {
  const out = ["DEGREE", ...profile.priorities];
  for (const r of ROWS) if (!out.includes(r)) out.push(r);
  return out;
}

// "CUNY Hunter College" -> "Hunter" keeps sentences readable
export function shortName(c) {
  let n = c.INSTNM;
  if (n.startsWith("CUNY ")) n = n.slice(5);
  if (n.startsWith("SUNY ")) n = n.slice(5);
  return n.replaceAll(" Community College", " CC").replaceAll(" College", "").trim();
}

function names(list) {
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(", ")} ${t("and")} ${list.at(-1)}`;
}

const pct = (v) => Math.round(v * 100);
const pctText = (v) => `${formatNumber(pct(v))}%`;

// "associate", "bachelor's" or both, for her programs (or for the college if none chosen)
export function degreeText(profile, e) {
  const a = profile.programs.length ? e.program.associateAwarded : e.college.offers2;
  const b = profile.programs.length ? e.program.bachelorAwarded : e.college.offers3;
  if (a && b) return t("level.both");
  if (b) return t("level.bachelor");
  if (a) return t("level.associate");
  return t("notReported");
}

// evaluations: results of evaluateAll for 1 to 3 colleges, in the order shown
export function compare(profile, evaluations) {
  const markers = new Map(evaluations.map((e) => [e, {}]));
  const mark = (e, row, key, ...values) => (markers.get(e)[row] = t(key, ...values));
  const summary = [];
  const out = { markers, summary, differentDegrees: false };

  const degreeSets = new Map();
  for (const e of evaluations) {
    const d = degreeText(profile, e);
    if (!degreeSets.has(d)) degreeSets.set(d, []);
    degreeSets.get(d).push(shortName(e.college));
  }
  out.differentDegrees = degreeSets.size > 1;
  if (evaluations.length < 2) return out;

  const sentences = {
    DEGREE: (() => {
      if (degreeSets.size < 2) return null;
      const parts = [...degreeSets].map(([d, list]) => t("cmp.degree.part", d, names(list)));
      evaluations.forEach((e) => mark(e, "DEGREE", "cmp.mark.differentPath"));
      return t("cmp.degree", parts.join("; "));
    })(),

    COSTS: (() => {
      const ok = [], notComparable = [];
      for (const e of evaluations) {
        if (comparableCost(profile, e.college) != null) ok.push(e);
        else { notComparable.push(shortName(e.college)); mark(e, "COSTS", "cmp.mark.notComparable"); }
      }
      const extra = notComparable.length ? ` ${t("cmp.cost.notComparable", names(notComparable))}` : "";
      if (ok.length < 2) return notComparable.length ? t("cmp.cost.none") + extra : null;
      ok.sort((a, b) => comparableCost(profile, a.college) - comparableCost(profile, b.college));
      const low = comparableCost(profile, ok[0].college), high = comparableCost(profile, ok.at(-1).college);
      if (high - low < COST_GAP) return t("cmp.cost.similar", money(low), money(high)) + extra;
      mark(ok[0], "COSTS", "cmp.mark.lowerCost");
      return t("cmp.cost.lower", shortName(ok[0].college), shortName(ok.at(-1).college), money(low), money(high)) + extra;
    })(),

    GRADUATION: (() => {
      const byMeasure = new Map(); // 6-year first, then 3-year
      const missing = [];
      for (const e of evaluations) {
        if (e.college.completionRate == null) { missing.push(shortName(e.college)); continue; }
        const years = e.college.completionYears;
        if (!byMeasure.has(years)) byMeasure.set(years, []);
        byMeasure.get(years).push(e);
      }
      const parts = [];
      const mixed = byMeasure.size > 1;
      for (const years of [...byMeasure.keys()].sort((a, b) => b - a)) {
        const g = byMeasure.get(years);
        if (mixed) g.forEach((e) => mark(e, "GRADUATION", `cmp.mark.measure.${years}`));
        if (g.length >= 2) {
          g.sort((a, b) => b.college.completionRate - a.college.completionRate);
          const hi = pct(g[0].college.completionRate), lo = pct(g.at(-1).college.completionRate);
          if (hi - lo >= RATE_GAP) {
            mark(g[0], "GRADUATION", "cmp.mark.higherRate");
            parts.push(t(`cmp.grad.higher.${years}`, shortName(g[0].college), shortName(g.at(-1).college),
              pctText(g[0].college.completionRate), pctText(g.at(-1).college.completionRate)));
          } else {
            parts.push(t(`cmp.grad.similar.${years}`, names(g.map((e) => shortName(e.college)))));
          }
        } else if (mixed) {
          parts.push(t(`cmp.grad.single.${years}`, shortName(g[0].college), pctText(g[0].college.completionRate)));
        }
      }
      if (missing.length) parts.push(t("cmp.grad.missing", names(missing)));
      return parts.length ? `${parts.join(" ")} ${t("cmp.grad.note")}` : null;
    })(),

    ADMISSION: (() => {
      const open = [], rated = [];
      for (const e of evaluations) {
        if (e.college.openAdmission === true) { open.push(shortName(e.college)); mark(e, "ADMISSION", "ac.open"); }
        else if (e.college.ADM_RATE != null && e.college.ADM_RATE > 0) rated.push(e);
      }
      const parts = [];
      if (open.length && open.length < evaluations.length) parts.push(t("cmp.adm.open", names(open)));
      if (rated.length >= 2) {
        rated.sort((a, b) => b.college.ADM_RATE - a.college.ADM_RATE);
        const hi = pct(rated[0].college.ADM_RATE), lo = pct(rated.at(-1).college.ADM_RATE);
        if (hi - lo >= ADMIT_GAP) {
          mark(rated[0], "ADMISSION", "cmp.mark.higherAdmit");
          parts.push(t("cmp.adm.higher", shortName(rated[0].college), shortName(rated.at(-1).college),
            pctText(rated[0].college.ADM_RATE), pctText(rated.at(-1).college.ADM_RATE)));
        }
      }
      return parts.length ? parts.join(" ") : null;
    })(),

    // Program size only: no marker, never "better"
    STUDY: (() => {
      if (!profile.programs.length) return null;
      const byLevel = new Map();
      for (const e of evaluations) {
        const d = degreeText(profile, e);
        if (!byLevel.has(d)) byLevel.set(d, []);
        byLevel.get(d).push(e);
      }
      for (const g of byLevel.values()) {
        if (g.length < 2) continue;
        g.sort((a, b) => b.program.recentDegrees - a.program.recentDegrees);
        const hi = g[0].program.recentDegrees, lo = g.at(-1).program.recentDegrees;
        if (lo > 0 && hi >= lo * STUDY_RATIO) {
          return t("cmp.study.more", shortName(g[0].college), shortName(g.at(-1).college), formatNumber(hi), formatNumber(lo));
        }
      }
      return null;
    })(),

    CAMPUS: (() => {
      const match = [], not = [];
      for (const e of evaluations) {
        if (e.social.considered === 0) return null;
        (e.social.matched === e.social.considered ? match : not).push(shortName(e.college));
      }
      return match.length && not.length ? t("cmp.campus", names(match)) : null;
    })(),
  };

  for (const row of rowOrder(profile)) if (sentences[row]) summary.push(sentences[row]);
  summary.push(t("cmp.closing"));
  return out;
}
