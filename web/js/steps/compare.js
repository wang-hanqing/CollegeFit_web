// Step 5: Compare. Ported from ComparePanel.java.
// Up to three kept colleges side by side, rows in the order of her priorities, markers only where
// a difference is large and measured the same way, and the student's own safety / target / reach call.
// (Web: no trade-off summary or list summary; the table shows the differences.)
//
// answers.compare  up to 3 kept UNITIDs
// answers.tiers    UNITID -> "SAFETY", "TARGET", "REACH" or "NOT_SURE": the student's call, never the app's
import { t, formatNumber } from "../i18n.js";
import { escapeHtml } from "../ui.js";
import { familyName } from "./direction.js";
import { campusLine } from "./explore.js";
import { pageFor } from "./details.js";
import { profileFrom, comparableCost, levels } from "../logic/explore.js";
import { evaluateAll, money, evidence } from "../logic/evaluate.js";
import { icon } from "../components.js";
import { compare, rowOrder, degreeText } from "../logic/compare.js";

export const TIERS = ["SAFETY", "TARGET", "REACH", "NOT_SURE"];
const MAX = 3;

// Kept colleges chosen for comparison. If fewer than 2 are chosen, kept colleges fill in.
// (The Java version always refilled to 3, so a student with 4 kept colleges could not swap one out.)
export function compareList(answers) {
  const list = answers.compare.filter((id) => answers.kept.includes(id));
  for (const id of answers.kept) if (list.length < 2 && !list.includes(id)) list.push(id);
  return list;
}

export function render(ctx) {
  const { data, answers } = ctx;
  const head = `
    <h1 id="page-title" tabindex="-1">${escapeHtml(t("cmp.title"))}</h1>
    <p class="lede">${escapeHtml(t("web.cmp.subtitle"))}</p>`;
  if (answers.kept.length < 2) {
    return `${head}
      <p class="notice">${escapeHtml(t(answers.kept.length ? "cmp.one" : "cmp.none"))}</p>
      <button type="button" class="secondary" data-action="to-explore">${escapeHtml(t("web.cmp.toExplore"))}</button>`;
  }

  const ids = compareList(answers);
  const profile = profileFrom(answers);
  const evaluations = ids.map((id) => evaluateAll(profile, data.collegeById.get(id), data, familyName));
  const result = compare(profile, evaluations);

  const picker = answers.kept.map((id) => {
    const c = data.collegeById.get(id);
    return `<label class="chip"><input type="checkbox" name="compare" value="${id}"${ids.includes(id) ? " checked" : ""}><span>${escapeHtml(c.INSTNM)}</span></label>`;
  }).join("");

  return `${head}
    <fieldset class="chips compare-picker">
      <legend>${escapeHtml(t("mine.pick"))}</legend>
      <div class="chip-row">${picker}</div>
    </fieldset>
    <p id="step-error" class="step-error" role="alert"></p>
    ${result.differentDegrees ? `<p class="notice">${escapeHtml(t("cmp.degreeBanner"))}</p>` : ""}
    ${table(profile, evaluations, result, answers, data)}
    <p class="source list-note">${escapeHtml(t("web.next.privacy"))}</p>`;
}

export function continueLabel() {
  return t("cmp.next");
}

