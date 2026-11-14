// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Builds the Firefox package: dist/firefox (+ a zip if the `zip` command exists). No dependencies.
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const root = path.join(__dirname, ".."), out = path.join(root, "dist", "firefox");
fs.rmSync(path.join(root, "dist"), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const p of ["content", "popup", "lib", "icons"]) fs.cpSync(path.join(root, p), path.join(out, p), { recursive: true });
for (const f of ["manifest.json", "LICENSE"]) fs.copyFileSync(path.join(root, f), path.join(out, f));
try { execSync(`cd "${out}" && zip -qr "../speakmi-firefox.zip" .`); console.log("built dist/firefox + zip"); }
catch { console.log("built dist/firefox (zip not found: compress the folder yourself)"); }
