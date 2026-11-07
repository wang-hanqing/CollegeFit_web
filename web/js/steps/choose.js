// Step 2 for students who know something: a subject, a place or a degree pathway.
// Ported from DirectionPanel.java. One page (#/direction/main) in three arrangements:
//   subject  study goals first, then place
//   place    place first, then study goals
//   pathway  two-year and four-year comparison first, then study goals and place
//
// answers.fields    programs (4-digit CIP) and whole fields (2-digit), in the order added
// answers.degree    "both" (not sure), "two", "four" or "either"
// answers.scope     "states" with answers.states, "anywhere" or "unsure" ("state" = the home state)
// answers.settings  e.g. ["URBAN"]   answers.sizes  e.g. ["LARGE"]   (never hide colleges)
import { t, formatNumber } from "../i18n.js";
import { escapeHtml } from "../ui.js";
import { icon, stepError } from "../components.js";
import { STATE_NAMES } from "../config.js";
import { familyName, pathwayCards } from "./direction.js";
import { extrasDialog, onDetailsClick, onDetailsChange } from "./details.js";
import { programList, searchPrograms } from "../logic/programs.js";
import { programCounts } from "../logic/directions.js";
import { statesOf } from "../logic/explore.js";

const DEGREES = [["both", "Pathway.NOT_SURE"], ["two", "Pathway.ASSOCIATE"], ["four", "Pathway.BACHELOR"], ["either", "Pathway.BOTH"]];
const SCOPES = [["unsure", "LocationScope.NOT_SURE"], ["states", "LocationScope.PREFERRED_STATE"], ["anywhere", "LocationScope.ANY_STATE"]];
const SETTINGS = ["URBAN", "SUBURBAN", "TOWN", "RURAL"];
const SIZES = ["SMALL", "MEDIUM", "LARGE"];

let query = "";      // what the student typed in the program search; not saved
let stateToAdd = ""; // state picked in the menu, before "Add state"

// The page shows "Specific states" with the home state when nothing else was chosen yet
function scopeShown(answers) {
  return answers.scope === "state" ? "states" : answers.scope;
}
function statesShown(answers) {
  return scopeShown(answers) === "states" ? statesOf(answers) : [];
}

export function render(ctx) {
  const { answers } = ctx;
  const start = answers.start || "subject";
  const key = { subject: "SUBJECT", place: "PLACE", pathway: "PATHWAY" }[start] || "SUBJECT";
  const goals = goalsSection(ctx), place = placeSection(ctx);
  return `
    <h1 id="page-title" tabindex="-1">${escapeHtml(t(`dir.title.${key}`))}</h1>
    <p class="lede">${escapeHtml(t("dir.subtitle"))}</p>
    ${start === "pathway" ? pathwayCards(ctx) : ""}
    ${stepError()}
    <div class="direction-sections">${start === "place" ? place + goals : goals + place}</div>
    <div class="extras-row">
      <button type="button" class="secondary" data-action="open-extras">${escapeHtml(t("dir.extras"))}
        <span class="muted">${escapeHtml(t("dir.optionalParen"))}</span></button>
      <p class="muted">${escapeHtml(t("dir.extras.hint"))}</p>
    </div>
    <details class="how">
      <summary>${escapeHtml(t("how.title"))}</summary>
      <ul>${["how.program", "how.place", "how.extras"].map((k) => `<li>${escapeHtml(t(k))}</li>`).join("")}</ul>
    </details>
    ${extrasDialog(answers, ctx.data)}`;
}

export function check(answers) {
  return answers.scope === "states" && !answers.states.length ? t("dir.states.none") : null;
}

// ---------- study goals ----------

function goalsSection(ctx) {
  const { answers } = ctx;
  const list = programList(ctx.data, familyName);
  const byCode = new Map(list.map((p) => [p.code, p]));
  const chips = answers.fields.length
    ? answers.fields.map((code) => `
        <button type="button" class="chip-button" data-action="remove-program" data-code="${code}"
          aria-label="${escapeHtml(t("web.dir.remove", byCode.get(code)?.short || code))}">
          ${escapeHtml(byCode.get(code)?.short || familyName(code))} <span aria-hidden="true">×</span></button>`).join("")
    : `<span class="muted">${escapeHtml(t("dir.programs.none"))}</span>`;
  const degree = DEGREES.map(([value, key]) => `
    <label class="chip"><input type="radio" name="degree" value="${value}"${answers.degree === value ? " checked" : ""}><span>${escapeHtml(t(key))}</span></label>`).join("");

  return `
    <section class="direction-card" aria-labelledby="goals-title">
      <h2 id="goals-title"><span class="option-icon">${icon("cap")}</span>${escapeHtml(t("dir.goals"))}</h2>
      <label class="field-label" for="program-search">${escapeHtml(t("dir.programs"))}
        <span class="hint">${escapeHtml(t("web.dir.programs.hint"))}</span></label>
      <input type="search" id="program-search" class="search" autocomplete="off" value="${escapeHtml(query)}"
        placeholder="${escapeHtml(t("web.dir.search.placeholder"))}" aria-controls="program-results">
      <ul id="program-results" class="program-results">${results(ctx)}</ul>
      <div class="chosen" aria-live="polite">${chips}</div>
      <fieldset class="chips">
        <legend>${escapeHtml(t("dir.degree"))}</legend>
        <div class="chip-row">${degree}</div>
        <p class="hint">${escapeHtml(t("dir.degree.hint"))}</p>
      </fieldset>
    </section>`;
}

