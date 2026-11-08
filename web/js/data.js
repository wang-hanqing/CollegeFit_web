// Loads the files made by pipeline/export_web.py and builds quick lookups.
import { DATA_FILES, VERSION } from "./config.js";

// {"fields": [...], "rows": [[...]]} -> [{field: value, ...}, ...]
function toObjects({ fields, rows }) {
  return rows.map((row) => {
    const item = {};
    fields.forEach((field, i) => (item[field] = row[i]));
    return item;
  });
}

const positive = (n) => n != null && n > 0;

export async function loadData(onProgress = () => {}) {
  let done = 0;
  const loaded = {};
  await Promise.all(
    DATA_FILES.map(async (name) => {
      const response = await fetch(`data/${name}.json?v=${VERSION}`);
      if (!response.ok) throw new Error(`data/${name}.json: ${response.status}`);
      loaded[name] = await response.json();
      onProgress(++done, DATA_FILES.length);
    })
  );
  return prepareData(loaded);
}

// Separate from loading so tests can run it on files read from disk.
export function prepareData(loaded) {
  const colleges = toObjects(loaded.colleges);
  const programs = toObjects(loaded.programs);

  // Per college: programs (4-digit CIP) with a positive award count in either year, at either level,
  // and whether it awards associate (2) or bachelor's (3) degrees at all. Same rules as College.java.
  const awarded = new Map();
  const levels = new Map();
  const programsByCollege = new Map();
  for (const p of programs) {
    if (!programsByCollege.has(p.UNITID)) programsByCollege.set(p.UNITID, []);
    programsByCollege.get(p.UNITID).push(p);
    if (positive(p.IPEDSCOUNT1) || positive(p.IPEDSCOUNT2)) {
      if (!awarded.has(p.UNITID)) awarded.set(p.UNITID, new Set());
      awarded.get(p.UNITID).add(p.CIPCODE);
      if (!levels.has(p.UNITID)) levels.set(p.UNITID, new Set());
      levels.get(p.UNITID).add(p.CREDLEV);
    }
  }
  for (const c of colleges) {
    c.awarded = awarded.get(c.UNITID) || new Set();
    const lv = levels.get(c.UNITID) || new Set();
    c.offers2 = lv.has(2);
    c.offers3 = lv.has(3);
    c.twoYear = c.offers2 && !c.offers3;
    c.isPublic = c.CONTROL === 1;
    c.type = !c.isPublic ? "PRIVATE" : c.twoYear ? "COMMUNITY_COLLEGE" : "PUBLIC_FOUR_YEAR";
    c.openAdmission = c.OPENADMP === 1 ? true : c.OPENADMP === 2 ? false : null;
    // four-year completion within 6 years if reported, otherwise two-year completion within 3 years
    c.completionRate = c.C150_4 ?? c.C150_L4 ?? null;
    c.completionYears = c.C150_4 != null ? 6 : c.C150_L4 != null ? 3 : 0;
    c.programs = programsByCollege.get(c.UNITID) || [];
  }

  // interest -> family -> career code -> { soc, title, jobZone, cip6Links, cip4: Set }
  const interestLinks = {};
  for (const row of toObjects(loaded.interest_links)) {
    const families = (interestLinks[row.INTEREST] ??= {});
    const careers = (families[row.FAMILY] ??= {});
    const career = (careers[row.SOC] ??= {
      soc: row.SOC, title: row.TITLE, jobZone: row.JOB_ZONE, cip6Links: row.CIP6_LINKS, cip4: new Set(),
    });
    career.cip4.add(row.CIP4);
  }

  return {
    meta: loaded.meta,
    colleges,
    collegeById: new Map(colleges.map((c) => [c.UNITID, c])),
    programsByCollege,
    programNames: loaded.cip,            // "1205" -> "Culinary Arts and Related Services"
    interestLinks,
    states: [...new Set(colleges.map((c) => c.STABBR))].sort(),
  };
}
