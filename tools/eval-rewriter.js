// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Scores model outputs with the SAME gate the extension uses (content/localai.js). No dependencies.
// Usage: node tools/eval-rewriter.js eval/outputs.jsonl [--csv eval/expert-sheet.csv]
// Input: one JSON object per line: {"id","lang","source","output","latency_ms"?,"peak_mb"?}
// Output: per language, how many rewrites the gate accepts and why it rejects the others, plus the criteria
// from docs/AI-EVALUATION.md. The critical-error rate needs native-speaker experts: it is NOT computed here.
const fs = require("fs"), path = require("path");
const E = require("../content/engine.js"), LA = require("../content/localai.js");
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && a !== args[args.indexOf("--csv") + 1]) || path.join(__dirname, "../eval/smoke-test.jsonl");
const csvOut = args.includes("--csv") ? args[args.indexOf("--csv") + 1] : null;
const rows = fs.readFileSync(file, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const by = {};
for (const r of rows) {
  const g = LA.gate(E, r.source, r.output, r.lang);
  const b = (by[r.lang] = by[r.lang] || { n: 0, accepted: 0, same: 0, rejected: 0, reasons: {}, ratios: [], lat: [], mem: [] });
  b.n++;
  if (g.accepted) { b.accepted++; b.ratios.push(E.countWords(g.text, r.lang) / Math.max(1, E.countWords(r.source, r.lang))); }
  else if (g.rejected.length) { b.rejected++; for (const i of g.rejected) b.reasons[i.type] = (b.reasons[i.type] || 0) + 1; }
  else b.same++;
  if (typeof r.latency_ms === "number") b.lat.push(r.latency_ms);
  if (typeof r.peak_mb === "number") b.mem.push(r.peak_mb);
}
console.log("Gate results per language (an accepted rewrite still needs expert review for critical errors)\n");
for (const [lang, b] of Object.entries(by)) {
  const pct = (x) => (100 * x / b.n).toFixed(1) + "%";
  const lat = median(b.lat), mem = b.mem.length ? Math.max(...b.mem) : null;
  console.log(`${lang}: n=${b.n}  accepted ${b.accepted} (${pct(b.accepted)})  unchanged ${b.same}  rejected ${b.rejected} (${pct(b.rejected)})`);
  console.log("   rejection reasons:", JSON.stringify(b.reasons));
  console.log("   median length ratio (accepted):", b.ratios.length ? median(b.ratios).toFixed(2) : "n/a");
  console.log("   median latency ms:", lat === null ? "not recorded" : lat, lat !== null ? (lat < 3000 ? "(meets < 3000)" : "(FAILS < 3000)") : "");
  console.log("   peak memory MB:", mem === null ? "not recorded" : mem, mem !== null ? (mem < 1536 ? "(meets < 1.5 GB)" : "(FAILS < 1.5 GB)") : "");
  console.log(`   n >= 200 required: ${b.n >= 200 ? "yes" : "NO (" + b.n + ")"}\n`);
}
if (csvOut) {
  const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
  const lines = ["id,lang,source,shown_to_reader,gate_accepted,critical_error(Y/N),meaning_preserved(1-5),simpler(1-5),notes"];
  for (const r of rows) { const g = LA.gate(E, r.source, r.output, r.lang); lines.push([r.id, r.lang, q(r.source), q(g.text), g.accepted, "", "", "", ""].join(",")); }
  fs.writeFileSync(csvOut, lines.join("\n") + "\n"); console.log("expert rating sheet written:", csvOut);
}
