// Checks the details page text (every lens, reasons and next steps) against the Java version, in English.
// Run from the project root:  node tests/evaluate.test.mjs
// tests/java_evaluate.json was made by tests/EvaluateDump.java with the Java app's own classes.
import { readFileSync } from "node:fs";
import { prepareData } from "../web/js/data.js";
import { setLanguage } from "../web/js/i18n.js";
import { evaluateAll } from "../web/js/logic/evaluate.js";
import { familyName } from "../web/js/steps/direction.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
globalThis.fetch = async (url) => ({ ok: true, json: async () => read(`../web/${url}`) });
await setLanguage("en");

const loaded = {};
for (const name of ["colleges", "programs", "cip", "interest_links", "meta"]) loaded[name] = read(`../web/data/${name}.json`);
const data = prepareData(loaded);
const java = read("./java_evaluate.json");

// Same profiles as EvaluateDump.java
const PROFILES = {
  A: ["51,52", "NY", "state", "NOT_SURE", "", "", "NOT_SURE", "NOT_SURE", "", ""],
  B: ["5138,11,1205", "NY", "anywhere", "BACHELOR", "600/550", "20000", "YES", "FROM_30K_TO_48K", "URBAN,TOWN", "LARGE"],
  C: ["", "CA", "state", "ASSOCIATE", "450/700", "5000", "NO", "UNDER_30K", "RURAL", "SMALL,MEDIUM"],
  D: ["51,52,11,24,26,42,45,50", "", "anywhere", "NOT_SURE", "", "15000", "NOT_SURE", "NOT_SURE", "", ""],
  E: ["5138", "NY", "state", "NOT_SURE", "", "30000", "PREFER_NOT_TO_SAY", "ABOVE_110K", "SUBURBAN", ""],
};
const list = (s) => (s ? s.split(",") : []);
const shape = (r) => ({ status: r.status, label: r.label, reason: r.reason, nextStep: r.nextStep,
  facts: r.facts.map((f) => [f.label, f.value, f.note, f.match]) });

let checks = 0, failures = 0;
for (const [name, [programs, home, scope, pathway, sat, budget, aid, income, settings, sizes]] of Object.entries(PROFILES)) {
  const [satReading, satMath] = sat ? sat.split("/").map(Number) : [null, null];
  const profile = {
    programs: list(programs), home, states: home && scope === "state" ? [home] : [], pathway,
    satReading, satMath, budget: budget ? Number(budget) : null, aid,
    income: ["NOT_SURE", "PREFER_NOT_TO_SAY"].includes(income) ? null : income,
    settings: list(settings), sizes: list(sizes), priorities: [],
  };
  for (const id of java.colleges) {
    const c = data.collegeById.get(Number(id));
    const web = evaluateAll(profile, c, data, familyName);
    const expected = java.results[`${name}|${id}`];
    for (const part of ["program", "academic", "financial", "social"]) {
      checks++;
      const a = JSON.stringify(shape(web[part])), e = JSON.stringify(expected[part]);
      if (a !== e) { failures++; if (failures <= 8) console.log(`FAIL ${name} ${id} ${c.INSTNM} ${part}\n  web:  ${a.slice(0, 700)}\n  java: ${e.slice(0, 700)}`); }
    }
    for (const part of ["reasons", "steps"]) {
      checks++;
      const a = JSON.stringify(web[part]), e = JSON.stringify(expected[part]);
      if (a !== e) { failures++; if (failures <= 8) console.log(`FAIL ${name} ${id} ${part}\n  web:  ${a}\n  java: ${e}`); }
    }
  }
}
console.log(`${checks - failures} of ${checks} checks match the Java version`);
process.exit(failures ? 1 : 0);
