// Step 4: Explore. Ported from OptionsPanel.java and OptionCard.java.
// Colleges are grouped by type and ordered by the student's priorities (logic/explore.js).
// Each card is short on purpose: the program, the top two priorities, Keep and Not for me.
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
  profileFrom, recommend, groups, GROUPS, comparableCost, outOfStatePublic, orderUsed,
} from "../logic/explore.js";
import { collegeIdFrom, pageFor, renderDetails, onDetailsClick, onDetailsChange } from "./details.js";

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
const shown = {};                 // group -> number of cards shown
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
    ${directionRow(profile, data)}
    ${orderRow(profile)}
    <p class="counts"><span>${escapeHtml(t("options.count", formatNumber(ranked.length), place))}</span>
      <span>${escapeHtml(t("explore.counts", formatNumber(answers.kept.length), formatNumber(Object.keys(answers.notForMe).length)))}</span></p>
    ${tip(answers, profile)}
    ${GROUPS.map((g) => groupSection(g, byGroup[g], answers, profile, data)).join("")}
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

function directionRow(profile, data) {
  const level = { ASSOCIATE: t("unsure.two"), BACHELOR: t("unsure.four") }[profile.pathway] || t("options.anyLevel");
  const chips = [...profile.programs.map((c) => programName(c, data)), level, ...profile.states.map((s) => STATE_NAMES[s] || s)];
  return `
    <div class="direction-row">
      <span class="muted">${escapeHtml(t("options.direction"))}</span>
      ${chips.map((c) => `<span class="tag">${escapeHtml(c)}</span>`).join("")}
      <button type="button" class="link" data-action="change-direction">${escapeHtml(t("options.change"))}</button>
    </div>`;
}

function orderRow(profile) {
  const order = orderUsed(profile);
  const text = profile.priorities.length
    ? `${t("explore.orderedBy")} ${profile.priorities.map((p, i) => `${formatNumber(i + 1)}. ${t(`order.short.${p}`)}`).join(`, ${t("then")} `)}.`
    : t("explore.orderedDefault");
  const steps = [t("order.how.evidence"), ...order.map((p) => t(`order.how.${p}`))];
  if (order.includes("STUDY")) steps.push(t("order.how.degrees"));
  steps.push(t("order.how.name"));
  return `
    <div class="order-row">
      <p>${escapeHtml(text)} <button type="button" class="link" data-action="change-priorities">${escapeHtml(t("explore.changePriorities"))}</button></p>
      <details class="how">
        <summary>${escapeHtml(t("order.how.title"))}</summary>
        <ol>${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
        <p>${escapeHtml(t("order.how.note"))}</p>
      </details>
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

function groupSection(group, recs, answers, profile, data) {
  const active = recs.filter((r) => !(r.college.UNITID in answers.notForMe));
  const setAside = recs.filter((r) => r.college.UNITID in answers.notForMe);
  const count = Math.min(shown[group] || FIRST, active.length);
  const cards = active.slice(0, count).map((r) => card(r, answers, profile, data)).join("");

  let more = "";
  if (active.length > count) {
    more = count === FIRST
      ? `<button type="button" class="secondary" data-action="show-all" data-group="${group}">${escapeHtml(t("options.showAll", formatNumber(active.length)))}</button>`
      : `<button type="button" class="secondary" data-action="show-more" data-group="${group}">${escapeHtml(t("options.more"))}</button>`;
  } else if (count > FIRST) {
    more = `<button type="button" class="link" data-action="show-fewer" data-group="${group}">${escapeHtml(t("web.showFewer"))}</button>`;
  }

  return `
    <section class="group" aria-labelledby="group-${group}">
      <h2 id="group-${group}">${escapeHtml(t(`group.${group}`))} <span class="group-count">${escapeHtml(formatNumber(active.length))}</span></h2>
      <p class="muted">${escapeHtml(t(`group.${group}.sub`))}</p>
      ${active.length ? "" : `<p class="empty">${emptyText(group, profile)}</p>`}
      <div class="college-grid">${cards}</div>
      <div class="group-more">${more}</div>
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
  if (!top.includes("STUDY")) lines.push(fact("", t("card.label.STUDY"), escapeHtml(programLine(r, profile, data))));
  top.forEach((p, i) => lines.push(fact(profile.priorities.length ? `#${formatNumber(i + 1)}` : "", t(`card.label.${p}`), priorityValue(p, r, profile, data))));

  return `
    <article class="college-card${kept ? " is-kept" : ""}" aria-labelledby="college-${id}">
      <h3 id="college-${id}">${escapeHtml(c.INSTNM)}</h3>
      <p class="where">${escapeHtml(`${c.CITY}, ${c.STABBR}`)} <span class="tag">${escapeHtml(t(c.twoYear ? "tag.two" : "tag.four"))}</span></p>
      <dl class="facts">${lines.join("")}</dl>
      <div class="card-actions">
        <button type="button" class="${kept ? "primary" : "secondary"} small" data-action="keep" data-id="${id}" aria-pressed="${kept}">
          ${kept ? icon("check") : ""}${escapeHtml(t(kept ? "keep.kept" : "keep.keep"))}</button>
        <button type="button" class="quiet small" data-action="not-for-me" data-id="${id}">${escapeHtml(t("keep.not"))}</button>
        <button type="button" class="link details-link" data-action="details" data-id="${id}">${escapeHtml(t("card.detailsShort"))}</button>
      </div>
    </article>`;
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

function programLine(r, profile, data) {
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
      if (!r.campusConsidered) return escapeHtml(t("card.social.none"));
      return `${escapeHtml(c.STABBR)} ${r.campusMatched ? `<span class="match">${icon("check")}</span>` : `<span class="no-match">✗</span>`}`;
  }
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
    case "show-all": shown[group] = FIRST + BATCH; rerender(); break;
    case "show-more": shown[group] = (shown[group] || FIRST) + BATCH; rerender(); break;
    case "show-fewer": shown[group] = FIRST; rerender(); document.getElementById(`group-${group}`)?.scrollIntoView(); break;
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
