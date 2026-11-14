# Speakmi and Human-Scale AI

## Small
- **No model in the core.** Extraction, sentence splitting, chunking, key-sentence selection and fidelity checks are ordinary code (`content/engine.js`). Key points are extractive: they are the article's own sentences.
- **Largest model parameter count in the core: none.** Speakmi does not train, ship or host a model.
- **Optional rewrite.** The overlay can ask the browser's built-in on-device rewriting model, only if the browser provides one (Chrome has one; Firefox does not yet). If none exists the option says so and Speakmi stays extractive. Any rewrite must pass the fidelity checks before it is shown.
- **Gap.** A small local model for Firefox, for German and Bahasa Indonesia, is on the roadmap. The model, size and runtime are not chosen yet.

## Intentional
- No account, no analytics, no network requests from the extension. `tools/check.js` fails the build if a network API appears in `content/` or `popup/`.
- Settings and reading streaks live in `storage.local` in the reader's browser.
- All code is open under MPL-2.0 and can be read, changed and forked.

## Tailored
- Built for readers with ADHD, dyslexia and autism-related literal-language needs, with five profiles.
- English, German and Bahasa Indonesia first; language support is meant to be extended by the community.
- Planned: co-design with 12 to 15 readers and a validation pilot. The pilot protocol is public: [docs/pilot/PROTOCOL.md](pilot/PROTOCOL.md).
- **Gap.** Speakmi has not yet been tested in a study. See [docs/pilot/RESULTS.md](pilot/RESULTS.md).
