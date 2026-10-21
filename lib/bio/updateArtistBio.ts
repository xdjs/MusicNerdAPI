import { getArtistById } from "@/lib/artists/getArtistById";
import { generateArtistBio } from "@/lib/bio/generateArtistBio";
import { isAboutEmptyState } from "@/lib/bio/isAboutEmptyState";
import { persistArtistBio } from "@/lib/bio/persistArtistBio";
import type { BioUpdateResult } from "@/lib/bio/types";
import type { ArtistWriteAuth } from "@/lib/ownership/types";

/**
 * Saves the About the artist wrote, or regenerates it from the Lore document.
 *
 * @param artistId - The artist.
 * @param input - The bio to save, or `regenerate`.
 * @param input.bio - The new About, when not regenerating.
 * @param input.regenerate - Rewrite the About from the Lore document instead.
 * @param ownership - The acting user and the claim read before authorization.
 * @returns MusicNerdWeb's result: a message and, after a regeneration, the About; or an error with its status.
 */
export async function updateArtistBio(
  artistId: string,
  input: { bio?: string; regenerate: boolean },
  ownership: ArtistWriteAuth,
): Promise<BioUpdateResult> {
  try {
    if (input.regenerate) {
      // Tells a real regeneration apart from a no-op: a pinned bio comes back unchanged.
      const priorBio = (await getArtistById(artistId))?.bio ?? null;
      const generated = await generateArtistBio(artistId, ownership);
      if (generated.httpStatus !== 200)
        return {
          status: "error",
          message: generated.error,
          statusCode: generated.httpStatus,
          code: generated.code,
        };
      const generatedBio = generated.bio;
      if (!generatedBio) return { status: "error", message: "Failed to generate bio" };
      if (isAboutEmptyState(generatedBio))
        return {
          status: "success",
          message: "No verified sources found — showing the claim prompt",
          data: generatedBio,
        };
      if (priorBio !== null && generatedBio === priorBio)
        return {
          status: "success",
          message:
            "About unchanged. A pinned bio stays locked until you unpin it; otherwise the saved Lore produced the same text.",
          data: generatedBio,
        };
      return { status: "success", message: "Bio regenerated", data: generatedBio };
    }
    await persistArtistBio(artistId, input.bio ?? "", { ownership });
    return { status: "success", message: "Bio updated" };
  } catch (e) {
    console.error("Error updating bio", e);
    return { status: "error", message: e instanceof Error ? e.message : "Error updating bio" };
  }
}
