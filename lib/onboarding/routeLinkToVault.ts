import { titleMatchesArtist } from "@/lib/artists/titleMatchesArtist";
import { artistNameForRun } from "@/lib/onboarding/artistNameForRun";
import { enrichVaultSource } from "@/lib/onboarding/enrichVaultSource";
import type { LinkDecisionRun } from "@/lib/onboarding/types";
import { fetchLinkPreview } from "@/lib/pages/fetchLinkPreview";
import { isUnsafeUrl } from "@/lib/pages/isUnsafeUrl";
import { inferTypeFromUrl } from "@/lib/sources/inferTypeFromUrl";
import { getVaultSourcesByStatus } from "@/lib/vault/getVaultSourcesByStatus";
import { insertVaultSource } from "@/lib/vault/insertVaultSource";

/**
 * A pasted link that isn't a platform profile, most often the artist's own
 * site, which urlmap has nowhere to put. If it resolves to a real page it goes
 * to the vault: approved as their website when the page title carries their
 * name, pending otherwise. A URL already in the vault isn't inserted twice.
 *
 * @param run - The link-decision run.
 * @param url - The normalized URL.
 * @returns The outcome bucket for the chat copy.
 */
export async function routeLinkToVault(
  run: LinkDecisionRun,
  url: string,
): Promise<
  "unrecognized" | "routedToVaultApproved" | "routedToVaultPending" | "vaultInsertFailed"
> {
  if (isUnsafeUrl(url)) return "unrecognized";
  if (run.existingVaultStatusByUrl === undefined) {
    const existing = await getVaultSourcesByStatus(run.artistId);
    run.existingVaultStatusByUrl = new Map(existing.map(s => [s.url, s.status]));
  }
  const existingStatus = run.existingVaultStatusByUrl.get(url);
  if (existingStatus) {
    return existingStatus === "approved" ? "routedToVaultApproved" : "routedToVaultPending";
  }
  const preview = await fetchLinkPreview(url);
  if (!preview.title && !preview.imageUrl) return "unrecognized";
  const ownedByArtist =
    !!preview.title && titleMatchesArtist(preview.title, await artistNameForRun(run));
  try {
    const source = await insertVaultSource({
      artistId: run.artistId,
      url,
      title: preview.title ?? undefined,
      // The artist handed us this URL and it carries their name: their official site.
      type: ownedByArtist ? "website" : inferTypeFromUrl(url),
      status: ownedByArtist ? "approved" : "pending",
    });
    run.existingVaultStatusByUrl.set(url, ownedByArtist ? "approved" : "pending");
    // A generic fallback title must never replace the og:title we already have.
    if (source?.id) await enrichVaultSource(source.id, url, { keepTitle: !!preview.title });
    return ownedByArtist ? "routedToVaultApproved" : "routedToVaultPending";
  } catch (e) {
    console.error(`[onboarding] insertVaultSource failed for ${url}:`, e);
    return "vaultInsertFailed";
  }
}
