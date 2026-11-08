// Checks Step 4 (Explore).
// Run from the project root:  node tests/explore.test.mjs
// Against the Java version (tests/java_explore.json, made by tests/ExploreDump.java): which colleges appear in
// each group, and each college's program, cost and campus values.
// Against the web rules only: the order. The web version has no "My area of study" priority (it is dropped
// from the cases below), and program matches, degree level and program size always follow the priorities.
import { readFileSync } from "node:fs";
import { prepareData } from "../web/js/data.js";
import { setLanguage } from "../web/js/i18n.js";
import { recommend, groups, comparableCost, GROUPS, orderUsed, sortKey, caseInsensitive } from "../web/js/logic/explore.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
globalThis.fetch = async (url) => ({ ok: true, json: async () => read(`../web/${url.split("?")[0]}`) });
await setLanguage("en");
const loaded = {};
for (const name of ["colleges", "programs", "cip", "interest_links", "meta"]) loaded[name] = read(`../web/data/${name}.json`);
const data = prepareData(loaded);
const java = read("./java_explore.json");

// Same cases as ExploreDump.java: fields | home | scope (state, anywhere or A+B) | pathway | priorities | settings | sizes
const CASES = {
  "video": ["51,52", "NY", "state", "NOT_SURE", "COSTS,ADMISSION"],
  "cs-us": ["11", "NY", "anywhere", "BACHELOR", "GRADUATION,COSTS,STUDY"],
  "none-ny": ["", "NY", "state", "ASSOCIATE", ""],
  "ca-mix": ["24,26,42", "CA", "state", "NOT_SURE", "STUDY,CAMPUS"],
  "tx-health": ["51", "TX", "state", "NOT_SURE", "ADMISSION,GRADUATION,COSTS"],
  "biz-us-nohome": ["52", "", "anywhere", "NOT_SURE", "CAMPUS"],
  "arts-ny-assoc": ["50", "NY", "state", "ASSOCIATE", "COSTS"],
  "subject-mix": ["5138,12,1205", "NY", "NY+NJ", "BOTH", "CAMPUS,STUDY", "URBAN", "LARGE"],
  "place-rural": ["", "CA", "state", "NOT_SURE", "CAMPUS,COSTS", "RURAL,TOWN", "SMALL"],
  "us-campus": ["52,1101", "TX", "anywhere", "BACHELOR", "STUDY,CAMPUS,GRADUATION", "SUBURBAN", "MEDIUM,LARGE"],
};
const list = (s) => (s ? s.split(",") : []);

let checks = 0, failures = 0;
function check(label, actual, expected) {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; console.log(`FAIL ${label}\n  web:  ${a.slice(0, 400)}\n  expected: ${e.slice(0, 400)}`); }
}

// Web order: the student's priorities (or campus matches), then programs and degree level, then size, then name
function inWebOrder(profile, list) {
  const order = [...orderUsed(profile), "STUDY"];
  const cmp = (x, y) => (x === y ? 0 : x == null ? 1 : y == null ? -1 : x < y ? -1 : 1);
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    let d = 0;
    for (const p of order) { d = cmp(sortKey(p, profile, a), sortKey(p, profile, b)); if (d) break; }
    if (!d) d = b.recentDegrees - a.recentDegrees;
    if (!d) d = caseInsensitive(a.college.INSTNM, b.college.INSTNM);
    if (d > 0) return `${a.college.INSTNM} before ${b.college.INSTNM}`;
  }
  return "ok";
}

for (const [name, [fields, home, scope, pathway, priorities, settings = "", sizes = ""]] of Object.entries(CASES)) {
  const profile = {
    programs: list(fields), pathway, home,
    states: scope.includes("+") ? scope.split("+") : home && scope === "state" ? [home] : [],
    priorities: list(priorities), income: null, settings: list(settings), sizes: list(sizes),
  };
  const ranked = recommend(data, profile);
  const byGroup = groups(ranked);
  check(`${name} total`, ranked.length, java[name].total);
  check(`${name} no STUDY priority`, orderUsed(profile).includes("STUDY"), false);
  for (const g of GROUPS) {
    const javaIds = java[name][g].map((x) => (Array.isArray(x) ? x[0] : x));
    check(`${name} ${g} colleges`, byGroup[g].map((r) => String(r.college.UNITID)).sort(), [...javaIds].sort());
    const byId = new Map(byGroup[g].map((r) => [String(r.college.UNITID), r]));
    const web = java[name][g].filter(Array.isArray).map(([id]) => {
      const r = byId.get(id);
      return r ? [id, r.programsAwarded, r.recentDegrees, r.associateAwarded, r.bachelorAwarded,
        comparableCost(profile, r.college), r.campusMatched] : [id];
    });
    check(`${name} ${g} values`, web, java[name][g].filter(Array.isArray));
    check(`${name} ${g} order`, inWebOrder(profile, byGroup[g]), "ok");
  }
}
check("skipped priorities use campus matches", orderUsed({ priorities: [] }), ["CAMPUS"]);
console.log(`${checks - failures} of ${checks} checks pass (colleges and values match the Java version; order follows the web rules)`);
process.exit(failures ? 1 : 0);
