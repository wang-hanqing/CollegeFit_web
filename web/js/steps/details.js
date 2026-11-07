// One college, opened from an Explore card. Ported from DetailsPanel.java and ExtraInfoPanel.java.
// Address: #/explore/college-<UNITID>. The Java version's four tabs become one page:
// key numbers, why explore it and what to verify, then three sections that open on demand.
import { t, formatNumber } from "../i18n.js";
import { escapeHtml } from "../ui.js";
import { icon } from "../components.js";
import { STATE_NAMES } from "../config.js";
import { familyName } from "./direction.js";
import { profileFrom } from "../logic/explore.js";
import { evaluateAll, money, outOfStateCost } from "../logic/evaluate.js";

const PAGE = /^college-(\d+)$/;

export function collegeIdFrom(page) {
  const m = PAGE.exec(page || "");
  return m ? Number(m[1]) : null;
}

export function pageFor(id) {
  return `college-${id}`;
}

export function renderDetails(ctx, id) {
  const { data, answers } = ctx;
  const c = data.collegeById.get(id);
  if (!c) return `<h1 id="page-title" tabindex="-1">${escapeHtml(t("details.title"))}</h1><p class="notice">${escapeHtml(t("web.details.missing"))}</p>`;
  const profile = profileFrom(answers);
  const r = evaluateAll(profile, c, data, familyName);
  const kept = answers.kept.includes(id);
  const setAside = id in answers.notForMe;

  return `
    <button type="button" class="link back-link" data-action="back-list">${icon("back", "directional")}${escapeHtml(t("details.back"))}</button>
    <h1 id="page-title" tabindex="-1">${escapeHtml(c.INSTNM)}</h1>
    <p class="where">${escapeHtml(`${c.CITY}, ${STATE_NAMES[c.STABBR] || c.STABBR}`)}. ${escapeHtml(t(`details.kind.${c.type}`))}</p>
    <div class="card-actions details-actions">
      <button type="button" class="${kept ? "primary" : "secondary"}" data-action="keep" data-id="${id}" aria-pressed="${kept}">
        ${kept ? icon("check") : ""}${escapeHtml(t(kept ? "keep.kept" : "keep.keep"))}</button>
      <button type="button" class="quiet" data-action="${setAside ? "undo-not" : "not-for-me"}" data-id="${id}">${escapeHtml(t(setAside ? "not.undo" : "keep.not"))}</button>
    </div>

    ${tiles(r, profile)}
    ${r.program.nursingBachelor ? `<p class="notice">${escapeHtml(t("prog.next.license"))}</p>` : ""}

    <div class="why-verify">
      <section class="why">
        <h2>${escapeHtml(t("details.why"))}</h2>
        ${r.reasons.length
          ? `<ul>${r.reasons.map((x) => `<li>${icon("check")}<span>${escapeHtml(x)}</span></li>`).join("")}</ul>`
          : `<p>${escapeHtml(t("details.why.none"))}</p>`}
      </section>
      <section class="verify">
        <h2>${escapeHtml(t("details.verify"))}</h2>
        <ul>${r.steps.map((x) => `<li><span class="box" aria-hidden="true"></span><span>${escapeHtml(x)}</span></li>`).join("")}</ul>
      </section>
    </div>

    ${section("academics", "cap", t("details.academics"), r.academic, academics(r, c))}
    ${section("costs", "dollar", t("tab.costs"), r.financial, facts(r.financial.facts) + calculator(c))}
    ${section("place", "pin", t("tab.place"), r.social, facts(r.social.facts) + `<p class="muted">${escapeHtml(t("details.place.note"))}</p>`)}

    <div class="link-row">
      ${c.INSTURL ? `<a class="secondary" href="${escapeHtml(c.INSTURL)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("details.site"))}</a>` : ""}
      <button type="button" class="secondary" data-action="copy-links" data-id="${id}">${escapeHtml(t("details.copy"))}</button>
      <button type="button" class="secondary" data-action="open-extras">${escapeHtml(t("details.addInfo"))}</button>
    </div>
    <p class="link-status" role="status"></p>
    <p class="source">${escapeHtml(t("details.disclaimer"))}</p>
    ${extrasDialog(answers, data)}`;
}

// ---------- pieces ----------

function tiles(r, profile) {
  const c = r.college;
  const open = c.openAdmission === true;
  const oos = c.isPublic && profile.home && profile.home !== c.STABBR;
  const cost = oos ? outOfStateCost(c) : c.COSTT4_A;
  const pct = (x) => formatNumber(x, { style: "percent", maximumFractionDigits: 0 });
  const items = [
    [profile.programs.length ? t("tile.degrees") : t("tile.degreesAll"),
      r.program.recentDegrees > 0 ? formatNumber(r.program.recentDegrees) : t("notReported"),
      r.program.recentDegrees > 0 ? levelText(r.program) : ""],
    [t(open ? "tile.admission" : "tile.admissionRate"),
      open ? t("ac.open") : c.ADM_RATE > 0 ? pct(c.ADM_RATE) : t("notReported"),
      t(open ? "tile.admission.open" : "tile.admission.note")],
    [t("tile.cost"), money(cost), t(oos ? "tile.cost.oos" : c.isPublic ? "tile.cost.public" : "tile.cost.private")],
    [t("tile.completion"), c.completionRate == null ? t("notReported") : pct(c.completionRate),
      c.completionYears ? t("tile.completion.within", formatNumber(c.completionYears)) : ""],
    [t("tile.size"), c.UGDS == null ? t("notReported") : formatNumber(c.UGDS), t("tile.size.note")],
  ];
  return `
    <dl class="tiles">
      ${items.map(([label, value, note]) => `
        <div class="tile">
          <dt>${escapeHtml(label)}</dt>
          <dd><span class="tile-value">${escapeHtml(value)}</span>${note ? `<span class="tile-note">${escapeHtml(note)}</span>` : ""}</dd>
        </div>`).join("")}
    </dl>`;
}

function levelText(program) {
  if (program.associateAwarded && program.bachelorAwarded) return t("level.both");
  return t(program.bachelorAwarded ? "level.bachelor" : "level.associate");
}

const STATUS_CLASS = { MATCH: "ok", MISMATCH: "bad", NEEDS_VERIFICATION: "check", INFO: "info", UNKNOWN: "none" };

function section(id, iconName, title, lens, body) {
  return `
    <details class="lens" id="lens-${id}">
      <summary>
        <span class="option-icon">${icon(iconName)}</span>
        <span class="lens-title">${escapeHtml(title)}</span>
        <span class="status ${STATUS_CLASS[lens.status]}">${escapeHtml(lens.label)}</span>
      </summary>
      <div class="lens-body">${body}</div>
    </details>`;
}

function facts(list) {
  return `<dl class="fact-list">${list.map((f) => `
    <div>
      <dt>${escapeHtml(f.label)}</dt>
      <dd>${f.match === true ? `<span class="match">${icon("check")}</span>` : f.match === false ? '<span class="no-match">✗</span>' : ""}
        <strong>${escapeHtml(f.value)}</strong>
        ${f.note ? `<span class="muted">${escapeHtml(f.note)}</span>` : ""}</dd>
    </div>`).join("")}</dl>`;
}

function academics(r, c) {
  const pct = (x) => formatNumber(x, { style: "percent", maximumFractionDigits: 0 });
  const outcomes = [
    { label: t("out.completion"), value: c.completionRate == null ? t("notReported") : pct(c.completionRate),
      note: c.completionRate == null ? "" : t("out.completion.note", formatNumber(c.completionYears)), match: null },
  ];
  const transfer = c.TRANS_4 ?? c.TRANS_L4 ?? null;
  const transferYears = c.TRANS_4 != null ? 6 : c.TRANS_L4 != null ? 3 : 0;
  outcomes.push({ label: t("out.transfer"), value: transfer == null ? t("notReported") : pct(transfer),
    note: transfer == null ? "" : t(c.twoYear ? "out.transfer.note.two" : "out.transfer.note.four", formatNumber(transferYears)), match: null });
  const resources = [{ label: t("res.ratio"), value: c.STUFACR == null ? t("notReported") : t("res.ratio.value", formatNumber(c.STUFACR)),
    note: t("res.ratio.note"), match: null }];
  return `
    <h3>${escapeHtml(t("details.part.0"))}</h3>${facts(r.program.facts)}
    <h3>${escapeHtml(t("details.part.1"))}</h3>${facts(r.academic.facts)}
    <h3>${escapeHtml(t("details.part.2"))}</h3>${facts(outcomes)}
    <h3>${escapeHtml(t("details.part.3"))}</h3>${facts(resources)}
    <p class="muted">${escapeHtml(t("res.explore"))}</p>`;
}

function calculator(c) {
  if (!c.NPCURL) return `<p class="notice">${escapeHtml(t("fin.next.noNpc"))}</p>`;
  return `<a class="primary" href="${escapeHtml(c.NPCURL)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("details.npc"))}</a>`;
}

