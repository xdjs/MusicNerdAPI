Tracks Pete's October 4 request to experiment with a better Music Nerd researcher/interviewer using LATASHA and Dutchyyy. The first deliverable is a reproducible, private question comparison in MusicNerdAPI, using stored staging evidence. This extends the editorial discussion originating in [social research #1414](https://github.com/xdjs/MusicNerdWeb/issues/1414); the scraper PRs remain separate drafts.

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
- [ ] **Compare three variants.** A: current signal-based question strategy with only structured-output transport normalization. B: original-source context plus available answer/correction memory, using direct questions. C: the same writer and context budget, with a bounded archive-retrieval/connection-planning step. Use the same model and frozen corpus; document the deliberate differences. Generated source identifiers and quoted evidence must resolve to supplied originals.
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