// Matches with how many colleges offer each, in the chosen states (all states when none)
function results(ctx) {
  const { answers, data } = ctx;
  const states = statesShown(answers);
  const counts = programCounts(data, states);
  const place = states.length === 1 ? STATE_NAMES[states[0]] || states[0] : t("dir.count.yourStates");
  const matches = searchPrograms(programList(data, familyName), query);
  if (!matches.length) return `<li class="muted">${escapeHtml(t("web.dir.noMatch"))}</li>`;
  return matches.map((p) => {
    const n = counts.get(p.code);
    const where = !states.length ? t("dir.count.us", formatNumber(n || 0))
      : n == null ? t("dir.count.none", place) : t("dir.count.state", formatNumber(n), place);
    const chosen = answers.fields.includes(p.code);
    return `
      <li><button type="button" data-action="add-program" data-code="${p.code}"${chosen ? ' aria-pressed="true"' : ""}>
        <span class="program-name">${chosen ? icon("check") : ""}${escapeHtml(p.name)}</span>
        <span class="program-count${n == null && states.length ? " none" : ""}">${escapeHtml(where)}</span>
      </button></li>`;
  }).join("");
}

// ---------- place ----------

function placeSection({ answers, data }) {
  const scope = scopeShown(answers);
  const scopes = SCOPES.map(([value, key]) => `
    <label class="chip"><input type="radio" name="scope" value="${value}"${scope === value ? " checked" : ""}><span>${escapeHtml(t(key))}</span></label>`).join("");
  const sorted = [...data.states].sort((a, b) => (STATE_NAMES[a] || a).localeCompare(STATE_NAMES[b] || b));
  const picked = stateToAdd || answers.home || sorted[0];
  const chosen = statesShown(answers);
  const statePicker = scope !== "states" ? "" : `
    <div class="add-state">
      <label class="visually-hidden" for="state-to-add">${escapeHtml(t("dir.where"))}</label>
      <select id="state-to-add" name="state-to-add">${sorted.map((s) =>
        `<option value="${s}"${s === picked ? " selected" : ""}>${escapeHtml(STATE_NAMES[s] || s)}</option>`).join("")}</select>
      <button type="button" class="secondary small" data-action="add-state">${escapeHtml(t("dir.addState"))}</button>
    </div>
    <div class="chosen">${chosen.length ? chosen.map((s) => `
      <button type="button" class="chip-button" data-action="remove-state" data-state="${s}"
        aria-label="${escapeHtml(t("web.dir.remove", STATE_NAMES[s] || s))}">${escapeHtml(STATE_NAMES[s] || s)} <span aria-hidden="true">×</span></button>`).join("")
      : `<span class="muted">${escapeHtml(t("dir.states.none"))}</span>`}</div>`;
  const multi = (name, values, label) => values.map((v) => `
    <label class="chip"${name === "size" ? ` title="${escapeHtml(t(`CollegeSize.${v}`))}"` : ""}>
      <input type="checkbox" name="${name}" value="${v}"${answers[`${name}s`].includes(v) ? " checked" : ""}><span>${escapeHtml(label(v))}</span></label>`).join("");

  return `
    <section class="direction-card" aria-labelledby="place-title">
      <h2 id="place-title"><span class="option-icon">${icon("pin")}</span>${escapeHtml(t("dir.place"))}</h2>
      <fieldset class="chips">
        <legend>${escapeHtml(t("dir.where"))}</legend>
        <div class="chip-row">${scopes}</div>
      </fieldset>
      ${statePicker}
      <fieldset class="chips">
        <legend>${escapeHtml(t("dir.setting"))} <span class="hint">${escapeHtml(t("dir.optional"))}</span></legend>
        <div class="chip-row">${multi("setting", SETTINGS, (v) => t(`CampusSetting.${v}`))}</div>
      </fieldset>
      <fieldset class="chips">
        <legend>${escapeHtml(t("dir.size"))} <span class="hint">${escapeHtml(t("dir.optional"))}</span></legend>
        <div class="chip-row">${multi("size", SIZES, (v) => t(`CollegeSize.${v}`))}</div>
      </fieldset>
    </section>`;
}

// ---------- events ----------

export function onInput(event, ctx) {
  if (event.target.id !== "program-search") return;
  query = event.target.value;
  document.getElementById("program-results").innerHTML = results(ctx);
}

export function onChange(event, ctx) {
  if (onDetailsChange(event, ctx)) return;
  const { name, value, checked } = event.target;
  const { answers, update, rerender } = ctx;
  if (name === "degree") update({ degree: value });
  else if (name === "scope") {
    // Choosing "Specific states" starts with the home state, so the list is never empty by surprise
    const states = value === "states" && !answers.states.length && answers.home ? [answers.home] : answers.states;
    update({ scope: value, states });
    rerender();
  } else if (name === "state-to-add") stateToAdd = value;
  else if (name === "setting" || name === "size") {
    const key = `${name}s`;
    const list = answers[key].filter((x) => x !== value);
    update({ [key]: checked ? [...list, value] : list });
  }
}

export function onClick(event, ctx) {
  if (onDetailsClick(event, ctx)) return;
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const { answers, update, rerender } = ctx;
  switch (target.dataset.action) {
    case "add-program": {
      const code = target.dataset.code;
      if (!answers.fields.includes(code)) update({ fields: [...answers.fields, code] });
      rerender();
      document.getElementById("program-search")?.focus();
      break;
    }
    case "remove-program":
      update({ fields: answers.fields.filter((c) => c !== target.dataset.code) });
      rerender();
      break;
    case "add-state": {
      const state = document.getElementById("state-to-add").value;
      const current = statesShown(answers);
      update({ scope: "states", states: current.includes(state) ? current : [...current, state] });
      rerender();
      break;
    }
    case "remove-state":
      update({ scope: "states", states: statesShown(answers).filter((s) => s !== target.dataset.state) });
      rerender();
      break;
  }
}
