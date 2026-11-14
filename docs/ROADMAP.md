# Roadmap

No dates are promised. Roughly in order:

1. **Firefox Add-ons listing**, and fixing the `innerHTML` warnings reported by the add-on validator (build the DOM safely instead).
2. **Small-model rewriter for Firefox**: choose a model, size and runtime; run on device; keep every output behind the fidelity checks; add German and Bahasa Indonesia.
3. **Language data files**: move lexicons out of `engine.js` so languages can be added without touching code.
4. **Tests in CI**: run the DOM tests with jsdom on every pull request.
5. **Co-design** with 12 to 15 neurodivergent readers, then a **validation pilot**; publish the results either way.
6. **Easy-Read evaluation** (Leichte Sprache / Inclusion Europe guidelines) and a **WCAG 2.2 AA audit**.
