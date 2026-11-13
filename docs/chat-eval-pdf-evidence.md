# Chat eval with PDF evidence (Web #1424), November 12, 2026

What changed, how it was measured, and what the numbers do and do not show. Local runs used the real handler in process against the staging database with a direct Anthropic provider for the same model (`anthropic/claude-sonnet-5.5`, effort `low`), judged by the same `judgeCitedAnswer` code. The hosted Evals workflow runs the identical suite through the Vercel AI Gateway.

## Why

The November 12 audit of #1424 found two separate problems. The production chat could not open an approved PDF for an ordinary question: PDF search was described to the model as "only for document/PDF questions", the prompt mentioned PDFs only under "for a PDF question", and PDF ranking used titles alone. Separately, the draft quote-only answer mode in API #112 omitted facts that were in its input. This change keeps the production prose answer and fixes reachability, then makes the eval able to score PDF-cited answers at all: on main, `readChatEvidence` captured only `readSource` and `webSearch`, so any answer citing a PDF was unscorable.

## What changed

Chat:

- Instructions treat approved PDFs as a corpus for ordinary questions, start every question with `searchSources` and `searchPdfSources` together, read two sources for first/earliest/when questions and report disagreement, and scan a whole source when every item of a kind is asked.
- `searchPdfSources` ranks by title and stored extracted text, accepts short Unicode terms, returns a 240-character preview per PDF, and its revision includes an extraction digest.
- `gateStepText` keeps planning narration written before a tool call off the stream. Text at the start of a step is held for 240 characters; a tool call in that step drops it, the step ending releases it. The final answer streams normally.

Eval:

- `readPdfChatEvidence` refetches the cited public PDF, verifies its bytes hash to what the tool reported, and extracts text with `[page N]` markers so `[n, p.N]` citations can be checked.
- The judge is the chat model at default sampling (the current Sonnet rejects a non-default temperature). Rubric `cited-evidence-v3`; the judge model is recorded in experiment metadata.
- `chatCases.ts` carries the 2026-11-06 audited references for Willie Colón / Blades and the Dutchyyy aliases, plus a twelfth case, the #1424 acceptance question, with page numbers checked against the original PDF on 2026-11-12.
- `ChatTurn.tools` records tool calls and inputs for review.

## Local results

Scores are the judge's relevance / groundedness (0 to 1). Times are first text / total in seconds. "Before" is main plus PDF reachability and the completeness instruction only. "Final" is the committed branch (`cc3a257`), run across three allowance windows on 2026-11-12 because the staging visitor allowance is 30 questions per rolling hour.

| Case | Before | Final | Final evidence |
| --- | --- | --- | --- |
| bio-ritmo-origin | 1 / 0.95, 10.6 / 10.6 s | 0.95 / 0.8, 11.5 / 11.5 s | 2 saved reads |
| bio-ritmo-singer | 1 / 1, 6.6 / 6.6 s | 1 / 0.95, 7.0 / 7.0 s | 1 saved read |
| bio-ritmo-puerta-del-sur | 1 / 1, 7.4 / 7.4 s | 1 / 1, 7.3 / 7.3 s | 1 saved read |
| bio-ritmo-colombia | 0.95 / 0.8, 9.7 / 9.7 s | 0.95 / 0.7, 8.7 / 8.8 s | 2 saved reads |
| bio-ritmo-30th | 0.6 / 0.7, 5.3 / 8.5 s (leaked planning text) | 0.75 / 0.9, 11.4 / 11.5 s | 2 saved reads |
| willie-colon-death | 1 / 0.6, 7.9 / 7.9 s (web) | 1 / 0.95, 8.3 / 8.3 s | 1 saved read |
| willie-colon-blades | 0.4 / 0.95, 7.3 / 7.3 s (one source) | 0.6 / 0.75, 9.8 / 9.8 s | 2 saved reads |
| willie-colon-instrument | 1 / 0.9, 6.9 / 6.9 s | 1 / 1, 8.5 / 8.5 s | 1 saved read |
| dutchyyy-aliases | 0.8 / 0.6, 6.6 / 12.6 s (no PDF) | 0.95 / 0.85, 9.8 / 9.8 s | PDF |
| dutchyyy-alias-years | 0.8 / 0.8, 31.5 / 31.5 s | 0.8 / 0.85, 10.1 / 10.1 s | PDF |
| dutchyyy-onchain | 0.6 / 0.85, 6.5 / 6.5 s (no PDF) | 1 / 0.9, 10.3 / 10.3 s | PDF |
| dutchyyy-unanswerable | 0.95 / 0.6, 9.1 / 9.2 s | 0.95 / 0.8, 8.6 / 8.6 s | web search |

