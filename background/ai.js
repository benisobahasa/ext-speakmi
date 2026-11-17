/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
/*
 * Speakmi background page: the only place that touches Firefox's on-device AI runtime
 * (browser.trial.ml, an experimental WebExtensions API built on Transformers.js and ONNX).
 *
 *  - Speakmi makes NO network requests of its own. If a model is not cached yet, FIREFOX downloads it,
 *    once, after the reader has granted the optional "trialML" permission and switched the feature on.
 *  - The article text is passed to the local engine and never leaves the device.
 *  - Nothing here decides what the reader sees: every output is checked in content/localai.js.
 *
 * browser.trial.ml is a trial API (Firefox 134+; on release builds it needs about:config flags
 * browser.ml.enable and extensions.ml.enabled) and Firefox only lets extensions load models from its own hub
 * and the Hugging Face organisations "Mozilla" and "Xenova". Source: Firefox Source Docs, "WebExtensions AI API".
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else factory().register(root);
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /*
   * Model registry. Only `active` is used. The others document what WP2 evaluates.
   * `langs` are the languages the model is allowed to rewrite: anything else stays extractive.
   * flan-t5-small is the default model Firefox documents for "text2text-generation": it proves the pipeline
   * and gives an English baseline, but it is NOT expected to meet the quality bar for German or Bahasa Indonesia.
   */
  const MODELS = {
    active: "flan-t5-small",
    list: {
      "flan-t5-small": { taskName: "text2text-generation", modelHub: "huggingface", modelId: "Xenova/flan-t5-small", dtype: "q8", langs: ["en"], params: "0.08B", note: "Firefox's documented default for this task. English baseline." }
    },
    // Not usable through the trial API until their Hugging Face organisation is allowed by Mozilla,
    // or through a bundled runtime (see docs/AI-RUNTIME.md). Listed so the evaluation plan is explicit.
    planned: ["Qwen2.5-1.5B-Instruct", "Qwen2.5-0.5B-Instruct", "SmolLM2-360M-Instruct"]
  };

  const MAX_NEW_TOKENS = 96;

  function createHandler(api, opts) {
    const TIMEOUT = (opts && opts.timeoutMs) || 240000;
    const ml = () => (api && api.trial && api.trial.ml) || null;
    const cfg = () => MODELS.list[MODELS.active];
    let engineReady = false, queue = Promise.resolve(), progressTo = null, listening = false;

    const hasPermission = async () => {
      try { return !!(await api.permissions.contains({ permissions: ["trialML"] })); } catch (e) { return false; }
    };

    async function status() {
      const c = cfg(), model = { id: c.modelId, hub: c.modelHub, params: c.params };
      if (!(await hasPermission())) return { state: "no-permission", backend: "firefox", langs: c.langs, model };
      if (!ml()) return { state: "no-api", backend: "firefox", langs: c.langs, model, hint: "flags" };
      return { state: "ready", backend: "firefox", langs: c.langs, model, loaded: engineReady };
    }

    async function init(tabId) {
      const st = await status();
      if (st.state !== "ready") return st;
      progressTo = tabId == null ? null : tabId;
      const c = cfg(), stop = keepAlive();
      try {
        await createOrReuse();
        engineReady = true;
        return Object.assign({}, st, { loaded: true });
      } catch (e) {
        engineReady = false;
        const msg = String((e && e.message) || e);
        return { state: "error", error: msg, hint: flagsHint(msg), model: st.model };
      } finally { stop(); }
    }

    // Firefox runs one engine at a time for an extension, so every job goes through one queue.
    function enqueue(fn) {
      const job = queue.then(fn);
      queue = job.catch(() => {});
      return job;
    }

    // Firefox unloads an idle background page after about 30 s. A model download or a slow first run can take
    // longer, so while a job is running we make one harmless extension API call every 20 s to keep the page alive.
    function keepAlive() {
      if (!(api.runtime && api.runtime.getPlatformInfo)) return () => {};
      const t = setInterval(() => { try { api.runtime.getPlatformInfo(); } catch (e) { /* ignore */ } }, 20000);
      if (t && t.unref) t.unref();
      return () => clearInterval(t);
    }

    // A model download that never finishes must end in a readable error, not an endless "Testing…".
    function withTimeout(p, label) {
      let t;
      const limit = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(label + " timed out. Check your internet connection (Firefox downloads the model once), then try again.")), TIMEOUT); });
      return Promise.race([p, limit]).finally(() => clearTimeout(t));
    }

    // Firefox keeps ONE engine per extension and refuses a second createEngine with "Engine already created".
    // That happens when an earlier attempt finished after the popup closed, or after the background page was
    // unloaded and started again. The engine is then ready to use: reuse it instead of failing.
    const isAlready = (e) => /already (?:been )?(?:created|exists?|loaded)/i.test(String((e && e.message) || e));
    async function createOrReuse() {
      const c = cfg();
      try {
        await withTimeout(ml().createEngine({ taskName: c.taskName, modelHub: c.modelHub, modelId: c.modelId, dtype: c.dtype }), "Model download");
        return "created";
      } catch (e) { if (isAlready(e)) return "reused"; throw e; }
    }

    // A failure that mentions a disabled feature or a missing permission means the about:config flags are off.
    const flagsHint = (msg) => /not (?:allowed|permitted|enabled|available)|disabled|\bpref|trial|permission/i.test(msg) ? "flags" : undefined;

    function run(prompt) {
      return enqueue(async () => {
        const stop = keepAlive();
        try {
          if (!engineReady) { const r = await init(progressTo); if (r.state !== "ready") throw new Error(r.error || r.state); }
          const go = () => ml().runEngine({ args: [String(prompt)], options: { max_new_tokens: MAX_NEW_TOKENS, do_sample: false } });
          let res;
          try { res = await go(); }
          catch (e) {
            // Firefox may drop the engine when memory is low. Create it again and retry once.
            engineReady = false;
            const r = await init(progressTo); if (r.state !== "ready") throw new Error(r.error || r.state);
            res = await go();
          }
          const first = Array.isArray(res) ? res[0] : res;
          return (first && (first.generated_text || first.summary_text || first.text)) || "";
        } finally { stop(); }
      });
    }

    async function remove() {
      engineReady = false;
      try { if (ml()) await ml().deleteCachedModels(); return { state: "deleted" }; } catch (e) { return { state: "error", error: String((e && e.message) || e) }; }
    }

    // Step-by-step check for the popup: tells the reader exactly which step fails. Never throws.
    const SAMPLE = "The committee, which had been delayed by several unforeseen circumstances, will convene on 14 March.";
    function selftest() {
      return enqueue(async () => {
        const steps = [], add = (name, ok, detail) => { steps.push({ name, ok: !!ok, detail: detail || "" }); return !!ok; };
        const c = cfg(), stop = keepAlive();
        try {
          const perm = await hasPermission();
          if (!add("Permission trialML", perm, perm ? "granted" : "not granted yet. Click \u201cAllow on-device AI\u201d first.")) return { steps };
          if (!add("Firefox AI API (browser.trial.ml)", !!ml(), ml() ? "available" : "missing. In about:config set browser.ml.enable and extensions.ml.enabled to true, then reload Speakmi or restart Firefox.")) return { steps };
          const t0 = Date.now();
          let how; try { how = await createOrReuse(); engineReady = true; }
          catch (e) { engineReady = false; add("Model " + c.modelId, false, String((e && e.message) || e)); return { steps }; }
          add("Model " + c.modelId, true, how === "reused" ? "already loaded" : "loaded in " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
          try {
            const t1 = Date.now();
            const res = await withTimeout(ml().runEngine({ args: ["Rewrite this sentence in plain, simple English. Keep every number, name and the same meaning. Do not add anything. Sentence: " + SAMPLE], options: { max_new_tokens: MAX_NEW_TOKENS, do_sample: false } }), "Test sentence");
            const first = Array.isArray(res) ? res[0] : res;
            const out = (first && (first.generated_text || first.summary_text || first.text)) || "";
            add("Test sentence", !!out.trim(), out.trim() ? "\u201c" + out.trim() + "\u201d (" + ((Date.now() - t1) / 1000).toFixed(1) + " s)" : "the model returned an empty answer");
          } catch (e) { add("Test sentence", false, String((e && e.message) || e)); }
          return { steps };
        } catch (e) { add("Unexpected error", false, String((e && e.message) || e)); return { steps }; }
        finally { stop(); }
      });
    }

    async function handle(msg, sender) {
      if (!msg || msg.speakmi !== "ai") return undefined;
      const tabId = sender && sender.tab ? sender.tab.id : null;
      switch (msg.op) {
        case "status": return status();
        case "init": return init(tabId);
        case "rewrite":
          try { return { text: await run(msg.prompt) }; } catch (e) { return { error: String((e && e.message) || e) }; }
        case "selftest": progressTo = tabId; return selftest();
        case "delete": return remove();
        default: return { error: "unknown op" };
      }
    }

    // Forward download progress to the tab that started it. The reader shows it in its status line.
    function listenProgress() {
      if (listening || !ml() || !ml().onProgress) return;
      listening = true;
      ml().onProgress.addListener((p) => {
        const m = { speakmi: "ai-progress", progress: p };
        if (progressTo == null) { try { const r = api.runtime.sendMessage(m); if (r && r.catch) r.catch(() => {}); } catch (e) { /* popup closed */ } return; }
        try { api.tabs.sendMessage(progressTo, m).catch(() => {}); } catch (e) { /* tab closed */ }
      });
    }

    return { handle, status, init, run, remove, selftest, listenProgress, MODELS };
  }

  function register(root) {
    const api = (root.browser && root.browser.runtime) ? root.browser : (root.chrome || null);
    if (!api || !api.runtime) return;
    const h = createHandler(api);
    try { h.listenProgress(); } catch (e) { /* API not present until the permission is granted */ }
    api.permissions && api.permissions.onAdded && api.permissions.onAdded.addListener(() => { try { h.listenProgress(); } catch (e) { /* ignore */ } });
    // Returning a Promise from onMessage keeps the channel open (WebExtensions Promise API).
    api.runtime.onMessage.addListener((msg, sender) => h.handle(msg, sender));
  }

  return { createHandler, register, MODELS };
});