function table(profile, evaluations, result, answers, data) {
  const head = evaluations.map((e) => `
    <th scope="col">
      <span class="college-name">${escapeHtml(e.college.INSTNM)}</span>
      <span class="muted">${escapeHtml(`${e.college.CITY}, ${e.college.STABBR}`)}. ${escapeHtml(t(`group.${e.college.type}`))}</span>
      <button type="button" class="link" data-action="details" data-id="${e.college.UNITID}">${escapeHtml(t("card.detailsShort"))}</button>
    </th>`).join("");

  const rows = rowOrder(profile).map((row) => {
    const rank = profile.priorities.indexOf(row) + 1;
    const cells = evaluations.map((e) => {
      // Same marker as Java, worded "acceptance rate" to match the row name in the web version
      const raw = result.markers.get(e)[row];
      const marker = raw === t("cmp.mark.higherAdmit") ? t("web.cmp.mark.higherAccept") : raw;
      const warning = marker && (marker === t("cmp.mark.notComparable") || marker === t("cmp.mark.differentPath")
        || marker.startsWith(t("cmp.mark.measurePrefix")));
      return `<td data-college="${escapeHtml(e.college.INSTNM)}">${value(row, e, profile, data)}${
        marker ? `<span class="marker${warning ? " warn" : ""}">${escapeHtml(marker)}</span>` : ""}</td>`;
    }).join("");
    return `
      <tr>
        <th scope="row">${rank ? `<span class="rank-tag">#${formatNumber(rank)}</span> ` : ""}${escapeHtml(t(`cmp.row.${row}`))}
          <span class="muted">${escapeHtml(t(`cmp.row.${row}.note`))}</span></th>
        ${cells}
      </tr>`;
  }).join("");

  // The student's own call. Next to it, her SAT against the college's middle 50% when she gave scores.
  const tiers = evaluations.map((e) => {
    const id = e.college.UNITID;
    const mine = answers.tiers[id] || "";
    const chips = TIERS.map((k) => `
      <label class="chip"><input type="radio" name="tier-${id}" value="${k}"${mine === k ? " checked" : ""}><span>${escapeHtml(t(`web.tier.${k}`))}</span></label>`).join("");
    const sat = e.academic.facts.filter((f) => f.label === t("ac.sat.reading") || f.label === t("ac.sat.math"))
      .map((f) => `<span class="muted tier-evidence">${escapeHtml(`${f.label}: ${f.value}`)}</span>`).join("");
    return `<td data-college="${escapeHtml(e.college.INSTNM)}"><div class="chip-row tiers">${chips}</div>${sat}</td>`;
  }).join("");

  return `
    <div class="table-wrap">
      <table class="compare-table">
        <thead><tr><td></td>${head}</tr></thead>
        <tbody>${rows}
          <tr class="reasons-row">
            <th scope="row">${escapeHtml(t("web.tier.label"))} <span class="muted">${escapeHtml(t("web.tier.note"))}</span></th>
            ${tiers}
          </tr>
        </tbody>
      </table>
    </div>`;
}

function value(row, e, profile, data) {
  const c = e.college;
  const strong = (x) => `<strong>${escapeHtml(x)}</strong>`;
  switch (row) {
    case "DEGREE": {
      const d = degreeText(profile, e);
      return strong(d.charAt(0).toUpperCase() + d.slice(1));
    }
    case "COSTS": {
      const v = comparableCost(profile, c);
      return `${v == null ? escapeHtml(t("notReported")) : strong(`${money(v)} ${t("web.perYearShort")}`)}
        <span class="muted">${escapeHtml(t("cmp.costBefore", money(c.COSTT4_A)))}</span>`;
    }
    case "GRADUATION":
      return c.completionRate == null ? escapeHtml(t("notReported"))
        : `${strong(`${formatNumber(Math.round(c.completionRate * 100))}%`)} ${escapeHtml(t("card.completion.measure", formatNumber(c.completionYears)))}`;
    case "ADMISSION":
      return strong(c.openAdmission === true ? t("ac.open")
        : c.ADM_RATE > 0 ? `${formatNumber(Math.round(c.ADM_RATE * 100))}%` : t("notReported"));
    case "STUDY":
      return programsHere(c, profile, data);
    default:
      return campusLine(e.social, c);
  }
}

// Which of the student's programs this college offers (a check or a cross), without degree counts
function programsHere(c, profile, data) {
  if (!profile.programs.length) return escapeHtml(t("web.cmp.anyProgram"));
  const lv = levels(profile.pathway);
  return `<span class="programs-here">${profile.programs.slice(0, 6).map((code) => {
    const name = code.length === 2 ? familyName(code) : (data.programNames[code] || code).split(",")[0];
    return lv.some((level) => evidence(c, code, level) === 0)
      ? `<span class="program-here">${icon("check")}${escapeHtml(name)}</span>`
      : `<span class="program-here missing"><span aria-hidden="true">✗</span> ${escapeHtml(name)}<span class="visually-hidden">${escapeHtml(t("web.details.notOffered"))}</span></span>`;
  }).join("")}</span>`;
}

export function onChange(event, { answers, update, rerender }) {
  const { name, value, checked } = event.target;
  if (name === "compare") {
    const id = Number(value);
    const list = compareList(answers).filter((x) => x !== id);
    if (checked) {
      if (list.length >= MAX) {
        event.target.checked = false;
        document.getElementById("step-error").textContent = t("compare.full");
        return;
      }
      list.push(id);
    }
    update({ compare: list });
    rerender();
  } else if (name?.startsWith("tier-")) {
    update({ tiers: { ...answers.tiers, [name.slice(5)]: value } });
  }
}

export function onClick(event, { go }) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  if (target.dataset.action === "details") go("explore", pageFor(target.dataset.id));
  if (target.dataset.action === "to-explore") go("explore");
}
