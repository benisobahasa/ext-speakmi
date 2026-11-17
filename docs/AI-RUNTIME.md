# On-device AI: runtime options and constraints

## Route A (implemented): Firefox AI runtime, `browser.trial.ml`
- Experimental WebExtensions API (Firefox 134 and later). The extension asks for the optional permission `trialML`. On Firefox release builds the reader must set `browser.ml.enable` and `extensions.ml.enabled` to `true` in `about:config`; they are on by default in Nightly.
- Runs Transformers.js on ONNX in an isolated process. Model files are cached by Firefox; the extension makes no network request.
- Firefox only lets extensions load models from its own hub and the Hugging Face organisations `Mozilla` and `Xenova`. The API can change between Firefox versions (it lives under `browser.trial`).
- Source: Firefox Source Docs, "WebExtensions AI API".

**Consequence for model choice.** The multilingual instruction models named in the proposal (Qwen2.5-1.5B and 0.5B, SmolLM2-360M) are published as ONNX builds under other organisations, so they cannot be loaded through this route today. WP2 therefore (a) tests what the `Xenova` and `Mozilla` organisations offer for English, German and Bahasa Indonesia, (b) asks Mozilla to allow additional organisations, which the Firefox documentation says is planned, and (c) evaluates Route B.

### Turn it on (what the reader does)
1. Click the Speakmi toolbar button, then **Turn on AI**. Firefox asks for the optional permission; accept it.
2. Speakmi checks the chain by itself (permission, Firefox AI API, model download, one test sentence). The first time, Firefox downloads the small model once (about 80 MB for `Xenova/flan-t5-small`, 8-bit form).
3. Done. English articles are rewritten from then on; German and Indonesian articles stay in rule-based mode.

**Only if Firefox has the feature switched off** (release builds; Nightly has it on) the popup shows a short note: open `about:config`, accept the warning page ("Accept the Risk and Continue"), set `browser.ml.enable` and `extensions.ml.enabled` to `true`, restart Firefox, and click **Turn on AI** again. An extension cannot change these settings or open `about:config` for the reader; this is a Firefox rule for trial APIs, not something Speakmi can remove.

If something fails, the popup shows the failing step as text (for example "Model download timed out") and a **Try again** button.

## Route B (not implemented): bundled runtime
Ship an open-source WebAssembly/WebGPU inference library with the extension and download the model once from a single disclosed domain. This allows any openly licensed model but needs: a vendored, pinned library with a licence review; a `host_permissions` entry or equivalent for exactly one domain; an update of the build guard to allow exactly that; and a data protection impact assessment. It is evaluated in WP2 and chosen only if Route A cannot reach the quality bar.

## Not implemented here
No model weights are included in this repository. Unit tests use a mock model. The popup's "Test on-device AI" button (0.5.1) runs the real chain inside Firefox and is how a real end-to-end run is checked; its result for a given Firefox version should be recorded in `docs/AI-EVALUATION.md` before it is claimed.
