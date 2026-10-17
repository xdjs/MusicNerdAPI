import { z } from "zod";
import { readResearchJson } from "@/lib/questionResearch/readResearchJson";
import { foldName } from "@/lib/text/foldName";
import type { ArtistAnchor } from "@/lib/relevance/types";

/** Read structured current/former group credits for an already-held Discogs ID, never a name search. */
export async function getDiscogsGroupFacts(
  id: string,
  artistName: string,
): Promise<NonNullable<ArtistAnchor["groups"]>> {
  if (!/^[1-9]\d{0,11}$/.test(id)) return [];
  const sourceUrl = `https://api.discogs.com/artists/${id}`;
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MusicNerd/1.0 (+https://musicnerd.net)",
      },
      signal: AbortSignal.timeout(8_000),
      redirect: "error",
    });
    const parsed = z
      .object({
        id: z.number().int().positive(),
        name: z.string(),
        groups: z.array(
          z.object({ id: z.number().int().positive(), name: z.string().min(1).max(200) }),
        ),
      })
      .safeParse(await readResearchJson(response));
    if (
      !parsed.success ||
      String(parsed.data.id) !== id ||
      foldName(parsed.data.name.replace(/\s+\(\d+\)$/, "")) !== foldName(artistName)
    )
      return [];
    return [...new Set(parsed.data.groups.map(group => group.name.trim()))]
      .filter(Boolean)
      .slice(0, 12)
      .map(name => ({ name, sourceUrl }));
  } catch {
    return [];
  }
}
