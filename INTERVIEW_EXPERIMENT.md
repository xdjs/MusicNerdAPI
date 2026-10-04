Tracks Pete's October 4 request to experiment with a better Music Nerd researcher/interviewer using LATASHA and Dutchyyy. The first deliverable is a reproducible, private question comparison in MusicNerdAPI, using read-only production snapshots. This extends the editorial discussion originating in [social research #1414](https://github.com/xdjs/MusicNerdWeb/issues/1414); the scraper PRs remain separate drafts.

> 2026-10-04 — Pete approved starting the experiment after reviewing the plan. Keep original evidence accessible, use previous answers and corrections, distinguish supported observations from proposed connections, and judge questions before changing the live interview.

## Goal

An operator can snapshot the two artists' existing research read-only, run three variants against that frozen evidence with the same model, and review questions with original source references, verification results, context size and timing. Real artist answers and profiles are never modified. The experiment is a server-side CLI in MusicNerdAPI; no public endpoint or UI is introduced.

## PRs (updated 2026-10-04)

| PR | Item | State |
| --- | --- | --- |
| MusicNerdAPI#TBD | Stored-evidence snapshot, bounded context, three-arm question experiment and private review report | In progress — branch `codex/interviewer-memory-experiment` from main `89d2f62` |
| Follow-up, after results | Integrate accepted research/context behavior into API interview and shared Lore consumers | Not started; informed by the experiment |

## Open — experiment

- [ ] **Freeze the evidence.** Snapshot own social captions, provenance-marked reel transcripts if present, approved Lore text, saved answers and corrections in a read-only transaction as the app role. Match explicit artist IDs and connected accounts. Fail on incomplete database reads. Keep private corpus/report files out of Git.
- [ ] **Compare three variants.** A: current signal-based question strategy with only structured-output transport normalization. B: a concise interviewer prompt with original-source context plus available answer/correction memory, without a separate research step. C: the same writer and context budget, with a bounded archive-retrieval/connection-planning step. Use the same model and frozen corpus; document the deliberate differences. Generated source identifiers and quoted evidence must resolve to supplied originals.
- [ ] **Make memory and connections safe to evaluate.** Preserve attribution, publication and availability dates; enforce corrections; check entire question premises, redundancy with answers, and uncertain reel speakers. Future sources must be excluded from cutoff scenarios. Current snapshots cannot reconstruct edits without source-version history; label temporal scenarios accordingly.
- [ ] **Produce reviewable results.** Private blinded question sets plus separate method key, evidence references, rejected drafts, usage/latency and remaining knowledge gaps. Model verdicts are advisory; Pete's editorial judgment is the quality decision. No claim that two artists establish general superiority.
- [ ] **Verify implementation.** Red/green tests for source identity, missing evidence, bounded retrieval/context, corrections, temporal exclusion, prior answers and uncertain speakers; all API checks. Real-model runs for both named artists. The CLI is offline from the API router, so preview health/build checks complement rather than substitute for actual CLI evidence.

## Architecture decisions

- Research and experiment implementation belongs in MusicNerdAPI. Reuse its schema, signal builders and AI Gateway client; no new database, migration, vector service or graph store.
- Source summaries are navigation aids. Questions cite original evidence; generated Lore is not independent corroboration.
- Context has a conservative UTF-8 byte budget (explicit token upper-bound proxy, not a provider tokenizer), output-token limit, request cancellation, finite model calls and no automatic retries. Record actual provider token usage.
- Stored-archive retrieval only in the first experiment. External lead-following and changes to active interview delivery follow evidence from this comparison.
- Staging inventory: LATASHA 40 posts, 0 extracted claims, 0 approved sources, 0 saved answers, 0 corrections; Dutchyyy 204 posts, 324 extracted claims, 4 approved sources, 0 saved answers, 8 corrections. Answer-memory acceptance uses separate, labelled synthetic cases, not fabricated artist answers.

## Source references

