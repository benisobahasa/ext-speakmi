/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
/*
 * Speakmi engine: pure functions, no DOM access except blocksFromHTML (takes a DOMParser).
 * Runs on the device. No network calls. Works in the browser and in Node (for tests).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SpeakmiEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const W = (s) => new Set(s.split(/\s+/).filter(Boolean));

  const STOP = {
    en: W("the a an and or but if of to in on at by for with from as is are was were be been being it its this that these those he she they we you i his her their our your not no do does did have has had will would can could should may might than then so such into over under about also more most other some any each which who whom whose what when where why how there here"),
    de: W("der die das den dem des ein eine einen einem einer eines und oder aber wenn von zu in im an am auf aus bei mit nach vor für als ist sind war waren sein wird werden wurde wurden hat haben hatte nicht kein keine es sie er wir ihr ich du sich auch noch nur dass wie was wer wo wann warum dann so zum zur um über unter durch gegen ohne bis"),
    id: W("yang dan di ke dari untuk dengan pada dalam adalah itu ini atau juga tidak akan telah sudah belum bisa dapat oleh sebagai karena saat ketika jika agar serta lebih sangat para kita kami mereka dia ia saya anda nya pun lah kah hanya masih ada apa siapa mana bagi antara tentang hingga sampai tanpa bukan")
  };

  const NEG = {
    en: W("not no never none neither nor cannot without nobody nothing nowhere"),
    de: W("nicht kein keine keinen keinem keiner nie niemals ohne nichts niemand nirgends"),
    id: W("tidak bukan belum tanpa jangan tiada nihil")
  };

  const NUMWORDS = {
    en: W("two three four five six seven eight nine ten eleven twelve twenty thirty forty fifty hundred thousand million billion half double triple"),
    de: W("zwei drei vier fünf sechs sieben acht neun zehn elf zwölf zwanzig dreißig vierzig fünfzig hundert tausend million millionen milliarde halb"),
    id: W("dua tiga empat lima enam tujuh delapan sembilan sepuluh sebelas puluh seratus ribu juta miliar setengah")
  };

  const ABBR = W("mr. mrs. ms. dr. prof. st. no. vs. etc. e.g. i.e. inc. ltd. jr. sr. fig. approx. ca. z.b. d.h. bzw. usw. u.a. nr. hr. fr. dll. dsb. dst. yg. tgl. hlm. ir.");

  // Seed lexicons. Small on purpose: hints are guidance, the pilot will refine them.
  const SIMPLER = {
    en: {
      "utilize": "use", "utilise": "use", "commence": "start", "terminate": "end", "approximately": "about",
      "subsequently": "later", "consequently": "so", "nevertheless": "but", "furthermore": "also",
      "additionally": "also", "demonstrate": "show", "indicate": "show", "facilitate": "help",
      "numerous": "many", "sufficient": "enough", "obtain": "get", "individuals": "people",
      "endeavour": "try", "assist": "help", "regarding": "about", "prior to": "before",
      "subsequent to": "after", "in order to": "to", "due to the fact that": "because", "a number of": "some",
      "with regard to": "about", "is able to": "can", "in the event that": "if", "modify": "change",
      "optimal": "best", "in conjunction with": "with", "at this point in time": "now",
      "ameliorate": "improve", "exacerbate": "make worse", "mitigate": "reduce", "ascertain": "find out",
      "whereas": "while", "hence": "so", "albeit": "although", "myriad": "many", "plethora": "a lot"
    },
    de: {
      "jedoch": "aber", "dennoch": "trotzdem", "folglich": "deshalb", "bezüglich": "zu", "ausschließlich": "nur",
      "gegebenenfalls": "wenn nötig", "darüber hinaus": "außerdem", "insbesondere": "vor allem",
      "demzufolge": "deshalb", "erforderlich": "nötig", "mittels": "mit", "hinsichtlich": "zu",
      "zeitnah": "bald", "bereitstellen": "geben", "durchführen": "machen", "aufgrund": "wegen"
    },
    id: {
      "mengimplementasikan": "menjalankan", "memfasilitasi": "membantu", "signifikan": "besar",
      "optimal": "terbaik", "komprehensif": "menyeluruh", "kendati": "meskipun", "sehubungan dengan": "tentang",
      "dikarenakan": "karena", "mengakomodasi": "menampung", "dewasa ini": "sekarang", "tatkala": "ketika",
      "lazimnya": "biasanya", "sesungguhnya": "sebenarnya", "mengaplikasikan": "menggunakan", "esensial": "penting"
    }
  };

  const IDIOMS = {
    en: {
      "break the ice": "start a conversation in a social situation", "piece of cake": "very easy",
      "under the weather": "slightly ill", "spill the beans": "reveal a secret",
      "hit the nail on the head": "describe something exactly", "blessing in disguise": "something that seems bad but turns out good",
      "an arm and a leg": "a lot of money", "once in a blue moon": "very rarely",
      "the ball is in your court": "it is your turn to decide or act", "on the same page": "in agreement",
      "bite the bullet": "accept something unpleasant", "back to square one": "back to the start",
      "tip of the iceberg": "a small visible part of a larger problem", "low-hanging fruit": "the easiest tasks",
      "game changer": "something that changes how things work", "raining cats and dogs": "raining heavily",
      "in the same boat": "in the same situation", "think outside the box": "think in new ways",
      "hit the road": "start a journey", "call it a day": "stop working for now"
    },
    de: {
      "ein katzensprung": "sehr nah", "nur bahnhof": "nichts verstehen", "daumen drücken": "jemandem Glück wünschen",
      "tomaten auf den augen": "etwas Offensichtliches nicht sehen", "den nagel auf den kopf treffen": "etwas genau beschreiben",
      "unter die lupe nehmen": "genau untersuchen", "auf der hand liegen": "offensichtlich sein", "ins wasser fallen": "nicht stattfinden",
      "das eis brechen": "ein Gespräch beginnen", "kinderspiel": "sehr einfach"
    },
    id: {
      "banting tulang": "bekerja sangat keras", "angkat tangan": "menyerah", "kepala dingin": "tenang",
      "panjang tangan": "suka mencuri", "cuci mata": "melihat hal-hal yang indah", "gulung tikar": "bangkrut",
      "tangan besi": "kekuasaan yang keras", "buah tangan": "oleh-oleh", "sekali dayung": "satu usaha untuk banyak tujuan",
      "angin segar": "kabar baik", "bunga desa": "perempuan paling cantik di desa"
    }
  };

  // Profile presets. Defaults are conservative and tied to the evidence labels in the UI.
  const PROFILES = {
    adhd:     { chunk: { maxSentences: 3, maxWords: 55 }, wpm: 190, tldr: 3, bullets: true, literalInline: false, spacing: false },
    dyslexia: { chunk: { maxSentences: 4, maxWords: 80 }, wpm: 150, tldr: 3, bullets: true, literalInline: false, spacing: true },
    autism:   { chunk: { maxSentences: 4, maxWords: 90 }, wpm: 190, tldr: 4, bullets: true, literalInline: true, spacing: false },
    mixed:    { chunk: { maxSentences: 3, maxWords: 60 }, wpm: 160, tldr: 3, bullets: true, literalInline: false, spacing: true },
    general:  { chunk: { maxSentences: 5, maxWords: 110 }, wpm: 220, tldr: 4, bullets: false, literalInline: false, spacing: false }
  };

  const ENUM = /^(first(ly)?|second(ly)?|third(ly)?|finally|lastly|next|then|erstens|zweitens|drittens|schlie(ß|ss)lich|zuerst|zun(ä|ae)chst|pertama|kedua|ketiga|terakhir|selanjutnya)\b/i;

  const tokens = (t) => (t.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu) || []);
  const countWords = (t) => (t.match(/[\p{L}\p{N}]+/gu) || []).length;
  const stopFor = (lang) => STOP[lang] || STOP.en;

  function detectLang(text) {
    const toks = tokens(text).slice(0, 600);
    let best = "en", bestN = 0;
    for (const l of ["en", "de", "id"]) {
      let n = 0;
      for (const w of toks) if (STOP[l].has(w)) n++;
      if (n > bestN) { bestN = n; best = l; }
    }
    return bestN >= 3 ? best : "en";
  }

  function splitSentences(text, lang) {
    text = (text || "").replace(/\s+/g, " ").trim();
    if (!text) return [];
    let parts;
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const seg = new Intl.Segmenter(lang || "en", { granularity: "sentence" });
      parts = Array.from(seg.segment(text), (x) => x.segment.trim());
    } else {
      parts = (text.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) || [text]).map((s) => s.trim());
    }
    const out = [];
    for (const p of parts) {
      if (!p) continue;
      const prev = out[out.length - 1];
      if (prev) {
        const last = prev.split(" ").pop().toLowerCase();
        if (ABBR.has(last) || /^[a-z]\.$/i.test(last)) { out[out.length - 1] = prev + " " + p; continue; }
      }
      out.push(p);
    }
    return out;
  }

  // ---------- fidelity layer ----------
  function numbersIn(text, lang) {
    const out = new Set();
    const re = /\d+(?:[.,:]\d+)*/g;
    let m;
    while ((m = re.exec(text))) out.add(m[0].replace(/[.,:]+$/, ""));
    const nw = NUMWORDS[lang] || NUMWORDS.en;
    for (const t of tokens(text)) if (nw.has(t)) out.add(t);
    return out;
  }

  function entitiesIn(text, lang) {
    if (lang === "de") return new Set(); // German capitalises all nouns, so the check would be noise
    const out = new Set();
    const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu) || [];
    words.forEach((w, i) => {
      if (/^\p{Lu}{2,}$/u.test(w)) out.add(w.toLowerCase());
      else if (i > 0 && /^\p{Lu}/u.test(w) && w.length > 1) out.add(w.toLowerCase());
    });
    return out;
  }

  function negCount(text, lang) {
    const set = NEG[lang] || NEG.en;
    let c = 0;
    for (const w of tokens(text)) {
      if (set.has(w)) c++;
      else if ((lang || "en") === "en" && /n['’]t$/.test(w)) c++;
    }
    return c;
  }

  /*
   * Verify an output sentence against the source sentence(s) it is anchored to.
   * mode "rewrite": same meaning expected, so numbers and negations must match exactly.
   * mode "summary": shorter text expected, so nothing may be added that the source lacks.
   */
  function verifyPoint(anchorTexts, outputText, lang, opts) {
    const mode = (opts && opts.mode) || "rewrite";
    const src = anchorTexts.join(" ");
    const issues = [];
    const sn = numbersIn(src, lang), on = numbersIn(outputText, lang);
    for (const n of on) if (!sn.has(n)) issues.push({ type: "number-added", value: n });
    if (mode === "rewrite") for (const n of sn) if (!on.has(n)) issues.push({ type: "number-missing", value: n });
    const se = entitiesIn(src, lang), oe = entitiesIn(outputText, lang);
    for (const e of oe) if (!se.has(e)) issues.push({ type: "name-added", value: e });
    const sneg = negCount(src, lang), oneg = negCount(outputText, lang);
    if (mode === "rewrite" && sneg !== oneg) issues.push({ type: "negation-changed", value: sneg + " to " + oneg });
    if (mode === "summary" && oneg > 0 && sneg === 0) issues.push({ type: "negation-added", value: String(oneg) });
    return { ok: issues.length === 0, issues };
  }

  // ---------- hints and idioms ----------
  const reCache = {};
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function lexRegex(lang) {
    if (reCache[lang]) return reCache[lang];
    const idioms = IDIOMS[lang] || {}, hints = SIMPLER[lang] || {};
    const all = [...Object.keys(idioms), ...Object.keys(hints)].sort((a, b) => b.length - a.length);
    reCache[lang] = all.length ? new RegExp("(?<![\\p{L}\\p{N}])(" + all.map(esc).join("|") + ")(?![\\p{L}\\p{N}])", "giu") : null;
    return reCache[lang];
  }

  function annotate(text, lang, opts) {
    const re = lexRegex(lang);
    const segs = [];
    if (!re || !opts || (!opts.hints && !opts.idioms)) return [{ t: "text", v: text }];
    const idioms = IDIOMS[lang] || {}, hints = SIMPLER[lang] || {};
    let last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      const key = m[1].toLowerCase();
      let seg = null;
      if (idioms[key] && opts.idioms) seg = { t: "idiom", v: m[1], tip: idioms[key] };
      else if (hints[key] && opts.hints) seg = { t: "hint", v: m[1], tip: hints[key] };
      if (!seg) continue;
      if (m.index > last) segs.push({ t: "text", v: text.slice(last, m.index) });
      segs.push(seg);
      last = m.index + m[1].length;
    }
    if (last < text.length) segs.push({ t: "text", v: text.slice(last) });
    return segs.length ? segs : [{ t: "text", v: text }];
  }

  // ---------- structure ----------
  function keywords(ids, sent, lang, k) {
    const tf = {}, stop = stopFor(lang);
    ids.forEach((id) => tokens(sent[id].text).forEach((w) => {
      if (w.length > 3 && !stop.has(w) && !/^\d/.test(w)) tf[w] = (tf[w] || 0) + 1;
    }));
    return Object.entries(tf).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, k).map((x) => x[0]);
  }

  function groupSentences(ids, sent, maxS, maxW) {
    const groups = []; let cur = [], words = 0;
    for (const id of ids) {
      cur.push(id); words += sent[id].words;
      if (cur.length >= maxS || words >= maxW) { groups.push(cur); cur = []; words = 0; }
    }
    if (cur.length) groups.push(cur);
    // Balance a lonely last sentence (3+1 becomes 2+2) so no screen is almost empty.
    const n = groups.length;
    if (n >= 2 && groups[n - 1].length === 1 && groups[n - 2].length >= 2) {
      const moved = groups[n - 2][groups[n - 2].length - 1];
      const words = sent[moved].words + sent[groups[n - 1][0]].words;
      if (words <= maxW * 1.3) { groups[n - 2].pop(); groups[n - 1].unshift(moved); }
    }
    return groups;
  }

  function extractiveSummary(order, sent, mblocks, lang, k) {
    const stop = stopFor(lang), tf = {};
    order.forEach((id) => tokens(sent[id].text).forEach((w) => {
      if (w.length > 2 && !stop.has(w) && !/^\d+$/.test(w)) tf[w] = (tf[w] || 0) + 1;
    }));
    const firstOfBlock = new Set(mblocks.filter((b) => b.sentences.length).map((b) => b.sentences[0]));
    const scored = order.map((id, i) => {
      const toks = [...new Set(tokens(sent[id].text).filter((w) => tf[w]))];
      let sc = toks.reduce((a, w) => a + tf[w], 0) / (Math.sqrt(toks.length) + 1);
      if (i === 0) sc *= 1.3; else if (firstOfBlock.has(id)) sc *= 1.15;
      const w = sent[id].words;
      if (w < 7 || w > 45) sc *= 0.6;
      if (/\d/.test(sent[id].text)) sc *= 1.05;
      return { id, i, sc, toks: new Set(toks) };
    }).sort((a, b) => b.sc - a.sc);
    const chosen = [];
    for (const c of scored) {
      if (chosen.length >= k) break;
      const dup = chosen.some((x) => {
        let inter = 0; c.toks.forEach((t) => { if (x.toks.has(t)) inter++; });
        return inter / (c.toks.size + x.toks.size - inter || 1) > 0.5;
      });
      if (!dup) chosen.push(c);
    }
    return chosen.sort((a, b) => a.i - b.i).map((c) => c.id);
  }

  function analyze(blocks, opts) {
    opts = opts || {};
    const profile = PROFILES[opts.profile] || PROFILES.mixed;
    const tune = opts.tune || {};
    const lang = opts.lang && opts.lang !== "auto" ? opts.lang : detectLang(blocks.map((b) => b.text).join(" "));
    let n = 0;
    const sent = {}, order = [];
    const mblocks = blocks.map((b, bi) => {
      if (b.type === "h") return { type: "h", level: b.level || 2, text: b.text, sentences: [] };
      const ids = splitSentences(b.text, lang).map((t) => {
        const id = "s" + (++n);
        sent[id] = { id, idx: n - 1, text: t, words: countWords(t), block: bi };
        order.push(id);
        return id;
      });
      return { type: b.type, text: b.text, sentences: ids };
    });

    const delta = tune.maxSentences || 0;
    const maxS = Math.max(1, profile.chunk.maxSentences + delta);
    const maxW = Math.max(20, profile.chunk.maxWords + 12 * delta);

    let cur = { heading: null, level: 2, auto: false, chunks: [] };
    const sections = [cur];
    const pending = [];
    const push = (kind, units) => {
      const words = units.flat().reduce((a, id) => a + sent[id].words, 0);
      const c = { kind, units, words, seconds: Math.max(1, Math.round((words / profile.wpm) * 60)) };
      cur.chunks.push(c);
    };
    let listBuf = null;
    const flushList = () => {
      if (listBuf) { for (let k = 0; k < listBuf.length; k += 6) push("list", listBuf.slice(k, k + 6)); listBuf = null; }
    };

    for (const b of mblocks) {
      if (b.type === "h") {
        flushList();
        if (!cur.chunks.length && cur.heading === null && sections.length === 1) { cur.heading = b.text; cur.level = b.level; }
        else { cur = { heading: b.text, level: b.level, auto: false, chunks: [] }; sections.push(cur); }
        continue;
      }
      if (!b.sentences.length) continue;
      if (b.type === "li") { (listBuf = listBuf || []).push(b.sentences); continue; }
      flushList();
      const kind = b.type === "quote" ? "quote" : "prose";
      const enumCount = b.sentences.filter((id) => ENUM.test(sent[id].text)).length;
      if (kind === "prose" && profile.bullets && b.sentences.length >= 3 && enumCount >= 3) {
        for (let k = 0; k < b.sentences.length; k += 6) push("list", b.sentences.slice(k, k + 6).map((id) => [id]));
      } else groupSentences(b.sentences, sent, maxS, maxW).forEach((g) => push(kind, [g]));
    }
    flushList();

    let secs = sections.filter((s) => s.chunks.length);
    if (secs.length === 1 && secs[0].heading === null && secs[0].chunks.length > 6) {
      const all = secs[0].chunks, groups = [];
      for (let k = 0; k < all.length; k += 4) groups.push(all.slice(k, k + 4));
      secs = groups.map((g, gi) => {
        const kw = keywords(g.flatMap((c) => c.units.flat()), sent, lang, 3);
        return { heading: null, autoLabel: kw, autoIndex: gi + 1, level: 2, auto: true, chunks: g };
      });
    }
    const chunks = [];
    secs.forEach((s, si) => {
      s.seconds = 0;
      s.chunks.forEach((c) => { c.section = si; c.i = chunks.length; chunks.push(c); s.seconds += c.seconds; });
    });

    const tl = extractiveSummary(order, sent, mblocks, lang, Math.min(profile.tldr, order.length));
    const facts = [];
    for (const id of order) {
      const nums = [...numbersIn(sent[id].text, lang)].filter((x) => /\d/.test(x));
      if (nums.length) facts.push({ id, numbers: nums });
      if (facts.length >= 8) break;
    }
    return { lang, blocks: mblocks, sent, order, sections: secs, chunks, tldr: tl, facts, profile: opts.profile, cfg: profile };
  }

  function blocksFromHTML(html, DP) {
    const doc = new DP().parseFromString(html, "text/html");
    const out = [];
    doc.body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote").forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === "blockquote" && el.querySelector("p")) return;
      if (tag === "li" && el.querySelector("p")) return;
      let node = el;
      if (tag === "li" && el.querySelector("ul,ol")) {
        node = el.cloneNode(true);
        node.querySelectorAll("ul,ol").forEach((x) => x.remove());
      }
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return;
      if (/^h[1-6]$/.test(tag)) { if (text.length <= 200) out.push({ type: "h", level: +tag[1], text }); }
      else if (text.length >= 2) out.push({ type: tag === "li" ? "li" : tag === "blockquote" ? "quote" : "p", text });
    });
    return out;
  }

  return { analyze, blocksFromHTML, splitSentences, detectLang, verifyPoint, annotate, numbersIn, entitiesIn, negCount, tokens, countWords, PROFILES };
});
