/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
/* Run: NODE_PATH=<dir with jsdom> node tests/run.js */
const fs = require("fs"), path = require("path");
const { JSDOM } = require("jsdom");
const Readability = require("../lib/Readability.js");
const E = require("../content/engine.js");
const crypto = require("crypto");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const demo = (f) => fs.readFileSync(path.join(__dirname, "../demo", f), "utf8");

function load(f) {
  const dom = new JSDOM(demo(f));
  const a = new Readability(dom.window.document).parse();
  return E.blocksFromHTML(a.content, dom.window.DOMParser);
}

// ---- pipeline per language and profile ----
for (const [f, lang] of [["sample-en.html", "en"], ["sample-de.html", "de"], ["sample-id.html", "id"]]) {
  const blocks = load(f);
  ok(blocks.length > 8, f + ": blocks extracted");
  for (const p of Object.keys(E.PROFILES)) {
    const m = E.analyze(blocks, { profile: p });
    ok(m.lang === lang, `${f}/${p}: language detected as ${m.lang}`);
    ok(m.chunks.length >= 4, `${f}/${p}: has chunks (${m.chunks.length})`);
    ok(m.tldr.length === Math.min(E.PROFILES[p].tldr, m.order.length), `${f}/${p}: tldr size`);
    const idx = m.tldr.map((id) => m.sent[id].idx);
    ok(idx.every((x, i) => i === 0 || x > idx[i - 1]), `${f}/${p}: tldr in source order`);
    const seen = new Map();
    m.chunks.forEach((c) => c.units.flat().forEach((id) => seen.set(id, (seen.get(id) || 0) + 1)));
    ok(m.order.every((id) => seen.get(id) === 1), `${f}/${p}: every sentence in exactly one chunk`);
    const maxS = E.PROFILES[p].chunk.maxSentences;
    ok(m.chunks.filter((c) => c.kind === "prose").every((c) => c.units[0].length <= maxS), `${f}/${p}: prose chunks within limit`);
    ok(m.facts.length > 0, `${f}/${p}: facts found`);
    // fidelity: every tldr point is verbatim, so it must verify against its own source
    ok(m.tldr.every((id) => E.verifyPoint([m.sent[id].text], m.sent[id].text, m.lang).ok), `${f}/${p}: verbatim points verify`);
  }
  const adhd = E.analyze(blocks, { profile: "adhd" }), gen = E.analyze(blocks, { profile: "general" });
  ok(adhd.chunks.length > gen.chunks.length, `${f}: ADHD profile makes more, shorter chunks (${adhd.chunks.length} vs ${gen.chunks.length})`);
  const tuned = E.analyze(blocks, { profile: "adhd", tune: { maxSentences: -1 } });
  ok(tuned.chunks.length >= adhd.chunks.length, `${f}: "too long" feedback does not increase chunk size`);
}

// ---- lists and enumerations ----
{
  const m = E.analyze(load("sample-en.html"), { profile: "adhd" });
  ok(m.chunks.some((c) => c.kind === "list"), "enumeration (First, Second, Third) becomes a list chunk");
}

// ---- fidelity negatives: errors must be caught ----
const V = (src, out, lang, mode) => E.verifyPoint([src], out, lang || "en", { mode: mode || "rewrite" });
ok(V("The drug does not reduce risk by 20 percent.", "The drug reduces risk by 20 percent.").issues.some((i) => i.type === "negation-changed"), "EN: dropped negation caught");
ok(V("The fee is 30 euros.", "The fee is 13 euros.").issues.some((i) => i.type === "number-added"), "EN: changed number caught");
ok(V("The fee is 30 euros.", "The fee is low.").issues.some((i) => i.type === "number-missing"), "EN: missing number caught");
ok(V("The mayor spoke on Monday.", "Mayor Smith spoke on Monday.").issues.some((i) => i.type === "name-added"), "EN: invented name caught");
ok(V("Das Rad ist nicht frei.", "Das Rad ist frei.", "de").issues.some((i) => i.type === "negation-changed"), "DE: dropped negation caught");
ok(V("Biayanya 5.000 rupiah.", "Biayanya 7.000 rupiah.", "id").issues.some((i) => i.type === "number-added"), "ID: changed number caught");
ok(V("Tidak ada biaya.", "Ada biaya.", "id").issues.some((i) => i.type === "negation-changed"), "ID: dropped negation caught");
ok(V("The pilot runs for 12 months and costs 240 euros.", "The pilot runs for 12 months and costs 240 euros.").ok, "EN: identical text passes");
ok(V("Riders can't use the bikes without payment.", "Riders cannot use the bikes without payment.").ok, "EN: contraction and cannot count as the same negation");
ok(V("The service is free.", "The service is not free.", "en", "summary").issues.some((i) => i.type === "negation-added"), "EN summary: added negation caught");

