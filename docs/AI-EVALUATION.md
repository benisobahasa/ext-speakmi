# Small-model evaluation protocol (WP2)

**Question.** Can a small on-device model rewrite single sentences into plainer language without changing their meaning, fast enough and small enough for a modest laptop?

**Data.** At least 200 paragraphs per language (English, German, Bahasa Indonesia) from openly licensed sources, split into sentences as the reader does. Published with the results.

**Per candidate model and language**
1. Generate a rewrite for every sentence with the exact prompt in `content/localai.js`.
2. Score with `node tools/eval-rewriter.js outputs.jsonl --csv sheet.csv`: share accepted by the gate, rejection reasons, length ratio, latency, peak memory.
3. Two native-speaker experts rate a random sample of the **sentences that would be shown to readers** (`sheet.csv`): critical error (Y/N), meaning preserved (1 to 5), simpler (1 to 5). Disagreements are resolved by discussion and the agreement is reported.

**Criteria (decision gate, month 9)**
- Critical factual error rate in shown rewrites below 2%.
- Median latency under 3 seconds per sentence and peak memory under 1.5 GB on an 8 GB laptop.
- Readability improvement and reader-rated usefulness in co-design.
- Comprehension in the controlled study (WP4).

If no candidate meets the criteria for a language, that language stays extractive and the data and the negative result are published.

**What the automatic gate does and does not do.** It catches changed or missing numbers, invented names, changed negation counts, empty, echoed, much too long or off-topic output. It does not catch every change of meaning, which is why the expert rating is part of the gate.
