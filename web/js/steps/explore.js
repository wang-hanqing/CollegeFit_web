// Step 4: Explore. Ported from OptionsPanel.java and OptionCard.java.
// Colleges are grouped by type and ordered by the student's priorities (logic/explore.js).
// Each card is short on purpose: the top two priorities, Keep and Not for me, and a tag when the college
// offers only some of the student's programs. The three groups sit side by side (tabs on narrow screens).
//
// answers.kept      UNITIDs kept, in the order kept
// answers.compare   up to 3 kept UNITIDs shown side by side in Step 5
// answers.notForMe  UNITID -> reason key ("" when no reason was given)
import { t, formatNumber, formatMoney, currentLanguage } from "../i18n.js";
import { escapeHtml } from "../ui.js";
import { icon } from "../components.js";
import { STATE_NAMES } from "../config.js";
import { familyName } from "./direction.js";
import {
  profileFrom, recommend, groups, GROUPS, comparableCost, outOfStatePublic,
} from "../logic/explore.js";
import { collegeIdFrom, pageFor, renderDetails, onDetailsClick, onDetailsChange } from "./details.js";
import { sizeOf } from "../logic/evaluate.js";

// #/explore/college-<UNITID> opens one college
export function isPage(page) {
  return collegeIdFrom(page) != null;
}

const FIRST = 2;          // cards per group before "Show all"
const BATCH = 12;         // cards added by each "Show more"
const TIP_AFTER = 2;      // same reason this many times -> suggestion
const REASONS = ["COST", "FAR", "ADMISSION", "PROGRAM", "SIZE", "OTHER"];
const MAX_COMPARE = 3;

// Page state that is not saved with the answers
const shown = {};                 // group -> number of cards shown in the one-group view
let focus = null;                 // group shown on its own after "Show all", or null for all three
let tab = null;                   // group shown on narrow screens, where the three columns become tabs
const openSetAside = new Set();   // groups whose "Not for me" list is open
const dismissedTips = new Set();
let pendingReason = null;         // UNITID waiting for a reason in the dialog

export function render(ctx) {
  const id = collegeIdFrom(ctx.page);
  if (id != null) return renderDetails(ctx, id) + reasonDialog();
  const { data, answers } = ctx;
  const profile = profileFrom(answers);
  const ranked = recommend(data, profile);
  const byGroup = groups(ranked);
  const place = placeText(profile);

  return `
    <h1 id="page-title" tabindex="-1">${escapeHtml(t("options.title", topicText(profile, data), place))}</h1>
    <p class="lede explore-count">${escapeHtml(t("options.count", formatNumber(ranked.length), place))}</p>
    ${summaryPanel(profile, data)}
    ${tip(answers, profile)}
    ${focus ? focusView(focus, byGroup[focus], answers, profile, data) : groupColumns(byGroup, answers, profile, data)}
    <p class="source">${escapeHtml(t("options.footnote.all"))}</p>
    ${reasonDialog()}`;
}

export function continueLabel() {
  return t("explore.toCompare");
}

// ---------- header rows ----------

function topicText(profile, data) {
  const names = profile.programs.map((code) => programName(code, data));
  if (!names.length) return t("options.topic.all");
  if (names.length > 2) return `${names.slice(0, 2).join(", ")} ${t("options.topic.more", formatNumber(names.length - 2))}`;
  return new Intl.ListFormat(currentLanguage().html, { type: "conjunction" }).format(names);
}

function placeText(profile) {
  return profile.states.length
    ? t("options.in", profile.states.map((s) => STATE_NAMES[s] || s).join(", "))
    : t("options.anywhere");
}

function programName(code, data) {
  if (code.length === 2) return familyName(code);
  return (data.programNames[code] || code).split(",")[0]; // "Registered Nursing", not the full title
}

