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

function paintTexts() {
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
}
function paintProfiles() {
  const names = T("profiles") || I.en.profiles;
  $("profiles").innerHTML = PROFILES.map((p) =>
    `<label style="--pc:${PICON[p][1]}"><input type="radio" name="profile" value="${p}" ${S.profile === p ? "checked" : ""}><span class="ico" aria-hidden="true">${PICON[p][0]}</span><span>${names[p] || I.en.profiles[p]}</span></label>`).join("");
}
function paintSettings() {
  const names = T("langNames") || I.en.langNames;
  const opts = `<option value="auto">${T("auto")}</option>` + ["en", "de", "id"].map((l) => `<option value="${l}">${names[l]}</option>`).join("");
  $("lang").innerHTML = opts; $("lang").value = S.lang;
  $("ui").innerHTML = opts; $("ui").value = S.ui;
  $("focus").checked = !!S.focus;
}
function paintEvidence() {
  $("evidence").innerHTML = EV.map((e) => `<li><span class="grade ${e.cls}">${e.grade}</span><b>${e.feature}</b><br><span class="muted">${e.note}</span></li>`).join("");
}
// Each part is isolated: if one fails, the others still render and the buttons keep working.
function paint() {
  for (const part of [paintTexts, paintProfiles, paintSettings, paintEvidence]) {
    try { part(); } catch (e) { console.error("[Speakmi popup]", part.name, e); }
  }
}

const errText = (e) => (e && e.message) ? e.message : String(e);
// Leading "/" = from the extension root. Firefox resolves a path without it relative to the popup page
// (popup/lib/Readability.js), which does not exist.
const LIB = ["/lib/Readability.js", "/content/brand.js", "/content/config.js", "/content/i18n.js", "/content/evidence.js", "/content/engine.js", "/content/overlay.js"];

// Firefox does not reject executeScript when the injected code throws: the error is returned inside the
// result. Without this check a failure looks like success and the popup just closes.
async function exec(tabId, details) {
  const res = await chrome.scripting.executeScript(Object.assign({ target: { tabId } }, details));
  const r = (res || [])[0];
  if (!r) throw new Error("the page did not respond");
  if (r.error !== undefined && r.error !== null) throw new Error(errText(r.error));
  return r.result;
}

function showError(e, step) {
  console.error("[Speakmi popup]", step, e);
  $("err").textContent = T("cannotRun");
  $("err").hidden = false;
  $("errDetail").textContent = T("errDetails", { e: step + ": " + errText(e) });
  $("errDetail").hidden = false;
}

async function run() {
  $("err").hidden = true; $("errDetail").hidden = true;
  $("run").disabled = true;
  let step = "tab";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id === undefined) throw new Error("no active tab");
    step = "check";
    const loaded = await exec(tab.id, { func: () => !!(window.__speakmi && window.__speakmi.open) });
    if (!loaded) { step = "inject"; await exec(tab.id, { files: LIB }); }
    step = "open";
    const shown = await exec(tab.id, { func: () => window.__speakmi.open().then(() => !!document.getElementById("speakmi-host")) });
    if (shown === false) throw new Error("the reading view was not added to the page");
    window.close();
  } catch (e) {
    showError(e, step);
  } finally {
    $("run").disabled = false;
  }
}

(async function init() {
  // Listeners first: they do not depend on paint(), so the buttons work even if a section fails to render.
  $("profiles").addEventListener("change", (e) => { if (e.target.name === "profile") { S.profile = e.target.value; save(); } });
  $("lang").addEventListener("change", (e) => { S.lang = e.target.value; save(); });
  $("ui").addEventListener("change", (e) => { S.ui = e.target.value; save(); paint(); });
  $("focus").addEventListener("change", (e) => { S.focus = e.target.checked; save(); });
  $("run").addEventListener("click", run);
  try { $("logo").src = BR.logo; BR.loadFonts(); } catch (e) { console.error("[Speakmi popup]", e); }
  try {
    const r = await chrome.storage.local.get(["speakmiSettings"]);
    S = Object.assign({}, DEFAULTS, r.speakmiSettings || {});
  } catch (e) { /* defaults */ }
  paint();
})();