// ---------- "Add scores or cost details" ----------

const SAT = ["NOT_SURE", "NOT_YET", "PROVIDED", "PREFER_NOT_TO_SAY"];
const BUDGET = ["NOT_SURE", "KNOWN", "PREFER_NOT_TO_SAY"];
const INCOME = ["NOT_SURE", "UNDER_30K", "FROM_30K_TO_48K", "FROM_48K_TO_75K", "FROM_75K_TO_110K", "ABOVE_110K", "PREFER_NOT_TO_SAY"];
const AID = ["NOT_SURE", "YES", "NO", "PREFER_NOT_TO_SAY"];

function select(name, values, prefix, current) {
  return `<select name="${name}">${values.map((v) =>
    `<option value="${v}"${v === current ? " selected" : ""}>${escapeHtml(t(`${prefix}.${v}`))}</option>`).join("")}</select>`;
}

export function extrasDialog(answers, data) {
  const states = [...data.states].sort((a, b) => (STATE_NAMES[a] || a).localeCompare(STATE_NAMES[b] || b));
  const home = `<select name="home"><option value=""${answers.home ? "" : " selected"}>${escapeHtml(t("form.notSure"))}</option>${
    states.map((s) => `<option value="${s}"${s === answers.home ? " selected" : ""}>${escapeHtml(STATE_NAMES[s] || s)}</option>`).join("")}</select>`;
  return `
    <dialog id="extras-dialog" class="help extras" aria-labelledby="extras-title">
      <form method="dialog" novalidate>
        <h2 id="extras-title">${escapeHtml(t("details.addInfo"))}</h2>
        <p class="muted">${escapeHtml(t("web.extras.hint"))}</p>
        <label class="field-label">${escapeHtml(t("extra.sat"))}${select("satStatus", SAT, "SatStatus", answers.satStatus)}</label>
        <div class="pair" data-shows="sat"${answers.satStatus === "PROVIDED" ? "" : " hidden"}>
          <label class="field-label">${escapeHtml(t("form.satReading"))}
            <input type="number" name="satReading" min="200" max="800" step="10" inputmode="numeric" value="${answers.satReading ?? ""}"></label>
          <label class="field-label">${escapeHtml(t("form.satMath"))}
            <input type="number" name="satMath" min="200" max="800" step="10" inputmode="numeric" value="${answers.satMath ?? ""}"></label>
        </div>
        <label class="field-label">${escapeHtml(t("extra.home"))}${home}</label>
        <label class="field-label">${escapeHtml(t("extra.budget"))}${select("budgetStatus", BUDGET, "ChoiceStatus", answers.budgetStatus)}</label>
        <div class="pair" data-shows="budget"${answers.budgetStatus === "KNOWN" ? "" : " hidden"}>
          <label class="field-label">${escapeHtml(t("form.budgetAmount"))}
            <input type="number" name="budget" min="0" step="500" inputmode="numeric" value="${answers.budget ?? ""}"></label>
        </div>
        <label class="field-label">${escapeHtml(t("extra.income"))}${select("income", INCOME, "IncomeBracket", answers.income)}</label>
        <label class="field-label">${escapeHtml(t("extra.aid"))}${select("aid", AID, "AidEligibility", answers.aid)}</label>
        <p class="step-error" id="extras-error" role="alert"></p>
        <div class="dialog-actions">
          <button type="submit" value="cancel" class="secondary" formnovalidate>${escapeHtml(t("not.cancel"))}</button>
          <button type="submit" value="save" class="primary" data-action="extras-save">${escapeHtml(t("not.save"))}</button>
        </div>
      </form>
    </dialog>`;
}

