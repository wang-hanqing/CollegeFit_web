// Step 2: Your direction. This file covers the "I'm not sure yet" path, ported from UnsurePanel.java:
//   interests  What do you enjoy doing? (six O*NET interest types, up to 2, or "not sure")
//   fields     Fields linked to those interests, or eight common fields
//   pathway    Two-year and four-year colleges
// The other starting points (subject, place, pathway) share one page, in choose.js.
import { t, formatNumber, formatMoney, currentLanguage } from "../i18n.js";
import { escapeHtml } from "../ui.js";
import { optionCards, choiceChips, bigNumber, stepError, icon } from "../components.js";
import { COMMON_FIELDS, LIBERAL_ARTS, MAX_INTERESTS, FIELDS_SHOWN, PROGRAMS_SHOWN, STATE_NAMES } from "../config.js";
import { linkedFields, fieldCount, pathwaySummary } from "../logic/directions.js";
import { statesOf } from "../logic/explore.js";
import * as choose from "./choose.js";

const INTERESTS = ["R", "I", "A", "S", "E", "C"];
let showAllFields = false; // "Show all fields" on the fields page; not saved
const openPrograms = new Set(); // fields whose program list is open, so a redraw keeps it open
const allPrograms = new Set();  // fields showing every program, not only the first few

export function pages(answers) {
  return answers.start === "not_sure" ? ["interests", "fields", "pathway"] : ["main"];
}

export function render(ctx) {
  const { page } = ctx;
  if (page === "interests") return interestsPage(ctx);
  if (page === "fields") return fieldsPage(ctx);
  if (page === "pathway") return pathwayPage(ctx);
  return choose.render(ctx);
}

export function check(answers, page) {
  return page === "main" ? choose.check(answers) : null;
}

export function onInput(event, ctx) {
  if (ctx.page === "main") choose.onInput(event, ctx);
}

export function onChange(event, ctx) {
  if (ctx.page === "main") return choose.onChange(event, ctx);
  const { name, value, checked } = event.target;
  const { answers, update, rerender } = ctx;

  if (name === "interest") {
    let interests = answers.interests.filter((i) => i !== value);
    if (checked) {
      if (interests.length >= MAX_INTERESTS) {
        event.target.checked = false;
        showError(t("unsure.interest.max"));
        return;
      }
      interests = [...interests, value];
    }
    showAllFields = false;
    update({ interests, interestsUnsure: false });
    rerender();
  } else if (name === "interest-unsure") {
    showAllFields = false;
    update({ interestsUnsure: checked, interests: checked ? [] : answers.interests });
    rerender();
  } else if (name === "field") {
    const fields = answers.fields.filter((f) => f !== value);
    update({ fields: checked ? [...fields, value] : fields });
    event.target.closest(".field-card")?.classList.toggle("is-chosen", checked);
  } else if (name === "home") {
    update({ home: value });
    rerender();
  } else if (name === "scope") {
    update({ scope: value });
    rerender();
  } else if (name === "degree") {
    update({ degree: value });
  }
}

export function onClick(event, ctx) {
  if (ctx.page === "main") return choose.onClick(event, ctx);
  if (event.target.closest('[data-action="all-fields"]')) {
    showAllFields = !showAllFields;
    ctx.rerender();
  }
  const more = event.target.closest('[data-action="all-programs"]');
  if (more) {
    const family = more.dataset.family;
    if (allPrograms.has(family)) allPrograms.delete(family);
    else allPrograms.add(family);
    ctx.rerender();
  }
}

// Remember which program lists are open (<details> keeps no state across a redraw)
export function onToggle(event) {
  const list = event.target;
  if (!list.matches?.("details.programs")) return;
  if (list.open) openPrograms.add(list.dataset.family);
  else openPrograms.delete(list.dataset.family);
}

// ---------- helpers ----------

const scopeStates = statesOf;

// "New York", "your states" or "the U.S."
export function where(answers) {
  const states = scopeStates(answers);
  if (states.length > 1) return t("dir.count.yourStates");
  return states.length ? STATE_NAMES[states[0]] || states[0] : t("pathway.us");
}

export function familyName(code) {
  const key = `family.${code}`;
  const name = t(key);
  return name === key ? t("web.family.unknown", code) : name;
}

function title(text, subtitle) {
  return `
    <h1 id="page-title" tabindex="-1">${escapeHtml(text)}</h1>
    ${subtitle ? `<p class="lede">${escapeHtml(subtitle)}</p>` : ""}`;
}

// "Data sources" at the foot of a page: one line per source, [what it is, where it comes from]
function sources(rows) {
  const lines = rows.map(([what, from]) =>
    `<div><dt>${escapeHtml(what)}</dt><dd>${escapeHtml(from)}</dd></div>`).join("");
  return `
    <div class="sources">
      <p class="sources-title">${escapeHtml(t("web.source.title"))}</p>
      <dl>${lines}</dl>
    </div>`;
}

