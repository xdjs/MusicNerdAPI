# Chat on passages: rollout order and accepted limits (Web #1424), November 16, 2026

Pete read ten side-by-side pairs on 2026-11-16 and approved moving toward production. The evidence is in `docs/chat-eval-pdf-evidence.md` ("Third staging record"). This note is the order of work, who had to act at each step, how to check it, and how to go back. **Every step was done by 2026-11-17; see "What happened" below.**

## Order

The order matters because the indexing job needs the table to exist. (This note first said API `main` publishes to production on merge. It does not: see "Production builds are staged" below.)

| Step | What | Who | Check | Going back |
| --- | --- | --- | --- | --- |
| 1 | Review and merge the design and docs: API #119, Docs #65, Docs #66 | reviewer | none; documents only | revert |
| 2 | Merge Web #1684 and apply migration 0066 to production. The PR lists the checks to make first (the `vector` extension's schema and version, a role allowed to create it) | someone with production database access | `source_units` exists with its five indexes; the app role can use the `vector` type; `unit_sync` is an allowed job kind | the migration is additive; nothing reads the table yet |
| 3 | Merge API #121, then #122, then #123 | reviewer | CI on `main`; production chat still answers (the new search stays off: `CHAT_RETRIEVAL` defaults to `legacy`) | revert the merge |
| 4 | Merge Web #1685 (queues indexing when a document's status or publication changes), #1680 and #1686 (the chat UI for passage tools) | reviewer | Web CI; chat page loads on the preview | revert |
| 5 | Index production's existing documents: the insert in API #121's description queues one `unit_sync` job per artist, in batches of 50 artists; the research cron drains it | someone with production database access | jobs of kind `unit_sync` finish; `source_units` has rows for the artists with approved documents; failures are recorded per document | units are only read once step 8 happens; deleting them is safe |
| 6 | Switch staging: set `CHAT_RETRIEVAL=units` for the Vercel `staging` environment and redeploy | someone with Vercel access | staging chat answers with page citations such as `[1, p.2]` | remove the variable and redeploy |
| 7 | Browser check on staging: status lines while it reads, page labels on citations, a follow-up question, Stop | Pete or a reviewer | by eye, both themes | n/a |
| 8 | Switch production: set `CHAT_RETRIEVAL=units` for Production and redeploy, after step 5 has drained | someone with Vercel access, on Pete's go | five questions from the eval set by hand; error rate and answer time in the logs for a day | remove the variable and redeploy |
| 9 | Clean up: remove the branch-scoped Preview variable `CHAT_RETRIEVAL` for `claude/chat-accuracy-eval`; the legacy path and the partner endpoints follow in later changes, after production has run on passages for a release |  |  |  |

Things to know before starting:

- Staging has no worker, so its index was built by the `units-backfill` eval suite for the eight eval artists only. After step 6 other staging artists have nothing indexed and their answers fall back to web search. Indexing more of staging needs the Evals workflow, whose AI Gateway key is over its budget.
- Staging is missing migrations 0058, 0059 and 0065. 0059 re-creates the job-kind check with its own list; applied after 0066 it would drop `unit_sync`. Web #1684's description has the detail.
- Step 5 spends on production's own AI Gateway access: one embedding per unit and one vision call per scanned page. The design estimated cents for the embeddings of the whole corpus; the vision cost depends on how many pages are scans and has not been measured on production.
- The index only holds documents that have text. About a third of production's approved documents have none (47 of 134 on 2026-11-15); the new search cannot answer from those any more than the current chat can.

## What happened (2026-11-16 to 2026-11-17)

