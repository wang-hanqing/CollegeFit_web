// Counting and matching for Step 2. Ported from RecommendationEngine.fieldCount / pathwaySummary
// and InterestLinks.fields; tests/directions.test.mjs checks the results against the Java version.

const cache = new Map();

// How many colleges in the states (all states if empty) recently awarded degrees in each program
// (4-digit code) and each field (2-digit code).
export function programCounts(data, states = []) {
  const key = [...states].sort().join(",");
  if (cache.has(key)) return cache.get(key);
  const wanted = new Set(states);
  const counts = new Map();
  for (const c of data.colleges) {
    if (wanted.size && !wanted.has(c.STABBR)) continue;
    const fields = new Set();
    for (const cip of c.awarded) {
      counts.set(cip, (counts.get(cip) || 0) + 1);
      fields.add(cip.slice(0, 2));
    }
    for (const f of fields) counts.set(f, (counts.get(f) || 0) + 1);
  }
  cache.set(key, counts);
  return counts;
}

export function fieldCount(data, states, code) {
  return programCounts(data, states).get(code) || 0;
}

// Fields linked to the chosen interests (O*NET interest -> career -> program family).
// Order: more linked careers first, then more colleges, then field code. Fields no college in scope offers are left out.
export function linkedFields(data, interests, states) {
  const byFamily = new Map();
  for (const interest of interests) {
    for (const [family, careers] of Object.entries(data.interestLinks[interest] || {})) {
      if (!byFamily.has(family)) byFamily.set(family, new Map());
      for (const [soc, career] of Object.entries(careers)) byFamily.get(family).set(soc, career);
    }
  }

  const counts = programCounts(data, states);
  const out = [];
  for (const [family, careerMap] of byFamily) {
    const colleges = counts.get(family) || 0;
    if (colleges === 0) continue;
    const careers = [...careerMap.values()].sort((a, b) =>
      b.cip6Links - a.cip6Links || a.jobZone - b.jobZone || compare(a.title, b.title));
    const cips = new Set();
    careers.forEach((c) => c.cip4.forEach((cip) => cips.add(cip)));
    const programs = [...cips]
      .map((cip) => ({ cip, colleges: counts.get(cip) || 0 }))
      .filter((p) => p.colleges > 0)
      .sort((a, b) => b.colleges - a.colleges || compare(a.cip, b.cip));
    out.push({
      family,
      colleges,
      linkedCareers: careers.length,
      careers: careers.slice(0, 3),
      programs: programs.slice(0, 3),
    });
  }
  return out.sort((a, b) => b.linkedCareers - a.linkedCareers || b.colleges - a.colleges || compare(a.family, b.family));
}

// Number of colleges and median published cost (before aid) for each way to start.
export function pathwaySummary(data, states = []) {
  const wanted = new Set(states);
  const groups = { twoYear: [], fourPublic: [], fourPrivate: [] };
  const counts = { twoYear: 0, fourPublic: 0, fourPrivate: 0 };
  for (const c of data.colleges) {
    if (wanted.size && !wanted.has(c.STABBR)) continue;
    const kind = c.twoYear ? "twoYear" : c.CONTROL === 1 ? "fourPublic" : "fourPrivate";
    counts[kind]++;
    if (c.COSTT4_A != null) groups[kind].push(c.COSTT4_A);
  }
  const out = {};
  for (const kind of Object.keys(groups)) out[kind] = { colleges: counts[kind], medianCost: median(groups[kind]) };
  return out;
}

function median(values) {
  if (!values.length) return 0;
  const v = [...values].sort((a, b) => a - b);
  const n = v.length;
  return n % 2 ? v[(n - 1) / 2] : Math.trunc((v[n / 2 - 1] + v[n / 2]) / 2);
}

// Java's String.compareTo: by UTF-16 code units, not locale
function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
