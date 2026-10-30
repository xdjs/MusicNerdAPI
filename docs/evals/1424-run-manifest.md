# Web #1424: one-run diagnostic manifest

Status: approved replacement completed October 29, 2026; [results and remaining gaps](1424-diagnostic-result.md). Attempt 1 remains preserved below. No semantic closure acceptance. Pete approved the new $5 bound. The eval transport reserves a conservative per-request allowance before egress; validation is required before dispatch. This is a diagnostic run of current chat, not final closure acceptance.

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

Proposed new limit: $5 combined model/provider usage for this single run. Pete approved this bound. The historical Braintrust display estimated $0.245 for recorded chat usage, but that is neither a full provider invoice nor a hard ceiling for this run. The eval-only transport now reserves text input at one token per UTF-8 byte plus 8,192 framing tokens, at $4/$20 per million input/output for Sonnet and $1/$6 for Flash. These exceed the inspected Gateway catalog rates including regional/cache-write or priority rates. Outputs are limited to 2,048 tokens. Each Tavily call reserves $0.016 (two PAYG credits). Failed requests are never refunded; retries reserve again; requests exceeding the $5 cumulative envelope or 100 provider requests are blocked before sending and latch the guard closed. Unknown models/media/native tools/provider routes are rejected. This conservative ledger is not a provider invoice; report actual available usage separately. No shared settings or new keys. The workflow has a ten-minute timeout. The output ceiling is an eval constraint and truncated/incomplete cases must remain visible. Pricing sources: https://ai-gateway.vercel.sh/v1/models and https://docs.tavily.com/documentation/api-credits, inspected October 29.

## Attempt 1: harness failure (preserved)

[Run 40975550504](https://github.com/xdjs/MusicNerdAPI/actions/runs/40975550504), SHA `024d946a16bf65716bdf221927660548d81b14b9`, ended cancelled. All 11 recorded turns have empty answers and stream errors; no semantic judge calls were sent. One Gateway model request and one Tavily search passed the guard. The next model request included an AI SDK `custom` part with kind `anthropic.message_start`, which the new guard incorrectly rejected as non-text. The guard then latched closed, preventing additional paid requests. The suite continued consuming normal staging question admissions while recording errors; cancellation did not stop those already scheduled records promptly. This is an eval harness defect, not a chat quality result.

Evidence: [failed model input](https://www.braintrust.dev/app/xDJs/p/music-nerd/trace?object_type=experiment&object_id=d09323c9-0abf-4f05-98b6-ca88f25ab2ad&r=dd66492b34aa373e64cd59ebfd14019a&sid=7029398fbafd62c9). Its assistant message visibly includes `type: custom`, `kind: anthropic.message_start`, and Anthropic provider options. Logs show exactly two admitted paid requests and final reserved cost $0.104224. Braintrust displays approximately $0.004 model cost; Tavily search billing is separate and actual invoiced total has not been verified. Preserve the reservation as the conservative consumed allowance, leaving $4.895776 of the original $5 authorization.

Offline correction: allow only that known metadata part, continue rejecting other unknown/media parts, skip later chat admissions once the guard is closed, and leave latency scores unscored on errors (the original run misleadingly showed total-time pass for fast errors). Regression first reproduced the rejection then passed. No second paid run is authorized by this correction; the agreed one-run/no-rerun limit remains.

## Replacement attempt authorized

Pete explicitly approved one replacement attempt after reviewing the harness failure. The runner carries forward 104,224 microdollars ($0.104224), leaving $4.895776 under the same original $5 ceiling. Same 11 cases, same runtime base and rubric, corrected harness; no quota resets, production changes or PDF-branch edits. Record the replacement SHA and run ID at dispatch.

Replacement result: run `40979660918`, code `89f689f`, completed all 11 cases. See [the result report](1424-diagnostic-result.md) for exact scores, manual exceptions, latency and the $3.709448 combined conservative reservation. No further paid rerun authorized.
