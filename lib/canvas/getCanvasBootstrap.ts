import { buildCanvasOpening } from "./buildCanvasOpening";
import { buildCanvasOrientation } from "./buildCanvasOrientation";
import { readCanvasPreviewBudget } from "./readCanvasPreviewBudget";
import { z } from "zod";
import { getArtistById } from "@/lib/artists/getArtistById";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { loadCanvasStoredOriginals } from "./loadCanvasStoredOriginals";
import { buildCanvasEvidence } from "./buildCanvasEvidence";
import { excerptCanvasIntroduction } from "./excerptCanvasIntroduction";
import { canvasSeeds } from "./const";
/** Preview-only, read-only artist entry. No model, provider refresh, PDF download or writes. */
export async function getCanvasBootstrap(id: string) {
  const headers = { ...getCorsHeaders(), "Cache-Control": "no-store" };
  if (process.env.VERCEL_ENV !== "preview" || process.env.MUSICNERD_CANVAS_PREVIEW_ENABLED !== "1")
    return Response.json({ error: "Preview unavailable" }, { status: 404, headers });
  if (!z.uuid().safeParse(id).success)
    return Response.json({ error: "Invalid artist" }, { status: 400, headers });
  const artist = await getArtistById(id);
  if (!artist) return Response.json({ error: "Artist not found" }, { status: 404, headers });
  let unavailable = false;
  const originals = await loadCanvasStoredOriginals(id).catch(() => {
    unavailable = true;
    return [];
  });
  const seen = new Set<string>();
  const featured = [
    originals.find(source => source.sourceId === `public_profile:${id}`),
    originals.find(source => source.mediaKind === "instagram" && source.image),
  ].filter((source): source is (typeof originals)[number] => !!source);
  const evidence = [...featured, ...originals]
    .filter(source => !seen.has(source.url) && seen.add(source.url))
    .slice(0, 8)
    .map(source => buildCanvasEvidence(source))
    .filter(item => item !== null);
  const seed = canvasSeeds[id] ?? [];
  const allEvidence = [...seed, ...evidence];
  const bio = originals.find(source => source.sourceId === `public_profile:${id}`);
  const candidates = allEvidence.filter(item => !item.id.startsWith("public_profile:"));
  const opening = buildCanvasOpening(candidates);
  return Response.json(
    {
      artist: { id, name: artist.name ?? "Artist", profileUrl: `/artist/${id}?view=profile` },
      evidence: allEvidence,
      introduction: bio
        ? { text: excerptCanvasIntroduction(bio.text), sourceUrl: bio.url, kind: "profile" }
        : buildCanvasOrientation(artist.name ?? "This artist", candidates),
      budget: await readCanvasPreviewBudget().catch(() => null),
      ...opening,
      sourceCount: originals.length,
      coverage: unavailable
        ? "Saved sources are temporarily unavailable."
        : originals.length
          ? "Explore this artist’s saved public sources."
          : "No readable public sources are available yet. Open the profile for artist links.",
      generationEnabled: true,
    },
    { headers },
  );
}
