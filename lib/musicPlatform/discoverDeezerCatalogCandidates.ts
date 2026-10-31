import { DEEZER_API, DEEZER_TIMEOUT_MS } from "@/lib/musicPlatform/const";
import { fetchJson } from "@/lib/networking/fetchJson";
import { foldName } from "@/lib/text/foldName";

/** Enumerate a bounded complete search before selecting names for recording verification. */
export async function discoverDeezerCatalogCandidates(
  artistName: string,
): Promise<{ status: "complete"; ids: string[] } | { status: "incomplete_search" }> {
  const name = foldName(artistName);
  if (!name) return { status: "complete", ids: [] };
  const result = await fetchJson(
    `${DEEZER_API}/search/artist?q=${encodeURIComponent(artistName)}&limit=25`,
    { timeoutMs: DEEZER_TIMEOUT_MS },
  );
  if (
    !result ||
    result.error ||
    !Array.isArray(result.data) ||
    typeof result.total !== "number" ||
    !Number.isSafeInteger(result.total) ||
    result.total < 0 ||
    (result.next != null && typeof result.next !== "string")
  )
    throw new Error("Invalid Deezer catalog search response");
  const ids = new Set<string>();
  for (const artist of result.data) {
    if (
      !artist ||
      typeof artist.id !== "number" ||
      !Number.isSafeInteger(artist.id) ||
      artist.id <= 0 ||
      typeof artist.name !== "string" ||
      !artist.name.trim()
    )
      throw new Error("Invalid Deezer catalog candidate");
    if (foldName(artist.name) === name) ids.add(String(artist.id));
  }
  if (result.next || result.total !== result.data.length || result.data.length > 25 || ids.size > 5)
    return { status: "incomplete_search" };
  return { status: "complete", ids: [...ids] };
}
