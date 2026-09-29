import { eq } from "drizzle-orm";
import { EMPTY_EXTRACTION } from "@/lib/credits/const";
import { roleIsSomebodyElsesHandle } from "@/lib/credits/roleIsSomebodyElsesHandle";
import type { ArtistStatement, CaptionCredit, CaptionExtraction } from "@/lib/credits/types";
import { db } from "@/lib/db/db";
import { artistSocialCredits } from "@/lib/db/schema";

/**
 * Reads back what was extracted, in the shape the extractor produced. Stored
 * roles that are really somebody else's handle are dropped on the way out too,
 * so rows written before that rule stop being wrong without a seven-minute
 * re-extraction.
 *
 * @param artistId - The artist.
 * @returns The credits and statements; empty on any failure.
 */
export async function getSocialCredits(artistId: string): Promise<CaptionExtraction> {
  if (!artistId) return EMPTY_EXTRACTION;
  try {
    const rows = await db
      .select()
      .from(artistSocialCredits)
      .where(eq(artistSocialCredits.artistId, artistId));
    const credits: CaptionCredit[] = [];
    const statements: ArtistStatement[] = [];
    for (const r of rows) {
      if (r.kind === "credit") {
        if (!r.subject) continue;
        const borrowed = roleIsSomebodyElsesHandle(r.label, r.subject, r.quote);
        if (borrowed) {
          console.log(
            `[getSocialCredits] Ignoring stored "${r.label}" for ${r.subject} — that is @${borrowed}`,
          );
          continue;
        }
        credits.push({
          subject: r.subject,
          isHandle: r.isHandle,
          role: r.label,
          quote: r.quote,
          url: r.sourceUrl,
          isSelf: r.isSelf,
          postedAt: r.postedAt ?? null,
        });
      } else {
        statements.push({
          quote: r.quote,
          topic: r.label,
          url: r.sourceUrl,
          postedAt: r.postedAt ?? null,
        });
      }
    }
    return { credits, statements };
  } catch (e) {
    console.error("[getSocialCredits] Error:", e);
    return EMPTY_EXTRACTION;
  }
}
