import { db } from "@/lib/db/db";
import { getStoredLatestProviders } from "@/lib/latestProviders/getStoredLatestProviders";
import { loadPublicLatestOriginals } from "@/lib/questionResearch/loadPublicLatestOriginals";
import type { ResearchOriginal } from "@/lib/questionResearch/types";

/**
 * The "latest" part of the public research corpus only: published interview answers
 * (`loadPublicLatestOriginals`) and the stored latest-provider releases
 * (`getStoredLatestProviders`), read in one repeatable-read, read-only snapshot as
 * `loadPublicResearchOriginals` reads them. Vault, social and research evidence are left out.
 *
 * @param artistId - The artist.
 * @returns The originals, answers first.
 */
export async function loadPublicLatestResearchOriginals(
  artistId: string,
): Promise<ResearchOriginal[]> {
  return db.transaction(
    async tx => [
      ...(await loadPublicLatestOriginals(tx, artistId)),
      ...(await getStoredLatestProviders(artistId, tx)).originals,
    ],
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
