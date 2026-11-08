// Checks the web version of Step 2 against numbers produced by the Java version.
// Run from the project root:  node tests/directions.test.mjs
// tests/java_directions.json was made with the Java app's own classes (InterestLinks, RecommendationEngine).
import { readFileSync } from "node:fs";
import { prepareData } from "../web/js/data.js";
import { linkedFields, fieldCount, pathwaySummary } from "../web/js/logic/directions.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const loaded = {};
for (const name of ["colleges", "programs", "cip", "interest_links", "meta"]) loaded[name] = read(`../web/data/${name}.json`);
const data = prepareData(loaded);
const java = read("./java_directions.json");

let failures = 0, checks = 0;
function check(label, actual, expected) {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.log(`FAIL ${label}\n  web:  ${a.slice(0, 300)}\n  java: ${e.slice(0, 300)}`);
  }
}

check("college count", data.colleges.length, java.collegeCount);

for (const [key, expected] of Object.entries(java.fields)) {
  const [combo, st] = key.split("|");
  const states = st ? st.split(",") : [];
  const web = linkedFields(data, [...combo], states).map((f) => ({
    family: f.family,
    colleges: f.colleges,
    linkedCareers: f.linkedCareers,
    careers: f.careers.map((c) => c.soc),
    // The web page lists every program; the Java version keeps the first three, in the same order
    programs: f.programs.slice(0, 3).map((p) => [data.programNames[p.cip] ?? p.cip, p.colleges]),
  }));
  check(`linked fields ${key}`, web, expected);
}

const COMMON = ["52", "51", "11", "50", "24", "26", "42", "45"];
for (const [st, expected] of Object.entries(java.common)) {
  const states = st ? st.split(",") : [];
  check(`common fields ${st || "all"}`, COMMON.map((f) => fieldCount(data, states, f)), expected);
}

for (const [st, expected] of Object.entries(java.pathway)) {
  const states = st ? st.split(",") : [];
  const p = pathwaySummary(data, states);
  check(`pathway ${st || "all"}`, ["twoYear", "fourPublic", "fourPrivate"].map((k) => [p[k].colleges, p[k].medianCost]), expected);
}

console.log(`${checks - failures} of ${checks} checks match the Java version`);
process.exit(failures ? 1 : 0);
