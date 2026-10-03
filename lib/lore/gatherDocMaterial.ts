import { getArtistById } from "@/lib/artists/getArtistById";
import { getSocialPostsOrNull } from "@/lib/instagram/getSocialPostsOrNull";
import { captionCreditSources } from "@/lib/lore/captionCreditSources";
import { getInterviewAnswers } from "@/lib/lore/getInterviewAnswers";
import { socialSignalSources } from "@/lib/lore/socialSignalSources";
import { videoContextSources } from "@/lib/lore/videoContextSources";
import type { DocMaterial } from "@/lib/lore/types";
import { isCitableSource } from "@/lib/sources/isCitableSource";
import { getVaultSourcesByStatus } from "@/lib/vault/getVaultSourcesByStatus";

/**
 * Everything the Lore is built from, read once.
 *
 * Citable sources only, filtered here at the one place material is read: the
 * manifest and the prompt lines are zipped by position, so filtering one and
 * not the other would point citations at the wrong source. An uncitable source
 * is one whose page we never read; its snippet is model output, not evidence.
 *
 * @param artistId - The artist.
 * @returns The material. Throws when the artist does not exist.
 */
export async function gatherDocMaterial(artistId: string): Promise<DocMaterial> {
  const artist = await getArtistById(artistId);
  if (!artist) throw new Error(`Artist not found: ${artistId}`);
  const artistName = artist.name ?? "Unknown Artist";

  const approvedSources = await getVaultSourcesByStatus(artistId, "approved");
  const vaultSources = approvedSources.filter(isCitableSource);
  const uncitable = approvedSources.length - vaultSources.length;
  if (uncitable > 0) {
    console.log(
      `[gatherDocMaterial] ${uncitable}/${approvedSources.length} approved source(s) excluded from citation for ${artistName} — page content never verified`,
    );
  }
  const answers = ((await getInterviewAnswers(artistId)) ?? []).filter(a => a.answer);

  const posts = (await getSocialPostsOrNull(artistId)) ?? [];
  const signals =
    posts.length > 0
      ? socialSignalSources(posts, artist.instagram ?? "", artistName)
      : { socialCollaborators: [], socialMusicRefs: [] };

  return {
    artist,
    artistName,
    vaultSources,
    answers,
    ...signals,
    ...(await captionCreditSources(artistId)),
    ...(posts.some(p => p.transcript) ? { videoContexts: videoContextSources(posts) } : {}),
  };
}