// Direction and order in one panel: what the student chose (white chips), their priorities
// (blue, numbered) and the steps that always follow (gray). Each row has one Edit button.
function summaryPanel(profile, data) {
  const level = { ASSOCIATE: t("unsure.two"), BACHELOR: t("unsure.four") }[profile.pathway] || t("options.anyLevel");
  const direction = [...profile.programs.map((c) => programName(c, data)), level, ...profile.states.map((s) => STATE_NAMES[s] || s)];
  const chosen = profile.priorities;
  const auto = [...(chosen.length ? [] : [t("web.order.auto.campus")]),
    ...(profile.programs.length
      ? [t("web.order.auto.programs"), t("web.order.auto.degree"), t("web.order.auto.size")]
      : [t("web.order.auto.collegeSize")]),
    t("web.order.auto.name")];
  const edit = (action, hidden) => `
    <button type="button" class="panel-edit" data-action="${action}">${icon("edit")}<span aria-hidden="true">${escapeHtml(t("web.panel.edit"))}</span><span class="visually-hidden">${escapeHtml(hidden)}</span></button>`;
  return `
    <div class="summary-panel">
      <span class="panel-label" id="panel-direction">${escapeHtml(t("web.panel.direction"))}</span>
      <ul class="panel-chips" aria-labelledby="panel-direction">${direction.map((d) => `<li class="chip-plain">${escapeHtml(d)}</li>`).join("")}</ul>
      ${edit("change-direction", t("web.panel.editDirection"))}
      <span class="panel-label" id="panel-order">${escapeHtml(t("web.panel.order"))}</span>
      <ol class="panel-chips" aria-labelledby="panel-order">
        ${chosen.map((p, i) => `<li class="chip-priority"><span class="chip-number">${escapeHtml(formatNumber(i + 1))}</span>${escapeHtml(t(`web.order.chip.${p}`))}</li>`).join("")}
        ${chosen.length ? `<li class="chip-sep" aria-hidden="true">${icon("arrow", "directional")}</li>` : ""}
        ${auto.map((a) => `<li class="chip-auto">${escapeHtml(a)}</li>`).join("")}
      </ol>
      ${edit("change-priorities", t("web.panel.editOrder"))}
    </div>`;
}

// "You set aside 2 colleges as 'Costs seem too high'. Want to put college costs first?"
function tip(answers) {
  const counts = {};
  for (const reason of Object.values(answers.notForMe)) if (reason) counts[reason] = (counts[reason] || 0) + 1;
  const reason = REASONS.find((r) => r !== "OTHER" && (counts[r] || 0) >= TIP_AFTER && !dismissedTips.has(r));
  if (!reason) return "";
  return `
    <div class="tip" role="status">
      <p>${escapeHtml(t("tip.text", formatNumber(counts[reason]), t(`reason.${reason}`)))} ${escapeHtml(t(`tip.ask.${reason}`))}</p>
      <div class="tip-actions">
        <button type="button" class="secondary small" data-action="tip-dismiss" data-reason="${reason}">${escapeHtml(t("tip.notNow"))}</button>
        <button type="button" class="primary small" data-action="tip-do" data-reason="${reason}">${escapeHtml(t(`tip.do.${reason}`))}</button>
      </div>
    </div>`;
}

// ---------- groups and cards ----------

// The three groups side by side (as in the Java version), so no group looks like the first choice.
// On narrow screens the columns become tabs; the tab for the student's degree path opens first.
function groupColumns(byGroup, answers, profile, data) {
  const active = (g) => byGroup[g].filter((r) => !(r.college.UNITID in answers.notForMe));
  const open = tab || defaultTab(profile, (g) => active(g).length);
  const tabs = GROUPS.map((g) => `
    <button type="button" role="tab" class="group-tab" data-action="tab" data-group="${g}" aria-selected="${g === open}"
      aria-controls="column-${g}">${escapeHtml(t(`web.tab.${g}`))} <span class="group-count">${escapeHtml(formatNumber(active(g).length))}</span></button>`).join("");
  return `
    <div class="groups-wrap">
      <div class="group-tabs" role="tablist" aria-label="${escapeHtml(t("web.tabs.label"))}">${tabs}</div>
      <div class="groups">
        ${GROUPS.map((g) => groupColumn(g, byGroup[g], answers, profile, data, g === open)).join("")}
      </div>
    </div>`;
}

function defaultTab(profile, count) {
  if (profile.pathway === "BACHELOR") return "PUBLIC_FOUR_YEAR";
  if (profile.pathway === "ASSOCIATE") return "COMMUNITY_COLLEGE";
  return GROUPS.find((g) => count(g) > 0) || GROUPS[0];
}

