# Music Nerd API

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

A fresh claim builds the whole page without asking: it discovers profile links, approves the pending sources it read, and writes and publishes the About, confirming each step as it goes (`runAutoBuild`). The artist reviews and corrects it on the page afterwards. A resume after a failure uses the step cards.

> **Decision 2026-10-15 (Pete):** the explicit source review that #1371 put between discovery and the About is reverted. It opened the old step-card popup on every fresh claim ([xdjs/MusicNerdWeb#1533](https://github.com/xdjs/MusicNerdWeb/issues/1533)); review belongs in the page's Lore section, not a popup. The directory-add authorization, private drafts and discovery checkpoints below stay.

### Directory-add research authorization (#1371)

Web atomically writes a `directory_add` activity and a `source_search` job with the newly inserted artist. Existing artist matches do not enqueue work. The API may perform narrowly scoped pre-claim discovery only when that exact immutable creation event belongs to the new artist and its original adder, and no claim has begun. The adder receives no editing rights. All writes recheck this authorization under the artist lock; a claim or deleted initiating account cancels it. Ordinary claim-approval research continues to use its existing authorized caller. Discovery keeps new sources pending and chains public social ingestion under the same creation lineage; it never writes a public About.

### Private directory drafts (migration 0047)

An affirmative identity verdict and readable original produce a private exact-snapshot assessment, never source approval. A separate durable preparation job synthesizes only unchanged assessed originals and stores its document/About in `artist_directory_preparations`, never `artists.bio` or `artist_docs`. Model work runs outside locks; commit rechecks creation authority, the job lease, the starting bio and every source snapshot. Claimants may reuse a draft only after explicitly approving its entire unchanged manifest and only if no newer interview/correction material would be omitted; all publication still uses the existing explicit publish action and edit/pin fences.

### Directory discovery at claim handoff

A successful directory `source_search` stores a version-1 completion checkpoint in its existing job state. Claim approval and onboarding reuse it only for 24 hours, with the original directory-add event/adder, the current approved claim, unchanged name/Spotify/Deezer identity, and an unchanged digest of that event's research originals. Human approval/rejection and source `updated_at` are excluded from the digest: review is not a request for another paid search. Missing, incomplete, legacy, stale, changed, or unreadable checkpoints use the normal discovery path. The checkpoint is written before downstream queueing, with immutable `completedAt` epoch milliseconds; job status and `updated_at` do not prove or renew discovery completion. A pending, running or failed parent can reuse its valid completed discovery while retrying only child handoff. Directory child queues are idempotent for the original event, including children already done or failed, so retries do not restart their budgets. Completed empty discovery is still complete. No new migration is needed beyond #1371's existing 0047 dependency.

At claim, the automatic build runs as usual; a resume's step cards reuse the saved discovery rather than searching again. The separate private-draft reuse rules still require every cited original to be approved and unchanged. Explicit profile discovery/research refresh remains available.

Social collection has separate durable progress. Directory social/caption jobs keep their original authority through child jobs and stop after any claim begins. At claim confirmation, replacement claim-scoped jobs retain the paid run/dataset, cursor, and bounded retry state; old workers cannot regain permission or revive retired jobs. A changed/disconnected Instagram handle cannot import an old run. An unknown provider-start outcome is retained for inspection instead of blindly starting another paid run; definite rejected starts may retry within the existing attempt limit. Pre-claim caption completion does not create public Lore. These checks make no claim that all social providers finished when web discovery did.
