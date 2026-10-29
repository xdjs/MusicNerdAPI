import { createHash } from "node:crypto";
import { loadCanvasPublicBio } from "./loadCanvasPublicBio";
import { loadPublicResearchOriginals } from "@/lib/questionResearch/loadPublicResearchOriginals";
import { loadCanvasSocialMedia } from "./loadCanvasSocialMedia";
import type { CanvasResearchOriginal } from "./const";
/** Add exact-post retained media to the existing public text corpus; unavailable media never blocks text. */
export async function loadCanvasStoredOriginals(
  artistId: string,
): Promise<CanvasResearchOriginal[]> {
  const originals = await loadPublicResearchOriginals(artistId);
  const bio = await loadCanvasPublicBio(artistId).catch(() => null);
  if (bio)
    originals.unshift({
      sourceId: `public_profile:${artistId}`,
      revision: createHash("sha256").update(bio.bio).digest("hex"),
      text: bio.bio,
      url: bio.url,
      curation: "approved",
      evidenceKind: "original_text",
      speaker: "unverified",
      publishedAt: null,
      retrievedAt: new Date().toISOString(),
      truncated: false,
    });
  const media = await loadCanvasSocialMedia(artistId).catch(() => new Map<string, string>());
  return originals.map(source => ({
    ...source,
    ...(media.has(source.url)
      ? { image: media.get(source.url), mediaKind: "instagram" as const }
      : {}),
  }));
}