function groupColumn(group, recs, answers, profile, data, isOpen) {
  const active = recs.filter((r) => !(r.college.UNITID in answers.notForMe));
  const setAside = recs.filter((r) => r.college.UNITID in answers.notForMe);
  const cards = active.slice(0, FIRST).map((r) => card(r, answers, profile, data)).join("");
  const more = active.length > FIRST
    ? `<button type="button" class="secondary small" data-action="show-all" data-group="${group}">${escapeHtml(t("options.showAll", formatNumber(active.length)))}</button>`
    : "";
  return `
    <section class="group group-column${isOpen ? " is-open" : ""}" id="column-${group}" aria-labelledby="group-${group}">
      <div class="group-head">
        <h2 id="group-${group}">${escapeHtml(t(`group.${group}`))} <span class="group-count">${escapeHtml(formatNumber(active.length))}</span></h2>
        <p class="muted">${escapeHtml(t(`group.${group}.sub`))}</p>
      </div>
      ${active.length ? "" : `<p class="empty">${emptyText(group, profile)}</p>`}
      <div class="college-list">${cards}</div>
      ${more ? `<div class="group-more">${more}</div>` : ""}
      ${setAside.length ? setAsideBox(group, setAside, answers) : ""}
    </section>`;
}

// After "Show all": one group across the full width, three cards a row
function focusView(group, recs, answers, profile, data) {
  const active = recs.filter((r) => !(r.college.UNITID in answers.notForMe));
  const setAside = recs.filter((r) => r.college.UNITID in answers.notForMe);
  const count = Math.min(shown[group] || BATCH, active.length);
  const more = active.length > count
    ? `<button type="button" class="secondary" data-action="show-more" data-group="${group}">${escapeHtml(t("options.more"))}</button>`
    : "";
  return `
    <button type="button" class="link back-link" data-action="all-groups">${icon("back", "directional")}${escapeHtml(t("web.allGroups"))}</button>
    <section class="group" aria-labelledby="group-${group}">
      <h2 id="group-${group}">${escapeHtml(t(`group.${group}`))} <span class="group-count">${escapeHtml(formatNumber(active.length))}</span></h2>
      <p class="muted">${escapeHtml(t(`group.${group}.sub`))}</p>
      <div class="college-grid">${active.slice(0, count).map((r) => card(r, answers, profile, data)).join("")}</div>
      ${more ? `<div class="group-more">${more}</div>` : ""}
      ${setAside.length ? setAsideBox(group, setAside, answers) : ""}
    </section>`;
}

function emptyText(group, profile) {
  const bachelorOnly = profile.pathway === "BACHELOR" && group === "COMMUNITY_COLLEGE";
  const associateOnly = profile.pathway === "ASSOCIATE" && group === "PUBLIC_FOUR_YEAR";
  if (!bachelorOnly && !associateOnly) return escapeHtml(t("options.none"));
  return `${escapeHtml(t(bachelorOnly ? "options.none.bachelor" : "options.none.associate"))}
    <button type="button" class="link" data-action="include-both">${escapeHtml(t(bachelorOnly ? "options.includeAssociate" : "options.includeBachelor"))}</button>`;
}

function card(r, answers, profile, data) {
  const c = r.college;
  const id = c.UNITID;
  const kept = answers.kept.includes(id);
  const top = profile.priorities.length ? profile.priorities.slice(0, 2) : ["COSTS", "ADMISSION"];
  const lines = [];
  top.forEach((p, i) => lines.push(fact(profile.priorities.length ? `#${formatNumber(i + 1)}` : "", t(`card.label.${p}`), priorityValue(p, r, profile, data))));

  return `
    <article class="college-card${kept ? " is-kept" : ""}" aria-labelledby="college-${id}">
      <h3 id="college-${id}">${escapeHtml(c.INSTNM)}</h3>
      <p class="where">${escapeHtml(`${c.CITY}, ${c.STABBR}`)} <span class="tag">${escapeHtml(t(c.twoYear ? "tag.two" : "tag.four"))}</span>${partialTag(r, profile, data)}</p>
      <dl class="facts">${lines.join("")}</dl>
      <div class="card-actions">
        <button type="button" class="${kept ? "primary" : "secondary"} small" data-action="keep" data-id="${id}" aria-pressed="${kept}">
          ${kept ? icon("check") : ""}${escapeHtml(t(kept ? "keep.kept" : "keep.keep"))}</button>
        <button type="button" class="quiet small" data-action="not-for-me" data-id="${id}">${escapeHtml(t("keep.not"))}</button>
        <button type="button" class="link details-link" data-action="details" data-id="${id}">${escapeHtml(t("card.detailsShort"))}</button>
      </div>
    </article>`;
}

