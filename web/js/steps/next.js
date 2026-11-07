// Step 6: Your colleges and next steps. Ported from NextStepsPanel.java and Shortlist.exportCsv,
// plus steps for the student's grade (new in the web version, from SQL course feedback).
import { t, formatNumber, currentLanguage } from "../i18n.js";
import { escapeHtml } from "../ui.js";
import { familyName } from "./direction.js";
import { pageFor } from "./details.js";
import { compareList } from "./compare.js";
import { profileFrom } from "../logic/explore.js";
import { evaluateAll } from "../logic/evaluate.js";

// How many steps exist for each grade (keys web.grade.<grade>.<n>)
const GRADE_STEPS = { 9: 3, 10: 3, 11: 4, 12: 5 };

// Steps from her own answers, the same for every college (NextStepGenerator.profileSteps)
function profileSteps(profile, answers) {
  const steps = [];
  if (profile.pathway === "NOT_SURE") steps.push(t("step.pathway"));
  if (!profile.programs.length) steps.push(t("step.program"));
  if (answers.satStatus !== "PROVIDED") steps.push(t("step.sat"));
  if (answers.aid === "NOT_SURE" || answers.aid === "PREFER_NOT_TO_SAY") steps.push(t("step.aid"));
  if (answers.budgetStatus !== "KNOWN") steps.push(t("step.budget"));
  if (!profile.income) steps.push(t("step.income"));
  steps.push(t("step.support"));
  return steps;
}

function topic(profile, data) {
  const names = profile.programs.map((code) => (code.length === 2 ? familyName(code) : (data.programNames[code] || code).split(",")[0]));
  if (!names.length) return t("mine.q.programFallback");
  return new Intl.ListFormat(currentLanguage().html, { type: "conjunction" }).format(names);
}

export function render({ data, answers }) {
  const head = `
    <h1 id="page-title" tabindex="-1">${escapeHtml(t("next.title"))}</h1>
    <p class="lede">${escapeHtml(t("next.subtitle"))}</p>`;
  const ids = answers.compare.length ? compareList(answers) : answers.kept;
  if (!ids.length) {
    return `${head}
      <p class="notice">${escapeHtml(t("cmp.none"))}</p>
      <button type="button" class="secondary" data-action="to-explore">${escapeHtml(t("web.cmp.toExplore"))}</button>
      ${tools(answers)}`;
  }

  const profile = profileFrom(answers);
  const evaluations = ids.map((id) => evaluateAll(profile, data.collegeById.get(id), data, familyName));
  const cards = evaluations.map((e) => {
    const c = e.college;
    const mine = (answers.reasons[c.UNITID] || []).map((k) => t(`keepReason.${k}`));
    return `
      <article class="college-card">
        <h3>${escapeHtml(c.INSTNM)}</h3>
        <p class="where">${escapeHtml(`${c.CITY}, ${c.STABBR}`)}. ${escapeHtml(t(`group.${c.type}`))}</p>
        <p class="reasons-line"><strong>${escapeHtml(t("next.myReasons"))}</strong> ${escapeHtml(mine.length ? mine.join(", ") : t("next.noReasons"))}</p>
        <button type="button" class="link" data-action="details" data-id="${c.UNITID}">${escapeHtml(t("card.detailsShort"))}</button>
      </article>`;
  }).join("");

  const todo = [...new Set([...evaluations.flatMap((e) => e.steps), ...profileSteps(profile, answers)])];
  const grade = GRADE_STEPS[answers.grade]
    ? `<section class="plan grade-plan">
        <h2>${escapeHtml(t("web.grade.steps", formatNumber(answers.grade)))}</h2>
        ${checklist(Array.from({ length: GRADE_STEPS[answers.grade] }, (_, i) => t(`web.grade.${answers.grade}.${i + 1}`)), "grade")}
      </section>`
    : "";
  const questions = [1, 2, 3, 4].map((i) => t(`mine.q${i}`, topic(profile, data)));

  return `${head}
    <div class="college-grid next-cards">${cards}</div>
    ${grade}
    <div class="why-verify">
      <section class="plan">
        <h2>${escapeHtml(t("mine.todo"))}</h2>
        ${checklist(todo, "todo")}
      </section>
      <section class="plan questions">
        <h2>${escapeHtml(t("mine.questions"))}</h2>
        <ul>${questions.map((q) => `<li>${escapeHtml(q)}</li>`).join("")}</ul>
      </section>
    </div>
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

// ---------- export (Shortlist.exportCsv) ----------

function csvValue(v) {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv(data, answers) {
  const profile = profileFrom(answers);
  const rows = [[t("export.college"), t("export.city"), t("export.state"), t("lens.program"), t("lens.academic"),
    t("lens.financial"), t("lens.social"), t("export.reasons"), t("export.steps"), t("details.website"), t("details.npc")]];
  for (const id of answers.kept) {
    const e = evaluateAll(profile, data.collegeById.get(id), data, familyName);
    const c = e.college;
    rows.push([c.INSTNM, c.CITY, c.STABBR, e.program.label, e.academic.label, e.financial.label, e.social.label,
      (answers.reasons[id] || []).map((k) => t(`keepReason.${k}`)).join("; "), e.steps.join("; "), c.INSTURL, c.NPCURL]);
  }
  rows.push([t("export.note")]);
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
