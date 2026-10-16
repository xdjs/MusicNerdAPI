# Source identity evaluation — 2026-10-16

Refs xdjs/MusicNerdWeb#1551. This is local live-model evaluation, not a production result. The separate YouTube deduplication PR #50 is unaffected.

## Method

Compared the existing judge at `118bb2c3115d30c0be6d4c8156ab57c5ee566780` with this branch, calling the actual Gemini 2.5 Flash model through AI Gateway. Kept temperature zero, disabled thinking, 1,500 source-text characters, maximum 12 judged pages, and a 20-second deadline. The candidate selects pages containing supplied facts before applying that cap. Source data was already captured during the provider evaluation; both arms received identical stored pages. Release anchors were corroborated in those sources and fixed before held-out judging; they were **not loaded from the production artist/catalog records**.

Jamie was the development case. Two readable Chicago articles were recovered with Firecrawl for this diagnostic because the native reader received HTTP 403. This PR does not enable a production Firecrawl reader. Ten Irish pages were natively readable. Tested each target identity with three rotated/reversed page orders. Irish anchors: `Solas`, `On A Wing`, self-titled `Jamie Duffy` and account `instagram: jamieduffyy`; Chicago anchor: `Anticore`. Name-only and account-only probes were separate. Self-titled and name-only facts cannot establish identity.

The seven other artists came from the previously annotated search benchmark. One live call per arm per artist: 14 calls, 34 pages, 30 readable, including one collaborator-focused article. [Fixture URLs, anchors and exact verdicts](source-identity-2026-10-16.json) are retained without copying source articles. This held-out sample measures retention, not broad wrong-artist precision.

## Results

| Target / measure                                          | Existing judge | Candidate |
| --------------------------------------------------------- | -------------- | --------- |
| Chicago Jamie: Irish pages incorrectly affirmed, 3 orders | 30/30          | 0/30      |
| Chicago Jamie: real Chicago pages affirmed, 3 orders      | 0/6            | 3/6       |
| Irish Jamie: real Irish pages affirmed, 3 orders          | 30/30          | 29/30     |
| Irish Jamie: Chicago pages incorrectly affirmed, 3 orders | 0/6            | 0/6       |
| Other artists: readable direct coverage retained          | 29/29          | 28/29     |
| Collaborator-focused Aphex Twin article retained          | 1/1            | 1/1       |

The Chicago tribute with `Anticore` passes in all three orders. The other Chicago article lacks the supplied release/account evidence and remains unresolved in all orders, with no retained extracted text. One Irish result fails quote validation in one order. The old judge repeatedly chose Irish Jamie even when the Chicago catalog was supplied; the candidate does not make those false affirmations.

Other artists retained: Beyoncé 5/5, Japanese Breakfast 4/4, Nilüfer Yanya 4/4, Hana Vu 6/6, The Ellis Court 1/1, Wednesday 6/6. Aphex Twin direct coverage is 2/3: the [Chaos Control interview](https://chaoscontrol.com/aphex-twin-2) lacks the supplied catalog facts and becomes an unverified lead. Four unreadable pages stay unresolved in both arms. The collaborator article remains accepted by both judges; this change does not resolve contribution-versus-subject coverage policy.

Name-only and account-only Jamie probes affirm no pages: none contains the supplied account handle. This is a deliberate loss of automatic verification, **not evidence that those sources are wrong**. Sparse or unavailable catalogs therefore remain a rollout risk.

## Failure handling and storage

Ran the actual source-filing path with inserts captured in memory, directory ambiguity forced false, and account adoption disabled for these article fixtures. Provider failure retains no extracted text and no positive identity assessment. A thirteenth candidate stays unresolved; unit coverage additionally uses 14 evidence-bearing pages to exercise the cap independently of the evidence filter. Malformed/missing evidence, invented anchors, cross-page quotations, duplicate decisions, numeric/name-only facts and late model completion after timeout have regression coverage.

No database was written. These checks do not exercise a signed-in production research job, existing-source cleanup, private draft generation, source approval, or public About publication. The UI is unchanged; entry is the existing durable source-search job, through `buildArtistAnchor` → `judgeCandidates` → `fileCandidate` / `saveCandidateSource`. Index-followed sources reuse the same judge. Existing authorization and approval gates remain authoritative.

## Time and usage

Across the seven held-out artists, median batch latency rose from 1.00 s to 3.27 s. Input tokens were 16,752 → 15,879; output tokens 436 → 3,196; total tokens 17,188 → 19,075 (+11.0%). This is **not** an 11% dollar-cost estimate: output and input token rates differ. No additional search calls or model calls were added; producing supporting quotations increases generation work. Small sample, not a load test or p95 estimate.

## Review and rollout limits

The precision improvement is measured on this same-name collision, and retention on the seven other artists. It is not a claim to solve every same-name collision or prove live Chicago discovery. Production still needs verified catalog/account anchors for the intended artist and a readable source; the HTTP 403 limitation remains. No new verified biography/group-membership ingestion, provider replacement, automatic source approval, or database cleanup is included. Keep this PR separate and draft until the owner accepts the recall tradeoff and deployment verification is complete.

To repeat the live comparison, obtain the manifest URLs through the normal reader, preserve those fetched pages once for both arms, and call each revision's `judgeSourceRelevance` with the listed anchors. Record verdicts, usage and elapsed time without logging credentials. For historical parity use the private archived captures; fresh fetching can change both content and accessibility. Do not run the source-search job against production just to reproduce this classifier benchmark.