const ONET = () => [t("web.source.careers"), t("web.source.onet")];
const COUNTS = (place) => [t("web.source.counts"), t("web.source.counts.text", place)];

function showError(text) {
  const error = document.getElementById("step-error");
  if (error) error.textContent = text;
}

function placeRow({ answers, data }) {
  const states = [...data.states].sort((a, b) => (STATE_NAMES[a] || a).localeCompare(STATE_NAMES[b] || b));
  const options = [`<option value=""${answers.home ? "" : " selected"}>${escapeHtml(t("form.notSure"))}</option>`]
    .concat(states.map((s) => `<option value="${s}"${s === answers.home ? " selected" : ""}>${escapeHtml(STATE_NAMES[s] || s)}</option>`))
    .join("");
  const scope = answers.home
    ? choiceChips({
        name: "scope",
        legend: t("unsure.explore"),
        selected: answers.scope,
        options: [
          { value: "state", label: t("unsure.inState") },
          { value: "anywhere", label: t("unsure.anywhere") },
        ],
      })
    : "";
  return `
    <div class="place-row">
      <label class="field-label">${escapeHtml(t("unsure.liveIn"))}
        <select name="home">${options}</select>
      </label>
      ${scope}
    </div>`;
}

// ---------- page 1: interests ----------

function interestsPage({ answers }) {
  const cards = optionCards({
    name: "interest",
    type: "checkbox",
    legend: t("unsure.interest.title"),
    className: "interest-cards",
    options: INTERESTS.map((i) => ({
      value: i,
      title: t(`interest.${i}`),
      description: `${t(`interest.${i}.ex1`)} ${t(`interest.${i}.ex2`)}`,
      checked: answers.interests.includes(i),
    })),
  });
  const unsure = optionCards({
    name: "interest-unsure",
    type: "checkbox",
    legend: t("unsure.interest.notSure"),
    className: "unsure-card",
    options: [{
      value: "yes",
      title: t("unsure.interest.notSure"),
      description: t("unsure.interest.notSure.text"),
      checked: answers.interestsUnsure,
    }],
  });
  return `
    ${title(t("unsure.interest.title"), t("unsure.interest.subtitle"))}
    ${stepError()}
    ${cards}
    ${unsure}
    ${sources([[t("web.source.activities"), t("web.source.onet")]])}`;
}

// ---------- page 2: fields ----------

function commonMode(answers) {
  return answers.interestsUnsure || answers.interests.length === 0;
}

function fieldsPage(ctx) {
  const { answers, data } = ctx;
  const states = scopeStates(answers);
  const place = where(answers);

  if (commonMode(answers)) {
    const cards = optionCards({
      name: "field",
      type: "checkbox",
      legend: t("unsure.common.title"),
      className: "common-fields",
      options: COMMON_FIELDS.map((f) => ({
        value: f,
        title: familyName(f),
        description: t(`field.${f}`),
        checked: answers.fields.includes(f),
        aside: bigNumber(formatNumber(fieldCount(data, states, f)), t("web.colleges.in", place)),
      })),
    });
    return `
      ${title(t("unsure.common.title"), t("unsure.common.subtitle"))}
      ${placeRow(ctx)}
      ${cards}
      ${sources([COUNTS(place)])}`;
  }

  const names = new Intl.ListFormat(currentLanguage().html, { type: "conjunction" })
    .format(answers.interests.map((i) => `“${t(`interest.${i}`)}”`));
  const fields = linkedFields(data, answers.interests, states);
  const shown = showAllFields ? fields : fields.slice(0, FIELDS_SHOWN);
  const more = fields.length > FIELDS_SHOWN
    ? `<button type="button" class="link more" data-action="all-fields">${escapeHtml(
        showAllFields ? t("unsure.fields.showFewer") : t("unsure.fields.showAll", formatNumber(fields.length)))}</button>`
    : "";
  const empty = fields.length ? "" : `<p class="notice">${escapeHtml(t("unsure.fields.empty", place))}</p>`;
  const liberalCount = fieldCount(data, states, LIBERAL_ARTS);
  const liberal = liberalCount
    ? optionCards({
        name: "field",
        type: "checkbox",
        legend: familyName(LIBERAL_ARTS),
        className: "liberal-card",
        options: [{
          value: LIBERAL_ARTS,
          title: t("unsure.fields.liberal", familyName(LIBERAL_ARTS)),
          description: t("web.fields.liberal.desc"),
          checked: answers.fields.includes(LIBERAL_ARTS),
          aside: bigNumber(formatNumber(liberalCount), t("web.colleges.in", place)),
        }],
      })
    : "";

  return `
    ${title(t("unsure.fields.title"), t("unsure.fields.subtitle", names))}
    ${placeRow(ctx)}
    ${empty}
    <fieldset class="field-list">
      <legend class="visually-hidden">${escapeHtml(t("unsure.fields.title"))}</legend>
      ${shown.map((f) => fieldCard(f, answers, data, place)).join("")}
    </fieldset>
    ${more}
    ${liberal}
    ${sources([ONET(), [t("web.source.links"), t("web.source.crosswalk")], COUNTS(place)])}`;
}

