# Web #1424: one-run diagnostic manifest

Status: prepared October 29, 2026; not executed. Budget approval and enforceable spend controls are pending. This is a diagnostic run of current chat, not final closure acceptance.

## Code and environment

- Runtime base: API main `e4054a4783ab3cf7dfdadf91d7285a54adf3c734`.
- Eval implementation: API PR #107, `cdf1bc1d80fc597635897abf15b597c38cd4177e`; pin the final documentation-only descendant at dispatch.
- Dataset: unchanged `lib/evals/chatCases.ts`, SHA-256 `9eea9fdc33edc751b4d0a178024ebcce712b26f7970c804ec7fc531f6951d14b`.
- Rubric: `cited-evidence-v1`; current configured chat model and default judge model, no model/config overrides.
- Existing GitHub Evals workflow, staging database, concurrency one. No quota resets or new credentials. The real route writes normal allowance/audit rows.
- API #106 remains open and separately owned. No edits to its API or Docs branches. Generic alias/motive questions do not prove PDF access.

## Fixed cases and required outcomes

| Case | Required answer / review |
| --- | --- |
| bio-ritmo-origin | Richmond, Virginia; 1991. Anniversary arithmetic yielding around 1992 fails the requested-year check. |
| bio-ritmo-singer | Rei Alvarez; any added membership claim must be supported. |
| bio-ritmo-puerta-del-sur | Vampisoul, 2014. Supported extra label details are allowed. |
| bio-ritmo-colombia | Two bars; one named for La Muralla. Added names/logo details require support. |
| bio-ritmo-30th | Salsa System; resolve any added date/format/edition claims against actual passages. |
| willie-colon-death | February 21, 2026, age 75; added circumstances require support. |
| willie-colon-blades | Metiendo Mano!, 1977, before Siembra. |
| willie-colon-instrument | Trombone; added early-instrument/influence details require support. |
| dutchyyy-aliases | Dutchmassive and Dutchy; any additional aliases, dates or releases require cited support. Do not require unsolicited chronology merely because it is in the short reference. |
| dutchyyy-onchain | Preserve music/context/lore when platforms disappear; do not turn an aspiration into guaranteed permanence. |
| dutchyyy-unanswerable | Honest limited-search abstention; no invented favorite food or claim of exhaustive corpus search. |

One attempt per case, 11 total, sequential, no suite reruns. Keep errors, quota denials, unsupported evidence and incomplete captures visible. One judge call per scorable answer; no judge call when capture checks fail. The runtime currently allows six model steps per question; SDK retries are separate from suite attempts and must be accounted for before calling this a strict call bound.

## Evidence and acceptance

Capture answer, source-number/URL bindings, exact readSource text or webSearch snippets, content hashes and tool-call IDs. These are run-time snapshots, not pre-frozen database revisions. Existing references stay fixed; changed/missing source evidence is a fixture discrepancy, not permission to rewrite expected outcomes after the run. Because full eligible source revisions have not been independently frozen, this run is diagnostic.

Review every case for requested-fact accuracy, every material claim's cited support and qualification. A model score alone cannot pass a case. Privacy/wrong-artist/fabricated citations fail regardless of average; missing captures remain unscored. Report first text against 5 seconds and completion against 20 seconds per case; do not infer p95 reliability from one sample per question. PDF-specific checks, held-out coverage, multi-turn Web smoke and owner acceptance remain separate.

## Spend preflight

Proposed new limit: $5 combined model/provider usage for this single run. Approval is pending. The historical Braintrust display estimated $0.245 for recorded chat usage, but that is neither a full provider invoice nor a hard ceiling for this run. The current runner has no dollar-budget guard and chat generation has no explicit output-token ceiling. Do not dispatch while representing the proposed $5 maximum as enforced. Establish a bounded mechanism or get an explicit revised execution agreement first; do not silently change shared gateway settings or create a new API key.
