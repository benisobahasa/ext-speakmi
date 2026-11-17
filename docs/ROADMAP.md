# Roadmap

No dates are promised. Roughly in order:

1. **Firefox Add-ons listing**, and fixing the `innerHTML` warnings reported by the add-on validator (build the DOM safely instead).
2. **Small-model rewriter for Firefox**: *integration done in 0.5.0 (Route A, English baseline model, behind the fidelity gate).* Next: evaluate candidates ([AI-EVALUATION.md](AI-EVALUATION.md)), get multilingual models loadable ([AI-RUNTIME.md](AI-RUNTIME.md)), add German and Bahasa Indonesia only if they pass.
3. **Language data files**: move lexicons out of `engine.js` so languages can be added without touching code.
4. **Tests in CI**: run the DOM tests with jsdom on every pull request.
5. **Co-design** with 12 to 15 neurodivergent readers, then a **validation pilot**; publish the results either way.
6. **Easy-Read evaluation** (Leichte Sprache / Inclusion Europe guidelines) and a **WCAG 2.2 AA audit**.
