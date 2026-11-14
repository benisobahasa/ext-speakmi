/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
"use strict";
const BR = window.SpeakmiBrand, I = window.SpeakmiI18N, EV = window.SpeakmiEvidence, CFG = window.SpeakmiConfig;
const DEFAULTS = { profile: "mixed", theme: "calm", scale: 1, focus: true, hints: true, idioms: true, ai: false, lang: "auto", ui: "auto", recap: false, tune: {} };
const PROFILES = ["adhd", "dyslexia", "autism", "mixed", "general"];
const PICON = { adhd: ["⚡", "#F2602F"], dyslexia: ["📖", "#4F5FD6"], autism: ["🧩", "#8B5CF6"], mixed: ["🌈", "#0FA59B"], general: ["✨", "#E59E0B"] };
let S = Object.assign({}, DEFAULTS);
const $ = (id) => document.getElementById(id);

const uiLang = () => {
  const u = S.ui === "auto" ? (navigator.language || "en").slice(0, 2).toLowerCase() : S.ui;
  return I[u] ? u : "en";
};
const T = (k, v) => {
  let s = I[uiLang()][k]; if (s === undefined) s = I.en[k];
  return typeof s === "string" && v ? s.replace(/\{(\w+)\}/g, (_, n) => (v[n] === undefined ? "" : v[n])) : s;
};
const save = () => chrome.storage.local.set({ speakmiSettings: S });
const nowSec = () => Math.floor(Date.now() / 1000);

function paint() {
  document.documentElement.lang = uiLang();
  $("beta").textContent = T("popupBeta"); $("openNote").textContent = T("popupOpen");
  $("hint").textContent = T("popupHint");
  $("lProfile").textContent = T("profile");
  $("lMore").textContent = T("settings");
  $("lLang").textContent = T("popupArticleLang");
  $("lUi").textContent = T("popupUi");
  $("lFocus").textContent = T("popupFocus");
  $("lAbout").textContent = T("popupAbout");
  $("run").textContent = T("popupRun") + " →";
  $("privacy").textContent = T("popupPrivacy"); $("privacy").href = CFG.PRIVACY_URL;
  $("support").textContent = T("popupSupport"); $("support").href = "mailto:" + CFG.SUPPORT_EMAIL;
  $("reset").textContent = T("popupReset");
  $("profiles").innerHTML = PROFILES.map((p) =>
    `<label style="--pc:${PICON[p][1]}"><input type="radio" name="profile" value="${p}" ${S.profile === p ? "checked" : ""}><span class="ico" aria-hidden="true">${PICON[p][0]}</span><span>${T("profiles")[p]}</span></label>`).join("");
  const names = T("langNames");
  $("lang").innerHTML = `<option value="auto">${T("auto")}</option>` + ["en", "de", "id"].map((l) => `<option value="${l}">${names[l]}</option>`).join("");
  $("lang").value = S.lang;
  $("ui").innerHTML = `<option value="auto">${T("auto")}</option>` + ["en", "de", "id"].map((l) => `<option value="${l}">${names[l]}</option>`).join("");
  $("ui").value = S.ui;
  $("focus").checked = !!S.focus;
  $("evidence").innerHTML = EV.map((e) => `<li><span class="grade ${e.cls}">${e.grade}</span><b>${e.feature}</b><br><span class="muted">${e.note}</span></li>`).join("");
}

async function run() {
  $("err").hidden = true;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const [{ result: loaded }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => !!window.__speakmi });
    if (!loaded) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["lib/Readability.js", "content/brand.js", "content/config.js", "content/i18n.js", "content/evidence.js", "content/engine.js", "content/overlay.js"] });
    }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.__speakmi.open() });
    window.close();
  } catch (e) {
    $("err").textContent = T("cannotRun");
    $("err").hidden = false;
  }
}

(async function init() {
  $("logo").src = BR.logo; BR.loadFonts();
  try {
    const r = await chrome.storage.local.get(["speakmiSettings"]);
    S = Object.assign({}, DEFAULTS, r.speakmiSettings || {});
  } catch (e) { /* defaults */ }
  paint();
  $("profiles").addEventListener("change", (e) => { if (e.target.name === "profile") { S.profile = e.target.value; save(); } });
  $("lang").addEventListener("change", (e) => { S.lang = e.target.value; save(); });
  $("ui").addEventListener("change", (e) => { S.ui = e.target.value; save(); paint(); });
  $("focus").addEventListener("change", (e) => { S.focus = e.target.checked; save(); });
  $("run").addEventListener("click", run);
})();
