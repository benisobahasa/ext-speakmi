# Evaluation data

`smoke-test.jsonl` is **three invented lines that exercise the scorer. It is not evaluation data and says nothing about any model.**

The real evaluation (docs/AI-EVALUATION.md) needs at least 200 openly licensed paragraphs per language, model outputs for them, and native-speaker expert ratings.
Score model outputs with `node tools/eval-rewriter.js your-outputs.jsonl --csv expert-sheet.csv`.
