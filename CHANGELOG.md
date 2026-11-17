# Changelog

## 0.5.3 (beta)
- Fixed: "Turn on AI" could end with "Engine already created". Firefox keeps one AI engine per extension and refuses a second `createEngine`. This happens when an earlier attempt finished after the popup closed, or when the background page was unloaded and started again. Speakmi now treats that answer as "the engine is ready" and uses it, in the setup check and in every rewrite.
- Tests: 56 AI checks (engine reuse in init, rewrite and the setup check) and 198 reader/popup checks.

## 0.5.2 (beta)
- Simpler on-device AI: **one button**. In the popup, "Turn on AI" asks Firefox for the optional permission, then checks the whole chain and downloads the small model once, automatically, with progress shown. When it passes, the reader uses the AI on English articles from then on; there is nothing else to tick. The long step list and the separate test button of 0.5.1 are gone.
- A short note about the two Firefox settings (`browser.ml.enable`, `extensions.ml.enabled`) now appears only when Firefox itself has its AI feature switched off. Extensions cannot change those settings, and the API is still a Firefox trial API; on Firefox Nightly it is on by default.
- If the permission prompt closes the popup, reopening it finishes the setup by itself.
- A model download that never finishes now ends with a clear "timed out" message after 4 minutes instead of an endless "Testing…".
- A page in another language (German, Indonesian) only skips the AI for that page. It no longer switches the reader's AI choice off for English pages.
- Tests: 53 AI checks and 198 reader/popup checks.

## 0.5.1 (beta)
- Fixed: the on-device AI could fail silently. When Firefox's AI features are off, the optional permission `trialML` is not offered at all and the popup only said "permission not granted". The popup now explains the real cause and lists the steps (open `about:config`, click "Accept the Risk and Continue", set `browser.ml.enable` and `extensions.ml.enabled` to `true`, reload Speakmi).
- New: "Test on-device AI" button in the popup. It checks permission, the Firefox AI API, model download and one real test sentence, and shows which step fails, with the raw model answer. Download progress is shown in the popup.
- Fixed: a model or engine error from Firefox was shown to the reader as the bare word "error". The real message (and the about:config hint) is now shown in the reader.
- Fixed: Firefox unloads an idle background page after about 30 s, which could interrupt a long first download. The background page now keeps itself alive while a job runs.
- Fixed: if Firefox drops the engine (low memory), the engine is created again and the rewrite is retried once.
- Clarified: the AI rewrite works on English articles only for now (the model is English). On German or Indonesian pages Speakmi keeps using the rule-based mode and says so.
- Tests: 52 AI checks (was 45) and 195 reader/popup checks, covering the self-test, retry and the flags hint.

## 0.5.0 (beta)
- New: optional on-device AI rewriter. It uses Firefox's AI runtime (`browser.trial.ml`) through a new background page, behind the optional permission `trialML`, asked for in the popup on the reader's click. Off by default. English only for now. Model currently wired in: `Xenova/flan-t5-small` (English baseline; not yet evaluated on real text).
- Fixed: a rewrite that **failed** the fidelity checks used to be shown with a warning badge. The original sentence is now shown instead, and the fidelity panel counts the rejected rewrites. This is what the docs always said.
- New: shape checks on model output (length, number of sentences, overlap with the source, echoed instructions) in addition to numbers, names and negations.
- Shown AI rewrites are labelled "Rewritten by AI".
- The build guard now also scans `background/`, and allows exactly one optional permission (`trialML`).
- New: `tools/eval-rewriter.js` and `docs/AI-EVALUATION.md` (the evaluation protocol), `docs/AI-RUNTIME.md` (runtime options and limits), `tests/ai.test.js` (45 checks, no dependencies), pilot results in `docs/pilot/RESULTS.md`.
- Removed the Chrome-only wording from the AI option; a browser-provided Rewriter, if any, goes through the same gate.

## 0.4.2 (beta)
- Fixed (root cause): "Restructure this page" never worked in Firefox. The popup injected `lib/Readability.js` and the other scripts by a path without a leading slash, and Firefox resolves that against the popup page (`popup/lib/Readability.js`), which does not exist. The paths now start with `/`.
- `npm run check` now fails if an injected path is not root-relative or does not exist; a test covers it.

## 0.4.1 (beta)
- Fixed: when something went wrong on a page, the popup closed as if it had worked and nothing appeared. Firefox returns errors from injected scripts inside the result instead of rejecting, and the popup never looked at it. The popup now checks every step, stays open, and shows the problem with a short technical detail. The reading view also shows a message instead of a blank page if it fails while starting.
- Popup: the buttons are attached before anything is drawn, and each section (texts, profiles, settings, evidence) is drawn on its own, so one failing section can no longer disable the rest.
- Popup: forces a light colour scheme and explicit text colours on lists and labels, so dark Firefox themes cannot produce white text on white.
- New tests for the popup (success path, injected error, partial rendering) and for the failure message in the reading view.

## 0.4.0 (beta)
- Fixed: the toolbar popup stopped half-way in 0.3.0 (a leftover line from the removed licence code), so the profile list and language lists stayed empty and the buttons did nothing. Everything in the popup now works.
- `npm run check` now verifies that every element the popup script uses exists in `popup.html`.

## 0.3.0 (beta)
- Firefox only. Manifest V3, `data_collection_permissions: none`, minimum Firefox 140.
- Released as open source under MPL-2.0.
- Removed all licensing, limits and payment code: every feature is free, with no account.
- Calm reading flow: one short part at a time, progress, highlights, finish screen, several themes.
- Source anchoring, fidelity checks (numbers, names, negations), evidence labels, five profiles.
- English, German and Bahasa Indonesia.
- Added `npm run check` (syntax, licence headers, manifest, and a guard against network APIs) and CI.
