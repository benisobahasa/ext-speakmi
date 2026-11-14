# Changelog

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