function fieldCard(field, answers, data, place) {
  const id = `field-${field.family}`;
  const on = answers.fields.includes(field.family);
  const careers = field.careers.map((c) => `
    <li><span class="career">${escapeHtml(c.title)}</span>
      <span class="tag">${escapeHtml(t(`web.jobZone.${c.jobZone}`))}</span></li>`).join("");
  const showAll = allPrograms.has(field.family);
  const programs = (showAll ? field.programs : field.programs.slice(0, PROGRAMS_SHOWN)).map((p) => `
    <li><span>${escapeHtml(data.programNames[p.cip] || p.cip)}</span>
      <span class="count">${escapeHtml(t("unsure.fields.programCount", formatNumber(p.colleges)))}</span></li>`).join("");
  const morePrograms = field.programs.length > PROGRAMS_SHOWN
    ? `<button type="button" class="link" data-action="all-programs" data-family="${field.family}">${escapeHtml(showAll
        ? t("web.fields.programs.fewer")
        : t("web.fields.programs.all", formatNumber(field.programs.length)))}</button>`
    : "";
  return `
    <div class="field-card${on ? " is-chosen" : ""}">
      <label class="field-head" for="${id}">
        <input type="checkbox" id="${id}" name="field" value="${field.family}"${on ? " checked" : ""}>
        <span class="tick" aria-hidden="true">${icon("check")}</span>
        <span class="option-text">
          <span class="option-title">${escapeHtml(familyName(field.family))}</span>
          <span class="option-description">${escapeHtml(t("web.fields.careers.label"))}</span>
        </span>
        ${bigNumber(formatNumber(field.colleges), t("web.colleges.in", place))}
      </label>
      <ul class="careers" aria-label="${escapeHtml(t("unsure.fields.careers"))}">${careers}</ul>
      <details class="programs" data-family="${field.family}"${openPrograms.has(field.family) ? " open" : ""}>
        <summary>${escapeHtml(t("web.fields.programs.count", place, formatNumber(field.programs.length)))}</summary>
        <ul>${programs}</ul>
        ${morePrograms}
      </details>
    </div>`;
}

// ---------- page 3: two-year or four-year ----------

function pathwayPage(ctx) {
  const { answers } = ctx;
  const choice = choiceChips({
    name: "degree",
    legend: t("web.path.choice"),
    selected: answers.degree,
    options: [
      { value: "both", label: t("unsure.both") },
      { value: "two", label: t("unsure.two") },
      { value: "four", label: t("unsure.four") },
    ],
  });
  return `
    ${title(t("unsure.pathway.title"), t("unsure.pathway.subtitle"))}
    ${pathwayCards(ctx)}
    ${choice}`;
}

// Two-year and four-year colleges side by side, with counts and median costs for the chosen states
export function pathwayCards({ answers, data }) {
  const place = where(answers);
  const p = pathwaySummary(data, scopeStates(answers));
  const four = p.fourPublic.colleges + p.fourPrivate.colleges;
  return `
    <div class="pathways">
      <section class="pathway">
        <h2>${escapeHtml(t("pathway.two"))} <span class="tag">${escapeHtml(t("pathway.two.tag"))}</span></h2>
        ${bigNumber(formatNumber(p.twoYear.colleges), t("web.colleges.in", place))}
        <p>${escapeHtml(t("web.path.cost", formatMoney(p.twoYear.medianCost)))}</p>
        <p class="muted">${escapeHtml(t("web.path.transfer"))}</p>
      </section>
      <section class="pathway">
        <h2>${escapeHtml(t("pathway.four"))} <span class="tag">${escapeHtml(t("pathway.four.tag"))}</span></h2>
        ${bigNumber(formatNumber(four), t("web.colleges.in", place))}
        <p>${escapeHtml(t("web.path.public", formatNumber(p.fourPublic.colleges), formatMoney(p.fourPublic.medianCost)))}<br>
           ${escapeHtml(t("web.path.private", formatNumber(p.fourPrivate.colleges), formatMoney(p.fourPrivate.medianCost)))}</p>
        <p class="muted">${escapeHtml(t("web.path.costNote"))}</p>
      </section>
    </div>`;
}
