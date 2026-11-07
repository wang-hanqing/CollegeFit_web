// Checks the web version of Step 4 (Explore) against the Java version.
// Run from the project root:  node tests/explore.test.mjs
// tests/java_explore.json was made by tests/ExploreDump.java with the Java app's own classes.
import { readFileSync } from "node:fs";
import { prepareData } from "../web/js/data.js";
import { recommend, groups, comparableCost, GROUPS } from "../web/js/logic/explore.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const loaded = {};
for (const name of ["colleges", "programs", "cip", "interest_links", "meta"]) loaded[name] = read(`../web/data/${name}.json`);
const data = prepareData(loaded);
const java = read("./java_explore.json");

// Same cases as ExploreDump.java: fields | home | scope | pathway | priorities
const CASES = {
  "video": ["51,52", "NY", "state", "NOT_SURE", "COSTS,ADMISSION"],
  "cs-us": ["11", "NY", "anywhere", "BACHELOR", "GRADUATION,COSTS,STUDY"],
  "none-ny": ["", "NY", "state", "ASSOCIATE", ""],
  "ca-mix": ["24,26,42", "CA", "state", "NOT_SURE", "STUDY,CAMPUS"],
  "tx-health": ["51", "TX", "state", "NOT_SURE", "ADMISSION,GRADUATION,COSTS"],
  "biz-us-nohome": ["52", "", "anywhere", "NOT_SURE", "CAMPUS"],
  "arts-ny-assoc": ["50", "NY", "state", "ASSOCIATE", "COSTS"],
};
const list = (s) => (s ? s.split(",") : []);

let checks = 0, failures = 0;
function check(label, actual, expected) {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; console.log(`FAIL ${label}\n  web:  ${a.slice(0, 400)}\n  java: ${e.slice(0, 400)}`); }
}

for (const [name, [fields, home, scope, pathway, priorities]] of Object.entries(CASES)) {
  const profile = {
    programs: list(fields), pathway, home,
    states: home && scope === "state" ? [home] : [],
    priorities: list(priorities), income: null,
  };
  const ranked = recommend(data, profile);
  const byGroup = groups(ranked);
  check(`${name} total`, ranked.length, java[name].total);
  for (const g of GROUPS) {
    const web = byGroup[g].map((r, i) => i < 6
      ? [String(r.college.UNITID), r.programsAwarded, r.recentDegrees, r.associateAwarded, r.bachelorAwarded,
         comparableCost(profile, r.college), r.campusMatched]
      : String(r.college.UNITID));
    check(`${name} ${g}`, web, java[name][g]);
  }
}
console.log(`${checks - failures} of ${checks} checks match the Java version`);
process.exit(failures ? 1 : 0);
