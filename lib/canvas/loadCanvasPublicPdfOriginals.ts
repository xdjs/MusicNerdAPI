import { createHash } from "node:crypto";
import { DUTCH_ARTIST_ID, type CanvasResearchOriginal } from "./const";
import { canvasPublicPdfs, canvasPublicProfile } from "./publicPdfManifest";
import { fetchCanvasPublicBuffer } from "./fetchCanvasPublicBuffer";
import { extractCanvasPdfPages } from "./extractCanvasPdfPages";
/** Preview-only public publication check and page retrieval. Never reads upload rows or private storage. */
export async function loadCanvasPublicPdfOriginals(artistId: string, signal?: AbortSignal) {
  const sources: CanvasResearchOriginal[] = [];
  const limitations: string[] = [];
  if (
    artistId !== DUTCH_ARTIST_ID ||
    process.env.VERCEL_ENV !== "preview" ||
    process.env.MUSICNERD_CANVAS_PREVIEW_ENABLED !== "1"
  )
    return { sources, limitations };
  let profile: string;
  try {
    profile = (await fetchCanvasPublicBuffer(canvasPublicProfile, 1_000_000, signal)).toString(
      "utf8",
    );
  } catch {
    return {
      sources,
      limitations: [
        "Public PDF retrieval unavailable: the public profile publication links could not be checked.",
      ],
    };
  }
  for (const doc of canvasPublicPdfs) {
    // A public storage URL alone is insufficient: the approved profile must still publish the download link.
    if (!profile.includes(`href="${doc.url}"`)) {
      limitations.push(`${doc.title}: no longer linked by the public profile; not retrieved.`);
      continue;
    }
    try {
      const bytes = await fetchCanvasPublicBuffer(doc.url, 2_000_000, signal);
      const revision = createHash("sha256").update(bytes).digest("hex");
      const pages = await extractCanvasPdfPages(bytes);
      pages.forEach((text, index) => {
        if (!text) return;
        sources.push({
          sourceId: `public_pdf:${doc.id}:${revision.slice(0, 12)}:page:${index + 1}`,
          revision,
          text,
          url: `${doc.url}#page=${index + 1}`,
          curation: "approved",
          evidenceKind: "original_text",
          speaker: "unverified",
          publishedAt: null,
          retrievedAt: new Date().toISOString(),
          truncated: false,
          pdf: {
            page: index + 1,
            title: `${doc.title} · PDF p. ${index + 1}`,
            limitation: doc.limitation,
          },
        });
      });
    } catch {
      limitations.push(
        `${doc.title}: public PDF extraction unavailable; do not infer missing passages.`,
      );
    }
  }
  return { sources, limitations };
}
