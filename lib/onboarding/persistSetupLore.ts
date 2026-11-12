import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { authorizeLockedArtistWrite } from "@/lib/ownership/authorizeLockedArtistWrite";
import type { ArtistWriteAuth } from "@/lib/ownership/types";
import { isRealBio } from "@/lib/bio/isRealBio";
import { BioConflictError } from "@/lib/bio/BioConflictError";
import { assertLoreSourcesCurrent } from "@/lib/lore/assertLoreSourcesCurrent";
import { assertSetupDocumentCurrent } from "@/lib/onboarding/assertSetupDocumentCurrent";
import type { DocSource } from "@/lib/lore/types";

/** Save setup material and finish its steps without modifying existing About, pins or lineage. */
export async function persistSetupLore(
  artistId: string,
  ownership: ArtistWriteAuth,
  document: { content: string; sources: DocSource[] } | null,
  expectedDocument: { content: string; sources: unknown; updatedAt: string | null } | null,
): Promise<void> {
  await db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    await authorizeLockedArtistWrite(tx, artistId, ownership);
    const [artist] = rowsOf(
      await tx.execute(sql`select bio,
      exists(select 1 from artist_bio_versions where artist_id=${artistId}::uuid and is_pinned) as pinned
      from artists where id=${artistId}::uuid`),
    ) as { bio: string | null; pinned: boolean }[];
    if (!artist || (!isRealBio(artist.bio) && !artist.pinned)) throw new BioConflictError();
    await assertSetupDocumentCurrent(tx, artistId, expectedDocument);
    if (!document && !expectedDocument?.content.trim()) throw new BioConflictError();
    if (document) {
      await assertLoreSourcesCurrent(tx, artistId, document.sources, { allowEmpty: true });
      await tx.execute(sql`insert into artist_docs(artist_id,content,sources)
      values(${artistId}::uuid,${document.content},${JSON.stringify(document.sources)}::jsonb)
      on conflict(artist_id) do update set content=excluded.content,sources=excluded.sources,updated_at=now()`);
    }
    await tx.execute(sql`insert into artist_onboarding_steps(artist_id,step)
      values(${artistId}::uuid,'interview'),(${artistId}::uuid,'publish')
      on conflict(artist_id,step) do nothing`);
  });
}
