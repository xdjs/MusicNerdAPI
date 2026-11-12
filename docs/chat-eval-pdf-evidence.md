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
- The judge is the chat model at default sampling (the current Sonnet rejects a non-default temperature). Rubric `cited-evidence-v2`; the judge model is recorded in experiment metadata.
- `chatCases.ts` carries the 2026-11-06 audited references for Willie Colón / Blades and the Dutchyyy aliases, plus a twelfth case, the #1424 acceptance question, with page numbers checked against the original PDF on 2026-11-12.
- `ChatTurn.tools` records tool calls and inputs for review.

## Local results

Scores are the judge's relevance / groundedness (0 to 1). Times are first text / total in seconds. "Before" is main plus PDF reachability and the completeness instruction only; "after" adds discovery on every question, the two-source rule, previews and the narration gate.

| Case | Before | After | Evidence after |
| --- | --- | --- | --- |
| bio-ritmo-origin | 1 / 0.95, 10.6 / 10.6 s | 1 / 0.85, 10.8 / 10.8 s | 2 saved reads |
| bio-ritmo-singer | 1 / 1, 6.6 / 6.6 s | 1 / 1, 7.7 / 7.7 s | 1 saved read |
| bio-ritmo-puerta-del-sur | 1 / 1, 7.4 / 7.4 s | 1 / 1, 7.9 / 7.9 s | 1 saved read |
| bio-ritmo-colombia | 0.95 / 0.8, 9.7 / 9.7 s | see final run | 2 saved reads |
| bio-ritmo-30th | 0.6 / 0.7, 5.3 / 8.5 s (leaked planning text) | 0.75 / 0.85, 11.5 / 11.6 s | 2 saved reads |
| willie-colon-death | 1 / 0.6, 7.9 / 7.9 s | see final run | web search |
| willie-colon-blades | 0.4 / 0.95, 7.3 / 7.3 s (one source) | 0.7 / 0.75, 10.7 / 10.8 s (two sources) | 2 saved reads |
| willie-colon-instrument | 1 / 0.9, 6.9 / 6.9 s | see final run | 1 saved read |
| dutchyyy-aliases | 0.8 / 0.6, 6.6 / 12.6 s (no PDF) | 0.95 / 0.6, 11.9 / 11.9 s (PDF read) | PDF + 1 saved read |
| dutchyyy-alias-years | 0.8 / 0.8, 31.5 / 31.5 s | 0.72 / 0.8, 10.7 / 10.7 s | PDF |
| dutchyyy-onchain | 0.6 / 0.85, 6.5 / 6.5 s (no PDF) | 1 / 0.93, 11.4 / 11.4 s (PDF read) | PDF |
| dutchyyy-unanswerable | 0.95 / 0.6, 9.1 / 9.2 s | see final run | web search |

The final full run after all changes is recorded below once the staging question allowance window reopens.

Cost: one 12-case run is about $0.60 at Sonnet 5.5 rates for chat plus judge; the PDF-backed questions are about $0.14 each.

## What the numbers do not show

- First text within five seconds is not met. Answers start at 6 to 12 seconds because the model reads sources before writing; the PDF-backed answer varies from 10 to 31 seconds with provider latency. Completion within 20 seconds is met on all but the slowest PDF sample.
- The Dutchyyy acceptance answer includes The Chill Factor in roughly half of runs. The page-1 overview lists three aliases; the fourth is a one-off credit on page 2. The reference marks this as the main completeness gap and the judge scores it accordingly.
- The Willie Colón / Blades case surfaces the Rolling Stone account only when search ranks it; the two-source rule reads what search returns.
- The judge is the same model family as the answerer. Manual review of answers against captured evidence remains the acceptance gate; the judge's reasons are good at naming unsupported clauses and misplaced citations and should be read, not averaged.
- Follow-ups after a PDF read drop the previous assistant turn from history (unchanged); the model re-answers from sources, which worked in a two-turn local check but repeats itself.
