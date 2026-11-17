/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
/* Run: node tests/ai.test.js   (no dependencies, no browser, no model: the model is replaced by a mock) */
const E = require("../content/engine.js");
const LA = require("../content/localai.js");
const BG = require("../background/ai.js");
const manifest = require("../manifest.json");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const types = (r) => r.rejected.map((i) => i.type);

(async () => {
  // ---- prompts and clean-up ----
  ok(LA.buildPrompt("en", "Hello.").includes("Hello."), "prompt contains the sentence (en)");
  ok(LA.buildPrompt("de", "Hallo.").startsWith("Schreibe"), "German prompt is in German");
  ok(LA.buildPrompt("id", "Halo.").startsWith("Tulis ulang"), "Indonesian prompt is in Indonesian");
  ok(LA.buildPrompt("xx", "Hi.").includes("plain, simple English"), "unknown language falls back to English prompt");
  ok(LA.cleanOutput('  "The fee is 30 euros."  ') === "The fee is 30 euros.", "quotes stripped");
  ok(LA.cleanOutput("Sentence: The fee is 30 euros.") === "The fee is 30 euros.", "label stripped");
  ok(LA.cleanOutput("- The fee is 30 euros.\nExtra line") === "The fee is 30 euros.", "bullet and extra lines stripped");
  ok(LA.cleanOutput(null) === "" && LA.cleanOutput(undefined) === "", "null output is empty");

  // ---- gating: a rewrite is shown ONLY if it passes every check; otherwise the original is kept ----
  const G = (src, out, lang) => LA.gate(E, src, out, lang || "en");
  {
    const src = "The committee will convene on 14 March to examine the proposal.";
    const r = G(src, "The committee will meet on 14 March to look at the proposal.");
    ok(r.accepted && !r.same && r.text.includes("meet"), "faithful rewrite accepted");
  }
  {
    const src = "The fee is 30 euros and it is paid every month.";
    const r = G(src, "The fee is 13 euros and it is paid every month.");
    ok(!r.accepted && r.same && r.text === src && types(r).includes("number-added"), "changed number: rejected, ORIGINAL returned");
  }
  {
    const src = "The drug does not reduce the risk of stroke in older adults.";
    const r = G(src, "The drug reduces the risk of stroke in older adults.");
    ok(!r.accepted && r.text === src && types(r).includes("negation-changed"), "dropped negation: rejected, ORIGINAL returned");
  }
  {
    const src = "The mayor spoke about the new bridge on Monday morning.";
    const r = G(src, "Mayor Smith spoke about the new bridge on Monday morning.");
    ok(!r.accepted && r.text === src && types(r).includes("name-added"), "invented name: rejected, ORIGINAL returned");
  }
  {
    const src = "The library opens early so that students can study before class starts.";
    const r = G(src, "The library opens early so that students can study before class starts, and the library also has a very large collection of rare books, maps, letters and manuscripts from many different countries.");
    ok(!r.accepted && r.text === src && types(r).includes("too-long"), "padded output: rejected");
  }
  {
    const src = "Regular exercise improves sleep quality and lowers stress levels in adults.";
    const r = G(src, "Football match yesterday ended after penalties.");
    ok(!r.accepted && r.text === src && (types(r).includes("off-topic") || types(r).includes("too-short")), "unrelated output: rejected");
  }
  {
    const src = "Regular exercise improves sleep quality and lowers stress levels in adults.";
    ok(G(src, "").same && !G(src, "").accepted, "empty output: original kept");
    ok(G(src, src).same && G(src, src).rejected.length === 0, "identical output: no change, not counted as rejected");
    const echo = G(src, LA.buildPrompt("en", src));
    ok(!echo.accepted && echo.text === src, "echoed instruction is rejected");
  }
  {
    const src = "Biayanya 5.000 rupiah per bulan untuk semua anggota.";
    const r = G(src, "Biayanya 7.000 rupiah per bulan untuk semua anggota.", "id");
    ok(!r.accepted && r.text === src && types(r).includes("number-added"), "ID: changed number rejected");
    const g = G("Das Rad ist nicht frei und kostet Geld für alle Nutzer.", "Das Rad ist frei und kostet Geld für alle Nutzer.", "de");
    ok(!g.accepted && types(g).includes("negation-changed"), "DE: dropped negation rejected");
  }

  // ---- client with a mock Firefox backend ----
  const mk = (over) => {
    const calls = [];
    const send = async (m) => {
      calls.push(m);
      if (over && over[m.op]) return over[m.op](m);
      if (m.op === "status") return { state: "ready", backend: "firefox", langs: ["en"], model: { id: "mock" } };
      if (m.op === "init") return { state: "ready" };
      if (m.op === "rewrite") return { text: "The committee will meet on 14 March to look at the proposal." };
    };
    return { calls, c: LA.createClient({ E, send }) };
  };
  {
    const { c } = mk();
    await c.init("en");
    const r = await c.rewrite("The committee will convene on 14 March to examine the proposal.", "en");
    ok(r.accepted && c.mode === "firefox", "client: init + rewrite through the mock model");
  }
  {
    const { c, calls } = mk({ rewrite: () => ({ text: "The committee will meet on 15 March to look at the proposal." }) });
    await c.init("en");
    const src = "The committee will convene on 14 March to examine the proposal.";
    const r = await c.rewrite(src, "en");
    ok(!r.accepted && r.text === src, "client: model that changes a number never reaches the reader");
    ok(calls.some((x) => x.op === "rewrite" && x.prompt.includes(src)), "client: the prompt was built from the source sentence");
  }
  {
    const { c } = mk({ status: () => ({ state: "no-permission", langs: ["en"] }) });
    let err = null; try { await c.init("en"); } catch (e) { err = e; }
    ok(err && err.state === "no-permission", "client: no permission is reported, nothing is downloaded");
  }
  {
    const { c } = mk({ status: () => ({ state: "no-api", hint: "flags", langs: ["en"] }) });
    let err = null; try { await c.init("en"); } catch (e) { err = e; }
    ok(err && err.state === "no-api" && err.hint === "flags", "client: missing API gives the about:config hint");
  }
  {
    const { c, calls } = mk();
    let err = null; try { await c.init("de"); } catch (e) { err = e; }
    ok(err && err.state === "lang" && !calls.some((x) => x.op === "init"), "client: unsupported language stays extractive and starts no download");
  }
  {
    const c = LA.createClient({ E, send: async () => { throw new Error("no background"); } });
    ok((await c.status()).state === "no-api", "client: no background page means AI is simply unavailable");
    let err = null; try { await c.rewrite("x", "en"); } catch (e) { err = e; }
    ok(!!err, "client: rewrite before init is refused");
  }
  {
    // browser-provided Rewriter (not in Firefox) still goes through the same gate
    const builtin = { Rewriter: { availability: async () => "available", create: async () => ({ rewrite: async () => "The fee is 99 euros and it is paid every month." }) } };
    const c = LA.createClient({ E, send: null, builtin });
    await c.init("en");
    const src = "The fee is 30 euros and it is paid every month.";
    const r = await c.rewrite(src, "en");
    ok(c.mode === "builtin" && !r.accepted && r.text === src, "built-in Rewriter output is gated too");
  }

  // ---- background handler with a fake browser.trial.ml ----
  const fakeApi = (opts) => {
    const log = { created: [], ran: [], deleted: 0, progress: null, sent: [] };
    const api = {
      permissions: { contains: async () => opts.permitted !== false },
      tabs: { sendMessage: async (id, m) => { log.sent.push([id, m]); } },
      trial: opts.noMl ? undefined : { ml: {
        createEngine: async (a) => { if (opts.createFails) throw new Error("model not allowed"); log.created.push(a); },
        runEngine: async (a) => { log.ran.push(a); return [{ generated_text: opts.answer || "OK." }]; },
        deleteCachedModels: async () => { log.deleted++; },
        onProgress: { addListener: (f) => { log.progress = f; } }
      } }
    };
    return { api, log };
  };
  {
    const { api } = fakeApi({ permitted: false });
    const h = BG.createHandler(api);
    ok((await h.handle({ speakmi: "ai", op: "status" }, {})).state === "no-permission", "background: not permitted");
    ok((await h.handle({ speakmi: "ai", op: "init" }, {})).state === "no-permission", "background: init refused without permission (no download)");
  }
  {
    const { api } = fakeApi({ noMl: true });
    const h = BG.createHandler(api);
    const s = await h.handle({ speakmi: "ai", op: "status" }, {});
    ok(s.state === "no-api" && s.hint === "flags", "background: permitted but API off gives the flags hint");
  }
  {
    const { api, log } = fakeApi({ answer: "The committee will meet." });
    const h = BG.createHandler(api); h.listenProgress(); h.listenProgress();
    const r = await h.handle({ speakmi: "ai", op: "init" }, { tab: { id: 7 } });
    ok(r.state === "ready" && log.created.length === 1, "background: engine created once");
    ok(log.created[0].modelHub === "huggingface" && /^Xenova\//.test(log.created[0].modelId), "background: model comes from an organisation Firefox allows (Xenova)");
    const t = await h.handle({ speakmi: "ai", op: "rewrite", prompt: "p" }, { tab: { id: 7 } });
    ok(t.text === "The committee will meet." && log.ran[0].args[0] === "p", "background: rewrite returns the generated text");
    log.progress({ progress: 50 });
    await new Promise((res) => setTimeout(res, 5));
    ok(log.sent.length === 1 && log.sent[0][0] === 7 && log.sent[0][1].speakmi === "ai-progress", "background: progress is forwarded to the tab that started it, once");
    ok((await h.handle({ speakmi: "ai", op: "delete" }, {})).state === "deleted" && log.deleted === 1, "background: cached model can be deleted");
    ok((await h.handle({ speakmi: "other" }, {})) === undefined, "background: ignores messages that are not for it");
  }
  {
    const { api } = fakeApi({ createFails: true });
    const h = BG.createHandler(api);
    const r = await h.handle({ speakmi: "ai", op: "init" }, {});
    ok(r.state === "error" && /not allowed/.test(r.error), "background: engine failure is reported, not thrown");
    const t = await h.handle({ speakmi: "ai", op: "rewrite", prompt: "p" }, {});
    ok(!!t.error, "background: rewrite after failed init returns an error");
  }

  {
    const { c } = mk({ init: () => ({ state: "error", error: "model not allowed", hint: "flags" }) });
    let err = null; try { await c.init("en"); } catch (e) { err = e; }
    ok(err && err.state === "error" && err.hint === "flags" && /not allowed/.test(err.message), "client: an init error keeps Firefox's message and the flags hint");
  }
  // ---- self-test, engine retry, flags hint ----
  {
    const { api } = fakeApi({ permitted: false });
    const r = await BG.createHandler(api).handle({ speakmi: "ai", op: "selftest" }, {});
    ok(r.steps.length === 1 && !r.steps[0].ok && /Allow on-device AI/.test(r.steps[0].detail), "selftest: stops at the permission step and says what to click");
  }
  {
    const { api } = fakeApi({ noMl: true });
    const r = await BG.createHandler(api).handle({ speakmi: "ai", op: "selftest" }, {});
    ok(r.steps.length === 2 && !r.steps[1].ok && /browser\.ml\.enable/.test(r.steps[1].detail), "selftest: stops at the missing API and names the flags");
  }
  {
    const { api } = fakeApi({ createFails: true });
    const r = await BG.createHandler(api).handle({ speakmi: "ai", op: "selftest" }, {});
    ok(r.steps.length === 3 && !r.steps[2].ok && /not allowed/.test(r.steps[2].detail), "selftest: reports the model step error text");
  }
  {
    const { api } = fakeApi({ answer: "The committee will meet on 14 March." });
    const r = await BG.createHandler(api).handle({ speakmi: "ai", op: "selftest" }, {});
    ok(r.steps.length === 4 && r.steps.every((x) => x.ok) && /committee will meet/.test(r.steps[3].detail), "selftest: all steps pass and the raw model answer is shown");
  }
  {
    // Firefox may drop the engine when memory is low: one retry with a fresh engine
    const { api, log } = fakeApi({ answer: "Fine." });
    let first = true; const run0 = api.trial.ml.runEngine;
    api.trial.ml.runEngine = async (a) => { if (first) { first = false; throw new Error("engine was deleted"); } return run0(a); };
    const h = BG.createHandler(api);
    const t = await h.handle({ speakmi: "ai", op: "rewrite", prompt: "p" }, {});
    ok(t.text === "Fine." && log.created.length === 2, "background: a dropped engine is created again and the rewrite is retried once");
  }
  {
    const { api } = fakeApi({ createFails: true });
    const r = await BG.createHandler(api).handle({ speakmi: "ai", op: "init" }, {});
    ok(r.state === "error" && r.hint === "flags", "background: a not-allowed error carries the flags hint");
  }

  {
    // a model download that never finishes ends in a readable error
    const { api } = fakeApi({});
    api.trial.ml.createEngine = () => new Promise(() => {});
    const h = BG.createHandler(api, { timeoutMs: 30 });
    const r = await h.handle({ speakmi: "ai", op: "selftest" }, {});
    ok(r.steps.length === 3 && !r.steps[2].ok && /timed out/.test(r.steps[2].detail), "selftest: a stuck download times out with a clear message");
  }

  {
    // Firefox answers "Engine already created" when an engine from an earlier attempt exists: reuse it
    const { api, log } = fakeApi({ answer: "Fine." });
    api.trial.ml.createEngine = async () => { throw new Error("Engine already created"); };
    const h = BG.createHandler(api);
    const i = await h.handle({ speakmi: "ai", op: "init" }, {});
    ok(i.state === "ready", "background: \"Engine already created\" counts as ready");
    const t = await h.handle({ speakmi: "ai", op: "rewrite", prompt: "p" }, {});
    ok(t.text === "Fine." && log.ran.length === 1, "background: the existing engine is used for the rewrite");
    const r = await BG.createHandler(api).handle({ speakmi: "ai", op: "selftest" }, {});
    ok(r.steps.length === 4 && r.steps.every((x) => x.ok) && /already loaded/.test(r.steps[2].detail), "selftest: passes with an engine that already exists");
  }

  // ---- manifest and privacy invariants ----
  ok(JSON.stringify(manifest.optional_permissions) === '["trialML"]', "manifest: only optional permission is trialML");
  ok(!(manifest.permissions || []).includes("trialML"), "manifest: trialML is NOT a required permission");
  ok(!manifest.host_permissions, "manifest: still no host permissions");
  ok(JSON.stringify(manifest.browser_specific_settings.gecko.data_collection_permissions.required) === '["none"]', "manifest: still declares no data collection");
  ok((manifest.background.scripts || []).join() === "background/ai.js", "manifest: one background script");
  ok(BG.MODELS.list[BG.MODELS.active].langs.every((l) => ["en", "de", "id"].includes(l)), "registry: languages are valid");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
