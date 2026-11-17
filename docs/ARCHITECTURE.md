# Architecture

```
popup/        toolbar popup: choose a profile, start the reader, allow on-device AI (optional permission)
background/
  ai.js        only place that touches Firefox's on-device AI runtime (browser.trial.ml); model registry
content/
  brand.js     logo and fonts
  config.js    constants (privacy page, support email)
  i18n.js      interface strings: en, de, id
  evidence.js  evidence grade for each feature
  engine.js    language detection, sentence splitting, chunking, key sentences,
               numbers / names / negations, idioms and simpler words, verifyPoint()
  localai.js   AI client: prompts, output clean-up, the gate (fidelity + shape checks), backend selection
  overlay.js   the reading interface (Shadow DOM, so page styles cannot leak in)
lib/           Mozilla Readability (Apache-2.0) for article extraction
tools/         build.js (package for Firefox), check.js (guards)
```

## Flow
1. The reader clicks the toolbar icon (or `Alt+Shift+S`). `popup.js` injects the scripts into the current tab with `scripting.executeScript` (permission `activeTab`).
2. The article is extracted with Readability and turned into blocks.
3. `engine.js` detects the language, splits sentences, builds chunks sized for the chosen profile, and selects key sentences. Every point keeps an anchor to its source sentence.
4. `overlay.js` renders the reader inside a Shadow DOM. **Source** opens the original text with the sentence highlighted.
5. Optional rewrites (off by default): `overlay.js` asks `localai.js`, which asks `background/ai.js`, which runs the model in Firefox's AI runtime. `localai.gate()` runs `verifyPoint()` and shape checks. **If anything fails the original sentence is shown.**

## Storage
Reader settings and the reading streak are stored in `storage.local`. The model files, if you use the AI feature, are cached by Firefox itself and can be deleted. Nothing is sent anywhere by Speakmi.
