import { reserveAboutLoreRefresh } from "@/lib/bio/reserveAboutLoreRefresh";
import { finishAboutLoreRefresh } from "@/lib/bio/finishAboutLoreRefresh";
import type { GeneratedBio, AboutLoreLease } from "@/lib/bio/types";
import { getArtistDocStrict } from "@/lib/lore/getArtistDocStrict";
import { refreshArtistDoc } from "@/lib/lore/refreshArtistDoc";
import { LoreChangedError } from "@/lib/lore/LoreChangedError";
import type { ArtistWriteAuth } from "@/lib/ownership/types";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/** Prepare missing/stale Lore through an exact job lease; preserve About on every failure. */
export async function prepareAboutLore(
  artistId: string,
  auth: ArtistWriteAuth,
  options: { signal?: AbortSignal } = {},
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
  let acquired: AboutLoreLease | undefined;
  try {
    for (let attempt = 0; attempt <= 20; attempt++) {
      options.signal?.throwIfAborted();
      const reservation = await reserveAboutLoreRefresh(artistId, auth);
      if (reservation.status === "busy") {
        if (attempt === 20) return busy;
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      if (reservation.status === "acquired") {
        acquired = {
          jobId: reservation.jobId,
          requestedAt: reservation.requestedAt,
          claimedAt: reservation.claimedAt,
        };
        const result = await refreshArtistDoc(artistId, {
          createIfMissing: true,
          jobId: acquired.jobId,
          expectedClaimId: auth.expectedClaimId,
          auth,
          lease: acquired,
          ...(options.signal ? { signal: options.signal } : {}),
        });
        const settled = await finishAboutLoreRefresh(
          artistId,
          acquired,
          result === "no-document" ? "no-material" : result,
        );
        acquired = undefined;
        if (result === "failed") throw new Error("Lore preparation failed");
        if (result === "cancelled") throw new OwnershipChangedError();
        if (result === "changed") throw new LoreChangedError();
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
    // A settlement error or unexpected rejection must not strand a lease when
    // storage has recovered. The exact token prevents releasing another worker.
    if (acquired) {
      try {
        await finishAboutLoreRefresh(artistId, acquired, "failed");
      } catch {
        return {
          httpStatus: 500,
          code: "LORE_PREPARATION_FAILED",
          error:
            "Lore preparation could not finish or release its job. Your existing About has been kept. Wait a few minutes for recovery before trying again.",
        };
      }
    }
    if (error instanceof OwnershipChangedError || error instanceof LoreChangedError)
      return { httpStatus: 409, error: error.message };
    console.error("[About] Lore preparation failed", error);
    return {
      httpStatus: 500,
      code: "LORE_PREPARATION_FAILED",
      error:
        "Could not prepare Lore for About. Please try again. Your existing About has been kept.",
    };
  }
}
