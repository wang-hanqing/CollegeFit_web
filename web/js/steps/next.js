// Step 6: Your colleges and next steps. Ported from NextStepsPanel.java and Shortlist.exportCsv.
// Web version, in four parts:
//   1. a card per college: the student's own safety / target / reach call, reminders only for that
//      college (a program it may not offer, out-of-state tuition), and its two links
//   2. a check of the whole list (acceptance rates, the student's own calls, college types)
//   3. this school year, by grade; New York City specifics when the student lives in New York
//   4. steps for every college, each once
// The CSV export has one column per college, so a counselor can read it side by side.
import { t, formatNumber, currentLanguage } from "../i18n.js";
import { escapeHtml } from "../ui.js";
import { familyName } from "./direction.js";
import { pageFor } from "./details.js";
import { compareList, TIERS } from "./compare.js";
import { profileFrom, comparableCost, levels } from "../logic/explore.js";
import { evaluateAll, evidence, money, outOfStateCost, setting, sizeOf } from "../logic/evaluate.js";
import { degreeText } from "../logic/compare.js";

// How many steps exist for each grade (keys web.grade.<grade>.<n>; web.nyc.<grade>.<n> for New York)
const GRADE_STEPS = { 9: 3, 10: 3, 11: 4, 12: 5 };
const NYC_STEPS = { 9: 3, 10: 3, 11: 5, 12: 6 };

// Fall of the year the student would start college, from the grade and today's school year
export function startYear(grade) {
  const now = new Date();
  const schoolYearEnds = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  return typeof grade === "number" ? schoolYearEnds + (12 - grade) : null;
}

function programName(code, data) {
  return code.length === 2 ? familyName(code) : (data.programNames[code] || code).split(",")[0];
}

// Reminders that belong to one college only
function collegeChecks(c, profile, data, e) {
  const lv = levels(profile.pathway);
  const checks = profile.programs.slice(0, 6)
    .filter((code) => !lv.some((level) => evidence(c, code, level) === 0))
    .map((code) => t("web.next.notOffered", programName(code, data)));
  if (c.isPublic && profile.home && profile.home !== c.STABBR) checks.push(t("web.next.oos"));
  if (e.program.nursingBachelor) checks.push(t("prog.next.license"));
  if (!c.NPCURL) checks.push(t("fin.next.noNpc"));
  return checks;
}

// Steps for every college, each once
function sharedSteps(profile, answers) {
  const year = startYear(answers.grade);
  const steps = [];
  if (profile.pathway === "NOT_SURE") steps.push(t("step.pathway"));
  steps.push(profile.programs.length
    ? (year ? t("web.next.programs.year", formatNumber(year, { useGrouping: false })) : t("web.next.programs"))
    : t("step.program"));
  if (answers.satStatus !== "PROVIDED") steps.push(t("step.sat"));
  steps.push(t("web.next.npc"));
  // Grades 11 and 12 in New York already have an aid step in "This school year"
  const nycAid = answers.home === "NY" && (answers.grade === 11 || answers.grade === 12);
  if (!nycAid && (answers.aid === "NOT_SURE" || answers.aid === "PREFER_NOT_TO_SAY")) steps.push(t("step.aid"));
  if (answers.budgetStatus !== "KNOWN") steps.push(t("step.budget"));
  steps.push(t("step.support"));
  return steps;
}

// Notes about the whole list: facts about the colleges, never a prediction
function listChecks(colleges, answers, profile) {
  const notes = [];
  const likely = colleges.filter((c) => c.openAdmission === true || c.ADM_RATE >= 0.75);
  if (colleges.length && !likely.length) {
    notes.push(t(profile.home === "NY" ? "web.next.balance.noneMostNY" : "web.next.balance.noneMost"));
  }
  if (colleges.length >= 2 && colleges.every((c) => c.openAdmission !== true && c.ADM_RATE != null && c.ADM_RATE < 0.3)) {
    notes.push(t("web.next.balance.allSelective"));
  }
  const calls = colleges.map((c) => answers.tiers[c.UNITID]).filter((x) => x && x !== "NOT_SURE");
  if (!calls.length) notes.push(t("web.next.tiers.none"));
  else if (!calls.includes("SAFETY")) notes.push(t("web.next.tiers.noSafety"));
  if (colleges.some((c) => c.type === "COMMUNITY_COLLEGE")) notes.push(t("web.next.cc"));
  if (colleges.some((c) => c.type === "PRIVATE")) notes.push(t("web.next.private"));
  return notes;
}

