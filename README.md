# Music Nerd API

Read the [API documentation](https://docs.musicnerd.net). The API landing page also links there; API endpoints and authentication are unchanged.

The API behind [Music Nerd](https://www.musicnerd.xyz). Next.js 16, API routes only.

- **Contributing:** [`AGENTS.md`](AGENTS.md) covers layout, conventions and commands.
- **Social research:** [`SOCIAL_RESEARCH.md`](SOCIAL_RESEARCH.md) covers actors, caps, transcript context and durable collection.

```bash
pnpm install
pnpm dev
curl http://localhost:3000/api/health   # {"status":"ok"}
```

### Pre-claim knowledge visibility (#1371)

Public research may use public social posts and catalog/Latest material before an artist claims their profile. Stored Lore evidence and its approved discovery revisions require a current approved claim on every public read, including saved-answer source revalidation. Claimant/admin knowledge tools keep their existing authorization. See the [Web visibility contract](https://github.com/xdjs/MusicNerdWeb/blob/codex/private-onboarding-1371/docs/directory-onboarding-visibility.md). This prerequisite does not enqueue directory discovery or publish pending sources.

### Claim handoff: the automatic build

A fresh claim builds the whole page without asking: it discovers profile links, approves the pending sources it read, and writes and publishes the About, confirming each step as it goes. The artist reviews and corrects it on the page afterwards.

The build runs on the server as a durable [Vercel Workflow](https://vercel.com/docs/workflows) (`lib/claimBuild/claimBuildWorkflow.ts`), so nobody has to keep the page open. MusicNerdWeb starts it with `POST /api/onboarding/{artistId}/build` when an admin approves a claim; calling it again restarts a stopped build at the first unconfirmed step. Each stage (`buildClaimProfiles`, `buildClaimSources`, `buildClaimAbout`) is a retried step that runs as the approved claimant and confirms its own onboarding step. A `claim-build:{artistId}` hook keeps one build per artist. The page only polls `GET /api/onboarding/{artistId}/state` ([xdjs/MusicNerdWeb#1538](https://github.com/xdjs/MusicNerdWeb/issues/1538)). The chat `open` turn still runs the same build inline for clients that send it; it goes away once MusicNerdWeb stops sending turns in production.

> **Decision 2026-10-15 (Pete):** the explicit source review that #1371 put between discovery and the About is reverted. It opened the old step-card popup on every fresh claim ([xdjs/MusicNerdWeb#1533](https://github.com/xdjs/MusicNerdWeb/issues/1533)); review belongs in the page's Lore section, not a popup. The directory-add authorization, private drafts and discovery checkpoints below stay.

### Directory-add research authorization (#1371)

Web atomically writes a `directory_add` activity and a `source_search` job with the newly inserted artist. Existing artist matches do not enqueue work. The API may perform narrowly scoped pre-claim discovery only when that exact immutable creation event belongs to the new artist and its original adder, and no claim has begun. The adder receives no editing rights. All writes recheck this authorization under the artist lock; a claim or deleted initiating account cancels it. Ordinary claim-approval research continues to use its existing authorized caller. Discovery keeps new sources pending and chains public social ingestion under the same creation lineage; it never writes a public About.

### Private directory drafts (migration 0047)

An affirmative identity verdict and readable original produce a private exact-snapshot assessment, never source approval. A separate durable preparation job synthesizes only unchanged assessed originals and stores its document/About in `artist_directory_preparations`, never `artists.bio` or `artist_docs`. Model work runs outside locks; commit rechecks creation authority, the job lease, the starting bio and every source snapshot. Claimants may reuse a draft only after explicitly approving its entire unchanged manifest and only if no newer interview/correction material would be omitted; claimant publication still uses the existing explicit publish action and edit/pin fences. The separate public directory projection is described below.

### Directory discovery at claim handoff

A successful directory `source_search` stores a version-1 completion checkpoint in its existing job state. Claim approval and onboarding reuse it only for 24 hours, with the original directory-add event/adder, the current approved claim, unchanged name/Spotify/Deezer identity, and an unchanged digest of that event's research originals. Human approval/rejection and source `updated_at` are excluded from the digest: review is not a request for another paid search. Missing, incomplete, legacy, stale, changed, or unreadable checkpoints use the normal discovery path. The checkpoint is written before downstream queueing, with immutable `completedAt` epoch milliseconds; job status and `updated_at` do not prove or renew discovery completion. A pending, running or failed parent can reuse its valid completed discovery while retrying only child handoff. Directory child queues are idempotent for the original event, including children already done or failed, so retries do not restart their budgets. Completed empty discovery is still complete. No new migration is needed beyond #1371's existing 0047 dependency.

At claim, the automatic build runs as usual (the claim build workflow); a chat resume's step cards reuse the saved discovery rather than searching again. The separate private-draft reuse rules still require every cited original to be approved and unchanged. Explicit profile discovery/research refresh remains available.

Social collection has separate durable progress. Directory social/caption jobs keep their original authority through child jobs and stop after any claim begins. At claim confirmation, replacement claim-scoped jobs retain the paid run/dataset, cursor, and bounded retry state; old workers cannot regain permission or revive retired jobs. A changed/disconnected Instagram handle cannot import an old run. An unknown provider-start outcome is retained for inspection instead of blindly starting another paid run; definite rejected starts may retry within the existing attempt limit. Pre-claim caption completion does not create public Lore. These checks make no claim that all social providers finished when web discovery did.

### Research source identity (#1548)

Source deduplication retains case-sensitive YouTube video IDs across watch, short, mobile, embed and live URLs, ignoring tracking parameters. Distinct interviews remain separate candidates. Existing verification, authorization and pending-source storage rules still apply. No public endpoint contract or database schema changes.

### Evidence-backed research identity (#1551)

Source relevance separates artist identity from coverage. Positive decisions must identify a distinguishing existing catalog/account anchor and quote supporting text from the excerpt actually sent to the judge. Artist-name matches alone, missing evidence, malformed responses and conflicting duplicate judgments remain unresolved. Pages lacking any supplied fact stay unresolved without a model call; remaining pages compete for the existing judgment budget. Excerpts retain introductory context and expose a bounded passage containing a known anchor when it falls below the initial excerpt.

Unresolved, unreadable, failed and over-limit candidates can only remain unverified leads under the existing source-eligibility rules, with no extracted source text; name matching cannot promote them to verified sources. The existing 12-page/20-second budget, provider/model, search queries and downstream approval/authorization rules remain unchanged. No generated biography or search snippet becomes a verified identity fact. Stored provider IDs supply catalog, account and structured group-credit anchors; generated biographies never supply identity facts.

[Live identity benchmark and rollout limits](docs/benchmarks/source-identity-2026-10-16.md).

Identity inputs now fall back to the held Deezer artist's bounded catalog when Spotify yields no catalog. Release URLs accompany those facts. For an already-held Discogs artist ID, structured current/former group credits are fetched with an eight-second deadline, a two-MiB response ceiling, ID/name validation and no redirects. Each group retains its provider URL; search-result biographies do not supply facts. Group evidence still requires a genuine source passage connecting the article's subject to that credit. Missing IDs, unavailable providers and mismatched identity responses add no facts. This does not assign Discogs IDs to existing artists, relabel namesakes, approve sources or reset completed research jobs.

### Source-attributed directory About (#1558)

New preparation jobs also save a versioned `public_about` envelope, separate from the private draft and the artist's published bio. Web migration **0054** must be applied before deploying this worker. Web revalidates creation lineage, claim state, identity and unchanged assessed originals before displaying it; old private drafts are not automatically public. No profile read starts research.

An exact, bounded biography passage from an identity-assessed platform profile matching a saved artist account is preferred. A similar artist/domain name is not ownership proof; custom-domain websites without ownership evidence use the researched fallback. For researched About, displayed sources are the union of validated citations in the research document and its About summary, so summarization cannot drop attribution for upstream evidence. The About must itself carry valid citations. Unknown source references or unsafe source URLs withhold the public projection. Public output contains only prose and source attribution, never the private document or original text.

Admin corrections to directory About carry `public_about.editedByAdmin: true`. Directory preparation preserves the entire corrected preparation on conflict, including during overlapping generation, while finishing its job. Web read-time eligibility still withdraws invalid source/identity evidence; automatic preparation never clears this human-edit protection. See MusicNerdWeb#1569.
