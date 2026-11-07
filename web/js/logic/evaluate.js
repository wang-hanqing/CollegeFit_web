// What each lens says about one college, for the details page. Ported from CollegeRecommendation.java,
// AcademicEvaluator.java, FinancialEvaluator.java, SocialEvaluator.java and NextStepGenerator.java.
// Every result is { status, label, facts: [{ label, value, note, match }], reason, nextStep }.
// No lens ever predicts the student's own admission or price; school statistics are context.
// tests/evaluate.test.mjs compares the English text with the Java version, line by line.
import { t, formatNumber } from "../i18n.js";
import { levels } from "./explore.js";

const HIGHLY_SELECTIVE = 0.15, SLIGHTLY_OVER = 1.1;
const SMALL_MAX = 1999, MEDIUM_MAX = 9999;
const MAX_LISTED = 6, FIELD_EARNINGS_SHOWN = 3;
const INCOME_KEYS = { UNDER_30K: "NPT41", FROM_30K_TO_48K: "NPT42", FROM_48K_TO_75K: "NPT43", FROM_75K_TO_110K: "NPT44", ABOVE_110K: "NPT45" };
const SETTINGS = { 1: "URBAN", 2: "SUBURBAN", 3: "TOWN", 4: "RURAL" };
const ORDER_SETTINGS = ["URBAN", "SUBURBAN", "TOWN", "RURAL"];
const ORDER_SIZES = ["SMALL", "MEDIUM", "LARGE"];

const fact = (label, value, note = "", match = null) => ({ label, value, note, match });
const result = (status, label, facts, reason = "", nextStep = "", matched = 0, considered = 0) =>
  ({ status, label, facts, reason, nextStep, matched, considered });

