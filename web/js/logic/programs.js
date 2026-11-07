// The program search list for "A subject or career I like". Ported from CollegeDataLoader.loadProgramList.
// Programs (4-digit CIP) that some college recently awarded, plus whole fields (2-digit) when a field has
// more than one such program. Whole fields come first, then programs, each alphabetical.
// tests/programs.test.mjs checks the list and counts against the Java version.
import { t } from "../i18n.js";
import { caseInsensitive } from "./explore.js";
import { programCounts } from "./directions.js";

let cached = null;

export function programList(data, familyName) {
  if (cached && cached.language === t("program.family", "")) return cached.list;
  const national = programCounts(data, []);
  const programs = Object.keys(data.programNames).filter((code) => (national.get(code) || 0) > 0);
  const perFamily = new Map();
  programs.forEach((code) => perFamily.set(code.slice(0, 2), (perFamily.get(code.slice(0, 2)) || 0) + 1));

  const fields = [...perFamily].filter(([, n]) => n > 1).map(([family]) => ({
    code: family,
    name: t("program.family", familyName(family)),
    short: t("program.family.short", familyName(family)),
    colleges: national.get(family) || 0,
  }));
  const items = programs.map((code) => {
    const name = data.programNames[code];
    const comma = name.indexOf(",");
    return { code, name, short: comma > 0 ? name.slice(0, comma) : name, colleges: national.get(code) };
  });
  const byName = (a, b) => caseInsensitive(a.name, b.name);
  const list = [...fields.sort(byName), ...items.sort(byName)];
  cached = { language: t("program.family", ""), list };
  return list;
}

// Up to 40 matches for what the student typed (a short list is easier to scan)
export function searchPrograms(list, query, limit = 40) {
  const q = query.trim().toLowerCase();
  const out = [];
  for (const p of list) {
    if (q && !p.name.toLowerCase().includes(q)) continue;
    out.push(p);
    if (out.length === limit) break;
  }
  return out;
}
