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
