/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
/*
 * Speakmi local AI client.
 *
 * Talks to a small on-device model and puts EVERY output behind the fidelity checks.
 * No network access here: inference happens in Firefox's own AI runtime (see background/ai.js),
 * or in a browser-provided Rewriter if one exists. Pure logic, so it also runs in Node for tests.
 *
 * Rule: a rewrite is shown only if it passes (1) verifyPoint (numbers, names, negations)
 * and (2) the shape guards below. Otherwise the reader sees the ORIGINAL sentence.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SpeakmiLocalAI = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // One instruction per language. Small models follow short, literal instructions best.
  const PROMPTS = {
    en: (t) => "Rewrite this sentence in plain, simple English. Keep every number, name and the same meaning. Do not add anything. Sentence: " + t,
    de: (t) => "Schreibe diesen Satz in einfacher Sprache neu. Behalte alle Zahlen, Namen und die gleiche Bedeutung. Füge nichts hinzu. Satz: " + t,
    id: (t) => "Tulis ulang kalimat ini dengan bahasa Indonesia yang sederhana. Pertahankan semua angka, nama, dan maknanya. Jangan menambahkan apa pun. Kalimat: " + t
  };

  // Shape guards. Defaults are conservative and are to be calibrated on the evaluation set (WP2).
  const GUARD = { minRatio: 0.4, maxRatio: 1.6, maxSentences: 2, minOverlap: 0.25 };

  const wordsOf = (s) => (String(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
  const contentSet = (s) => new Set(wordsOf(s).filter((w) => w.length >= 4));

  function buildPrompt(lang, text) {
    return (PROMPTS[lang] || PROMPTS.en)(text);
  }

  // Models sometimes echo the instruction, add quotes, bullets or labels. Keep only the sentence.
  function cleanOutput(raw) {
    let s = String(raw == null ? "" : raw).replace(/\r/g, "").trim();
    s = s.split("\n").map((l) => l.trim()).filter(Boolean)[0] || "";
    s = s.replace(/^(?:[-*•>]+|\d+[.)])\s+/, "")
      .replace(/^(?:sentence|satz|kalimat|rewritten|output|answer|antwort|jawaban)\s*:\s*/i, "")
      .replace(/^["“„«'‘]+|["”“»'’]+$/g, "")
      .trim();
    return s;
  }

  // Returns [] when the shape is acceptable, else a list of issue objects (same shape as verifyPoint issues).
  function shapeIssues(src, out, opts) {
    const g = Object.assign({}, GUARD, opts || {});
    const issues = [];
    const sw = wordsOf(src).length, ow = wordsOf(out).length;
    if (!ow) return [{ type: "empty", value: "" }];
    if (sw && ow / sw < g.minRatio) issues.push({ type: "too-short", value: ow + "/" + sw });
    if (sw && ow / sw > g.maxRatio) issues.push({ type: "too-long", value: ow + "/" + sw });
    const sentences = (out.match(/[.!?…。]+(\s|$)/g) || []).length || 1;
    if (sentences > g.maxSentences) issues.push({ type: "too-many-sentences", value: String(sentences) });
    const a = contentSet(src), b = contentSet(out);
    if (a.size >= 4 && b.size) {
      let hit = 0; for (const w of b) if (a.has(w)) hit++;
      // Plain-language rewriting swaps words, so only demand a modest overlap with the source.
      if (hit / Math.min(a.size, b.size) < g.minOverlap) issues.push({ type: "off-topic", value: hit + "/" + Math.min(a.size, b.size) });
    }
    return issues;
  }

  /*
   * Gate one model output against its source sentence.
   * Returns { text, same, accepted, v, rejected }:
   *  - accepted: the rewrite passed every check; `text` is the rewrite.
   *  - otherwise `text` is the ORIGINAL sentence, `same` is true and `rejected` lists why.
   */
  function gate(E, src, rawOut, lang, opts) {
    const out = cleanOutput(rawOut);
    if (!out || out.trim() === src.trim()) return { text: src, same: true, accepted: false, v: { ok: true, issues: [] }, rejected: [] };
    const v = E.verifyPoint([src], out, lang, { mode: "rewrite" });
    const shape = shapeIssues(src, out, opts);
    const all = v.issues.concat(shape);
    if (all.length) return { text: src, same: true, accepted: false, v: { ok: false, issues: all }, rejected: all, candidate: out };
    return { text: out, same: false, accepted: true, v: { ok: true, issues: [] }, rejected: [] };
  }

  /*
   * Client. `send(msg)` reaches the background page (Firefox AI runtime); it returns a Promise.
   * `builtin` is an optional browser-provided Rewriter (e.g. Chrome); Firefox has none.
   */
  function createClient(deps) {
    const E = deps.E, send = deps.send, builtin = deps.builtin || null;
    let mode = null, rewriter = null, info = null;

    async function status() {
      if (send) {
        try { const r = await send({ op: "status" }); if (r && r.state) { info = r; return r; } } catch (e) { /* no background */ }
      }
      if (builtin && "Rewriter" in builtin) {
        try { const av = await builtin.Rewriter.availability(); if (av !== "unavailable") return { state: "ready", backend: "builtin", langs: ["en"], model: { id: "browser built-in" } }; } catch (e) { /* none */ }
      }
      return { state: "no-api" };
    }

    async function init(lang, onProgress) {
      const st = await status();
      if (st.state === "no-api" || st.state === "no-permission") { const e = new Error(st.state); e.state = st.state; e.hint = st.hint; throw e; }
      if (st.langs && st.langs.indexOf(lang) < 0) { const e = new Error("lang"); e.state = "lang"; throw e; }
      if (st.backend === "builtin") {
        rewriter = await builtin.Rewriter.create({ tone: "as-is", format: "plain-text", length: "as-is",
          sharedContext: "Rewrite in plain, simple language. Keep every number, name and negation exactly as in the source." });
        mode = "builtin"; return st;
      }
      if (onProgress) client.onProgress = onProgress;
      const r = await send({ op: "init" });
      if (!r || r.state !== "ready") { const e = new Error((r && r.error) || "init"); e.state = (r && r.state) || "error"; e.hint = r && r.hint; throw e; }
      mode = "firefox"; info = r; return r;
    }

    async function rewrite(src, lang) {
      let raw;
      if (mode === "builtin") raw = await rewriter.rewrite(src);
      else if (mode === "firefox") {
        const r = await send({ op: "rewrite", prompt: buildPrompt(lang, src) });
        if (!r || r.error) throw new Error((r && r.error) || "no answer");
        raw = r.text;
      } else throw new Error("not initialised");
      return gate(E, src, raw, lang);
    }

    const client = { status, init, rewrite, onProgress: null, get mode() { return mode; }, get info() { return info; }, reset() { mode = null; rewriter = null; } };
    return client;
  }

  return { buildPrompt, cleanOutput, shapeIssues, gate, createClient, GUARD, PROMPTS };
});