function gradePlan(answers) {
  const g = answers.grade;
  if (g == null) {
    return `<section class="plan grade-plan">
        <h2>${escapeHtml(t("web.next.year.title"))}</h2>
        <p>${escapeHtml(t("web.next.year.pick"))}</p>
        <button type="button" class="secondary small" data-action="pick-grade">${escapeHtml(t("web.next.year.pickButton"))}</button>
      </section>`;
  }
  if (!GRADE_STEPS[g]) return "";
  const nyc = answers.home === "NY";
  const count = nyc ? NYC_STEPS[g] : GRADE_STEPS[g];
  const items = Array.from({ length: count }, (_, i) => t(`${nyc ? "web.nyc" : "web.grade"}.${g}.${i + 1}`));
  return `<section class="plan grade-plan">
      <h2>${escapeHtml(t("web.grade.steps", formatNumber(g)))}</h2>
      ${checklist(items, "grade")}
    </section>`;
}

export function render({ data, answers }) {
  const head = `
    <h1 id="page-title" tabindex="-1">${escapeHtml(t("next.title"))}</h1>
    <p class="lede">${escapeHtml(t("next.subtitle"))}</p>`;
  const ids = answers.kept.filter((id) => !(id in answers.notForMe));
  if (!ids.length) {
    return `${head}
      <p class="notice">${escapeHtml(t("cmp.none"))}</p>
      <button type="button" class="secondary" data-action="to-explore">${escapeHtml(t("web.cmp.toExplore"))}</button>
      ${gradePlan(answers)}
      ${tools(answers)}`;
  }

  const profile = profileFrom(answers);
  const evaluations = ids.map((id) => evaluateAll(profile, data.collegeById.get(id), data, familyName));
  const cards = evaluations.map((e) => {
    const c = e.college;
    const tier = answers.tiers[c.UNITID];
    const checks = collegeChecks(c, profile, data, e);
    return `
      <article class="college-card next-card">
        <h3>${escapeHtml(c.INSTNM)}</h3>
        <p class="where">${escapeHtml(`${c.CITY}, ${c.STABBR}`)}. ${escapeHtml(t(`web.type.${c.type}`))}</p>
        <p class="tier-line"><span class="muted">${escapeHtml(t("web.tier.short"))}</span>
          ${tier && tier !== "NOT_SURE" ? `<span class="tier-tag tier-${tier.toLowerCase()}">${escapeHtml(t(`web.tier.${tier}`))}</span>`
            : `<button type="button" class="link" data-action="to-compare">${escapeHtml(t("web.tier.decide"))}</button>`}</p>
        ${checks.length ? `<ul class="college-checks">${checks.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}
        <div class="card-links">
          ${c.INSTURL ? `<a href="${escapeHtml(c.INSTURL)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("details.site"))}</a>` : ""}
          ${c.NPCURL ? `<a href="${escapeHtml(c.NPCURL)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("details.npc"))}</a>` : ""}
          <button type="button" class="link" data-action="details" data-id="${c.UNITID}">${escapeHtml(t("card.detailsShort"))}</button>
        </div>
      </article>`;
  }).join("");

  const notes = listChecks(evaluations.map((e) => e.college), answers, profile);
  return `${head}
    <div class="college-grid next-cards">${cards}</div>
    ${notes.length ? `<section class="plan list-check">
        <h2>${escapeHtml(t("web.next.list.title"))}</h2>
        <ul>${notes.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
      </section>` : ""}
    ${gradePlan(answers)}
    <section class="plan">
      <h2>${escapeHtml(t("web.next.every"))}</h2>
      ${checklist(sharedSteps(profile, answers), "todo")}
    </section>
    ${tools(answers)}`;
}

// Checkboxes to tick off while working through the list; not saved
function checklist(items, prefix) {
  return `<ul class="checklist">${items.map((x, i) => `
    <li><label><input type="checkbox" id="${prefix}-${i}"><span>${escapeHtml(x)}</span></label></li>`).join("")}</ul>`;
}

function tools(answers) {
  return `
    <div class="link-row no-print">
      <button type="button" class="primary" data-action="export"${answers.kept.length ? "" : " disabled"}>${escapeHtml(t("web.next.export"))}</button>
      <button type="button" class="secondary" data-action="print">${escapeHtml(t("web.next.print"))}</button>
      <button type="button" class="quiet" data-action="start-over">${escapeHtml(t("startOver"))}</button>
    </div>
    <p class="link-status" role="status"></p>
    <p class="privacy">${escapeHtml(t("web.next.privacy"))}</p>
    <dialog id="confirm-dialog" class="help">
      <form method="dialog">
        <p id="confirm-text"></p>
        <div class="dialog-actions">
          <button type="submit" value="cancel" class="secondary">${escapeHtml(t("not.cancel"))}</button>
          <button type="submit" value="ok" class="primary" id="confirm-ok"></button>
        </div>
      </form>
    </dialog>`;
}

function confirm(text, okLabel) {
  const dialog = document.getElementById("confirm-dialog");
  dialog.querySelector("#confirm-text").textContent = text;
  dialog.querySelector("#confirm-ok").textContent = okLabel;
  dialog.returnValue = "";
  dialog.showModal();
  return new Promise((resolve) => dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok"), { once: true }));
}

// ---------- export ----------
// One column per kept college (not set aside), one row per fact, so it reads like the Compare table.
// Then the steps for every college, each once, and the data source.

function csvValue(v) {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv(data, answers) {
  const profile = profileFrom(answers);
  const ids = answers.kept.filter((id) => !(id in answers.notForMe));
  const evaluations = ids.map((id) => evaluateAll(profile, data.collegeById.get(id), data, familyName));
  const pct = (x) => `${Math.round(x * 100)}%`;
  const lv = levels(profile.pathway);
  const rowOf = (label, f) => [label, ...evaluations.map((e) => f(e, e.college))];
  const rows = [
    rowOf(t("export.college"), (e, c) => c.INSTNM),
    rowOf(t("export.city"), (e, c) => c.CITY),
    rowOf(t("export.state"), (e, c) => c.STABBR),
    rowOf(t("web.csv.type"), (e, c) => t(`web.type.${c.type}`)),
    rowOf(t("cmp.row.DEGREE"), (e) => { const d = degreeText(profile, e); return d.charAt(0).toUpperCase() + d.slice(1); }),
    rowOf(t("web.csv.programs"), (e, c) => profile.programs.length
      ? profile.programs.map((code) => `${programName(code, data)}: ${t(lv.some((l) => evidence(c, code, l) === 0) ? "web.csv.yes" : "web.csv.noRecent")}`).join("; ")
      : t("web.cmp.anyProgram")),
    rowOf(t("web.csv.net"), (e, c) => {
      if (c.isPublic && profile.home && profile.home !== c.STABBR) return t("web.csv.notCompared");
      const v = comparableCost(profile, c);
      return v == null ? t("notReported") : money(v);
    }),
    rowOf(t("web.csv.sticker"), (e, c) => {
      const v = c.isPublic && profile.home && profile.home !== c.STABBR ? outOfStateCost(c) : c.COSTT4_A;
      return v == null ? t("notReported") : money(v);
    }),
    rowOf(t("tile.admissionRate"), (e, c) => c.openAdmission === true ? t("ac.open") : c.ADM_RATE > 0 ? pct(c.ADM_RATE) : t("notReported")),
    rowOf(t("tile.completion"), (e, c) => c.completionRate == null ? t("notReported")
      : `${pct(c.completionRate)} ${t("card.completion.measure", formatNumber(c.completionYears))}`),
    rowOf(t("web.csv.transfer"), (e, c) => {
      const v = c.completionYears === 3 ? c.TRANS_L4 : c.TRANS_4;
      return v == null ? t("notReported") : pct(v);
    }),
    rowOf(t("web.tile.campus"), (e, c) => {
      const where = setting(c), size = sizeOf(c);
      const parts = [where === "NOT_SURE" ? t("notReported") : t(`CampusSetting.${where}`)];
      if (size) parts.push(t("web.csv.size", t(`web.size.${size}`), formatNumber(c.UGDS)));
      return parts.join(", ");
    }),
    rowOf(t("web.tier.label"), (e, c) => t(`web.tier.${answers.tiers[c.UNITID] || "NOT_SURE"}`)),
    rowOf(t("web.csv.checks"), (e, c) => collegeChecks(c, profile, data, e).join("; ")),
    rowOf(t("details.website"), (e, c) => c.INSTURL || ""),
    rowOf(t("web.csv.npc"), (e, c) => c.NPCURL || ""),
    [],
    [t("web.next.every")],
    ...sharedSteps(profile, answers).map((x) => [x]),
    [],
    [t("details.disclaimer")],
  ];
  return "\ufeff" + rows.map((r) => r.map(csvValue).join(",")).join("\r\n") + "\r\n"; // BOM so Excel reads UTF-8
}

function download(text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CollegeFit_my_list_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function onClick(event, { data, answers, go, reset }) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  switch (target.dataset.action) {
    case "details": go("explore", pageFor(target.dataset.id)); break;
    case "to-explore": go("explore"); break;
    case "to-compare": go("compare"); break;
    case "pick-grade": {
      const side = document.getElementById("side");
      side?.classList.add("is-open");
      side?.querySelector(".side-toggle")?.setAttribute("aria-expanded", "true");
      side?.querySelector('[data-action="grade"]')?.focus();
      break;
    }
    case "print": window.print(); break;
    case "export":
      if (await confirm(t("list.privacy.confirm"), t("web.next.export"))) {
        download(exportCsv(data, answers));
        document.querySelector(".link-status").textContent = t("web.next.exported");
      }
      break;
    case "start-over":
      if (await confirm(t("web.startOver.confirm"), t("web.startOver.yes"))) reset();
      break;
  }
}
