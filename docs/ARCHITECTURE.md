# Architecture

```
popup/        toolbar popup: choose a profile, start the reader
content/
  brand.js     logo and fonts
  config.js    constants (privacy page, support email)
  i18n.js      interface strings: en, de, id
  evidence.js  evidence grade for each feature
  engine.js    language detection, sentence splitting, chunking, key sentences,
               numbers / names / negations, idioms and simpler words, verifyPoint()
  overlay.js   the reading interface (Shadow DOM, so page styles cannot leak in)
lib/           Mozilla Readability (Apache-2.0) for article extraction
tools/         build.js (package for Firefox), check.js (guards)
```

## Flow
1. The reader clicks the toolbar icon (or `Alt+Shift+S`). `popup.js` injects the scripts into the current tab with `scripting.executeScript` (permission `activeTab`).
2. The article is extracted with Readability and turned into blocks.
3. `engine.js` detects the language, splits sentences, builds chunks sized for the chosen profile, and selects key sentences. Every point keeps an anchor to its source sentence.
4. `overlay.js` renders the reader inside a Shadow DOM. **Source** opens the original text with the sentence highlighted.
5. Optional rewrites go through `verifyPoint()` before being shown.

## Storage
Reader settings and the reading streak are stored in `storage.local`. Nothing else is stored and nothing is sent anywhere.
