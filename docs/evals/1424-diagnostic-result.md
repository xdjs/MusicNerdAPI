# October 29, 2026: #1424 diagnostic result

The approved replacement completed, but this is **not closure acceptance**. It exposed citation-support gaps and first-text misses. Automated scores remain unchanged; manual findings below are not a regrade or a new passing threshold.

- [GitHub run 40979660918](https://github.com/xdjs/MusicNerdAPI/actions/runs/40979660918): success, exact code `89f689fc0d9296d1d05f391d07c70dc3d77f5187` (October 30 UTC / October 29 New York).
- [Braintrust experiment](https://www.braintrust.dev/app/xDJs/p/music-nerd/experiments/chat%20%C2%B7%20anthropic%2Fclaude-sonnet-5.5%20%C2%B7%2089f689f), ID `b6868b7e-9b9c-4a10-a2de-25ac6f1a66e2`. Same 11 cases, staging, rubric `cited-evidence-v1`; no third run.
- 11/11 non-error, scorable records. Automated relevance 100%; citation-marker integrity 10/10 eligible; source groundedness 97.27%. All 11 complete within 20 seconds; only 2/11 first text within five seconds (3.466–6.998 seconds). These single samples do not establish latency reliability.
- 45 paid requests admitted in this replacement. Final conservative reservation **$3.709448**, including **$0.104224** carried from failed attempt 1, below the original $5 ceiling. Braintrust displays approximately $0.268 estimated model cost for the replacement; Tavily billing is separate. Neither number is a verified provider invoice.
- All answer rows and cited captured passages were manually reviewed. Passage text and hashes are retained in Braintrust. Raw export stays local; no wholesale third-party source text is committed here.

| Case | Judge grounding | First text / total (s) | Manual evidence review |
| --- | --- | --- | --- |
| bio-ritmo-origin | 100% | 6.998 / 7.011 | Requested Richmond/1991 and added origin details supported by captured passages. |
| bio-ritmo-singer | 100% | 5.187 / 5.199 | Core name/original membership supported. Puerto Rican origin is in passage [2], but the answer attaches [4], whose captured snippet does not support that origin. Citation-placement gap despite judge 100%. |
| bio-ritmo-puerta-del-sur | 100% | 3.720 / 3.727 | Label/year directly supported by captured band discography. |
| bio-ritmo-colombia | 100% | 5.008 / 5.017 | Two bars, La Muralla, Cali and logo details supported; limited-search qualification retained. |
| bio-ritmo-30th | 100% | 5.266 / 5.293 | Core release, 2006 EP and December 2022 supported. Claimed headline wording is absent from captured [1] snippet; do not treat the inferred edition relationship as an independently verified full-page statement. |
| willie-colon-death | 100% | 5.149 / 5.157 | Date/age and additional circumstances appear in captured [2]. The date sentence cites [5], whose snippet lacks the calendar date; citation-placement gap despite judge 100%. |
| willie-colon-blades | 100% | 5.764 / 5.779 | Core Metiendo Mano!/1977 supported. Final guest-on-a-Lavoe-led-record characterization is not established by either captured passage. Manual non-pass despite judge 100%. |
| willie-colon-instrument | 100% | 3.466 / 3.476 | Instrument and named influences directly supported. |
| dutchyyy-aliases | 80% | 6.867 / 6.882 | 2004 solo-album assertion is absent from cited [3]; other cited names/rebranding supported. Manual non-pass, judge 80%. Instagram evidence does not validate PDF retrieval. |
| dutchyyy-onchain | 90% | 5.917 / 5.926 | Core preservation motive supported. September 2024 date is not in captured [1] text. In Process record supports recovered material, but permanence is not proven. Needs qualification/support review; judge 90%. |
| dutchyyy-unanswerable | 100% | 5.476 / 5.482 | Appropriate limited-search abstention; no invented food. Captured web results concern Dutch cuisine, so this is not proof of comprehensive artist-source coverage. |

## Next actions under #1424

1. Preserve the unsupported additions and citation-placement cases as offline scorer regressions. The judge missed some unsupported material; 97.27% must not be presented as human acceptance. Review runtime answer instructions to require a supporting citation for each material clause, without taking over API #106.
2. Investigate first-text timing from these saved traces before another paid run; do not infer a causal regression from a single run with a changed harness and live evidence.
3. Complete the original-capability disposition and old draft PR review, then the separately scoped real Web→API follow-up/citation smoke. Generic Dutchyyy questions do not establish PDF support; that remains API #106's work.
4. Pete must explicitly disposition remaining limitations and accept the final matrix. API #107 remains draft, unmerged and not production. No further paid run is authorized by these results.

Validation before dispatch: 4,458 tests passed, nine skipped; types, lint, format and production build passed. This run exercises the real API route through the eval workflow; it is not a deployed Web-browser smoke. Prior attempt 1 remains an all-error harness failure in the run manifest.
