import { getArtistById } from "@/lib/artists/getArtistById";
import { BioConflictError } from "@/lib/bio/BioConflictError";
import { hasPinnedBio } from "@/lib/bio/hasPinnedBio";
import { persistArtistBio } from "@/lib/bio/persistArtistBio";
import { sanitizeBioText } from "@/lib/bio/sanitizeBioText";
import type { GeneratedBio } from "@/lib/bio/types";
import { generateAboutFromDoc } from "@/lib/lore/generateAboutFromDoc";
import { getArtistDocStrict } from "@/lib/lore/getArtistDocStrict";
import { stripCitationMarkers } from "@/lib/lore/stripCitationMarkers";
import type { DocSource } from "@/lib/lore/types";
import type { ArtistWriteAuth } from "@/lib/ownership/types";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Rewrites the About from the stored Lore document and saves it. The About is
 * a projection of stored Lore: this never discovers or fetches sources. A
 * pinned bio is returned unchanged; without a Lore document nothing is written.
 *
 * @param artistId - The artist.
 * @param auth - The acting user and the claim read before authorization.
 * @returns The About now saved, or the status and message saying why the existing About was kept.
 */
export async function generateArtistBio(
  artistId: string,
  auth: ArtistWriteAuth,
): Promise<GeneratedBio> {
  try {
    const artist = await getArtistById(artistId);
    if (!artist) return { httpStatus: 404, error: "Artist not found" };
    if (await hasPinnedBio(artistId))
      return {
        httpStatus: 200,
        bio: artist.bio,
        pinned: true,
        message: "Bio is pinned. Unpin it before regenerating.",
      };
    // Strict read: a database failure is an error, not an empty document.
    const doc = await getArtistDocStrict(artistId);
    if (!doc?.content.trim())
      return {
        httpStatus: 409,
        code: "LORE_REQUIRED",
        error:
          "Build your Lore document before generating About. Your existing About has been kept.",
      };
    const draft = await generateAboutFromDoc(
      artist.name ?? "Artist",
      doc.content,
      (doc.sources ?? []) as DocSource[],
    );
    // As onboarding publishes it: the Lore keeps its citations, the About is prose.
    const bio = sanitizeBioText(stripCitationMarkers(draft));
    if (!/\p{L}/u.test(bio)) throw new Error("About generation returned no prose");
    const saved = await persistArtistBio(artistId, bio, {
      generated: true,
      expectedBio: artist.bio,
      ownership: auth,
    });
    return { httpStatus: 200, bio: saved };
  } catch (error) {
    if (error instanceof BioConflictError || error instanceof OwnershipChangedError)
      return { httpStatus: 409, error: error.message };
    if (error instanceof Error && error.message === "Gemini timeout")
      return {
        httpStatus: 408,
        error: "About generation timed out. Please try again. Your existing About has been kept.",
      };
    console.error("[About] Generation from Lore failed", error);
    return {
      httpStatus: 500,
      error: "Could not generate About from Lore. Your existing About has been kept.",
    };
  }
}
