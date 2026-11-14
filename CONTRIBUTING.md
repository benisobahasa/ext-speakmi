# Contributing to Speakmi

Speakmi is for readers who are easily overloaded, so every change is judged by one question: does it make reading calmer and more trustworthy?

## Ground rules
1. **Fidelity first.** Never show text that is not in the source unless it passes the fidelity checks (`verifyPoint` in `content/engine.js`).
2. **Privacy by default.** No network calls, analytics, accounts or remote code. `npm run check` fails if one appears.
3. **Evidence labels.** A new feature needs an entry in `content/evidence.js` (strong, moderate, guidance, untested) with a source.
4. **Accessible by default.** Keyboard and screen-reader friendly, respect reduced motion, no flashing.
5. **Licence.** Contributions are under MPL-2.0. New source files carry the MPL header (see any file in `content/`).

## Set up
```
git clone <your fork>
cd speakmi
npm run check
node tools/build.js
```
Load `dist/firefox/manifest.json` in `about:debugging#/runtime/this-firefox`.

## Adding or improving a language
1. Interface strings: `content/i18n.js`.
2. Sentence rules, negations, number words, idioms with literal meanings and simpler-word hints: `content/engine.js` (small seed lexicons per language; moving them into separate data files is a welcome first contribution).
3. Add a demo article in `demo/` and a test case. **Native-speaker review is required.**

## Pull requests
Keep them small, say which reading problem they solve, and tick the checklist in the template. Be kind: see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
