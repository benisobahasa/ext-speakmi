# Fidelity checks

Readers who find long text hard are the least able to notice when a tool changes what it says. Speakmi therefore treats fidelity as a feature.

**Extractive by default.** Key points and chunks are the article's own sentences in their original wording, each anchored to its source. The reader's fidelity panel counts them: sentences shown in original wording, rewritten and verified, and flagged.

**Checks for any rewritten text** (`verifyPoint(anchorTexts, outputText, lang, opts)` in `content/engine.js`):
- `number-added`, `number-missing`: numbers (including number words) must match the source.
- `name-added`: capitalised names in the output must appear in the source.
- `negation-changed`: the count of negations must match in rewrite mode; `negation-added` is flagged in summary mode.

If a check fails, the original wording is shown instead.

**Limits.** These are rule-based checks. They catch the common silent errors (a changed number, a dropped "not", an invented name), not every change of meaning. Name detection is heuristic. Coverage is English, German and Bahasa Indonesia. A planned expert audit of a random sample will report the real error rate.
