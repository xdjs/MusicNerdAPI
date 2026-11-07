import { sql } from "drizzle-orm";
import { rowsOf } from "@/lib/db/rowsOf";
import type { TransactionDb } from "@/lib/ownership/types";

/** Read private lineage only after the caller has established artist access/locking. */
export async function readBioProvenance(
  tx: Pick<TransactionDb, "execute">,
  artistId: string,
): Promise<unknown> {
  const [row] = rowsOf(
    await tx.execute(
      sql`select provenance from mn_private.artist_bio_provenance where artist_id=${artistId}::uuid`,
    ),
  ) as { provenance: unknown }[];
  return row?.provenance ?? null;
}
