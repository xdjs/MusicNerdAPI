# Endpoint documentation draft — not published

## PUT /api/artistBio/{id}: regenerate About

Authenticate with the browser Privy access token as a Bearer token. The caller must be the approved claimant or an admin; trusted-contributor status alone does not grant this action. Send `{ "regenerate": true }` to regenerate, or use the existing `{ "bio": "..." }` edit contract.

Regeneration prepares missing or stale Lore from already saved eligible readable material, then generates About. A current Lore document is reused. This action does not start source discovery/extraction, full research or onboarding. A newly submitted URL may still need processing or moderation before it is eligible. A pinned biography is returned unchanged with a message requiring unpinning before regeneration.

Success uses the existing response shape: HTTP200 `{ "status": "ok", "message": "...", "bio": "..." }`. A successful Lore step alone is not About success. If Lore preparation succeeds but About fails, the prepared Lore may remain saved while the previous About is preserved.

Errors use `{ "status": "error", "error": "...", "code"?: "..." }`. Codes are optional; clients must not require them for every error.

| Outcome | Status / optional code | Client behavior |
| --- | --- | --- |
| No usable saved Lore | 409 / LORE_REQUIRED | Explain processing/review prerequisites; retain displayed About |
| Existing Lore/About generation lease | 409 / LORE_PREPARING | Show busy state; retry later, not a second simultaneous generation |
| Lore preparation or its settlement failed | 500 / LORE_PREPARATION_FAILED | Show preparation error; retain About; observe recovery guidance |
| Source, claim, document or About changed before save | 409, no required code | Reload current state before retry |
| About generation timeout mapped by generator | 408, no required code | Preserve About; allow a deliberate later retry |
| About generation or lease cleanup failed | 500, no required code | Do not claim success; preserve About and show returned guidance |

The handler starts a45-second budget at entry; the host route declares60 seconds. This is not a proven hard wall-clock guarantee across authentication, database stalls and host termination. Preparation-stage aborts can surface as preparation failures rather than408. Do not automatically retry an uncertain outcome without checking saved state.

Implementation references: `lib/bio/putArtistBioHandler.ts`, `generateArtistBio.ts`, `prepareAboutLore.ts`, `updateArtistBio.ts`; exact review branch is `codex/1655-api-review-20261105`. Publish this in the required API documentation codebase only after its location/review is established. This local text does not claim that separate documentation PR already exists.