// "Business only" when the student picked several programs and this college offers some of them
function partialTag(r, profile, data) {
  if (profile.programs.length < 2 || r.programsAwarded >= profile.programs.length) return "";
  const names = new Intl.ListFormat(currentLanguage().html, { type: "conjunction" })
    .format(r.awardedNames.map((code) => programName(code, data)));
  return ` <span class="tag partial">${escapeHtml(t("web.card.only", names))}</span>`;
}

function fact(rank, label, valueHtml) {
  return `
    <div class="fact">
      <dt>${rank ? `<span class="rank-tag">${escapeHtml(rank)}</span>` : ""}${escapeHtml(label)}</dt>
      <dd>${valueHtml}</dd>
    </div>`;
}

function levelText(r) {
  if (r.associateAwarded && r.bachelorAwarded) return t("level.both");
  return t(r.bachelorAwarded ? "level.bachelor" : "level.associate");
}

// r: an Explore result or an evaluateAll(...).program result (same fields)
export function programLine(r, profile, data) {
  if (!profile.programs.length) return t("card.program.all", formatNumber(r.recentDegrees));
  if (profile.programs.length === 1) {
    const name = programName(profile.programs[0], data);
    return r.recentDegrees > 0
      ? t("card.program.one", name, formatNumber(r.recentDegrees), levelText(r))
      : t("card.program.awarded", name, levelText(r));
  }
  return t("card.program.many", formatNumber(r.programsAwarded), formatNumber(profile.programs.length), formatNumber(r.recentDegrees));
}

function priorityValue(p, r, profile, data) {
  const c = r.college;
  const big = (text) => `<strong class="value">${escapeHtml(text)}</strong>`;
  switch (p) {
    case "COSTS": {
      const cost = comparableCost(profile, c);
      if (cost != null) return `${big(`${formatMoney(cost)}`)} <span class="muted">${escapeHtml(t("web.perYear"))}*</span>`;
      return escapeHtml(t(outOfStatePublic(profile, c) ? "card.cost.oosNotComparable" : "card.cost.notReported"));
    }
    case "GRADUATION":
      return c.completionRate == null ? escapeHtml(t("notReported"))
        : `${big(formatNumber(c.completionRate, { style: "percent", maximumFractionDigits: 0 }))} <span class="muted">${escapeHtml(t("card.completion.measure", formatNumber(c.completionYears)))}</span>`;
    case "ADMISSION":
      if (c.openAdmission === true) return big(t("ac.open"));
      if (c.ADM_RATE != null && c.ADM_RATE > 0) return `${big(formatNumber(c.ADM_RATE, { style: "percent", maximumFractionDigits: 0 }))} <span class="muted">${escapeHtml(t("web.admitted"))}</span>`;
      return escapeHtml(t("notReported"));
    case "STUDY":
      return escapeHtml(programLine(r, profile, data));
    default:
      return campusLine(r.social, c);
  }
}

// State, setting and size, each with a match mark; only the ones the student chose
export function campusLine(social, c) {
  const shown = social.facts.filter((f) => f.match != null);
  if (!shown.length) return escapeHtml(t("card.social.none"));
  return shown.map((f) => {
    const v = f.label === t("soc.size") ? t(`card.size.${sizeOf(c) || "UNKNOWN"}`) : f.value;
    return `${escapeHtml(v)} ${f.match ? `<span class="match">${icon("check")}</span>` : '<span class="no-match">✗</span>'}`;
  }).join(" ");
}

// ---------- not for me ----------

function setAsideBox(group, setAside, answers) {
  const open = openSetAside.has(group);
  const items = setAside.map((r) => {
    const id = r.college.UNITID;
    const reason = answers.notForMe[id];
    const why = reason ? t(`reason.${reason}`) : t("not.noReason");
    return `
      <li>
        <strong>${escapeHtml(r.college.INSTNM)}</strong>
        <span class="muted">${escapeHtml(t("not.reasonLine", why))}</span>
        <span class="set-aside-actions">
          <button type="button" class="link" data-action="undo-not" data-id="${id}">${escapeHtml(t("not.undo"))}</button>
          <button type="button" class="link" data-action="not-for-me" data-id="${id}">${escapeHtml(t("not.edit"))}</button>
        </span>
      </li>`;
  }).join("");
  return `
    <details class="set-aside" data-group="${group}"${open ? " open" : ""}>
      <summary>${escapeHtml(t("not.section", formatNumber(setAside.length)))}</summary>
      <ul>${items}</ul>
    </details>`;
}