// ---- hints and idioms ----
{
  const seg = E.annotate("Joining is a piece of cake and we utilize bikes.", "en", { hints: true, idioms: true });
  ok(seg.some((s) => s.t === "idiom" && /very easy/.test(s.tip)), "idiom flagged with literal meaning");
  ok(seg.some((s) => s.t === "hint" && s.tip === "use"), "simpler-word hint found");
  ok(E.annotate("Joining is a piece of cake", "en", { hints: false, idioms: false }).length === 1, "annotations can be switched off");
  ok(E.annotate("Der Einstieg ist ein Kinderspiel.", "de", { hints: true, idioms: true }).some((s) => s.t === "idiom"), "DE idiom flagged");
  ok(E.annotate("Petugas harus banting tulang.", "id", { hints: true, idioms: true }).some((s) => s.t === "idiom"), "ID idiom flagged");
}

// ---- sentence splitting ----
{
  const s = E.splitSentences("Dr. Brandt arrived at 9.30 a.m. She spoke. The talk was short.", "en");
  ok(s.length === 3 || s.length === 4, "abbreviations do not over-split: " + JSON.stringify(s));
}

// ---- overlay in a simulated browser ----
const FILES = ["lib/Readability.js", "content/brand.js", "content/config.js", "content/i18n.js", "content/evidence.js", "content/engine.js", "content/overlay.js"];
function overlayTest(f, settings, extraStore) {
  const dom = new JSDOM(demo(f), { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.org/" });
  const w = dom.window, store = Object.assign({ speakmiSettings: Object.assign({ profile: "adhd", focus: true, ui: "en" }, settings || {}) }, extraStore || {});
  const pick = (keys) => { const ks = typeof keys === "string" ? [keys] : keys; const o = {}; ks.forEach((k) => { if (k in store) o[k] = JSON.parse(JSON.stringify(store[k])); }); return o; };
  w.chrome = { storage: { local: { get: async (k) => pick(k), set: (o) => Object.assign(store, JSON.parse(JSON.stringify(o))), remove: (k) => delete store[k] } } };
  w.open = (u) => { w.__opened = u; };
  for (const file of FILES) w.eval(fs.readFileSync(path.join(__dirname, "..", file), "utf8"));
  return { w, store, R: () => w.document.getElementById("speakmi-host").shadowRoot };
}
const click = (R, sel) => { const el = R.querySelector(sel); if (!el) throw new Error("missing " + sel); el.click(); };

(async () => {
  // --- ADHD focus flow ---
  let t = overlayTest("sample-en.html");
  const errors = []; t.w.addEventListener("error", (e) => errors.push(e.message));
  await t.w.__speakmi.open();
  let R = t.R();
  ok(!!t.w.document.getElementById("speakmi-host"), "overlay host created");
  ok(/short parts/.test(R.textContent), "intro shows the reading plan");
  ok(R.querySelectorAll(".points li").length === 3, "intro shows 3 key sentences for ADHD");
  ok(R.querySelectorAll(".chunk").length === 0 && !!R.querySelector('[data-act="start"]'), "intro has one clear start button and no chunk yet");
  ok(!R.querySelector(".opts"), "secondary controls are hidden until Settings is opened");
  click(R, '[data-act="start"]');
  ok(/Chunk 1 of/.test(R.textContent) && R.querySelectorAll(".chunk").length === 1, "start shows exactly one chunk");
  const total = R.querySelectorAll(".segs i").length;
  ok(total >= 6, "segmented progress has one segment per chunk (" + total + ")");
  ok(R.querySelectorAll(".segs i.cur").length === 1 && /left/.test(R.textContent), "current segment and time left shown");
  click(R, ".sent");
  ok(R.querySelector(".sent.mark") !== null, "tapping a sentence highlights it");
  click(R, '[data-act="next"]');
  ok(/Chunk 2 of/.test(R.textContent) && R.querySelectorAll(".segs i.done").length === 1, "next advances and fills the segment");
  click(R, '[data-act="prev"]');
  ok(/Chunk 1 of/.test(R.textContent) && R.querySelector(".sent.mark") !== null, "previous goes back and keeps the highlight");
  let g = 0; while (!R.querySelector(".hero.done") && g++ < 60) click(R, '[data-act="next"]');
  ok(!!R.querySelector(".hero.done") && /made it to the end/.test(R.textContent), "finish screen appears after the last chunk");
  await new Promise((r) => setTimeout(r, 30));
  ok(/reading streak/.test(R.textContent) && t.store.speakmiStreak.total === 1 && t.store.speakmiStreak.days === 1, "finishing records a local reading streak");
  ok(/Your highlights/.test(R.textContent) && R.querySelectorAll(".hero.done .points li").length === 1, "finish screen lists the highlighted sentence");
  click(R, '[data-act="again"]');
  ok(/short parts/.test(R.textContent) && R.querySelectorAll(".sent.mark").length === 0, "read again returns to the intro");
  click(R, '[data-act="src"]'); ok(/From:/.test(R.textContent), "source popover opens");
  click(R, '[data-act="jump"]'); ok(R.querySelector(".osent.hl") !== null, "jump highlights the source sentence in the original");
  click(R, '[data-act="toggleOriginal"]');
  click(R, '[data-act="panel"]');
  ok(!!R.querySelector(".opts") && /Aurora|Calm|Paper|Midnight/.test(R.querySelector('[data-act="theme"]').textContent), "settings panel opens");
  click(R, '[data-act="theme"]'); ok(R.querySelector(".root").dataset.theme === "calm", "theme cycles from the default Aurora to Calm");
  click(R, '[data-act="tooShort"]'); ok(t.store.speakmiSettings.tune.adhd.maxSentences === 1, "feedback stored locally");
  click(R, '[data-act="toggleFocus"]');
  ok(R.querySelectorAll(".sechead").length >= 3, "list mode shows collapsible sections");
  const sel = R.querySelector('[data-sel="profile"]'); sel.value = "dyslexia"; sel.dispatchEvent(new t.w.Event("change", { bubbles: true }));
  ok(R.querySelector(".root").classList.contains("spaced"), "dyslexia profile applies extra spacing");
  ok(/Fidelity audit/.test(R.textContent) && /Strong/.test(R.textContent) && /Weak/.test(R.textContent), "fidelity audit and evidence labels shown");
  click(R, '[data-act="close"]');
  ok(!t.w.document.getElementById("speakmi-host"), "overlay closes");
  ok(errors.length === 0, "no script errors: " + errors.join("|"));

  // --- open edition: no limits, no payments ---
  t = overlayTest("sample-en.html"); await t.w.__speakmi.open(); R = t.R();
  ok(!R.querySelector(".paywall") && /open source/i.test(R.querySelector(".pill").textContent), "open edition: no paywall, pill says open source");
  ok(!t.store.speakmiUsage && !t.store.speakmiLicense, "open edition: nothing about usage or licences is stored");
  ok(!R.querySelector('[data-act="upgrade"]'), "open edition: no upgrade button");

  { const x = overlayTest("sample-en.html", { theme: "sand" }); await x.w.__speakmi.open();
    ok(x.R().querySelector(".root").dataset.theme === "paper", "legacy saved theme maps to the new Paper theme");
    ok(x.R().querySelector("img.logo") !== null, "header shows the logo");
    const y = overlayTest("sample-en.html", { profile: "adhd" }); await y.w.__speakmi.open(); const YR = y.R(); YR.querySelector('[data-act="start"]').click();
    const cols = [...YR.querySelectorAll(".segs i")].map((i) => i.getAttribute("style"));
    ok(cols.every((c) => /--c:#/.test(c)) && new Set(cols).size >= 3, "progress segments are colour-coded by section"); }

  // --- other languages ---
  for (const [f, text, ui] of [["sample-de.html", /Kurz gesagt/, "de"], ["sample-id.html", /Singkatnya/, "id"]]) {
    const x = overlayTest(f, { profile: "autism", ui }); await x.w.__speakmi.open();
    const RR = x.R();
    ok(text.test(RR.textContent), f + ": UI language applied");
    click(RR, '[data-act="start"]');
    let n = 0; while (!RR.querySelector(".lit") && n++ < 20) { const b = RR.querySelector('[data-act="next"]'); if (!b) break; b.click(); }
    ok(RR.querySelector(".lit") !== null, f + ": autism profile shows literal meaning inline");
  }
  { const x = overlayTest("sample-en.html", { profile: "adhd" }); await x.w.__speakmi.open(); const RR = x.R(); click(RR, '[data-act="start"]');
    let n = 0; while (!RR.querySelector(".idiom") && n++ < 20) RR.querySelector('[data-act="next"]').click();
    ok(RR.querySelector(".idiom") !== null && /Literal meaning/.test(RR.querySelector(".idiom").dataset.tip), "EN: idiom tooltip carries the literal meaning"); }

  // --- too little text ---
  const dom = new JSDOM("<html><body><p>Hello.</p></body></html>", { runScripts: "outside-only", url: "https://example.org/" });
  dom.window.chrome = { storage: { local: { get: async () => ({}), set() {} } } };
  for (const file of FILES) dom.window.eval(fs.readFileSync(path.join(__dirname, "..", file), "utf8"));
  await dom.window.__speakmi.open();
  ok(/could not find enough/.test(dom.window.document.getElementById("speakmi-host").shadowRoot.textContent), "short page shows a clear message");

  // --- reading view: a failure must be shown, not leave a blank page ---
  {
    const d = new JSDOM(demo("sample-en.html"), { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.org/" });
    d.window.chrome = { storage: { local: { get: async () => { throw new Error("storage broke"); }, set() {} } } };
    for (const file of FILES) d.window.eval(fs.readFileSync(path.join(__dirname, "..", file), "utf8"));
    d.window.SpeakmiEngine.analyze = () => { throw new Error("analysis broke"); };
    await d.window.__speakmi.open();
    const host = d.window.document.getElementById("speakmi-host");
    ok(!!host && /analysis broke/.test(host.shadowRoot.textContent), "a failing analysis shows a message instead of a blank page");
  }

  // --- popup: errors from injected scripts are shown, the popup stays open, sections render on their own ---
  async function popupTest(execImpl, uiLang) {
    const html = fs.readFileSync(path.join(__dirname, "../popup/popup.html"), "utf8").replace(/<script src="[^"]+"><\/script>/g, "");
    const d = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
    const w = d.window;
    Object.defineProperty(w.navigator, "language", { value: uiLang || "en-US" });
    let closed = false; w.close = () => { closed = true; };
    w.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } }, tabs: { query: async () => [{ id: 7 }] }, scripting: { executeScript: execImpl } };
    w.FontFace = function () { this.load = async () => this; }; w.document.fonts = { add() {} };
    for (const f of ["content/brand.js", "content/config.js", "content/i18n.js", "content/evidence.js", "popup/popup.js"]) w.eval(fs.readFileSync(path.join(__dirname, "..", f), "utf8"));
    await new Promise((r) => setTimeout(r, 50));
    return { w, d: w.document, wasClosed: () => closed };
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  {
    let injected = null;
    const good = await popupTest(async (o) => { if (o.files) injected = o.files; return [{ result: o.files ? undefined : (o.func.toString().includes("then") ? true : false) }]; }, "id-ID");
    ok(good.d.querySelectorAll("#profiles label").length === 5 && good.d.querySelectorAll("#lang option").length === 4, "popup draws profiles and language lists (Indonesian UI)");
    good.d.getElementById("run").click(); await sleep(50);
    ok(good.wasClosed(), "popup closes only after the reading view was added");
    ok(Array.isArray(injected) && injected.length === 7 && injected.every((f) => f.startsWith("/") && fs.existsSync(path.join(__dirname, "..", f.slice(1)))), "popup injects root-relative paths that exist (Firefox resolves others against popup/)");
  }
  {
    const bad = await popupTest(async (o) => (o.files ? [{ result: undefined }] : o.func.toString().includes("then") ? [{ error: { message: "boom in page" } }] : [{ result: false }]));
    bad.d.getElementById("run").click(); await sleep(50);
    ok(!bad.wasClosed(), "popup stays open when the injected script throws");
    ok(!bad.d.getElementById("err").hidden && /boom in page/.test(bad.d.getElementById("errDetail").textContent), "popup shows the real error text");
  }
  {
    const miss = await popupTest(async (o) => (o.files ? [{ error: "Unable to load script" }] : [{ result: false }]));
    miss.d.getElementById("run").click(); await sleep(50);
    ok(!miss.wasClosed() && /Unable to load script/.test(miss.d.getElementById("errDetail").textContent), "popup reports a script file that could not be loaded");
  }
  {
    const nohost = await popupTest(async (o) => (o.files ? [{ result: undefined }] : o.func.toString().includes("then") ? [{ result: false }] : [{ result: false }]));
    nohost.d.getElementById("run").click(); await sleep(50);
    ok(!nohost.wasClosed(), "popup stays open when the reading view did not appear");
  }
  {
    let saved = null;
    const part = await popupTest(async () => [{ result: true }]);
    part.w.chrome.storage.local.set = async (o) => { saved = o; };
    const radio = part.d.querySelector('#profiles input[value="adhd"]'); radio.checked = true;
    radio.dispatchEvent(new part.w.Event("change", { bubbles: true })); await sleep(20);
    ok(saved && saved.speakmiSettings.profile === "adhd", "choosing a reading profile in the popup is saved");
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
