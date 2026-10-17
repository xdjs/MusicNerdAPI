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

The precision improvement is measured on this same-name collision, and retention on the seven other artists. It is not a claim to solve every same-name collision or prove live Chicago discovery. Production still needs verified catalog/account anchors for the intended artist and a readable source; the HTTP 403 limitation remains. No generated biography ingestion, search-provider replacement, automatic source approval, or database cleanup is included. The provider-evidence extension below adds structured group credits. Keep this PR separate and draft until the owner accepts the recall tradeoff and deployment verification is complete.

To repeat the live comparison, obtain the manifest URLs through the normal reader, preserve those fetched pages once for both arms, and call each revision's `judgeSourceRelevance` with the listed anchors. Record verdicts, usage and elapsed time without logging credentials. For historical parity use the private archived captures; fresh fetching can change both content and accessibility. Do not run the source-search job against production just to reproduce this classifier benchmark.

## Provider-evidence extension and real-record acceptance

The initial real-record check found that the second staging Jamie Duffy row held only Deezer ID `8699816`, with no catalog anchors from the Spotify-only builder. That row is not a verified Chicago identity. Its public Deezer catalog contains _What Am I Here For (Piano Version)_; the extension now obtains this title and its canonical release URL through the existing bounded provider reader. With that actual row's new anchor, all twelve Jamie fixtures remain unresolved. This is a safe result, not Chicago acceptance.

