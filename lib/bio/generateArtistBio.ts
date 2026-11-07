import { LoreChangedError } from "@/lib/lore/LoreChangedError";
import { getArtistById } from "@/lib/artists/getArtistById";
import { BioConflictError } from "@/lib/bio/BioConflictError";
import { hasPinnedBio } from "@/lib/bio/hasPinnedBio";
import { prepareAboutLore } from "@/lib/bio/prepareAboutLore";
import { persistArtistBio } from "@/lib/bio/persistArtistBio";
import { sanitizeBioText } from "@/lib/bio/sanitizeBioText";
import { finishAboutLoreRefresh } from "@/lib/bio/finishAboutLoreRefresh";
import type { AboutLoreLease, AboutGenerationBudget } from "@/lib/bio/types";
import type { GeneratedBio } from "@/lib/bio/types";
import { generateAboutFromDoc } from "@/lib/lore/generateAboutFromDoc";
import { stripCitationMarkers } from "@/lib/lore/stripCitationMarkers";
import type { DocSource } from "@/lib/lore/types";
import type { ArtistWriteAuth } from "@/lib/ownership/types";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Prepares missing or pending Lore from saved eligible material, then rewrites
 * About. This never starts source discovery/extraction or onboarding. A pinned
 * bio is returned unchanged, and preparation failures preserve the saved About.
 *
 * @param artistId - The artist.
 * @param auth - The acting user and the claim read before authorization.
 * @returns The About now saved, or the status and message saying why the existing About was kept.
 */
export async function generateArtistBio(
  artistId: string,
  auth: ArtistWriteAuth,
  budget: AboutGenerationBudget = {},
): Promise<GeneratedBio> {
  // Leave time for transaction cleanup before the route's 60-second limit.
  const controller = new AbortController();
  const remaining = Math.min(45_000, (budget.deadline ?? Date.now() + 45_000) - Date.now());
  if (remaining <= 0) controller.abort(new Error("Gemini timeout"));
  const timer = setTimeout(
    () => controller.abort(new Error("Gemini timeout")),
    Math.max(0, remaining),
  );
  const signal = budget.signal
    ? AbortSignal.any([controller.signal, budget.signal])
    : controller.signal;
  let aboutLease: AboutLoreLease | undefined;
  try {
    signal.throwIfAborted();
    const artist = await getArtistById(artistId);
    if (!artist) return { httpStatus: 404, error: "Artist not found" };
    if (await hasPinnedBio(artistId))
      return {
        httpStatus: 200,
        bio: artist.bio,
        pinned: true,
        message: "Bio is pinned. Unpin it before regenerating.",
      };
    const doc = await prepareAboutLore(artistId, auth, { signal });
    if ("error" in doc) return doc;
    aboutLease = doc.aboutLease;
    signal.throwIfAborted();
    const draft = await generateAboutFromDoc(
      artist.name ?? "Artist",
      doc.content,
      (doc.sources ?? []) as DocSource[],
      { abortSignal: signal },
    );
    // As onboarding publishes it: the Lore keeps its citations, the About is prose.
    const bio = sanitizeBioText(stripCitationMarkers(draft));
    if (!/\p{L}/u.test(bio)) throw new Error("About generation returned no prose");
    const saved = await persistArtistBio(artistId, bio, {
      generated: true,
      ...(aboutLease ? { aboutLease } : {}),
      signal,
      expectedBio: artist.bio,
      expectedLore: { content: doc.content, sources: (doc.sources ?? []) as DocSource[] },
      ownership: auth,
    });
    aboutLease = undefined; // settled atomically with the About write
    return { httpStatus: 200, bio: saved };
  } catch (error) {
    if (aboutLease) {
      try {
        await finishAboutLoreRefresh(artistId, aboutLease, "rebuilt");
      } catch {
        return {
          httpStatus: 500,
          error:
            "About could not finish or release its preparation job. Your existing About has been kept. Wait a few minutes for recovery before trying again.",
        };
      }
    }
    if (
      error instanceof LoreChangedError ||
      error instanceof BioConflictError ||
      error instanceof OwnershipChangedError
    )
      return { httpStatus: 409, error: error.message };
    if (signal.aborted || (error instanceof Error && error.message === "Gemini timeout"))
      return {
        httpStatus: 408,
        error: "About generation timed out. Please try again. Your existing About has been kept.",
      };
    console.error("[About] Generation from Lore failed", error);
    return {
      httpStatus: 500,
      error: "Could not generate About from Lore. Your existing About has been kept.",
    };
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