// Reads the form; returns { changes } or { error }
function readExtras(form) {
  const value = (name) => form.elements[name].value;
  const whole = (name) => (/^\s*\d+\s*$/.test(value(name)) ? Number(value(name)) : null);
  const changes = {
    satStatus: value("satStatus"), home: value("home"),
    budgetStatus: value("budgetStatus"), income: value("income"), aid: value("aid"),
    satReading: null, satMath: null, budget: null,
  };
  if (changes.satStatus === "PROVIDED") {
    const reading = whole("satReading"), math = whole("satMath");
    if (reading == null || math == null) return { error: t("error.sat.missing") };
    if ([reading, math].some((n) => n < 200 || n > 800)) return { error: t("error.sat") };
    Object.assign(changes, { satReading: reading, satMath: math });
  }
  if (changes.budgetStatus === "KNOWN") {
    const raw = value("budget").replace(/[$,\s]/g, "");
    const budget = /^\d+$/.test(raw) ? Number(raw) : null;
    if (budget == null) return { error: t("error.budget.missing") };
    changes.budget = budget;
  }
  return { changes };
}

export function onDetailsClick(event, ctx) {
  const target = event.target.closest("[data-action]");
  if (!target) return false;
  const { data, update, rerender, go } = ctx;
  switch (target.dataset.action) {
    case "back-list": go("explore"); return true;
    case "copy-links": {
      const c = data.collegeById.get(Number(target.dataset.id));
      const text = [c.INSTURL, c.NPCURL].filter(Boolean).join("\n");
      const status = document.querySelector(".link-status");
      navigator.clipboard?.writeText(text)
        .then(() => (status.textContent = t("details.copied")))
        .catch(() => (status.textContent = text));
      return true;
    }
    case "open-extras": {
      const dialog = document.getElementById("extras-dialog");
      dialog.querySelector("#extras-error").textContent = "";
      dialog.showModal();
      return true;
    }
    case "extras-save": {
      const form = target.closest("form");
      const { changes, error } = readExtras(form);
      if (error) {
        event.preventDefault(); // keep the dialog open
        form.querySelector("#extras-error").textContent = error;
        return true;
      }
      update(changes);
      setTimeout(rerender); // after the dialog closes
      return true;
    }
  }
  return false;
}

// Show the score and budget boxes only when they apply
export function onDetailsChange(event) {
  const { name, value } = event.target;
  const form = event.target.closest("#extras-dialog form");
  if (!form) return false;
  if (name === "satStatus") form.querySelector('[data-shows="sat"]').hidden = value !== "PROVIDED";
  if (name === "budgetStatus") form.querySelector('[data-shows="budget"]').hidden = value !== "KNOWN";
  return true;
}
