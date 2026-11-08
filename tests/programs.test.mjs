// Checks the program search list and per-state college counts against the Java version.
// Run from the project root:  node tests/programs.test.mjs
// tests/java_programs.json was made by tests/ProgramListDump.java with the Java app's own classes.
import { readFileSync } from "node:fs";
import { prepareData } from "../web/js/data.js";
import { setLanguage } from "../web/js/i18n.js";
import { programList } from "../web/js/logic/programs.js";
import { programCounts } from "../web/js/logic/directions.js";
import { familyName } from "../web/js/steps/direction.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
globalThis.fetch = async (url) => ({ ok: true, json: async () => read(`../web/${url.split("?")[0]}`) });
await setLanguage("en");
const loaded = {};
for (const name of ["colleges", "programs", "cip", "interest_links", "meta"]) loaded[name] = read(`../web/data/${name}.json`);
const data = prepareData(loaded);
const java = read("./java_programs.json");

let checks = 0, failures = 0;
function check(label, actual, expected) {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; console.log(`FAIL ${label}\n  web:  ${a.slice(0, 400)}\n  java: ${e.slice(0, 400)}`); }
}

check("program list", programList(data, familyName).map((p) => [p.code, p.name, p.short, p.colleges]), java.list);
for (const [states, expected] of Object.entries(java.counts)) {
  const counts = programCounts(data, states.split(","));
  check(`counts ${states}`, Object.fromEntries([...counts].sort(([a], [b]) => (a < b ? -1 : 1))), expected);
}
console.log(`${checks - failures} of ${checks} checks match the Java version`);
process.exit(failures ? 1 : 0);
