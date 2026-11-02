import { reserveAboutLoreRefresh } from "@/lib/bio/reserveAboutLoreRefresh";
import type { GeneratedBio } from "@/lib/bio/types";
import { getArtistDocStrict } from "@/lib/lore/getArtistDocStrict";
import { refreshArtistDoc } from "@/lib/lore/refreshArtistDoc";
import type { ArtistWriteAuth } from "@/lib/ownership/types";
import { failResearchJob } from "@/lib/research/failResearchJob";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import { settleLoreRefresh } from "@/lib/research/settleLoreRefresh";

/** Prepare missing/pending Lore through its existing job lease; never start discovery or extraction. */
export async function prepareAboutLore(
  artistId: string,
  auth: ArtistWriteAuth,
): Promise<
  | NonNullable<Awaited<ReturnType<typeof getArtistDocStrict>>>
  | Exclude<GeneratedBio, { httpStatus: 200 }>
> {
  const busy = {
    httpStatus: 409 as const,
    code: "LORE_PREPARING" as const,
    error:
      "Lore preparation is still in progress. Please try Regenerate About again shortly. Your existing About has been kept.",
  };
  try {
    // A short bounded wait lets a concurrent worker finish without a second
    // synthesis. A killed worker retains its normal three-minute cron lease.
    for (let attempt = 0; attempt <= 20; attempt++) {
      const reservation = await reserveAboutLoreRefresh(artistId, auth);
      if (reservation.status === "busy") {
        if (attempt === 20) return busy;
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      if (reservation.status === "acquired") {
        const result = await refreshArtistDoc(artistId, {
          createIfMissing: true,
          jobId: reservation.jobId,
          expectedClaimId: auth.expectedClaimId,
          auth,
        });
        if (result === "failed") {
          await failResearchJob(reservation.jobId, "Could not prepare Lore for About");
          throw new Error("Lore preparation failed");
        }
        const settled = await settleLoreRefresh(reservation.jobId, reservation.requestedAt);
        if (result === "cancelled") throw new OwnershipChangedError();
        if (!settled) return busy;
        if (result === "no-material" || result === "no-document")
          return {
            httpStatus: 409,
            code: "LORE_REQUIRED",
            error:
              "About needs approved, readable Lore. If you just added a link, wait for source processing or review to finish, then try again. Your existing About has been kept.",
          };
      }
      const doc = await getArtistDocStrict(artistId);
      if (!doc?.content.trim()) throw new Error("Prepared Lore is unavailable");
      return doc;
    }
    return busy;
  } catch (error) {
    if (error instanceof OwnershipChangedError) return { httpStatus: 409, error: error.message };
    console.error("[About] Lore preparation failed", error);
    return {
      httpStatus: 500,
      code: "LORE_PREPARATION_FAILED",
      error:
        "Could not prepare Lore for About. Please try again. Your existing About has been kept.",
    };
  }
}