Final averages: relevance 0.91, groundedness 0.87; 12 of 12 complete within 20 seconds; 0 of 12 show first text within 5 seconds (range 7.0 to 11.5 s). The judge's reasons name the remaining gaps: the 30th-year answer hedges instead of committing to Salsa System; the first-album answer does not surface the Rolling Stone account; the acceptance answer omits The Chill Factor in this sample (it appears in about half of runs); the unanswerable answer's process claims are uncited.

Cost: one 12-case run is about $0.60 at Sonnet 5.5 rates for chat plus judge; the PDF-backed questions are about $0.14 each. Raw per-case outputs, tool calls and judge reasons were kept locally for review and are not committed.

## Hosted record

The Evals workflow (`suite=chat`) on this branch records the same suite through the Vercel AI Gateway to Braintrust. Three attempts on 2026-11-12 each exposed a harness defect that this branch fixes (missing storage origin, PDF parts refused by the spend guard, the guard's five-dollar ledger exhausted at 39 requests); the fourth hit the evals' own staging allowance. The run after the allowance reopened, [Actions run 43302586217](https://github.com/xdjs/MusicNerdAPI/actions/runs/43302586217) on `7847392`, answered 11 of 12 cases (the twelfth, the unanswerable control, hit the allowance by one slot): answer relevance 89.6%, source groundedness 87.5%, citations 100%, evidence scorable 91.7%, total time 100%, first text 0%; 44 paid requests, $6.88 reserved of the $10 ceiling, actual spend about a dollar. Per-case answers, captured evidence and judge reasons are in the private Braintrust experiment `chat · anthropic/claude-sonnet-5.5 · 7847392`.

## Pass and fail (added 2026-11-12, decided with Pete)

Before this change the suite recorded six scores per case and nothing could fail a run. `lib/evals/chatGates.ts` now defines the gates and `lib/evals/chatReporter.ts` applies them, printing every row and making `braintrust eval` exit non-zero when a gate is missed:

| Gate                         | Threshold                                                 |
| ---------------------------- | --------------------------------------------------------- |
| answer_relevance             | mean over questions at least 0.80; no question below 0.60 |
| source_groundedness          | mean over questions at least 0.80; no question below 0.60 |
| citations, evidence_scorable | 1 on every answerable row                                 |
| total_time                   | 1 on every row                                            |
| errors                       | no row may end in an error                                |
| first_text                   | reported, not gated                                       |

A question with `trials` (the acceptance question runs three times) contributes the mean of its trials, so every question weighs the same. First text is not gated because the chat reads sources before it writes; the five-second target waits on a product change, a status line streamed while reading, tracked separately.

The judge is `MODEL_JUDGE` (`openai/gpt-5.4`), a different model family from the chat model, so an answer is never graded by its own author. Scores from the earlier Sonnet judge (the tables above) and from `MODEL_JUDGE` are not directly comparable; the experiment metadata records `judgeModel`.

### Choosing the judge (2026-11-13)

The `chat-pdf-text` suite asked the acceptance question ten times (hosted runs 43353848854 and 43354317150) and graded every answer with three candidates. Six answers named all four aliases; four omitted The Chill Factor, which the reference calls the main completeness gap.

| Judge | Relevance, complete / incomplete answers | Groundedness range | Failed calls | Latency |
| --- | --- | --- | --- | --- |
| google/gemini-3.8-flash | 1.0 / 0.90–0.95 | always 1.0 | 0 of 10 | 6–9 s |
| google/gemini-4-hydrogen | 0.90–1.0 / 0.85–0.90 | 0.85–1.0 | 2 of 10 | 9–14 s |
| openai/gpt-5.4 | 0.93–0.95 / 0.87–0.90 | 0.79–0.96 | 0 of 10 | 3–5 s |

GPT-5.4 separated complete from incomplete answers every time, was the only judge whose groundedness ever moved (its reasons name the specific claim), never failed a call, and was the fastest. Gemini 3.8 Flash never found a groundedness fault in ten answers. Gemini 4 Hydrogen failed two calls through the gateway. The spend guard prices all three (`createEvalBudgetFetch`), so the comparison can be rerun.

### Text beside the bytes (2026-11-13, not kept)

One paired experiment tested handing the model the PDF's extracted text with page markers beside the original bytes, five trials each. All four aliases appeared in 3 of 5 bytes-only answers and 2 of 5 text-alongside answers; every answer cited correctly and finished under 20 seconds. No evidence of improvement for about 40% more input per PDF read, so the variant was removed; the alias rate stays about one in two, measured by three trials in the chat suite.

### First hosted gated run (2026-11-13, run 43353465167)

Fourteen rows (twelve questions, the acceptance question three times), judged by Gemini 3.8 Flash before the judge choice above: means relevance 0.95, groundedness 1.0, citations 0.97, total time 1.0. One row failed the gates and so did the run: the `dutchyyy-aliases` answer cited a number that no returned source carried, which also left the judge without evidence for it. The other thirteen rows passed every gate. The suite now logs the cited and returned numbers when that happens.

## Staging allowance

Staging admits 30 chat questions per rolling hour per visitor key and 200 per day. The suite does not bypass this. When a question is refused, `withAllowanceWait` sleeps until the reset the response reports (plus two seconds) and asks once more; a refusal that is further away than an hour, the daily allowance, is returned as the error it is and fails the run. The hosted job's timeout is 80 minutes to allow one such wait. Two hosted runs in the same hour therefore take longer, not fewer answers.

## Running locally

`pnpm eval:local evals/chat.eval.ts` runs the suite from `.env.local` through the Vercel AI Gateway with `--no-send-logs`: the same handler, judge and reporter as the hosted workflow, nothing sent to Braintrust, no Braintrust key needed. The hosted workflow holds the gateway credential as a secret, so experiments run there by preference; no secret needs to leave Vercel or GitHub. `.env.local` needs `AI_GATEWAY_API_KEY`, the staging `SUPABASE_DB_CONNECTION` and `SUPABASE_URL`, `TAVILY_API_KEY` and a `MUSICNERD_RESEARCH_API_KEY` (any 32+ character string; it keys the local visitor allowance separately from the hosted runs). One 14-question run is about a dollar.

## Follow-up turns (2026-11-13)

Before this change the body validator dropped every earlier answer that had read a PDF, because the document's access can change between turns and the old answer would replay it. The guard stays, narrowed: `keepCurrentPdfTurns` keeps such an answer only while every document it read is still published for the artist at the revision it read (the read tool now returns `revision`); otherwise the answer is dropped as before. The chat suite's `dutchyyy-aliases` case gained a follow-up row, asked with the first answer in the conversation and scored like any other row.

## Passages run

With `CHAT_RETRIEVAL=units` the chat answers from `searchPassages` and `readUnits` instead of the whole-source and PDF tools, and the suite judges what those tools returned. The workflow input `retrieval` (`legacy` or `units`, default `legacy`) sets `CHAT_RETRIEVAL` for the run, and the experiment metadata records it as `retrieval`.

- **Evidence is the tool output.** Each search result and each unit read becomes one evidence row with its text exactly as the model saw it; nothing is refetched (the PDF refetch applies only to the legacy PDF tools).
- **Locator markers.** Each row's text starts with `[<locator>]` on its own line (for example `[p.3]`), so a `[n, p.N]` citation can be checked against the pages the model was shown, the way `[page N]` markers are checked today.
- **Follow-ups.** The turn's replayed parts include the `tool-searchPassages` and `tool-readUnits` parts, so the follow-up row sends `documents` and the handler checks them as it does for a client.
- **Output.** As before, only numbers are printed; no passage text reaches the log.

Run: `gh workflow run evals.yml -f suite=chat -f retrieval=units`, then once with `-f retrieval=legacy` on the same commit.

| Measure                  | legacy | units | Delta |
| ------------------------ | ------ | ----- | ----- |
| Gate result              |        |       |       |
| Mean answer_relevance    |        |       |       |
| Mean source_groundedness |        |       |       |
| Mean first signal (ms)   |        |       |       |
| Mean first text (ms)     |        |       |       |
| Mean total time (ms)     |        |       |       |
| Per-question deltas      |        |       |       |

To be filled from the hosted runs.

## What the numbers do not show

- First text within five seconds is not met. Answers start at 6 to 12 seconds because the model reads sources before writing; the PDF-backed answer varies from 10 to 31 seconds with provider latency. Completion within 20 seconds is met on all but the slowest PDF sample.
- The Dutchyyy acceptance answer includes The Chill Factor in roughly half of runs. The page-1 overview lists three aliases; the fourth is a one-off credit on page 2. The reference marks this as the main completeness gap and the judge scores it accordingly.
- The Willie Colón / Blades case surfaces the Rolling Stone account only when search ranks it; the two-source rule reads what search returns.
- The judge is the same model family as the answerer. Manual review of answers against captured evidence remains the acceptance gate; the judge's reasons are good at naming unsupported clauses and misplaced citations and should be read, not averaged.

## Vision pass proof (2026-11-13, part 1 of the grounded chat plan)

The page-level index reads scanned pages with a vision model instead of the native whole-PDF read. Before wiring that path, the `vision-page` suite transcribes a committed image-only fixture (`lib/units/__tests__/fixtures/scanned-page.pdf`, one page, no text layer, the sentence "Music Nerd vision fixture, November 2026") through the gateway with `MODEL_OCR` (`google/gemini-3.8-flash`) as a one-page PDF file part. Hosted run [43501462312](https://github.com/xdjs/MusicNerdAPI/actions/runs/43501462312) on `e6c0213`: `contains_phrase` 100%, no errors. Two harness defects were fixed on the way: the suite resolved the fixture with `import.meta.url`, which the Braintrust bundle leaves empty, and the spend guard refused `file` parts in user messages before the request left. The suite logs only the score and, on failure, the provider error, never the transcription.

## Retrieval eval

The `retrieval` suite (`evals/retrieval.eval.ts`) measures the page-level text index before any model reads it. For each of the twelve chat questions plus the `dutchyyy-aliases` follow-up (`lib/evals/retrievalCases.ts`) it calls `searchUnits(artistId, question, { names: [artistName] })` on the staging database and scores the top eight hits against labelled `{ sourceKind, sourceId, locator }` pairs: `recall_at_8` (share of expected pairs found; an unlabelled unanswerable case scores 1 when the search is weak) and `reciprocal_rank` (1 over the rank of the first expected hit, 0 when absent). The task's only model call is the query embedding, behind the spend guard, which prices gateway `/embedding-model` requests at the embedding model's rate and refuses any other unpriced gateway model path. The output holds source ids, locators, titles, public URLs and scores, never unit text.

**Gates** (`lib/evals/retrievalGates.ts`): mean `recall_at_8` over labelled cases at least 0.8, and no labelled case with `reciprocal_rank` 0. Cases with no labels are reported but never gate, so runs can pass while labels are written; a run with no labelled case at all fails ("no labelled cases"). The run must pass before the chat flag for the index is turned on anywhere.

**One-time backfill.** On a fresh staging database, after Web migration 0066 is applied there and before the first `retrieval` run, run the `units-backfill` suite once (`gh workflow run evals.yml -f suite=units-backfill`). For each artist in the cases it ingests every source whose indexed revision is not its current revision, with OCR, and reports counts only (`sources`, `ingested`, `failed`, `unitsWritten`); the `indexed` score is 1 when units were written or the artist has no sources.

**Labelling.** Run `gh workflow run evals.yml -f suite=retrieval -f label=true`. The hosted log then lists one line per hit on stderr: `label <case> #<rank> <sourceKind> <sourceId> <locator> <title> <url>`, without text. The labeller opens each public document at the listed page, decides which units answer the question, and writes the pairs into `expected` in `retrievalCases.ts` (the known Dutchyyy PDF pages are in those cases' `note`). Only public documents are opened; nothing from a private source is copied into the repository. Pete confirms the labels in the pull request. A case that cannot pass is reported, not relabelled; ranking (`RRF_K`, candidate counts, alias expansion) is tuned until the gates pass.

The spend guard's embedding path suffix (`/embedding-model`) is read from the installed AI SDK gateway provider; the first hosted run confirms it, and a different suffix is fixed in the same pull request.
