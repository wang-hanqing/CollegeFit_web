// Checks Compare and decide (markers, trade-off summary, degree levels) against the Java version, in English.
// Run from the project root:  node tests/compare.test.mjs
// tests/java_compare.json was made by tests/CompareDump.java with the Java app's own classes.
import { readFileSync } from "node:fs";
import { prepareData } from "../web/js/data.js";
import { setLanguage } from "../web/js/i18n.js";
import { evaluateAll } from "../web/js/logic/evaluate.js";
import { compare, degreeText, ROWS } from "../web/js/logic/compare.js";
import { familyName } from "../web/js/steps/direction.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
globalThis.fetch = async (url) => ({ ok: true, json: async () => read(`../web/${url.split("?")[0]}`) });
await setLanguage("en");
const loaded = {};
for (const name of ["colleges", "programs", "cip", "interest_links", "meta"]) loaded[name] = read(`../web/data/${name}.json`);
const data = prepareData(loaded);
const java = read("./java_compare.json");

// Same profiles as CompareDump.java: programs | home | scope | pathway | priorities | settings | sizes
const PROFILES = {
  A: ["51,52", "NY", "state", "NOT_SURE", "COSTS,ADMISSION", "", ""],
  B: ["5138,11", "NY", "anywhere", "BACHELOR", "GRADUATION,STUDY", "URBAN", "LARGE"],
  C: ["", "CA", "state", "ASSOCIATE", "", "RURAL", ""],
  D: ["52", "", "anywhere", "NOT_SURE", "CAMPUS,COSTS,GRADUATION", "SUBURBAN", "SMALL,MEDIUM"],
};
const list = (s) => (s ? s.split(",") : []);

let checks = 0, failures = 0;
for (const [key, expected] of Object.entries(java)) {
  const [name, ids] = key.split("|");
  const [programs, home, scope, pathway, priorities, settings, sizes] = PROFILES[name];
  const profile = {
    programs: list(programs), home, states: home && scope === "state" ? [home] : [], pathway,
    priorities: list(priorities), settings: list(settings), sizes: list(sizes),
    income: null, satReading: null, satMath: null, budget: null, aid: "NOT_SURE",
  };
  const evaluations = ids.split(",").map((id) => evaluateAll(profile, data.collegeById.get(Number(id)), data, familyName));
  const result = compare(profile, evaluations);
  const web = {
    summary: result.summary,
    different: result.differentDegrees,
    markers: evaluations.map((e) => Object.fromEntries(ROWS.filter((r) => result.markers.get(e)[r]).map((r) => [r, result.markers.get(e)[r]]))),
    degrees: evaluations.map((e) => degreeText(profile, e)),
  };
  checks++;
  const a = JSON.stringify(web), e = JSON.stringify(expected);
  if (a !== e) { failures++; if (failures <= 5) console.log(`FAIL ${key}\n  web:  ${a}\n  java: ${e}`); }
}
console.log(`${checks - failures} of ${checks} checks match the Java version`);
process.exit(failures ? 1 : 0);