export function money(n) {
  if (n == null) return t("money.notReported");
  const text = formatNumber(Math.abs(n), { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  return n < 0 ? `-${text}` : text;
}
const num = (n) => (n == null ? t("money.notReported") : formatNumber(n));
const pct = (rate) => `${formatNumber(Math.round(rate * 100))}%`;

// ---------- college helpers (College.java) ----------

function rows(c, code, level) {
  return c.programs.filter((p) => p.CREDLEV === level && p.CIPCODE.startsWith(code));
}

// AWARDED (0) < ZERO_AWARDS (1) < NOT_CONFIRMED (2)
function evidenceOfRow(p) {
  if ((p.IPEDSCOUNT1 ?? 0) > 0 || (p.IPEDSCOUNT2 ?? 0) > 0) return 0;
  if (p.IPEDSCOUNT1 != null && p.IPEDSCOUNT2 != null) return 1;
  return 2;
}
export function evidence(c, code, level) {
  const found = rows(c, code, level);
  if (code.length === 4) return found.length ? evidenceOfRow(found[0]) : 2;
  return found.reduce((best, p) => Math.min(best, evidenceOfRow(p)), 2);
}
const EVIDENCE = ["AWARDED", "ZERO_AWARDS", "NOT_CONFIRMED"];

export function recentDegrees(c, code, level) {
  let total = 0;
  for (const p of rows(c, code, level)) {
    const v = p.IPEDSCOUNT2 ?? p.IPEDSCOUNT1;
    if (v != null && v > 0) total += v;
  }
  return total;
}

function familyProgramsAwarded(c, family, level) {
  return rows(c, family, level).filter((p) => evidenceOfRow(p) === 0).length;
}

// Largest programs in a field with reported earnings: [{ cip, earnings }]
function fieldEarnings(c, family, level, limit) {
  return rows(c, family, level)
    .filter((p) => p.EARN_MDN_1YR != null && evidenceOfRow(p) === 0)
    .map((p) => ({ cip: p.CIPCODE, earnings: p.EARN_MDN_1YR, size: recentDegrees(c, p.CIPCODE, level) }))
    .sort((a, b) => b.size - a.size || (a.cip < b.cip ? -1 : 1))
    .slice(0, limit);
}

function programEarnings(c, cip, level) {
  return rows(c, cip, level).find((p) => p.CIPCODE === cip)?.EARN_MDN_1YR ?? null;
}

export function setting(c) {
  return SETTINGS[Math.trunc((c.LOCALE ?? 0) / 10)] || "NOT_SURE";
}

export function sizeOf(c) {
  const u = c.UGDS;
  if (u == null) return null;
  return u <= SMALL_MAX ? "SMALL" : u <= MEDIUM_MAX ? "MEDIUM" : "LARGE";
}

export function outOfStateCost(c) {
  if (c.COSTT4_A == null || c.TUITIONFEE_IN == null || c.TUITIONFEE_OUT == null) return null;
  return c.COSTT4_A - c.TUITIONFEE_IN + c.TUITIONFEE_OUT;
}

const isOutOfStatePublic = (s, c) => c.isPublic && s.home && s.home !== c.STABBR;
const netPrice = (s, c) => (INCOME_KEYS[s.income] ? c[INCOME_KEYS[s.income]] ?? null : null);

function names(list) {
  if (list.length === 1) return list[0];
  if (list.length <= 3) return `${list.slice(0, -1).join(", ")} ${t("and")} ${list.at(-1)}`;
  return `${list.slice(0, 3).join(", ")} ${t("prog.andMore", formatNumber(list.length - 3))}`;
}

// ---------- program check (CollegeRecommendation.java) ----------

export function programResult(s, c, data, familyName) {
  const lv = levels(s.pathway);
  if (!s.programs.length) {
    return {
      ...result("UNKNOWN", t("prog.label.none"),
        [fact(t("lens.program"), t("prog.none"), t("prog.none.note"))], "", t("prog.next.none")),
      programsAwarded: 0,
      recentDegrees: lv.reduce((sum, l) => sum + recentDegrees(c, "", l), 0),
      associateAwarded: c.offers2 && lv.includes(2),
      bachelorAwarded: c.offers3 && lv.includes(3),
      nursingBachelor: false,
    };
  }
  const programName = (code) => (code.length === 2 ? familyName(code)
    : (data.programNames[code] || code).split(",")[0]);

  const facts = [], steps = [], awardedNames = [], otherNames = [];
  const families = new Set(s.programs.filter((p) => p.length === 2));
  let nursing = false, anyAssociate = false, anyBachelor = false, awarded = 0, degrees = 0, singleLabel = "";

  for (const code of s.programs) {
    let best = 2;
    const nm = programName(code);
    const parts = [], awardedLevels = [];
    let bachelorHere = false;
    for (const level of lv) {
      const e = evidence(c, code, level);
      if (e === 0) {
        const levelName = t(`prog.level.${level}`);
        const graduates = recentDegrees(c, code, level);
        if (code.length === 2) {
          const k = familyProgramsAwarded(c, code, level);
          parts.push(t(k === 1 ? "prog.part.family.one" : "prog.part.family", levelName, formatNumber(k), num(graduates)));
        } else {
          parts.push(t("prog.part.awarded", levelName, num(graduates)));
        }
        if (level === 2) anyAssociate = true; else { anyBachelor = true; bachelorHere = true; }
        awardedLevels.push(level);
        if (code.length === 2 || !families.has(code.slice(0, 2))) degrees += graduates;
      }
      best = Math.min(best, e);
    }
    const isAwarded = best === 0;
    const value = isAwarded ? parts.join(". ") : t(`prog.value.${EVIDENCE[best]}`);
    const note = isAwarded ? "" : t(`prog.note.${EVIDENCE[best]}`);
    if (s.programs.length <= MAX_LISTED || (isAwarded && awardedNames.length < MAX_LISTED)) {
      facts.push(fact(nm, value, note, isAwarded));
      if (s.programs.length <= MAX_LISTED) {
        for (const level of awardedLevels) {
          const lvName = t(`prog.level.${level}`).toLowerCase();
          if (code.length === 4) {
            const pay = programEarnings(c, code, level);
            if (pay != null) facts.push(fact(t("prog.earnings", nm, lvName), money(pay), t("prog.earnings.note")));
          } else {
            const list = fieldEarnings(c, code, level, FIELD_EARNINGS_SHOWN);
            list.forEach((row, i) => facts.push(fact(
              t("prog.earnings", data.programNames[row.cip] || row.cip, lvName), money(row.earnings),
              i === list.length - 1 ? t("prog.earnings.note") : "")));
          }
        }
      }
    }
    if (isAwarded) {
      awarded++;
      awardedNames.push(nm);
      if (code === "5138" && bachelorHere) nursing = true; // CIP 5138 also covers RN-to-BSN programs
    } else {
      otherNames.push(nm);
      if (s.programs.length <= MAX_LISTED) steps.push(t(best === 1 ? "prog.next.zero" : "prog.next.confirm", nm));
    }
    singleLabel = t(`prog.label.one.${EVIDENCE[best]}`, nm);
  }

  const total = s.programs.length;
  if (total > MAX_LISTED) {
    if (awardedNames.length > MAX_LISTED) facts.push(fact(t("prog.moreAwarded"), String(awardedNames.length - MAX_LISTED), "", true));
    if (otherNames.length) {
      facts.push(fact(t("prog.others"), t("prog.others.value", formatNumber(otherNames.length)), t("prog.others.note")));
      steps.unshift(t("prog.next.others"));
    }
  }
  if (awardedNames.length) {
    steps.unshift(awardedNames.length === 1 ? t("prog.next.verify.one", awardedNames[0]) : t("prog.next.verify", names(awardedNames)));
  }
  if (nursing) steps.splice(1, 0, t("prog.next.license"));

  const level = anyAssociate && anyBachelor ? t("level.both") : t(anyBachelor ? "level.bachelor" : "level.associate");
  const label = total === 1 ? singleLabel : t("prog.label.many", formatNumber(awarded), formatNumber(total));
  const reason = !awardedNames.length ? ""
    : awardedNames.length === 1 && degrees > 0 ? t("prog.reason.count", num(degrees), awardedNames[0], level)
    : t("prog.reason", names(awardedNames));
  return {
    ...result(awarded > 0 ? "INFO" : "NEEDS_VERIFICATION", label, facts, reason, steps.join("\n")),
    programsAwarded: awarded, recentDegrees: degrees,
    associateAwarded: anyAssociate, bachelorAwarded: anyBachelor, nursingBachelor: nursing,
  };
}

// ---------- academic lens (AcademicEvaluator.java) ----------

function band(score, p25, p75) {
  return score < p25 ? "BELOW" : score > p75 ? "ABOVE" : "WITHIN";
}

export function academicResult(s, c) {
  const facts = [];
  let rate = c.ADM_RATE ?? null;
  const open = c.openAdmission === true;
  if (open) facts.push(fact(t("ac.policy"), t("ac.open"), t("ac.open.note")));
  else if (rate != null && rate <= 0) {
    rate = null; // a 0% rate is not believable for a college with students
    facts.push(fact(t("ac.policy"), t("ac.rate.unusable"), t("ac.rate.unusable.note")));
  } else if (rate != null) facts.push(fact(t("ac.rateLabel"), pct(rate), t("ac.rate.note")));
  else facts.push(fact(t("ac.policy"), t("notReported")));

  const policy = c.ADMCON7;
  if (!(open && policy == null)) {
    facts.push(fact(t("ac.test"), [1, 2, 3, 5].includes(policy) ? t(`ac.test.${policy}`) : t("notReported")));
  }

  let reading = null, math = null;
  if (s.satReading != null && s.satMath != null) {
    if (c.SATVR25 == null || c.SATVR75 == null || c.SATMT25 == null || c.SATMT75 == null) {
      facts.push(fact(t("ac.sat"), t("ac.sat.noRanges"), t("ac.sat.noRanges.note")));
    } else {
      reading = band(s.satReading, c.SATVR25, c.SATVR75);
      math = band(s.satMath, c.SATMT25, c.SATMT75);
      facts.push(fact(t("ac.sat.reading"), t(`ac.band.${reading}`, String(s.satReading), `${c.SATVR25}-${c.SATVR75}`), t("ac.sat.range.note")));
      facts.push(fact(t("ac.sat.math"), t(`ac.band.${math}`, String(s.satMath), `${c.SATMT25}-${c.SATMT75}`), t("ac.sat.range.note")));
    }
  }
  facts.push(fact(t("ac.program"), t("ac.program.value"), t("ac.program.note")));

  const next = t("ac.next");
  if (rate != null && rate < HIGHLY_SELECTIVE) return result("NEEDS_VERIFICATION", t("ac.label.selective", pct(rate)), facts, "", next);
  if (reading) {
    const overall = reading === math ? reading : "MIXED";
    const status = overall === "BELOW" || overall === "MIXED" ? "NEEDS_VERIFICATION" : "INFO";
    const reason = overall === "WITHIN" || overall === "ABOVE" ? t("ac.reason.sat") : "";
    return result(status, t(`ac.label.sat.${overall}`), facts, reason, next);
  }
  if (open) return result("INFO", t("ac.open"), facts, t("ac.reason.open"), "");
  if (rate != null) return result("INFO", t("ac.label.rate", pct(rate)), facts, rate >= 0.5 ? t("ac.reason.rate", pct(rate)) : "", next);
  return result("UNKNOWN", t("ac.label.unknown"), facts, "", next);
}

// ---------- financial lens (FinancialEvaluator.java) ----------

function netNote(c, net) {
  let note = t(c.isPublic ? "fin.net.public.note" : "fin.net.note");
  if (net < 0) note += ` ${t("fin.net.negative.note")}`;
  return note;
}

export function financialResult(s, c) {
  const facts = [];
  const oos = isOutOfStatePublic(s, c);
  facts.push(fact(t("fin.cost"), money(c.COSTT4_A), t(c.isPublic ? "fin.cost.public.note" : "fin.cost.note")));
  if (c.isPublic) {
    facts.push(fact(t("fin.tuitionIn"), money(c.TUITIONFEE_IN), t("fin.tuitionIn.note")));
    facts.push(fact(t("fin.tuitionOut"), money(c.TUITIONFEE_OUT), t("fin.tuitionOut.note")));
    if (oos) facts.push(fact(t("fin.oosEstimate"), money(outOfStateCost(c)), t("fin.oosEstimate.note")));
  } else {
    facts.push(fact(t("fin.tuition"), money(c.TUITIONFEE_IN), t("fin.tuition.note")));
  }

  let net = null;
  const bracketNet = netPrice(s, c);
  if (oos) facts.push(fact(t("fin.net"), t("fin.net.oos"), t("fin.net.oos.note")));
  else if (bracketNet != null) {
    net = bracketNet;
    facts.push(fact(t("fin.net.bracket", t(`IncomeBracket.${s.income}`)), money(net), netNote(c, net)));
  } else if (c.NPT4 != null) facts.push(fact(t("fin.net.all"), money(c.NPT4), netNote(c, c.NPT4)));
  else facts.push(fact(t("fin.net"), t("notReported")));

  const next = !c.NPCURL ? t("fin.next.noNpc") : c.isPublic && !oos ? t("fin.next.residency") : t("fin.next");
  const published = oos ? outOfStateCost(c) : c.COSTT4_A;
  if (published == null && net == null && c.NPT4 == null) return result("UNKNOWN", t("fin.label.insufficient"), facts, "", next);

  const reason = net != null && net < 10000 ? t("fin.reason.net", money(net)) : "";
  if (s.budget == null) return result("NEEDS_VERIFICATION", t("fin.label.verify"), facts, reason, next);

  const useNet = s.aid === "YES" && net != null;
  if (!useNet && published == null) return result("NEEDS_VERIFICATION", t("fin.label.verify"), facts, reason, next);
  const reference = useNet ? net : published;
  const basis = t(useNet ? "fin.basis.net" : "fin.basis.published");
  facts.push(fact(t("fin.budget"), money(s.budget), t("fin.budget.note", basis, money(reference)), reference <= s.budget));

  if (reference <= s.budget) return result("INFO", t("fin.label.within"), facts, t("fin.reason.within"), next);
  if (!useNet && s.aid !== "NO") return result("NEEDS_VERIFICATION", t("fin.label.beforeAid"), facts, reason, next);
  if (reference <= s.budget * SLIGHTLY_OVER) return result("NEEDS_VERIFICATION", t("fin.label.slightly"), facts, reason, next);
  return result("MISMATCH", t("fin.label.above"), facts, "", next);
}

// ---------- social lens (SocialEvaluator.java) ----------

export function socialResult(s, c) {
  const facts = [];
  let considered = 0, matched = 0;

  if (s.states.length) {
    const ok = s.states.includes(c.STABBR);
    considered++; if (ok) matched++;
    facts.push(fact(t("soc.state"), c.STABBR, t("soc.youChose", s.states.join(", ")), ok));
  } else {
    facts.push(fact(t("soc.state"), c.STABBR, t("soc.noPreference")));
  }

  const where = setting(c);
  const settingValue = where === "NOT_SURE" ? t("unavailable") : t(`CampusSetting.${where}`);
  const wanted = ORDER_SETTINGS.filter((x) => s.settings.includes(x));
  if (!wanted.length) facts.push(fact(t("soc.setting"), settingValue, t("soc.noPreference")));
  else if (where === "NOT_SURE") facts.push(fact(t("soc.setting"), settingValue, t("soc.dataMissing")));
  else {
    const ok = wanted.includes(where);
    considered++; if (ok) matched++;
    facts.push(fact(t("soc.setting"), settingValue, t("soc.youChose", wanted.map((x) => t(`CampusSetting.${x}`)).join(", ")), ok));
  }

  const size = sizeOf(c);
  const sizeValue = size == null ? t("unavailable") : t("soc.size.value", num(c.UGDS), t(`CollegeSize.short.${size}`));
  const online = t("soc.size.online");
  const sizes = ORDER_SIZES.filter((x) => s.sizes.includes(x));
  if (!sizes.length) facts.push(fact(t("soc.size"), sizeValue, `${t("soc.noPreference")} ${online}`));
  else if (size == null) facts.push(fact(t("soc.size"), sizeValue, t("soc.dataMissing")));
  else {
    const ok = sizes.includes(size);
    considered++; if (ok) matched++;
    facts.push(fact(t("soc.size"), sizeValue, `${t("soc.youChose", sizes.map((x) => t(`CollegeSize.${x}`)).join(", "))} ${online}`, ok));
  }

  if (!considered) return result("UNKNOWN", t("soc.label.none"), facts, "", t("soc.next.none"));
  const all = matched === considered;
  return result(all ? "MATCH" : "MISMATCH", t("soc.label", formatNumber(matched), formatNumber(considered)), facts,
    all ? t("soc.reason", formatNumber(matched), formatNumber(considered)) : "", all ? "" : t("soc.next.flexible"), matched, considered);
}

// ---------- the whole picture for one college ----------

export function evaluateAll(s, c, data, familyName) {
  const program = programResult(s, c, data, familyName);
  const academic = academicResult(s, c);
  const financial = financialResult(s, c);
  const social = socialResult(s, c);
  const lenses = [program, academic, financial, social];

  const reasons = lenses.flatMap((r) => r.reason.split("\n")).filter((x) => x.trim());
  const steps = [...new Set([...lenses.flatMap((r) => r.nextStep.split("\n")).filter((x) => x.trim()), t("step.support")])];
  return { college: c, program, academic, financial, social, reasons, steps };
}
