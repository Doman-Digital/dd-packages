// Scores a blind-test run as docs/blind-test.md describes. Run after the votes are in and the answer key
// has been committed (or is on disk at <dir>/.key/key.json).
//
//   node scripts/blind/score.mjs calibration/blind/<date>
//
// Reads <dir>/votes.csv (judge,session,pair,kind,left,right,picked,excluded). If kind, left or right is empty
// it is filled from the key by pair number, so judges only need to write judge, session, pair and picked.
// Counts only rows whose `excluded` is empty. `picked` is the side the judge said was built by AI (left or right).

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = resolve(process.argv[2] ?? "");
const key = existsSync(join(dir, ".key", "key.json")) ? JSON.parse(readFileSync(join(dir, ".key", "key.json"), "utf8")) : null;
const lines = readFileSync(join(dir, "votes.csv"), "utf8").trim().split(/\r?\n/);
const head = lines.shift().split(",");
const votes = lines.filter(Boolean).map((l) => {
  const c = l.split(",");
  const v = Object.fromEntries(head.map((h, i) => [h, (c[i] ?? "").trim()]));
  const k = key?.pairs[v.pair];
  if (k) {
    v.kind ||= k.kind;
    v.left ||= k.left;
    v.right ||= k.right;
  }
  return v;
});
if (votes.some((v) => !v.left || !v.right)) throw new Error("some votes have no left/right and there is no answer key to fill them from");

// P(X >= k) for X ~ Binomial(n, p).
function tail(n, k, p = 0.5) {
  let sum = 0;
  let term = Math.pow(1 - p, n);
  for (let i = 0; i <= n; i++) {
    if (i >= k) sum += term;
    term *= ((n - i) / (i + 1)) * (p / (1 - p));
  }
  return sum;
}
// Smallest k with a 5% or lower chance of k or more heads in n fair flips.
const critical = (n) => {
  for (let k = 0; k <= n + 1; k++) if (tail(n, k) <= 0.05) return k;
  return n + 1;
};
// Clopper-Pearson 95% interval by bisection on the binomial tail.
function clopperPearson(x, n) {
  const solve = (f) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2;
      if (f(m)) lo = m;
      else hi = m;
    }
    return lo;
  };
  const lower = x === 0 ? 0 : solve((p) => tail(n, x, p) < 0.025);
  const upper = x === n ? 1 : solve((p) => tail(n, x + 1, p) < 0.975);
  return [lower, upper];
}
const aiSide = (v) => (v.picked === "left" ? v.left : v.right);
const counted = votes.filter((v) => !v.excluded);
const pct = (x) => `${(100 * x).toFixed(0)}%`;
const out = [];
out.push(`Blind test ${dir.split(/[\\/]/).pop()}: ${votes.length} votes, ${counted.length} counted, ${votes.length - counted.length} excluded`);

// 1. Controls first.
const controls = counted.filter((v) => v.kind === "control");
const controlHits = controls.filter((v) => aiSide(v).startsWith("null:")).length;
const kc = critical(controls.length);
const controlsWork = controls.length > 0 && controlHits >= kc;
out.push("", `1. Controls: null page picked as AI in ${controlHits} of ${controls.length} (needs ${kc} or more)`);
if (!controlsWork) out.push("   The controls do not work: the judges could not see the AI look in pages known to have it. Void the run and record why.");

// 2. The test pairs.
const tests = counted.filter((v) => v.kind === "test");
const ours = tests.filter((v) => aiSide(v).startsWith("ours:")).length;
const kt = critical(tests.length);
const [lo, hi] = tests.length ? clopperPearson(ours, tests.length) : [0, 1];
out.push("", `2. Test pairs: our site picked as AI in ${ours} of ${tests.length} (${pct(ours / (tests.length || 1))}, 95% interval ${pct(lo)} to ${pct(hi)})`);
out.push(`   Fails the target at ${kt} or more (one-sided exact binomial, 5%). One-sided p = ${tail(tests.length, ours).toFixed(3)}.`);
out.push(`   Target ${ours >= kt ? "NOT met" : "met"}${controlsWork ? "" : " (but the run is void: controls failed)"}.`);

// 3. How much it can see.
out.push("", `3. Power: ${tests.length} counted test votes (aim for 40). Judges who really spot our sites 75% of the time are caught about ${pct(1 - cdf(tests.length, kt - 1, 0.75))} of the time with this many.`);
function cdf(n, k, p) {
  return 1 - tail(n, k + 1, p);
}

// 4. Per site.
out.push("", "4. Per site (our site picked as AI):");
const sites = [...new Set(tests.map((v) => (v.left.startsWith("ours:") ? v.left : v.right)))].sort();
for (const s of sites) {
  const rows = tests.filter((v) => v.left === s || v.right === s);
  out.push(`   ${s.padEnd(18)} ${rows.filter((v) => aiSide(v) === s).length} of ${rows.length}`);
}
console.log(out.join("\n"));
