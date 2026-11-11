import { prepareBioUrlReceipts } from "@/lib/bio/prepareBioUrlReceipts";
import { sql } from "drizzle-orm";
import { isRealBio } from "@/lib/bio/isRealBio";
import { rowsOf } from "@/lib/db/rowsOf";
import type { TransactionDb } from "@/lib/ownership/types";

/** Save text and private lineage atomically under the caller's artist lock; equal text with different evidence remains distinct. */
export async function saveBioVersions(
  tx: Pick<TransactionDb, "execute">,
  artistId: string,
  texts: (string | null | undefined)[],
  provenances: unknown[] = [],
): Promise<void> {
  for (const [index, text] of texts.entries()) {
    if (!isRealBio(text)) continue;
    const provenance = provenances[index] ?? null;
    await prepareBioUrlReceipts(tx, provenance);
    const encoded = provenance == null ? null : JSON.stringify(provenance);
    const saved = rowsOf(
      await tx.execute(sql`select v.id from artist_bio_versions v
   left join mn_private.artist_bio_version_provenance p on p.version_id=v.id
   where v.artist_id=${artistId}::uuid and v.bio_text=${text!}
     and p.provenance is not distinct from ${encoded}::jsonb limit 1`),
    );
    if (saved.length) continue;
    const [version] = rowsOf(
      await tx.execute(sql`insert into artist_bio_versions(artist_id,bio_text,is_pinned)
   values(${artistId}::uuid,${text!},false) returning id`),
    ) as { id: string }[];
    if (!version) throw new Error("Could not save About history");
    if (provenance != null)
      await tx.execute(sql`insert into mn_private.artist_bio_version_provenance(version_id,provenance)
   values(${version.id}::uuid,${encoded}::jsonb)`);
  }
}
