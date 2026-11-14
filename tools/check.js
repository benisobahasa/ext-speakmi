// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Repository guards: syntax, licence headers, manifest, and no network APIs. No dependencies.
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const list = (d, ext) => fs.readdirSync(path.join(root, d)).filter((f) => f.endsWith(ext)).map((f) => d + "/" + f);
let bad = 0;
const fail = (m) => { bad++; console.error("FAIL: " + m); };
const ok = (m) => console.log("ok:   " + m);

const own = [...list("content", ".js"), ...list("popup", ".js"), ...list("tools", ".js"), "tests/run.js"];
for (const f of own) {
  try { execFileSync(process.execPath, ["--check", path.join(root, f)], { stdio: "pipe" }); } catch (e) { fail("syntax error in " + f); }
  if (!/Mozilla Public License/.test(read(f).slice(0, 400))) fail("missing MPL header: " + f);
}
ok(`${own.length} source files: syntax and licence headers`);

for (const f of ["manifest.json"]) {
  const m = JSON.parse(read(f));
  if (m.manifest_version !== 3) fail("manifest_version must be 3");
  const g = (m.browser_specific_settings || {}).gecko || {};
  if (!g.id) fail("gecko id missing");
  if (JSON.stringify((g.data_collection_permissions || {}).required) !== '["none"]') fail("data_collection_permissions must be required: [none]");
  const allowed = ["activeTab", "scripting", "storage"];
  for (const p of m.permissions || []) if (!allowed.includes(p)) fail("unexpected permission: " + p);
  if (m.host_permissions && m.host_permissions.length) fail("host_permissions must be empty");
  if (m.version !== JSON.parse(read("package.json")).version) fail("manifest and package.json versions differ");
}
ok("manifest: MV3, gecko id, no data collection, minimal permissions, versions match");

const forbidden = [/\bfetch\s*\(/, /XMLHttpRequest/, /\bWebSocket\b/, /sendBeacon/, /\bEventSource\b/, /importScripts\s*\(/, /\beval\s*\(/, /new Function\s*\(/];
for (const f of [...list("content", ".js"), ...list("popup", ".js")]) {
  const src = read(f);
  for (const re of forbidden) if (re.test(src)) fail(`${f} uses a forbidden API: ${re}`);
}
for (const f of list("popup", ".html")) {
  if (/(src|href)\s*=\s*["']https?:/i.test(read(f))) fail(f + " loads a remote resource");
}
ok("no network APIs, eval, or remote resources in content/ and popup/");

if (bad) { console.error(`\n${bad} problem(s).`); process.exit(1); }
console.log("\nAll checks passed.");
