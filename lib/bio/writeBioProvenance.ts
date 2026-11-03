import { sql } from "drizzle-orm";
import type { TransactionDb } from "@/lib/ownership/types";

/** Publish private lineage in the same artist-locked transaction as its text. */
export async function writeBioProvenance(
  tx: Pick<TransactionDb, "execute">,
  artistId: string,
  provenance: unknown,
): Promise<void> {
  if (provenance == null) {
    await tx.execute(
      sql`delete from mn_private.artist_bio_provenance where artist_id=${artistId}::uuid`,
    );
    return;
  }
  await tx.execute(sql`insert into mn_private.artist_bio_provenance(artist_id,provenance)
 values(${artistId}::uuid,${provenance == null ? null : JSON.stringify(provenance)}::jsonb)
 on conflict(artist_id) do update set provenance=excluded.provenance`);
}
