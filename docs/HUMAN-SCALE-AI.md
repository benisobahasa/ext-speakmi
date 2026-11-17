# Speakmi and Human-Scale AI

## Small
- **The core needs no model.** Extraction, sentence splitting, chunking, key-sentence selection and the fidelity checks are ordinary code (`content/engine.js`). Key points are extractive: they are the article's own sentences.
- **One optional small model.** The plain-language rewriter runs a small model through Firefox's own on-device AI runtime (`browser.trial.ml`, built on Transformers.js and ONNX). The model currently wired in is `Xenova/flan-t5-small` (about 0.08 billion parameters), Firefox's documented default for text-to-text generation. Candidates of up to about 1.5 billion parameters are planned for evaluation ([AI-EVALUATION.md](AI-EVALUATION.md)).
- **Largest model in the project today: about 0.08 billion parameters, optional, English only, off by default.** Speakmi does not train, ship or host a model, and calls no cloud API.
- **Honest status.** The integration is implemented and unit-tested with a mock model. It has **not** yet been evaluated on real paragraphs, and the default model is not expected to meet the quality bar for German or Bahasa Indonesia. That evaluation is the funded work (WP2). If no model passes, Speakmi stays extractive and publishes the result.
- **Known constraints** ([AI-RUNTIME.md](AI-RUNTIME.md)): the API is experimental, release builds of Firefox need two `about:config` switches, and Firefox only loads models from its own hub and the Hugging Face organisations `Mozilla` and `Xenova`.

## Intentional
- No account, no analytics, no network requests from the extension. `tools/check.js` fails the build if a network API appears in `content/`, `popup/` or `background/`.
- The AI feature is opt-in in two steps: the reader grants the optional `trialML` permission in the toolbar popup, then switches the rewrite on inside the reader. Nothing is downloaded before that. If the model is not cached, **Firefox** downloads it once; the reader sees the model name and the progress.
- Article text goes only to the local engine. The reader can remove the permission at any time.
- A rewrite is shown only if it passes the numbers, names and negations checks and the shape checks. If it fails, the **original sentence is shown** and the fidelity panel counts the rejection. Rewrites that are shown are labelled "Rewritten by AI" and can be switched back to the original with one click.
- All code is open under MPL-2.0.

## Tailored
- Built for readers with ADHD, dyslexia and autism-related literal-language needs, with five profiles.
- English, German and Bahasa Indonesia for the interface and the rule-based core; the AI rewriter is English only until a model passes the evaluation for another language.
- A first pilot (n = 4) is reported in [docs/pilot/RESULTS.md](pilot/RESULTS.md). Co-design with 12 to 15 readers and a controlled study are planned.
