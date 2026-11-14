/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
/*
 * Speakmi overlay. Injected on demand (activeTab). Renders inside a shadow root so the host page
 * cannot restyle it. All processing happens locally.
 *
 * Reading flow (focus mode): intro -> one short chunk at a time -> finish screen.
 * Design choices for attention differences: one clear next action, visible progress and time left,
 * calm colours, little text at once, tap-to-highlight, and secondary controls hidden in Settings.
 */
(function () {
  "use strict";
  if (window.__speakmi) return;

  const E = window.SpeakmiEngine, I = window.SpeakmiI18N, EV = window.SpeakmiEvidence, CFG = window.SpeakmiConfig, BR = window.SpeakmiBrand || { logo: "", loadFonts: () => Promise.resolve(false) };
  const DEFAULTS = { profile: "mixed", theme: "aurora", scale: 1, focus: true, hints: true, idioms: true, ai: false, lang: "auto", ui: "auto", recap: false, tune: {} };
  let S = Object.assign({}, DEFAULTS);
  let host = null, root = null, article = null, model = null, where = {}, rewriter = null;
  const st = {
    chunk: -1, original: false, openSrc: new Set(), hl: null, openSec: new Set([0]), rewrites: {}, showOrig: new Set(),
    busy: false, aiMsg: "", panel: false, marks: new Set(), premium: true, plan: "open", left: Infinity, paywall: false,
    finished: false, celebrate: false, streak: null
  };
  const dayKey = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const THEMES = ["aurora", "calm", "paper", "midnight"];
  const LEGACY = { sand: "paper", dark: "midnight", light: "aurora" };
  const themeName = () => (THEMES.includes(S.theme) ? S.theme : LEGACY[S.theme] || "aurora");
  const SEC_COLORS = ["#4F5FD6", "#1E9BD7", "#0FA59B", "#8B5CF6", "#E59E0B", "#E8416A"];
  const secColor = (i) => SEC_COLORS[i % SEC_COLORS.length];
  let prevOverflow = "";

  // ---------- helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uiLang = () => {
    const u = S.ui === "auto" ? (navigator.language || "en").slice(0, 2).toLowerCase() : S.ui;
    return I[u] ? u : "en";
  };
  const T = (k, v) => {
    let s = I[uiLang()][k];
    if (s === undefined) s = I.en[k];
    if (s === undefined) return k;
    return typeof s === "string" && v ? s.replace(/\{(\w+)\}/g, (_, n) => (v[n] === undefined ? "" : v[n])) : s;
  };
  const TG = (g, k) => (I[uiLang()][g] && I[uiLang()][g][k]) || (I.en[g] && I.en[g][k]) || k;
  const fmtTime = (sec) => (sec < 60 ? T("sec", { n: sec }) : T("min", { n: Math.max(1, Math.round(sec / 60)) }));
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const tune = () => S.tune[S.profile] || {};
  const N = () => (model ? model.chunks.length : 0);

  async function getStore(keys) { try { return await chrome.storage.local.get(keys); } catch (e) { return {}; } }
  function setStore(o) { try { chrome.storage.local.set(o); } catch (e) { /* ignore */ } }
  async function loadSettings() { const r = await getStore("speakmiSettings"); S = Object.assign({}, DEFAULTS, r.speakmiSettings || {}); }
  const saveSettings = () => setStore({ speakmiSettings: S });

  // ---------- extraction ----------
  function extract() {
    try {
      const clone = document.cloneNode(true);
      const a = new Readability(clone, { charThreshold: 200 }).parse();
      if (!a || !a.content) return null;
      const blocks = E.blocksFromHTML(a.content, DOMParser);
      const words = blocks.reduce((n, b) => n + E.countWords(b.text), 0);
      if (words < 80) return null;
      return { title: a.title || document.title || "", blocks };
    } catch (e) { return null; }
  }

  function analyze() {
    model = E.analyze(article.blocks, { profile: S.profile, lang: S.lang, tune: tune() });
    where = {};
    model.chunks.forEach((c) => c.units.flat().forEach((id) => { where[id] = c.i; }));
    st.chunk = Math.max(-1, Math.min(N(), st.chunk));
  }

  const secTitle = (s) => s.heading || (s.auto ? T("part", { n: s.autoIndex }) + ": " + cap(s.autoLabel.join(", ")) : T("intro"));
  const secsLeft = () => model.chunks.slice(Math.max(0, st.chunk)).reduce((a, c) => a + c.seconds, 0);
  const totalSecs = () => model.chunks.reduce((a, c) => a + c.seconds, 0);

  // ---------- rendering ----------
  function sentHTML(id) {
    const s = model.sent[id], rw = st.rewrites[id];
    const showRw = rw && !rw.same && !st.showOrig.has(id);
    const segs = showRw ? [{ t: "text", v: rw.text }] : E.annotate(s.text, model.lang, { hints: S.hints, idioms: S.idioms });
    const html = segs.map((g) => {
      if (g.t === "text") return esc(g.v);
      if (g.t === "hint") return `<span class="hint" tabindex="0" data-tip="${esc(T("simpler", { w: g.tip }))}">${esc(g.v)}</span>`;
      return `<span class="idiom" tabindex="0" data-tip="${esc(T("literal", { m: g.tip }))}">${esc(g.v)}</span>` +
        (model.cfg.literalInline ? ` <span class="lit">(= ${esc(g.tip)})</span>` : "");
    }).join("");
    let extra = "";
    if (rw && !rw.same) {
      const ok = rw.v.ok;
      const issues = rw.v.issues.map((x) => (T("issues")[x.type] ? T("issues")[x.type].replace("{v}", x.value) : x.type)).join("; ");
      extra = ` <span class="badge ${ok ? "ok" : "bad"}" title="${esc(ok ? T("verified") : T("flagged", { i: issues }))}">${ok ? "✓" : "!"} ${esc(T("rewritten"))}</span>` +
        ` <button class="mini" data-act="toggleOrig" data-id="${id}">${esc(showRw ? T("showOrig") : T("showRewrite"))}</button>` +
        (ok ? "" : `<span class="note">${esc(T("flagged", { i: issues }))}</span>`);
    }
    const marked = st.marks.has(id);
    return `<span class="sent${marked ? " mark" : ""}" data-act="mark" data-id="${id}" role="button" tabindex="0" aria-pressed="${marked}">${html}</span>${extra}`;
  }

  function chunkHTML(c, withTip) {
    let body;
    if (c.kind === "list") body = `<ul>${c.units.map((u) => `<li>${u.map(sentHTML).join(" ")}</li>`).join("")}</ul>`;
    else if (c.kind === "quote") body = `<blockquote>${c.units[0].map(sentHTML).join(" ")}</blockquote>`;
    else body = `<p>${c.units[0].map(sentHTML).join(" ")}</p>`;
    return `<article class="chunk" data-chunk="${c.i}" style="--sc:${secColor(c.section)}"><div class="text">${body}</div>${withTip ? `<p class="tip">${esc(T("tipMark"))}</p>` : ""}</article>`;
  }

  function summaryCard() {
    if (!model.tldr.length) return "";
    const items = model.tldr.map((id) => {
      const c = model.chunks[where[id]], open = st.openSrc.has(id);
      const loc = secTitle(model.sections[c.section]) + " · " + T("chunkOf", { i: c.i + 1, n: N() });
      return `<li><span class="text">${esc(model.sent[id].text)}</span> ` +
        `<button class="mini" data-act="src" data-id="${id}" aria-expanded="${open}">${esc(T("source"))}</button>` +
        (open ? `<div class="srcbox">${esc(T("sourceIn", { s: loc }))} <button class="mini" data-act="jump" data-id="${id}">${esc(T("jump"))}</button></div>` : "") + `</li>`;
    }).join("");
    return `<section class="card summary" aria-labelledby="sumh"><h2 id="sumh">${esc(T("summaryTitle"))}</h2><p class="muted small">${esc(T("summaryBadge"))}</p><ul class="points">${items}</ul></section>`;
  }

  function factsAndOutline() {
    const facts = model.facts.length ? `<details><summary>${esc(T("keyNumbers"))}</summary><ul class="facts">${model.facts.map((f) => {
      const tx = model.sent[f.id].text, sn = tx.length > 90 ? tx.slice(0, 90) + "…" : tx;
      return `<li><b>${esc(f.numbers.join(", "))}</b> · ${esc(sn)} <button class="mini" data-act="jump" data-id="${f.id}">${esc(T("jump"))}</button></li>`;
    }).join("")}</ul></details>` : "";
    const outline = `<details><summary>${esc(T("outline"))}</summary><ol class="outline">${model.sections.map((s, i) =>
      `<li><button class="link" data-act="gotoSec" data-i="${i}">${esc(secTitle(s))}</button> <span class="muted">${esc(fmtTime(s.seconds))}</span></li>`).join("")}</ol></details>`;
    return facts + outline;
  }

  function auditHTML() {
    let n = 0, ok = 0, bad = 0;
    model.order.forEach((id) => { n++; const rw = st.rewrites[id]; if (rw && !rw.same) { if (rw.v.ok) ok++; else bad++; } });
    return `<section class="card fid"><h2>✓ ${esc(T("fidelity"))}</h2><p>${esc(T("fidelityLine", { n, v: n - ok - bad, ok, bad }))}</p><p class="muted small">${esc(T("fidelityNote"))}</p></section>`;
  }

  function evidenceHTML() {
    return `<details class="card"><summary>${esc(T("evidenceTitle"))}</summary><ul class="evid">${EV.map((e) =>
      `<li><span class="grade ${e.cls}">${esc(e.grade)}</span> <b>${esc(e.feature)}</b><br><span class="muted small">${esc(e.note)}</span></li>`).join("")}</ul></details>`;
  }

  function introHTML() {
    return `<section class="hero"><p class="eyebrow">${esc(T("bitesPlan", { n: N(), t: fmtTime(totalSecs()) }))}</p>` +
      `<h1 class="atitle">${esc(article.title)}</h1>` + summaryCard() +
      `<div class="center"><button class="cta" data-act="start">${esc(T("start"))} →</button></div>` +
      `<div class="more">${factsAndOutline()}</div>` + auditHTML() + evidenceHTML() + `</section>`;
  }

  function chunkStepHTML() {
    const c = model.chunks[st.chunk], n = N();
    const segs = model.chunks.map((x, i) => `<i class="${i < st.chunk ? "done" : i === st.chunk ? "cur" : ""}" style="--c:${secColor(x.section)}"></i>`).join("");
    let recap = "";
    if (S.recap && st.chunk > 0) {
      const prev = model.chunks[st.chunk - 1], first = prev.units.flat()[0];
      recap = `<div class="recap">${esc(T("recap", { h: secTitle(model.sections[c.section]) }))} <q>${esc(model.sent[first].text)}</q></div>`;
    }
    const last = st.chunk >= n - 1;
    return `<section class="step" aria-label="${esc(T("focus"))}">` +
      `<div class="segs" role="progressbar" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="${st.chunk + 1}" aria-label="${esc(T("chunkOf", { i: st.chunk + 1, n }))}">${segs}</div>` +
      `<div class="meta2"><span>${esc(T("chunkOf", { i: st.chunk + 1, n }))}</span><span>${esc(T("timeLeft", { t: fmtTime(secsLeft()) }))}</span></div>` +
      `<p class="secname" style="--sc:${secColor(c.section)}">${esc(secTitle(model.sections[c.section]))}${model.sections[c.section].auto ? ` <span class="muted small">(${esc(T("autoLabel"))})</span>` : ""}</p>` +
      recap + chunkHTML(c, st.chunk === 0) +
      `<nav class="nav"><button data-act="prev">← ${esc(T("prev"))}</button><button class="cta" data-act="next">${esc(last ? T("finish") : T("next"))} ${last ? "✓" : "→"}</button></nav></section>`;
  }

  function doneHTML() {
    const marked = [...st.marks].sort((a, b) => model.sent[a].idx - model.sent[b].idx);
    const recapIds = marked.length ? marked : model.tldr;
    return `<section class="hero done">${st.celebrate ? confettiHTML() : ""}<div class="check" aria-hidden="true">✓</div><h1>${esc(T("doneTitle"))}</h1>` +
      (st.streak ? `<p class="streak"><span aria-hidden="true">🔥</span> ${esc(T("streakLine", st.streak))}</p>` : "") +
      `<p class="lead">${esc(T("doneLine", { n: N(), t: fmtTime(totalSecs()) }))}</p>` +
      `<section class="card"><h2>${esc(marked.length ? T("highlights") : T("keyPointsRecap"))}</h2><ul class="points">${recapIds.map((id) => `<li>${esc(model.sent[id].text)}</li>`).join("")}</ul></section>` +
      `<div class="center row"><button class="cta" data-act="again">↺ ${esc(T("again"))}</button><button data-act="toggleOriginal">${esc(T("original"))}</button><button data-act="close">${esc(T("close"))}</button></div>` +
      auditHTML() + `</section>`;
  }

  function confettiHTML() {
    const cols = ["#6C7BEA", "#3BAFE0", "#1CDDD8", "#FF7A45", "#F0436B", "#FFD23F"];
    let h = "";
    for (let i = 0; i < 36; i++) {
      const x = (i * 29) % 100, d = (2.4 + (((i * 7) % 10) / 10) * 1.8).toFixed(2), dl = ((((i * 13) % 10) / 10) * 0.7).toFixed(2), r = (i * 47) % 360;
      h += `<i style="left:${x}%;background:${cols[i % cols.length]};animation-duration:${d}s;animation-delay:${dl}s;--r:${r}deg"></i>`;
    }
    return `<div class="confetti" aria-hidden="true">${h}</div>`;
  }

  async function recordFinish() {
    const r = await getStore("speakmiStreak");
    const s = r.speakmiStreak || { last: "", days: 0, total: 0 };
    const today = dayKey(new Date()), yest = dayKey(new Date(Date.now() - 864e5));
    if (s.last !== today) { s.days = s.last === yest ? (s.days || 0) + 1 : 1; s.last = today; }
    s.total = (s.total || 0) + 1;
    setStore({ speakmiStreak: s });
    st.streak = { days: s.days, total: s.total };
    render();
  }

  function listHTML() {
    return `<div class="wrap">${summaryCard()}<div class="more">${factsAndOutline()}</div>` +
      model.sections.map((s, i) => {
        const open = st.openSec.has(i);
        return `<section class="sec" data-sec="${i}"><button class="sechead" data-act="toggleSec" data-i="${i}" aria-expanded="${open}"><span class="chev">${open ? "▾" : "▸"}</span> ${esc(secTitle(s))} <span class="muted small">${esc(s.chunks.length + " · " + fmtTime(s.seconds))}</span></button>` +
          (open ? s.chunks.map((c) => chunkHTML(c, false)).join("") : "") + `</section>`;
      }).join("") + auditHTML() + evidenceHTML() + `</div>`;
  }

  function originalHTML() {
    return `<section class="card"><p class="muted small">${esc(T("originalTitle"))}</p>` + model.blocks.map((b) => {
      if (b.type === "h") return `<h3>${esc(b.text)}</h3>`;
      return `<p class="orig">${b.sentences.map((id) => `<span class="osent${st.hl === id ? " hl" : ""}" data-sid="${id}">${esc(model.sent[id].text)}</span>`).join(" ")}</p>`;
    }).join("") + `</section>`;
  }


  const CSS = `
:host{all:initial}
*{box-sizing:border-box}
.root{position:fixed;inset:0;display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(160deg,var(--bg2),var(--bg));color:var(--fg);font:400 calc(17px*var(--scale))/1.75 "Speakmi Lexend","Atkinson Hyperlegible","Segoe UI",Verdana,Arial,sans-serif;--cta-grad:linear-gradient(135deg,#F2602F,#DB2D68);--brand-grad:linear-gradient(135deg,#6C7BEA,#3BAFE0 55%,#1CDDD8)}
.root::before,.root::after{content:"";position:absolute;width:52vmax;height:52vmax;border-radius:50%;filter:blur(80px);opacity:.6;pointer-events:none;animation:drift 22s ease-in-out infinite alternate}
.root::before{background:radial-gradient(circle,var(--blob1),transparent 66%);top:-22vmax;right:-14vmax}
.root::after{background:radial-gradient(circle,var(--blob2),transparent 66%);bottom:-26vmax;left:-16vmax;animation-delay:-9s}
.bar,.opts,.main{position:relative;z-index:1}
.root[data-theme=aurora]{--bg:#EEF2FF;--bg2:#FAFCFF;--fg:#1B2440;--muted:#55608A;--card:#FFFFFF;--glass:rgba(255,255,255,.78);--line:#DDE3F7;--acc:#4F5FD6;--accfg:#FFFFFF;--seg:#DDE3F7;--okbg:#DDF7F1;--ok:#0B7F78;--badbg:#FFE9DC;--bad:#B4390F;--hl:#FFE27A;--blob1:rgba(108,123,234,.55);--blob2:rgba(28,221,216,.45);--shadow:0 12px 32px rgba(79,95,214,.15)}
.root[data-theme=calm]{--bg:#E3F0EF;--bg2:#F4FAF9;--fg:#17323A;--muted:#4A666E;--card:#FFFFFF;--glass:rgba(255,255,255,.78);--line:#C8DEDC;--acc:#0F6B7A;--accfg:#FFFFFF;--seg:#C8DEDC;--okbg:#DDF1E3;--ok:#166534;--badbg:#FDEBD3;--bad:#9A3412;--hl:#FFE98A;--blob1:rgba(15,150,160,.35);--blob2:rgba(120,200,160,.35);--shadow:0 10px 28px rgba(15,107,122,.12)}
.root[data-theme=paper]{--bg:#F1E9DA;--bg2:#FBF7EE;--fg:#2B2A28;--muted:#6B645A;--card:#FFFDF8;--glass:rgba(255,253,248,.82);--line:#E2D8C5;--acc:#7A4A1E;--accfg:#FFFFFF;--seg:#E2D8C5;--okbg:#E5F0DC;--ok:#2F6B1F;--badbg:#FBE3CF;--bad:#9A3412;--hl:#FFE08A;--blob1:rgba(214,160,90,.35);--blob2:rgba(190,120,90,.25);--shadow:0 10px 26px rgba(90,60,20,.10)}
.root[data-theme=midnight]{--bg:#0D1226;--bg2:#131B36;--fg:#E8ECFF;--muted:#9AA6D6;--card:#171E3A;--glass:rgba(23,30,58,.80);--line:#2A3562;--acc:#9DB0FF;--accfg:#0D1226;--seg:#2A3562;--okbg:#0F3A36;--ok:#5EEAD4;--badbg:#3E2418;--bad:#FDBA74;--hl:#6B5A00;--blob1:rgba(108,123,234,.45);--blob2:rgba(28,221,216,.28);--shadow:0 12px 34px rgba(0,0,0,.45)}
.spaced .text,.spaced .orig,.spaced .points{letter-spacing:.12em;word-spacing:.16em;line-height:1.95}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
button,select{font:inherit;font-size:.8em;color:var(--fg);background:var(--card);border:1px solid var(--line);border-radius:14px;min-height:42px;padding:6px 14px;cursor:pointer;transition:transform .12s,border-color .15s,box-shadow .15s}
button:hover{border-color:var(--acc);box-shadow:0 4px 12px rgba(79,95,214,.15)}
button:active{transform:scale(.97)}
button:disabled{opacity:.4;cursor:default}
button.cta{background:var(--cta-grad);color:#fff;border:0;font-weight:800;font-size:1.05em;min-height:56px;padding:12px 32px;border-radius:18px;box-shadow:0 10px 24px rgba(219,45,104,.32);animation:glow 2.8s ease-in-out infinite}
button.cta:hover{filter:brightness(1.06);box-shadow:0 12px 28px rgba(219,45,104,.4)}
button.mini{min-height:28px;padding:1px 10px;font-size:.68em;border-radius:9px;margin-left:4px}
button.link{border:0;background:none;min-height:0;padding:0;color:var(--acc);text-decoration:underline;font-size:1em;box-shadow:none}
.pill{font-size:.72em;min-height:32px;padding:2px 14px;border-radius:999px;background:var(--okbg);color:var(--ok);border-color:transparent;font-weight:700}
.pill.pro{display:inline-flex;align-items:center;background:var(--brand-grad);color:#0D1226}
:focus-visible{outline:3px solid var(--acc);outline-offset:2px}
.bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding:10px 18px;background:var(--glass);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.brand{display:flex;gap:10px;align-items:center;min-width:0}
.logo{width:36px;height:36px;display:block}
.brand b{font-size:1.2em;font-weight:800;background:linear-gradient(90deg,#4F5FD6,#1479B8 60%,#0B9F98);-webkit-background-clip:text;background-clip:text;color:transparent}
.root[data-theme=midnight] .brand b{background:linear-gradient(90deg,#9DB0FF,#5FD1F0 60%,#3EE6D3);-webkit-background-clip:text;background-clip:text}
.brand .title{color:var(--muted);font-size:.72em;max-width:30ch;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tools,.opts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.opts{padding:10px 18px;background:var(--glass);backdrop-filter:blur(14px);border-bottom:1px solid var(--line);font-size:.78em}
.opts label{display:inline-flex;gap:6px;align-items:center}
.opts input{width:18px;height:18px;accent-color:var(--acc)}
.sep{width:1px;height:22px;background:var(--line)}
.main{flex:1;overflow:auto;padding:26px 18px 80px}
.wrap,.hero{max-width:68ch;margin:0 auto;display:flex;flex-direction:column;gap:18px}
.spaced .wrap,.spaced .hero,.spaced .step{max-width:60ch}
.step{max-width:68ch;margin:0 auto}
.center{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:8px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:18px 24px;box-shadow:var(--shadow)}
.card h2{margin:0 0 4px;font-size:1.02em;color:var(--acc);font-weight:700}
h1{margin:0;font-size:1.6em;line-height:1.25;font-weight:800}
.eyebrow{align-self:flex-start;margin:0;font-size:.74em;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#fff;background:var(--brand-grad);border-radius:999px;padding:4px 14px;text-shadow:0 1px 1px rgba(0,0,0,.18)}
.lead{font-size:1.02em;margin:0;color:var(--muted)}
h3{margin:18px 0 6px;font-size:1em;color:var(--acc)}
.muted{color:var(--muted)}.small{font-size:.8em}
.summary{position:relative;overflow:hidden;padding-left:30px}
.summary::before{content:"";position:absolute;left:0;top:0;bottom:0;width:8px;background:var(--brand-grad)}
.points{padding-left:1.2em;margin:8px 0}.points li{margin:10px 0}.points li::marker{color:var(--acc);font-weight:800}
summary{cursor:pointer;font-size:.82em;color:var(--acc);margin-top:8px;min-height:32px;font-weight:600}
.more{display:flex;flex-direction:column}
.facts,.outline,.evid{font-size:.82em;padding-left:1.2em}.evid{list-style:none;padding:0}.evid li{margin:10px 0}
.segs{display:flex;gap:5px;margin:2px 0 10px}
.segs i{flex:1;height:12px;min-width:4px;border-radius:8px;background:var(--seg);transition:background .25s,transform .25s,box-shadow .25s}
.segs i.done{background:var(--c)}
.segs i.cur{background:var(--c);transform:scaleY(1.35);box-shadow:0 0 0 4px color-mix(in srgb,var(--c) 25%,transparent)}
.meta2{display:flex;justify-content:space-between;font-size:.74em;color:var(--muted);margin-bottom:8px}
.secname{display:inline-flex;align-items:center;gap:9px;margin:6px 0 10px;font-weight:700;color:var(--fg);font-size:.86em;background:color-mix(in srgb,var(--sc) 15%,transparent);border-radius:999px;padding:5px 16px 5px 12px}
.secname::before{content:"";width:12px;height:12px;border-radius:50%;background:var(--sc)}
.chunk{background:linear-gradient(180deg,color-mix(in srgb,var(--sc) 8%,var(--card)),var(--card) 55%);border:1px solid var(--line);border-left:8px solid var(--sc);border-radius:22px;padding:24px 28px;margin:10px 0;box-shadow:var(--shadow);animation:rise .3s ease-out}
.chunk .text{font-size:1.06em}
.chunk p,.chunk ul,.chunk blockquote{margin:0}.chunk ul{padding-left:1.2em}.chunk li{margin:10px 0}
.chunk blockquote{border-left:4px solid var(--acc);padding-left:14px;font-style:italic}
.tip{font-size:.72em!important;color:var(--muted);margin-top:14px!important}
.nav{display:flex;justify-content:space-between;gap:12px;margin-top:16px}.nav button{flex:1;min-height:58px;font-size:.95em}.nav .cta{flex:1.7}
.recap{font-size:.82em;color:var(--muted);border-left:3px solid var(--line);padding-left:12px;margin:8px 0}
.sent{cursor:pointer;border-radius:6px;padding:0 2px;transition:background .15s}.sent:hover{background:color-mix(in srgb,var(--acc) 12%,transparent)}
.sent.mark{background:var(--hl);box-decoration-break:clone;-webkit-box-decoration-break:clone}
.sechead{width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);border-radius:0;font-size:.92em;color:var(--acc);padding:10px 0;box-shadow:none}
.chev{display:inline-block;width:1.2em}
.hint,.idiom{position:relative;cursor:help;border-bottom:2px dotted var(--acc)}
.idiom{border-bottom-color:#E59E0B}
.hint:hover::after,.hint:focus::after,.idiom:hover::after,.idiom:focus::after{content:attr(data-tip);position:absolute;left:0;top:115%;z-index:5;background:var(--fg);color:var(--bg);font-size:.78em;line-height:1.35;letter-spacing:0;word-spacing:0;padding:6px 10px;border-radius:10px;width:max-content;max-width:28ch}
.lit{color:#C2670A;font-size:.85em}
.root[data-theme=midnight] .lit{color:#FDBA74}
.badge{display:inline-block;font-size:.64em;padding:0 9px;border-radius:999px;vertical-align:middle;letter-spacing:0}
.badge.ok{background:var(--okbg);color:var(--ok)}.badge.bad{background:var(--badbg);color:var(--bad)}
.note{display:block;font-size:.74em;color:var(--bad)}
.srcbox{font-size:.76em;color:var(--muted);background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:6px 12px;margin-top:4px}
.grade{display:inline-block;font-size:.68em;padding:0 9px;border-radius:999px;border:1px solid var(--line);margin-right:6px}
.grade.strong{background:var(--okbg);color:var(--ok)}.grade.weak{background:var(--badbg);color:var(--bad)}
.orig{margin:0 0 10px}.osent.hl{background:var(--hl);border-radius:5px;padding:0 3px}
.fid{border:2px solid transparent;background:linear-gradient(var(--card),var(--card)) padding-box,var(--brand-grad) border-box}
.fid p{margin:4px 0}
.hero.done,.hero.paywall{text-align:center;align-items:center}
.hero.paywall{padding:36px 30px}
.check{width:84px;height:84px;border-radius:50%;background:var(--brand-grad);color:#fff;display:grid;place-items:center;font-size:2.4em;font-weight:800;box-shadow:0 12px 30px rgba(59,175,224,.4);animation:pop .5s cubic-bezier(.2,1.4,.4,1)}
.check.lock{background:var(--cta-grad);box-shadow:0 12px 30px rgba(219,45,104,.35)}
.streak{margin:0;font-weight:700;background:var(--badbg);color:var(--bad);border-radius:999px;padding:6px 18px;font-size:.9em}
.perks{list-style:none;padding:0;margin:4px 0;text-align:left}.perks li{margin:8px 0}.perks li::before{content:"✓";color:var(--ok);font-weight:800;margin-right:10px}
.hero.done .points{text-align:left}
.confetti{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:3}
.confetti i{position:absolute;top:-16px;width:9px;height:15px;border-radius:3px;animation:fall linear forwards}
.msg{max-width:60ch;margin:80px auto;text-align:center;font-size:1.05em}
.status{font-size:.74em;color:var(--muted)}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes drift{from{transform:translate(0,0)}to{transform:translate(4vmax,3vmax)}}
@keyframes glow{0%,100%{box-shadow:0 10px 24px rgba(219,45,104,.30)}50%{box-shadow:0 12px 34px rgba(219,45,104,.52)}}
@keyframes fall{from{transform:translateY(0) rotate(var(--r))}to{transform:translateY(112vh) rotate(calc(var(--r) + 540deg));opacity:.85}}
@media (prefers-reduced-motion:reduce){*,.root::before,.root::after{animation:none!important;transition:none!important}.confetti{display:none}}
@media (max-width:560px){.brand .title{display:none}.chunk{padding:18px 20px}}
`;

  function render(focusAct) {
    if (!root) return;
    const main = root.querySelector(".main");
    const top = main ? main.scrollTop : 0;
    const spaced = model && model.cfg.spacing ? " spaced" : "";
    const theme = themeName();
    const pill = `<span class="pill pro">${esc(T("planOpen"))}</span>`;
    const brand = `<div class="brand"><img class="logo" src="${BR.logo}" alt=""><b>${esc(T("appName"))}</b>${article ? `<span class="title">${esc(article.title)}</span>` : ""}</div>`;

    let bar, inner;
    if (!article) {
      bar = `<header class="bar">${brand}<div class="tools"><button data-act="close" aria-label="${esc(T("close"))}">✕</button></div></header>`;
      inner = `<div class="msg" role="alert">${esc(st.fail ? T("failed", { e: st.fail }) : T("notEnough"))}</div>`;
    } else if (false) {
      inner = "";
    } else {
      const profiles = Object.keys(E.PROFILES).map((p) => `<option value="${p}" ${p === S.profile ? "selected" : ""}>${esc(TG("profiles", p))}</option>`).join("");
      bar = `<header class="bar">${brand}<div class="tools">${pill}
<label><span class="sr">${esc(T("profile"))}</span><select data-sel="profile" aria-label="${esc(T("profile"))}">${profiles}</select></label>
<button data-act="toggleFocus" aria-pressed="${S.focus}">${esc(S.focus ? T("list") : T("focus"))}</button>
<button data-act="toggleOriginal" aria-pressed="${st.original}">${esc(st.original ? T("restructured") : T("original"))}</button>
<button data-act="panel" aria-expanded="${st.panel}">⚙ ${esc(T("settings"))}</button>
<button data-act="close" aria-label="${esc(T("close"))}">✕</button></div></header>`;
      if (st.panel) {
        bar += `<div class="opts"><button data-act="theme">${esc(T("theme"))}: ${esc(TG("themeNames", theme))}</button>
<button data-act="smaller" aria-label="${esc(T("smaller"))}">A−</button><button data-act="larger" aria-label="${esc(T("larger"))}">A+</button><span class="sep"></span>
<span>${esc(T("feedback"))}:</span><button data-act="tooLong">${esc(T("tooLong"))}</button><button data-act="tooShort">${esc(T("tooShort"))}</button><button data-act="lost" aria-pressed="${S.recap}">${esc(T("lost"))}</button><span class="sep"></span>
<label><input type="checkbox" data-chk="hints" ${S.hints ? "checked" : ""}>${esc(T("hints"))}</label>
<label><input type="checkbox" data-chk="idioms" ${S.idioms ? "checked" : ""}>${esc(T("idioms"))}</label>
<label><input type="checkbox" data-chk="ai" ${S.ai ? "checked" : ""}>${esc(T("ai"))}</label>
<span class="status">${esc(st.busy ? T("aiBusy") : st.aiMsg)}</span></div>`;
      }
      if (st.original) inner = `<div class="wrap">${originalHTML()}</div>`;
      else if (S.focus) inner = st.chunk < 0 ? introHTML() : st.chunk >= N() ? doneHTML() : chunkStepHTML();
      else inner = listHTML();
      inner += `<div class="sr" aria-live="polite">${esc(st.busy ? T("aiBusy") : st.aiMsg)}</div>`;
    }
    root.innerHTML = `<style>${CSS}</style><div class="root${spaced}" data-theme="${theme}" style="--scale:${S.scale}" role="dialog" aria-modal="true" aria-label="Speakmi">${bar}<main class="main" tabindex="-1">${inner}</main></div>`;
    const m2 = root.querySelector(".main");
    if (m2) m2.scrollTop = top;
    if (focusAct) { const b = root.querySelector(`[data-act="${focusAct}"]`); if (b && !b.disabled) b.focus(); }
    if (st.hl && st.original) {
      const el = root.querySelector(`.osent[data-sid="${st.hl}"]`);
      if (el && el.scrollIntoView) el.scrollIntoView({ block: "center" });
    }
    st.celebrate = false;
    maybeRewrite();
  }

  // ---------- optional on-device AI (experimental) ----------
  async function initAI() {
    if (!("Rewriter" in self)) throw new Error(T("aiNoApi"));
    if (model.lang !== "en") throw new Error(T("aiEnOnly"));
    const av = await self.Rewriter.availability();
    if (av === "unavailable") throw new Error(T("aiNoApi"));
    rewriter = await self.Rewriter.create({
      tone: "as-is", format: "plain-text", length: "as-is",
      sharedContext: "Rewrite in plain, simple language for readers who find long or complex sentences hard. Keep every number, name and negation exactly as in the source."
    });
  }

  function visibleChunks() {
    if (st.original || st.paywall) return [];
    if (S.focus) return st.chunk >= 0 && st.chunk < N() ? [model.chunks[st.chunk]] : [];
    return model.sections.flatMap((s, i) => (st.openSec.has(i) ? s.chunks : []));
  }

  async function maybeRewrite() {
    if (!S.ai || !rewriter || st.busy || !model) return;
    const todo = visibleChunks().flatMap((c) => c.units.flat()).filter((id) => !st.rewrites[id]);
    if (!todo.length) return;
    st.busy = true; render();
    try {
      for (const id of todo) {
        const src = model.sent[id].text;
        const out = ((await rewriter.rewrite(src)) || "").trim();
        const v = E.verifyPoint([src], out, model.lang, { mode: "rewrite" });
        st.rewrites[id] = { text: out || src, v, same: !out || out === src };
      }
      st.aiMsg = "";
    } catch (e) {
      st.aiMsg = T("aiError", { e: (e && e.message) || e });
      S.ai = false; saveSettings();
    }
    st.busy = false; render();
  }

  // ---------- events ----------
  const go = (i) => {
    st.chunk = Math.max(-1, Math.min(N(), i)); const m = root.querySelector(".main"); if (m) m.scrollTop = 0;
    if (st.chunk >= N() && N() > 0 && !st.finished) { st.finished = true; st.celebrate = true; recordFinish(); }
  };

  function onClick(e) {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act, id = el.dataset.id;
    let focusAct = null;
    switch (act) {
      case "close": close(); return;
      case "toggleFocus": S.focus = !S.focus; break;
      case "toggleOriginal": st.original = !st.original; st.hl = null; break;
      case "panel": st.panel = !st.panel; break;
      case "theme": S.theme = THEMES[(THEMES.indexOf(themeName()) + 1) % THEMES.length]; break;
      case "smaller": S.scale = Math.max(0.8, +(S.scale - 0.1).toFixed(2)); break;
      case "larger": S.scale = Math.min(1.8, +(S.scale + 0.1).toFixed(2)); break;
      case "start": go(0); focusAct = "next"; break;
      case "prev": go(st.chunk - 1); focusAct = "prev"; break;
      case "next": go(st.chunk + 1); focusAct = st.chunk >= N() ? "again" : "next"; break;
      case "again": st.marks = new Set(); st.finished = false; go(-1); break;
      case "mark": st.marks.has(id) ? st.marks.delete(id) : st.marks.add(id); break;
      case "src": st.openSrc.has(id) ? st.openSrc.delete(id) : st.openSrc.add(id); break;
      case "jump": st.original = true; st.hl = id; break;
      case "toggleOrig": st.showOrig.has(id) ? st.showOrig.delete(id) : st.showOrig.add(id); break;
      case "toggleSec": { const i = +el.dataset.i; st.openSec.has(i) ? st.openSec.delete(i) : st.openSec.add(i); break; }
      case "gotoSec": {
        const i = +el.dataset.i; st.original = false;
        if (S.focus) go(model.sections[i].chunks[0].i); else st.openSec.add(i);
        break;
      }
      case "tooLong": case "tooShort": {
        const t = Object.assign({}, tune());
        t.maxSentences = Math.max(-2, Math.min(3, (t.maxSentences || 0) + (act === "tooLong" ? -1 : 1)));
        S.tune = Object.assign({}, S.tune, { [S.profile]: t });
        analyze(); break;
      }
      case "lost": S.recap = !S.recap; break;
      default: return;
    }
    saveSettings(); render(focusAct);
  }

  function onChange(e) {
    const sel = e.target.closest("[data-sel]");
    if (sel) { S.profile = sel.value; st.chunk = S.focus ? -1 : 0; st.openSec = new Set([0]); analyze(); saveSettings(); render(); return; }
    const chk = e.target.closest("[data-chk]");
    if (!chk) return;
    const k = chk.dataset.chk;
    if (k === "ai") {
      if (!chk.checked) { S.ai = false; saveSettings(); render(); return; }
      st.aiMsg = T("aiBusy"); render();
      initAI().then(() => { S.ai = true; st.aiMsg = ""; saveSettings(); render(); })
        .catch((err) => { S.ai = false; st.aiMsg = err.message; render(); });
      return;
    }
    S[k] = chk.checked; saveSettings(); render();
  }

  function onKey(e) {
    if (!root) return;
    const tag = (e.target.tagName || "").toUpperCase();
    if (e.key === "Enter" && e.target.dataset && e.target.dataset.act === "mark") { e.target.click(); return; }
    if (["INPUT", "SELECT", "TEXTAREA"].includes(tag) || !article || st.paywall) { if (e.key === "Escape") close(); return; }
    if (e.key === "Escape") close();
    else if (S.focus && !st.original && e.key === "ArrowRight" && st.chunk < N()) { go(st.chunk + 1); render("next"); }
    else if (S.focus && !st.original && e.key === "ArrowLeft" && st.chunk > -1) { go(st.chunk - 1); render("prev"); }
    else if ((e.key === "o" || e.key === "O") && tag !== "BUTTON") { st.original = !st.original; st.hl = null; render(); }
  }

  // ---------- lifecycle ----------
  async function open() {
    if (host) close();
    st.fail = "";
    try {
      await loadSettings();
      Object.assign(st, { chunk: -1, original: false, rewrites: {}, showOrig: new Set(), openSrc: new Set(), openSec: new Set([0]), busy: false, aiMsg: "", panel: false, marks: new Set(), paywall: false, finished: false, celebrate: false, streak: null });
      rewriter = null; model = null;
      BR.loadFonts().then((ok) => { if (ok && root) render(); }).catch(() => {});
      article = extract();
      st.premium = true; st.plan = "open"; st.left = Infinity;
      if (article) { analyze(); if (!S.focus) st.chunk = 0; }
      if (S.ai && (!st.premium || !model)) S.ai = false;
      if (S.ai) { try { await initAI(); } catch (e) { S.ai = false; st.aiMsg = e.message; } }
    } catch (e) {
      // Never leave the reader with a blank page: show what went wrong.
      console.error("[Speakmi]", e);
      article = null; model = null;
      st.fail = (e && e.message) ? e.message : String(e);
    }
    host = document.createElement("div");
    host.id = "speakmi-host";
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;";
    root = host.attachShadow({ mode: "open" });
    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    document.addEventListener("keydown", onKey, true);
    prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.appendChild(host);
    try { render(); } catch (e) {
      console.error("[Speakmi]", e);
      st.fail = (e && e.message) ? e.message : String(e); article = null; model = null;
      try { render(); } catch (e2) { close(); throw e2; }
    }
    const m = root.querySelector(".main"); if (m) m.focus();
  }

  function close() {
    if (!host) return;
    document.removeEventListener("keydown", onKey, true);
    host.remove(); host = null; root = null;
    document.documentElement.style.overflow = prevOverflow;
  }

  window.__speakmi = { open, close, toggle: () => (host ? close() : open()) };
})();
