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

### Claim handoff: explicit source review (#1371)

The fresh-claim automatic build may discover profile links and read sources, but it must not approve pending sources or publish About. After discovery, it opens the existing vault review step. The artist's existing review, interview/About choice, and publish actions remain authoritative. Already approved/rejected sources are not rewritten. Source discovery is not repeated merely to show the review card, including when discovery returns no sources.

### Directory-add research authorization (#1371)

Web atomically writes a `directory_add` activity and a `source_search` job with the newly inserted artist. Existing artist matches do not enqueue work. The API may perform narrowly scoped pre-claim discovery only when that exact immutable creation event belongs to the new artist and its original adder, and no claim has begun. The adder receives no editing rights. All writes recheck this authorization under the artist lock; a claim or deleted initiating account cancels it. Ordinary claim-approval research continues to use its existing authorized caller. Discovery keeps new sources pending and chains public social ingestion under the same creation lineage; it never writes a public About.
