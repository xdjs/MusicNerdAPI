import { and, eq, sql } from "drizzle-orm";
import { isRealBio } from "@/lib/bio/isRealBio";
import { artistBioVersions } from "@/lib/db/schema";
import type { TransactionDb } from "@/lib/ownership/types";

/**
 * Keeps bios in the artist's history, oldest first. Only real bios, and only
 * ones not already saved; history is deleted only explicitly.
 *
 * @param tx - The transaction the bio is written in.
 * @param artistId - The artist.
 * @param texts - The bios to keep, e.g. the old and the new.
 * @returns Nothing.
 */
export async function saveBioVersions(
  tx: Pick<TransactionDb, "query" | "insert">,
  artistId: string,
  texts: (string | null | undefined)[],
  provenances: unknown[] = [],
): Promise<void> {
  for (const [index, text] of texts.entries()) {
    if (!isRealBio(text)) continue;
    const bioProvenance = provenances[index] ?? null;
    const saved = await tx.query.artistBioVersions.findFirst({
      where: and(
        eq(artistBioVersions.artistId, artistId),
        eq(artistBioVersions.bioText, text!),
        bioProvenance == null
          ? sql`${artistBioVersions.bioProvenance} is null`
          : sql`${artistBioVersions.bioProvenance} = ${JSON.stringify(bioProvenance)}::jsonb`,
      ),
    });
    if (!saved)
      await tx
        .insert(artistBioVersions)
        .values({ artistId, bioText: text!, bioProvenance, isPinned: false });
  }
}