Chicago Jamie is independently cross-linked by [Discogs 164081](https://api.discogs.com/artists/164081) and [MusicBrainz](https://musicbrainz.org/artist/6ab35c8a-60d7-4d62-8579-5861764e1b15). The extension reads structured current/former group credits only when the artist already holds a Discogs ID; it validates the returned ID and name and retains the provider URL. It does not discover or assign that ID by matching a name.

Using the production anchor builder with that verified public Discogs ID fetched seven group credits. Three rotated/reversed live-model runs accepted zero of 30 Irish pages and accepted the Chicago tribute in all three runs. The second Chicago article remained unresolved in all three. Its matching group mention occurs in a reader comment, and the returned evidence does not satisfy the supplied group fact. Do not weaken identity checks to force this article through. These runs replayed filing with inserts intercepted; they did not create a Chicago database record.

Authenticated staging admin inspection found no supported creation flow for a Discogs/MusicBrainz-only artist: Add artist requires Spotify or Deezer, and its alternative opens an email request. The admin Artist data section provides coverage metrics, not record creation. Consequently a fresh durable Chicago research job is still blocked by supported identity setup. The existing Deezer row was not relabeled and completed jobs were not reset. The previous preview advance request returned `ran: false`; it is not execution evidence. Native fetching still returns 403 for the Chicago sources; recovered Firecrawl text remains diagnostic only.

Full local suite after the provider extension: 2,812 passed, 9 skipped; type-check, lint, formatting and production build passed. Local Node is 23; CI validates Node 24. This implementation adds bounded provider reads (up to eight seconds for Discogs), so the earlier model-only latency and token comparison does not measure total new job latency or provider cost.

The post-extension seven-artist live rerun retained 27/29 readable direct-coverage pages, versus 28/29 in the earlier candidate run and 29/29 in the baseline. Aphex Twin retained 1/3 direct pages on this run; the other six artists retained all 26/26. Its collaborator-focused article still passed. All seven model calls completed without provider errors. This additional lost Aphex result is a recall limitation and demonstrates run-to-run variability; the earlier 28/29 is not a guarantee. Exact new verdicts and usage are included under `providerExtensionHeldout` in the JSON manifest.

## Scope correction and follow-up — 2026-10-16

Pete confirmed that artist creation stays unchanged. Expanding add-by-link support is not part of #52 and is not a prerequisite for reviewing this research-accuracy change. The absence of a verified Chicago record still limits the Chicago end-to-end claim, but it does not justify a special creation flow to make a benchmark pass.

### Aphex evidence audit

Inspected the saved source bodies and captured raw live-model decisions. The Furious interview mentions Richard D. James as the artist's real name, but the fixture supplied that string as a release fact. The diagnostic accepted that real-name passage as catalog evidence. This is a fixture-quality problem; the earlier 28/29 acceptance rate must not be presented as entirely well-supported catalog verification. The Chaos Control interview has none of the supplied catalog facts.

A separate corrected run excluded the mislabeled `Richard D. James` fact rather than substituting an unverified alias. Both interviews stayed unresolved. The other Aphex direct article and collaborator article retained actual release evidence and passed. This leaves direct retention at 1/3 for Aphex, or 27/29 when combined with the unchanged six-artist results from the previous run; that combined number is not a new seven-artist run. No production validation was relaxed to improve the score. Verified alias evidence could address this later, but is not implemented or claimed here.

### St. Catherine's actual-record acceptance

Read the production record and its 14 pending sources in a read-only transaction as `mnweb`. Live Deezer ID `165924737` supplied five release titles; three distinguishing titles also occur on the saved Bandcamp account `stcatherines`. Bare numeric/very short titles and name-equivalent handles do not become distinguishing facts. Other saved social handles were not independently verified or used to establish this result.

Across three runs with stored candidates plus the Bandcamp catalog and release page, none of the 14 questionable candidates was affirmed (0/42). The corroborated Bandcamp release passed identity evidence in all three runs: once as substantive coverage and twice as a listing. Catalog-page evidence validation passed in two of these three runs; the remaining run supplied non-verbatim quotes and stayed unresolved. In the earlier catalog-only control, it passed as a listing 3/3. Coverage variability remains: this is not proof of consistent press-source retention or public Lore generation.

The actual filing path replay for the original 14 candidates dropped four unreadable unrelated URLs and would retain ten text-free, identity-unassessed pending leads. Zero would retain verified text. Inserts were intercepted; account adoption and directory ambiguity were substituted. This is prevention evidence, not historical cleanup or a fresh durable-job acceptance pass.

Historical disposition: the six St. Catherine's Child pages remain unverified unless an identity connection is established; the seven institution/place/saint pages and Robin Gibb release should be rejected as unrelated through the existing review flow. No review action was performed. All 14 remain pending, including nine with previously stored text. [Per-source dispositions, live verdicts, provider anchors and filing replay](source-identity-stc-2026-10-16.json) contain no copied article bodies.

Remaining gaps are explicit: historical review is not done; the unrelated-page judge outcome is unresolved rather than a confident negative; Bandcamp identity success does not prove stable substantive-coverage classification; two valid Aphex interviews lack usable supplied evidence; and Chicago still has native-reader 403 and real-record setup limitations. No artist creation, database reset, cleanup, merge or release was added.

## Downstream boundary audit — 2026-10-16

Read-only production checks as `mnweb` found St. Catherine's has zero approved vault sources, source assessments, prepared drafts, Lore docs, confirmed research candidates and research-evidence records, and no About text. Its nine historical pending texts therefore do not enter the audited generation paths.

- Lore loads only approved, citable vault sources (`gatherDocMaterial`).
- Artist knowledge loads approved vault rows and independently filters status during normalization.
- Private directory preparation requires an unchanged identity-assessment snapshot; readable pending text alone is insufficient.
- Public-question vault evidence requires approval and a claim; its separate candidate store requires confirmed identity and current evidence revision. Neither store has eligible material for this artist.
- Current Web main generates About from stored Lore and returns `LORE_REQUIRED` when absent. The old pending-source synthesis fallback in the dirty local Web checkout is stale and was not changed. The legacy Ask fallback also selects approved vault sources.

Added regression tests for readable historical pending text exclusion in knowledge normalization and directory material loading. All 2,814 tests passed (9 skipped), along with type-check, lint, formatting and build. Tests exercise the SQL boundary in PGlite and the normalizer; they are not a live end-user answer-generation run. No confirmed downstream bypass was found, so no production behavior was changed during this audit.

The Chicago 403 findings refer to ReGen Magazine articles, not Instagram. No evidence links them to a 30-day social-fetch window or the separate June case. Historical source-review actions remain undone; the existing approval/assessment gates isolate them, so bulk cleanup is not a prerequisite for this preventive fix. This audit does not establish the correctness of every previously approved source or generated document elsewhere in the directory.
