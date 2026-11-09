// One college, opened from an Explore card. Ported from DetailsPanel.java and ExtraInfoPanel.java.
// Address: #/explore/college-<UNITID>. Web version: four key numbers, then three short sections laid out
// as small tiles (academics and programs, costs, location and size), each ending with its next step.
import { t, formatNumber } from "../i18n.js";
import { escapeHtml } from "../ui.js";
import { icon } from "../components.js";
import { STATE_NAMES } from "../config.js";
import { familyName } from "./direction.js";
import { profileFrom, comparableCost, levels } from "../logic/explore.js";
import {
  evaluateAll, money, outOfStateCost, setting, sizeOf, evidence, programEarnings, fieldEarnings,
} from "../logic/evaluate.js";

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
    ${section("cap", t("details.academics"), academics(r, c, profile, data, id))}
    ${section("dollar", t("tab.costs"), costs(r, c, profile))}
    ${section("pin", t("tab.place"), place(r, c))}

    <div class="link-row">
      <button type="button" class="secondary" data-action="open-extras">${escapeHtml(t("details.addInfo"))}</button>
    </div>
    <p class="source">${escapeHtml(t("details.disclaimer"))}</p>
    ${extrasDialog(answers, data)}`;
}

// ---------- pieces ----------

// Four numbers, in the order of the priorities: cost after grants, admission, completion, campus.
// The cost is the same number the Explore card shows; the price before aid is the note.
function tiles(r, profile) {
  const c = r.college;
  const open = c.openAdmission === true;
  const oos = c.isPublic && profile.home && profile.home !== c.STABBR;
  const pct = (x) => formatNumber(x, { style: "percent", maximumFractionDigits: 0 });
  const net = comparableCost(profile, c);
  const sticker = oos ? outOfStateCost(c) : c.COSTT4_A;
  const costTile = net != null
    ? [t("web.tile.netCost"), money(net), sticker != null ? t("web.tile.netCost.note", money(sticker)) : t("web.perYear")]
    : [t("tile.cost"), money(sticker), t(oos ? "tile.cost.oos" : "web.tile.cost.noNet")];
  const transfer = c.completionYears === 3 ? c.TRANS_L4 : c.TRANS_4;
  const within = c.completionYears ? t("tile.completion.within", formatNumber(c.completionYears)) : "";
  const where = setting(c);
  const size = sizeOf(c);
  const items = [
    costTile,
    [t(open ? "tile.admission" : "tile.admissionRate"),
      open ? t("ac.open") : c.ADM_RATE > 0 ? pct(c.ADM_RATE) : t("notReported"),
      t(open ? "tile.admission.open" : "tile.admission.note")],
    [t("tile.completion"), c.completionRate == null ? t("notReported") : pct(c.completionRate),
      transfer != null && within ? t("web.tile.completion.transfer", within, pct(transfer)) : within],
    [t("web.tile.campus"), where === "NOT_SURE" ? t("notReported") : t(`CampusSetting.${where}`),
      size ? t("web.tile.campus.note", t(`web.size.${size}`), formatNumber(c.UGDS)) : ""],
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

function section(iconName, title, body) {
  return `
    <section class="detail-section">
      <h2><span class="option-icon">${icon(iconName)}</span>${escapeHtml(title)}</h2>
      ${body}
    </section>`;
}

// Small tiles like the four at the top: [label, value, note, match] (match: true, false or null)
function miniTiles(items, className = "") {
  return `
    <dl class="tiles mini-tiles ${className}">
      ${items.map(([label, value, note, match]) => `
        <div class="tile">
          <dt>${escapeHtml(label)}</dt>
          <dd><span class="tile-value">${escapeHtml(value)}${match === true ? ` <span class="match">${icon("check")}</span>`
            : match === false ? ' <span class="no-match">✗</span>' : ""}</span>${note ? `<span class="tile-note">${escapeHtml(note)}</span>` : ""}</dd>
        </div>`).join("")}
    </dl>`;
}

function programName(code, data, full = false) {
  if (code.length === 2) return familyName(code);
  const name = data.programNames[code] || code;
  return full ? name : name.split(",")[0];
}

// Academics: the student's programs here, admissions, students per faculty, earnings after graduating.
// Admission, completion and transfer rates are in the four tiles at the top, so they are not repeated.
function academics(r, c, profile, data, id) {
  const lv = levels(profile.pathway);
  const offered = (code) => lv.some((level) => evidence(c, code, level) === 0);
  const chosen = profile.programs.slice(0, 6);
  const programs = chosen.length ? `
    <p class="programs-here"><span class="muted">${escapeHtml(t("web.details.programsHere"))}</span>
      ${chosen.map((code) => offered(code)
        ? `<span class="program-here">${icon("check")}${escapeHtml(programName(code, data))}</span>`
        : `<span class="program-here missing"><span aria-hidden="true">✗</span> ${escapeHtml(programName(code, data))}<span class="visually-hidden">${escapeHtml(t("web.details.notOffered"))}</span></span>`).join("")}
    </p>` : "";

  const skip = new Set([t("ac.rateLabel"), t("ac.policy")]);
  const admissions = r.academic.facts.filter((f) => !skip.has(f.label)).map((f) =>
    [f.label, f.label === t("ac.program") ? t("web.details.programAdmission") : f.value,
      f.label === t("ac.test") ? "" : f.label === t("ac.program") ? t("web.details.programAdmission.note") : f.note, f.match]);

  const earnings = [];
  for (const code of chosen.filter(offered)) {
    for (const level of lv) {
      if (evidence(c, code, level) !== 0) continue;
      const lvName = t(`prog.level.${level}`).toLowerCase();
      const list = code.length === 4
        ? [{ cip: code, earnings: programEarnings(c, code, level) }].filter((x) => x.earnings != null)
        : fieldEarnings(c, code, level, 3);
      list.forEach((x) => earnings.push([`${programName(x.cip, data, true)} (${lvName})`, money(x.earnings)]));
    }
  }
  const earningsBlock = !chosen.length ? `<p class="muted">${escapeHtml(t("web.details.earnings.pick"))}</p>`
    : earnings.length ? `
      <dl class="earnings">${earnings.map(([name, pay]) => `<div><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(pay)}</dd></div>`).join("")}</dl>
      <p class="tile-footnote">${escapeHtml(t("web.details.earnings.note"))}</p>`
    : `<p class="muted">${escapeHtml(t("web.details.earnings.none"))}</p>`;

  return `
    ${programs}
    <h3>${escapeHtml(t("details.part.1"))}</h3>
    ${miniTiles(admissions, "two")}
    ${r.program.nursingBachelor ? `<p class="notice">${escapeHtml(t("prog.next.license"))}</p>` : ""}
    <h3>${escapeHtml(t("res.ratio"))}</h3>
    ${miniTiles([["", c.STUFACR == null ? t("notReported") : t("res.ratio.value", formatNumber(c.STUFACR)), t("web.details.ratio.note"), null]], "one")}
    <h3>${escapeHtml(t("web.details.earnings"))}</h3>
    ${earningsBlock}
    <div class="link-row">
      ${c.INSTURL ? `<a class="secondary" href="${escapeHtml(c.INSTURL)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("details.site"))}</a>` : ""}
      <button type="button" class="secondary" data-action="copy-links" data-id="${id}">${escapeHtml(t("details.copy"))}</button>
    </div>
    <p class="link-status" role="status"></p>`;
}

// Costs: cost after grants first (the number Explore uses), then the price before aid and tuition
function costs(r, c, profile) {
  const oos = c.isPublic && profile.home && profile.home !== c.STABBR;
  const net = comparableCost(profile, c);
  const yearNote = profile.income ? t("web.cost.income", t(`IncomeBracket.${profile.income}`)) : t("web.cost.year");
  const items = [
    oos ? [t("web.tile.netCost"), t("fin.net.oos"), t("fin.net.oos.note"), null]
      : [t("web.tile.netCost"), net == null ? t("notReported") : money(net), net == null ? "" : yearNote, null],
    [t("web.cost.sticker"), money(c.COSTT4_A), c.isPublic ? t("web.cost.inState") : t("web.cost.year"), null],
  ];
  if (oos) items.push([t("web.cost.oosEstimate"), money(outOfStateCost(c)), t("web.cost.year"), null]);
  if (c.isPublic) {
    items.push([t("web.cost.tuitionIn"), money(c.TUITIONFEE_IN), t("web.cost.year"), null]);
    items.push([t("web.cost.tuitionOut"), money(c.TUITIONFEE_OUT), t("web.cost.year"), null]);
  } else {
    items.push([t("web.cost.tuition"), money(c.TUITIONFEE_IN), t("web.cost.year"), null]);
  }
  const budget = r.financial.facts.find((f) => f.label === t("fin.budget"));
  if (budget) items.push([budget.label, budget.value, budget.note, budget.match]);
  return `
    ${miniTiles(items)}
    <div class="link-row">${calculator(c)}</div>`;
}

// Location and size: a check or a cross only where the student stated a preference
function place(r, c) {
  const [state, where, size] = r.social.facts;
  const s = sizeOf(c);
  const settingKey = setting(c);
  return `
    ${miniTiles([
      [t("soc.state"), STATE_NAMES[c.STABBR] || c.STABBR, "", state?.match ?? null],
      [t("web.details.setting"), settingKey === "NOT_SURE" ? t("notReported") : t(`CampusSetting.${settingKey}`), "", where?.match ?? null],
      [t("web.details.size"), s ? t(`web.size.${s}`) : t("notReported"), c.UGDS == null ? "" : t("web.details.size.note", formatNumber(c.UGDS)), size?.match ?? null],
    ], "three")}
    <p class="tour">${escapeHtml(t("web.details.tour"))}</p>`;
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