- [Social research #1414](https://github.com/xdjs/MusicNerdWeb/issues/1414), [API#18](https://github.com/xdjs/MusicNerdAPI/pull/18), [Web#1421](https://github.com/xdjs/MusicNerdWeb/pull/1421)
- API `lib/questions/`, `lib/lore/getInterviewAnswers.ts`, `lib/lore/getDocCorrections.ts`, `lib/vault/sourceSearchQueries.ts`
- [Earlier research: summarising before thinking](https://github.com/xdjs/MusicNerdWeb/blob/main/docs/rnd/research/2026-08-24-we-are-summarising-before-we-think.md)

## Running the experiment

This is an operator CLI, not a public route. It renders no UI and is not imported by active interview handlers. Node 24 and the locked pnpm dependencies are required. `tsx` is a pinned development dependency for this specific CLI.

```bash
pnpm interview:experiment --help
pnpm interview:experiment snapshot --env-file /private/path/production.env --environment production --artist-id <production-uuid> --expected-handle <connected-handle> --output /private/path/corpus.json
pnpm interview:experiment run --env-file /private/path/preview.env --corpus /private/path/corpus.json --output /private/path/new-review-directory
```

The snapshot reads through a repeatable-read, read-only transaction as `mnweb`. The operator selects the environment's connection; the environment label records that selection and is not an automatic host-to-environment classifier. Artist UUID and expected connected handle must match. Model runs read only the saved JSON and use AI Gateway; they do not connect to the database, scrape, save interview answers, or publish Lore. `--arm signals|context|connections` runs one arm. `--as-of <ISO>` filters both availability and publication. It is a current-snapshot cutoff simulation, **not a reconstructed historical deployment**: mutable posts lack version history and extracted baseline signals are derived now.

`--exclude-source <evidence-id>` can be repeated and requires `--exclusion-reason`. Exclusions remain in the private corpus audit. Production approval statuses are unchanged. Human judgment is needed when an approved source belongs to a namesake.

Each model call uses the existing Flash model by default, 512 thinking tokens, at most 6,144 output tokens, a 45-second abort signal and no automatic retries. The main evidence packet is at most 48,000 UTF-8 bytes; a call's instruction/payload ceiling is 90,000 bytes. These are conservative text-size bounds, **not exact token counts** or a tokenizer. Actual provider usage and timing are recorded. A and B require at most two calls; C at most three. Failure stops the CLI, retaining earlier completed arm JSON; use `--arm` to investigate a failed arm in a new output directory.

Long sources are divided into overlapping original passages, with source group and offsets retained. Neither the generated Lore nor an index preview becomes independent evidence. Corrections and saved answers remain whole and pinned; a memory set too large for the budget fails explicitly. The navigation index uses short previews; selected sources are opened as original text. This selection still risks missing a relevant passage, and is a variable under evaluation, not a solved retrieval problem.

Short prompt IDs such as `e17` are reversible aliases for original UUID/offset references. Full text, original URLs, dates and attribution travel alongside them; reports restore original IDs. Quotation validation permits layout-only whitespace differences for extracted PDFs and rejects changed words. The independent reviewer checks whole premises, attribution, corrections, redundancy and editorial value. Its acceptance is advisory.

Outputs are local files with mode 0600 in a mode-0700 directory: `questions.md` is blinded; `evidence.md` contains original references/excerpts; `methods.json` reveals arms and usage; `results.json` includes rejected drafts; `corpus.json` preserves the exact input. File creation refuses to overwrite existing reports. Keep all of them private and outside Git. Read the question sets before the method key.

## October 4 production correction

Pete pointed out that LATASHA's sources were approved in production. The initial inventory was staging only. Read-only production checks found LATASHÁ: 120 posts, 5 extracted claims, 15 approved sources; Dutchyyy: 199 posts, 317 extracted claims, 4 approved sources and 8 corrections. Neither has saved interview answers there. Fourteen LATASHÁ sources and three Dutchyyy PDFs have readable text. Two approved LATASHÁ Discogs entries name LaTasha Conway and LaTasha Alford; they are excluded from the experiment as apparent namesakes, with a recorded reason, without changing production data. Original artist answers in unit/negative tests are explicitly synthetic.

The first exploratory run showed that larger context can produce long, abstract questions, inaccurate quotations and invented reference IDs. It is not acceptance evidence for production. The next iteration retains the same corpus, shortens reference IDs mechanically, permits PDF whitespace normalization, and asks for concise questions and short continuous quotations. It does not relax factual or attribution requirements.

## Acceptance status

The final local implementation passed 437 test files / 1,497 tests, type-check, lint, format-check and build. Both production snapshots were exercised with real Gateway calls for all three arms. Final model-accepted question counts: LATASHÁ 3 signal / 2 context / 3 connections; Dutchyyy 3 signal / 3 context / 2 connections. These counts are not quality scores. A separate six-case synthetic verifier check matched all expected accepts/rejects.

Manual review found a consequential false positive: an animation/sampling question asserted an influence when its two sources established only separate interests. That prevents treating automatic acceptance as production editorial readiness. Other questions still trend abstract or personal rather than musically specific. The experiment is complete enough for human comparison; the improved interviewer is not proven or released. No real saved-answer or reel-transcript case was present in the selected production corpora. Future coverage must include those, more artists, and repetitions/held-out cases.

The signal arm reuses current candidate builders, answer resolution, boilerplate prioritization, diversity and collaborator caps, with structured-output transport normalized and the experiment's common runtime budget/verifier. B changes both the context and editorial prompt. C adds a research pass to B. Therefore the first comparison evaluates these bundles, not memory in isolation. Further ablations are needed to attribute gains to one change.