function reasonDialog() {
  const options = REASONS.map((r) => `
    <label class="chip"><input type="radio" name="reason" value="${r}"><span>${escapeHtml(t(`reason.${r}`))}</span></label>`).join("");
  return `
    <dialog id="reason-dialog" class="help" aria-labelledby="reason-title">
      <form method="dialog">
        <h2 id="reason-title"></h2>
        <p class="muted">${escapeHtml(t("not.question"))}</p>
        <fieldset class="reason-options">
          <legend class="visually-hidden">${escapeHtml(t("not.question"))}</legend>
          ${options}
        </fieldset>
        <div class="dialog-actions">
          <button type="submit" value="cancel" class="secondary">${escapeHtml(t("not.cancel"))}</button>
          <button type="submit" value="save" class="primary" data-action="reason-save">${escapeHtml(t("not.save"))}</button>
        </div>
      </form>
    </dialog>`;
}

// ---------- clicks ----------

export function onChange(event, ctx) {
  onDetailsChange(event, ctx);
}

export function onClick(event, ctx) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  if (onDetailsClick(event, ctx)) return;
  const { answers, update, rerender, go } = ctx;
  const id = target.dataset.id != null ? Number(target.dataset.id) : null;
  const group = target.dataset.group;

  switch (target.dataset.action) {
    case "keep": {
      if (answers.kept.includes(id)) {
        update({
          kept: answers.kept.filter((k) => k !== id),
          compare: answers.compare.filter((k) => k !== id),
        });
      } else {
        const notForMe = { ...answers.notForMe };
        delete notForMe[id];
        update({
          kept: [...answers.kept, id],
          compare: answers.compare.length < MAX_COMPARE ? [...answers.compare, id] : answers.compare,
          notForMe,
        });
      }
      rerender();
      break;
    }
    case "not-for-me": {
      pendingReason = id;
      const dialog = document.getElementById("reason-dialog");
      const college = ctx.data.collegeById.get(id);
      dialog.querySelector("#reason-title").textContent = t("not.title", college.INSTNM);
      dialog.querySelectorAll('input[name="reason"]').forEach((input) => {
        input.checked = input.value === (answers.notForMe[id] || "");
      });
      dialog.returnValue = "";
      dialog.showModal();
      dialog.addEventListener("close", () => onReasonClosed(dialog, ctx), { once: true });
      break;
    }
    case "undo-not": {
      const notForMe = { ...answers.notForMe };
      delete notForMe[id];
      update({ notForMe });
      rerender();
      break;
    }
    case "show-all": focus = group; shown[group] = BATCH; rerender(); document.getElementById(`group-${group}`)?.scrollIntoView(); break;
    case "show-more": shown[group] = (shown[group] || BATCH) + BATCH; rerender(); break;
    case "all-groups": focus = null; rerender(); document.querySelector(".groups-wrap")?.scrollIntoView(); break;
    case "tab": tab = group; rerender(); document.querySelector(`[data-action="tab"][data-group="${group}"]`)?.focus(); break;
    case "include-both": update({ degree: "both" }); rerender(); break;
    case "details": go("explore", pageFor(id)); break;
    case "change-direction": go("direction"); break;
    case "change-priorities": go("priorities"); break;
    case "tip-dismiss": dismissedTips.add(target.dataset.reason); rerender(); break;
    case "tip-do": {
      const reason = target.dataset.reason;
      dismissedTips.add(reason);
      if (reason === "COST" || reason === "ADMISSION") {
        const first = reason === "COST" ? "COSTS" : "ADMISSION";
        update({ priorities: [first, ...answers.priorities.filter((p) => p !== first)].slice(0, 3) });
        rerender();
      } else {
        go("direction"); // states, programs or campus choices
      }
      break;
    }
  }
}

export function onToggle(event) {
  const box = event.target.closest(".set-aside");
  if (!box) return;
  if (box.open) openSetAside.add(box.dataset.group);
  else openSetAside.delete(box.dataset.group);
}

function onReasonClosed(dialog, { answers, update, rerender }) {
  if (dialog.returnValue !== "save" || pendingReason == null) return;
  const reason = dialog.querySelector('input[name="reason"]:checked')?.value || "";
  const id = pendingReason;
  pendingReason = null;
  update({
    kept: answers.kept.filter((k) => k !== id),
    compare: answers.compare.filter((k) => k !== id),
    notForMe: { ...answers.notForMe, [id]: reason },
  });
  rerender();
}
