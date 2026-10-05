import { sql } from "drizzle-orm";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { authorizeLockedArtistWrite } from "@/lib/ownership/authorizeLockedArtistWrite";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import type { TransactionDb } from "@/lib/ownership/types";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import type { ResearchJob } from "@/lib/research/types";
import type { ExtractionState } from "@/lib/sourceExtraction/types";

/** Recheck claim, lease and original eligibility under artist → job → source locks. */
export async function lockSourceExtractionSlice(
  tx: TransactionDb,
  job: ResearchJob,
  state: ExtractionState,
): Promise<"stale" | "eligible" | "changed"> {
  await lockArtistRow(tx, job.artistId);
  if (state.version === 1) {
    await authorizeLockedArtistWrite(tx, job.artistId, {
      userId: state.userId,
      expectedClaimId: state.expectedClaimId,
    });
  } else {
    const claim = await findApprovedClaim(tx, job.artistId);
    if ((claim?.id ?? null) !== state.expectedClaimId) throw new OwnershipChangedError();
  }
  const current = await tx.execute(
    sql`select id from artist_research_jobs where id=${job.id}::uuid and artist_id=${job.artistId}::uuid and kind='source_extract' and status='running' and cursor=${job.cursor} and updated_at is not distinct from ${job.updatedAt}::timestamptz for update`,
  );
  if (!current.length) return "stale";
  const source = state.sources[job.cursor];
  if (!source) return "eligible";
  const rows = await tx.execute(
    sql`select id from artist_vault_sources where id=${source.id}::uuid and artist_id=${job.artistId}::uuid and status='approved' and file_path is null and url=${source.url} and coalesce(extracted_text,'') ~ '^[[:space:]]*$' for update`,
  );
  return rows.length ? "eligible" : "changed";
}
