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
// On-device AI, one button. Turn on = ask Firefox for the optional "trialML" permission (on the reader's click),
// then check the whole chain and download the model once, automatically. The reader uses the AI from then on.
// Help text appears only when Firefox itself has the feature switched off.
let aiModel = "Xenova/flan-t5-small", aiOn = false, aiBusy = false;
async function aiStatus() {
  try { const r = await chrome.runtime.sendMessage({ speakmi: "ai", op: "status" }); if (r && r.model) aiModel = r.model.id; } catch (e) { /* background not ready */ }
  try { aiOn = !!(await chrome.permissions.contains({ permissions: ["trialML"] })); } catch (e) { aiOn = false; }
}
const setAiState = (t, bad) => { $("aiState").textContent = t || ""; $("aiState").className = "small " + (bad ? "bad" : "muted"); };
function paintAI() {
  $("lAi").textContent = T("popupAiTitle");
  $("aiText").textContent = T("popupAiText", { m: aiModel });
  $("aiBtn").textContent = !aiOn ? T("popupAiEnable") : S.ai ? T("popupAiDisable") : T("popupAiRetry");
  $("aiBtn").disabled = aiBusy;
  $("aiHelp").textContent = T("popupAiHelp");
}
// Runs the real chain inside Firefox: permission, AI API, model download, one test sentence.
async function checkAI() {
  aiBusy = true; paintAI(); $("aiHelp").hidden = true; setAiState(T("popupAiTesting"));
  try {
    const r = await chrome.runtime.sendMessage({ speakmi: "ai", op: "selftest" });
    const steps = (r && r.steps) || [];
    if (!steps.length) throw new Error("no answer from the background page");
    const bad = steps.find((st) => !st.ok);
    if (!bad) { S.ai = true; save(); setAiState(T("popupAiReady")); }
    else {
      S.ai = false; save();
      if (/browser\.trial\.ml/.test(bad.name)) { $("aiHelp").hidden = false; setAiState(""); }
      else setAiState(T("popupAiFail", { e: bad.name + ": " + bad.detail }), true);
    }
  } catch (e) { console.error("[Speakmi popup] check", e); setAiState(T("popupAiFail", { e: errText(e) }), true); }
  aiBusy = false; await aiStatus(); paintAI();
}
async function toggleAI() {
  if (aiBusy) return;
  setAiState("");
  try {
    if (aiOn && S.ai) { await chrome.permissions.remove({ permissions: ["trialML"] }); S.ai = false; save(); $("aiHelp").hidden = true; await aiStatus(); paintAI(); return; }
    if (aiOn) return checkAI();
    const granted = await chrome.permissions.request({ permissions: ["trialML"] });
    if (!granted) { setAiState(T("popupAiDenied"), true); return; }
    await aiStatus(); return checkAI();
  } catch (e) {
    // Firefox throws here when its AI feature is switched off (the permission is then not offered at all).
    console.error("[Speakmi popup] permission", e);
    $("aiHelp").hidden = false; setAiState("");
    await aiStatus(); paintAI();
  }
}
// The first run downloads the model. Firefox reports progress to the background page, which forwards it here.
if (chrome.runtime && chrome.runtime.onMessage && chrome.runtime.onMessage.addListener) chrome.runtime.onMessage.addListener((m) => {
  if (!aiBusy || !m || m.speakmi !== "ai-progress") return;
  const pr = m.progress || {}, n = typeof pr.progress === "number" ? Math.round(pr.progress <= 1 ? pr.progress * 100 : pr.progress) : null;
  if (n !== null) setAiState(T("popupAiProgress", { p: n }));
});
function paintEvidence() {
  $("evidence").innerHTML = EV.map((e) => `<li><span class="grade ${e.cls}">${e.grade}</span><b>${e.feature}</b><br><span class="muted">${e.note}</span></li>`).join("");
}
// Each part is isolated: if one fails, the others still render and the buttons keep working.
function paint() {
  for (const part of [paintTexts, paintProfiles, paintSettings, paintAI, paintEvidence]) {
    try { part(); } catch (e) { console.error("[Speakmi popup]", part.name, e); }
  }
}

const errText = (e) => (e && e.message) ? e.message : String(e);
// Leading "/" = from the extension root. Firefox resolves a path without it relative to the popup page
// (popup/lib/Readability.js), which does not exist.
const LIB = ["/lib/Readability.js", "/content/brand.js", "/content/config.js", "/content/i18n.js", "/content/evidence.js", "/content/engine.js", "/content/localai.js", "/content/overlay.js"];

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
  $("aiBtn").addEventListener("click", toggleAI);
  try { $("logo").src = BR.logo; BR.loadFonts(); } catch (e) { console.error("[Speakmi popup]", e); }
  try {
    const r = await chrome.storage.local.get(["speakmiSettings"]);
    S = Object.assign({}, DEFAULTS, r.speakmiSettings || {});
  } catch (e) { /* defaults */ }
  await aiStatus();
  paint();
  // The permission prompt can close this popup. When it is reopened with the permission granted, finish the setup.
  if (aiOn && !S.ai) checkAI();
})();
