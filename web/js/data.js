// Loads the files made by pipeline/export_web.py and builds quick lookups.
import { DATA_FILES } from "./config.js";

// {"fields": [...], "rows": [[...]]} -> [{field: value, ...}, ...]
function toObjects({ fields, rows }) {
  return rows.map((row) => {
    const item = {};
    fields.forEach((field, i) => (item[field] = row[i]));
    return item;
  });
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const id = item[key];
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(item);
  }
  return groups;
}

export async function loadData(onProgress = () => {}) {
  let done = 0;
  const loaded = {};
  await Promise.all(
    DATA_FILES.map(async (name) => {
      const response = await fetch(`data/${name}.json`);
      if (!response.ok) throw new Error(`data/${name}.json: ${response.status}`);
      loaded[name] = await response.json();
      onProgress(++done, DATA_FILES.length);
    })
  );

  const colleges = toObjects(loaded.colleges);
  const programs = toObjects(loaded.programs);
  return {
    meta: loaded.meta,
    colleges,
    collegeById: new Map(colleges.map((c) => [c.UNITID, c])),
    programsByCollege: groupBy(programs, "UNITID"),
    programNames: loaded.cip,            // "1205" -> "Culinary Arts and Related Services"
    interestLinks: toObjects(loaded.interest_links),
  };
}
