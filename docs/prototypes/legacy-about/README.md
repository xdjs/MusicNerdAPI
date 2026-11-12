# Isolated stricter legacy About visibility candidate

This records a local policy candidate now applied to the API public projector and isolated SQL guard, with the Web worker mirroring the policy. It is not a production release or migration. It writes no artist evidence, runs no model and invents no provenance. Run `node node_modules/vitest/vitest.mjs run docs/prototypes/legacy-about` from the API checkout with existing dependencies.

## Baseline evidence

At API `c6399c7157244f010a9f0897450c4a4f9cb192ef` and Web `bf40fb843e14b10b02510493c9b017962d7e3ab7`, both `projectSavedPublicBio` implementations return a real biography with null provenance when a current approved claim exists. Both also allow a hash-valid generated biography with an empty source array under its original current claim. Claim ownership establishes editing authority; neither condition establishes what evidence produced the text. The isolated guarded SQL prototype implements the same exceptions.

The candidate removes those two public-display exceptions:

| Stored lineage | Existing saved-About behavior | Candidate behavior |
| --- | --- | --- |
| Null legacy lineage, claimed | Public text | Hidden |
| Generated, empty sources, matching claim/hash | Public text | Hidden |
| Explicit authored, empty sources, matching nonnull current claim/hash | Public text | Preserved |
| Unknown, malformed, mismatched or withdrawn vault lineage | Hidden | Hidden |

The candidate and wrapper still delegate all other validation to the existing projector. This is not a new source-kind or moderation policy. Claimed nonempty interview/social manifests retain their existing treatment; this experiment does not add record-level validation for those kinds. Source eligibility passed to the application projector must still come from the real authorized public-source query.

## Preservation and parity evidence

`projectEvidenceBackedBio.ts` wraps the actual API projector; its optional projector argument lets the same candidate run against a pinned copy of the previous Web projector. Previous API and Web implementations remain in fixtures solely to demonstrate the behavioral difference. `fixtures/provenance.json` records the original Web source hash and commits. Only dependency import paths and formatting were adapted for portability. The Web fixture uses API counterparts for text classification, URL validation and source revisions; their inspected behavior matched, but this is not an independently booted Web application or route test.

`buildEvidenceBackedSql.ts` modifies exactly the two corresponding clauses in the existing isolated SQL prototype and refuses an unexpected template. The PGlite matrix compares baseline API/Web results with candidate API/Web/SQL results. It resets one synthetic artist per case, verifies raw biography and pinned-history bytes remain unchanged, and closes the in-memory database. No deployed database, credential or network connection is involved.

A current source row cannot retroactively prove the origin of unrelated legacy text. The tests therefore hide null-lineage text even if eligible evidence was added afterward. The real `nextBioProvenance` helper retains null lineage for a legacy manual edit; pinning preserved text is not authorship certification. No automatic promotion to `authored` is proposed. Any future explicit authorship attestation flow needs its own authorization/product decision.

## Decision and rollout limitations

Adopting this candidate would hide legitimate legacy biographies, including claimed and pinned ones whose provenance was never recorded. Raw owner/editor text and history must remain available so users can review them; no background regeneration, destructive cleanup or automatic evidence assignment is authorized. Whether that public visibility loss is acceptable is a product decision, not a conclusion established by passing tests.

The local API saved-About policy and isolated SQL guard are changed; the wrapper itself is imported only by this comparison experiment. No deployed API/Web/public SQL policy changes have been made. Directory fallbacks, caches and direct database access require separate rollout verification. A real rollout would need coordinated public-reader changes, approved treatment of directory fallback and user messaging, existing role/client cutover protections, cache handling and native PostgreSQL validation. This experiment neither repairs historic provenance nor closes existing raw-reader access by itself.
