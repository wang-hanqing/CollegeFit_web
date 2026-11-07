// Reusable pieces for the steps. Choices are real radio inputs, so keyboards, screen readers
// and phone browsers handle them without extra code; CSS makes them look like cards or chips.
import { escapeHtml } from "./ui.js";

const ICONS = {
  // simple line icons, drawn on a 24 x 24 grid
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/><path d="M22 9v6"/>',
  pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  paths: '<path d="M12 21v-7"/><path d="M12 14L6 8V4"/><path d="M12 14l6-6V4"/><path d="M4 6l2-2 2 2M16 6l2-2 2 2"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
};

export function icon(name, extraClass = "") {
  return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

// Large cards. options: [{ value, title, description, icon, aside, checked }]
// type "radio" = one choice (selected), "checkbox" = several (each option's checked).
// aside: optional HTML shown at the end of the card, such as a big number.
export function optionCards({ name, legend, options, selected, type = "radio", className = "" }) {
  const cards = options.map((o) => {
    const id = `${name}-${o.value}`;
    const on = type === "radio" ? o.value === selected : o.checked;
    return `
      <label class="option-card" for="${id}">
        <input type="${type}" id="${id}" name="${name}" value="${escapeHtml(o.value)}"${on ? " checked" : ""}>
        ${o.icon ? `<span class="option-icon">${icon(o.icon)}</span>` : ""}
        ${type === "checkbox" ? `<span class="tick" aria-hidden="true">${icon("check")}</span>` : ""}
        <span class="option-text">
          <span class="option-title">${escapeHtml(o.title)}</span>
          ${o.description ? `<span class="option-description">${escapeHtml(o.description)}</span>` : ""}
        </span>
        ${o.aside || ""}
      </label>`;
  }).join("");
  return `
    <fieldset class="option-cards ${className}">
      <legend class="visually-hidden">${escapeHtml(legend)}</legend>
      ${cards}
    </fieldset>`;
}

// A big number with a short label under it, e.g. 137 / colleges in New York
export function bigNumber(number, label) {
  return `<span class="big-number"><span class="big-number-value">${escapeHtml(number)}</span><span class="big-number-label">${escapeHtml(label)}</span></span>`;
}

// Small pills in a row, one choice. options: [{ value, label }]
export function choiceChips({ name, legend, hint, options, selected }) {
  const chips = options.map((o) => {
    const id = `${name}-${o.value}`;
    return `
      <label class="chip" for="${id}">
        <input type="radio" id="${id}" name="${name}" value="${escapeHtml(o.value)}"${String(o.value) === String(selected) ? " checked" : ""}>
        <span>${escapeHtml(o.label)}</span>
      </label>`;
  }).join("");
  return `
    <fieldset class="chips">
      <legend>${escapeHtml(legend)}</legend>
      ${hint ? `<p class="hint">${escapeHtml(hint)}</p>` : ""}
      <div class="chip-row">${chips}</div>
    </fieldset>`;
}

// Where a step shows "pick something first" messages
export function stepError() {
  return '<p id="step-error" class="step-error" role="alert"></p>';
}

export function privacyNote(text) {
  return `<p class="privacy">${icon("shield")}${escapeHtml(text)}</p>`;
}

ICONS.dollar = '<path d="M12 3v18"/><path d="M16.5 7.5c-.8-1.3-2.4-2-4.5-2-2.6 0-4 1.3-4 3s1.5 2.6 4 3.2 4.5 1.4 4.5 3.3-1.8 3.3-4.5 3.3c-2.2 0-3.9-.8-4.8-2.3"/>';
ICONS.book = '<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5c-.8 0-1.5-.7-1.5-1.5z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z"/>';
ICONS.door = '<path d="M5 21V4.5C5 3.7 5.7 3 6.5 3h11c.8 0 1.5.7 1.5 1.5V21"/><path d="M3 21h18"/><path d="M14.5 12.5v.5"/>';
ICONS.back = '<path d="M15 5l-7 7 7 7"/>';
ICONS.check = '<path d="M5 12.5l4.5 4.5L19 7.5"/>';
ICONS.shield = '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>';