- **Steps 1 to 4:** all PRs merged on 2026-11-16. Migration 0066 was applied to production through the Supabase CLI and verified: the table, five indexes, row-level security and the app role's policies, `vector` 0.8.0 in `public`, the delete triggers and the `unit_sync` job kind.
- **Step 6:** staging switched on 2026-11-16.
- **Step 7:** Pete checked staging in the browser on 2026-11-17. That check led to three Web fixes: real bold text instead of `**` (Web #1689), no `¶`/`§` markers beside citation numbers (Web #1690; PDF page labels stay), and real italics instead of `*` (Web #1692).
- **Production builds are staged.** Production had been serving the 2026-11-11 build (#113) since then; later `main` builds were built for production but never assigned to the domain. On 2026-11-17 Pete promoted `2ac7e08` (`vercel promote <deployment> --scope musicnerd`). That shipped #99, #117, #120 and this work together. The Web production release followed, carrying Web #1642 (signed-in account from `GET /api/user/me`), which needs #99 live first. Pete checked sign-in, the account menu, his profile and the admin panel. **Any future API change reaches production only when someone promotes its build.**
- **Step 5:** 344 `unit_sync` jobs, queued in batches of 50 after the promote. 5,539 units for 343 artists, every unit embedded, no failed jobs; about 40 minutes.
- **Step 8:** `CHAT_RETRIEVAL=units` set for Production on 2026-11-17 and promoted (deployment `api-1g7nz6ak3`). A direct request showed the chat calling `searchPassages`. Two questions read on musicnerd.net were complete and cited. To go back, promote the previous build (`api-rnksbwvf4`) or remove the variable and redeploy.
- **Step 9:** the branch-scoped Preview variable is gone. Staging keeps `CHAT_RETRIEVAL=units` so it matches production. The legacy path was removed on 2026-11-20 (next section).

## Legacy path removed (2026-11-20)

Pete asked for the cleanup on 2026-11-20, three days after the production switch, instead of waiting a further release.

- The chat has one path: `searchPassages`, `readUnits` and `listDocuments`, with `searchSources`/`readSource` for the latest releases and published answers, and `webSearch`. `CHAT_RETRIEVAL` is no longer read; the variable can be removed from Production and staging once this build is live.
- Removed: the PDF tools (`lib/chatPdf/`), the PDF-turn replay check, the `chat-pdf-text` eval and the `pdf106` benchmarks with their workflow jobs, and the Evals workflow's `retrieval` input. The PDF page counter that uploads use moved to `lib/units/countPdfPages.ts`.
- An earlier answer from the PDF tools, sent back by a tab opened before the switch, is no longer replayed into the conversation: its reads can no longer be checked against the documents' current publication.
- To go back to the old chat, promote a production build from before this change (for example `api-1g7nz6ak3`, which still honours `CHAT_RETRIEVAL`).

## Limits accepted with the switch

Accepted by Pete with the switch, and recorded on #1424. Each is measured in the evidence note.

1. **An unmarked closing conclusion.** About 1 answer in 13 ends on a sentence of the model's own that no document states (3 of 91 answers contradicted a document). The current chat does it less often and misses more facts. The instructions already forbid it; a higher reasoning setting and a check before sending are untested options.
2. **A one-off item on a long list is sometimes left out.** `dutchyyy-alias-years` named every alias in 5 of 6 answers with the list rule (4 of 6 before); the model was shown the same pages each time. The current chat left the same alias out in one of two answers.
3. **A true fact is sometimes cited to the wrong document** (5 of 636 claims).
4. **Documents with no saved text are invisible to the chat** (47 of 134 approved documents on production, 2026-11-17). Tracked in Web #1693.
5. **Celia Cruz has no three-answer result on the new search.** The run was blocked by the Evals key's budget; her earlier single answers were complete.
6. **The judge's scores on two questions are advisory** (`willie-colon-blades`, `dutchyyy-aliases`), for the reasons recorded on those cases.
7. **The answer text arrives in one burst at the end**, with the status line covering the wait. Checked in the browser on staging and production on 2026-11-17.
8. **Follow-up conversations** were measured in the eval on the new search but were not part of the side-by-side with the current chat.
9. **The any-term text query is unmeasured on production-sized data** (step 8's day of logs covers it).
