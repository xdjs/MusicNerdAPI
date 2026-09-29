import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistDocCorrections } from "@/lib/db/schema";
import type { DocCorrection } from "@/lib/lore/types";

/**
 * The artist's corrections to their Lore. They live outside the document so a
 * rebuild re-applies them instead of destroying them.
 *
 * @param artistId - The artist.
 * @returns The corrections; [] on a database error, so the Lore still builds.
 */
export async function getDocCorrections(artistId: string): Promise<DocCorrection[]> {
  try {
    const rows = await db
      .select()
      .from(artistDocCorrections)
      .where(eq(artistDocCorrections.artistId, artistId));
    return rows.map(r => ({ id: r.id, claim: r.claim, correction: r.correction, kind: r.kind }));
  } catch (e) {
    console.error("[getDocCorrections] Error:", e);
    return [];
  }
}
