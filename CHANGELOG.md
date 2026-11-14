# Changelog

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
