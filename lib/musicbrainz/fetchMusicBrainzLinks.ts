import { artistIdFromUrl } from "@/lib/musicbrainz/artistIdFromUrl";
import { MIN_SCORE } from "@/lib/musicbrainz/const";
import { mb } from "@/lib/musicbrainz/mb";
import { sinceLastCall } from "@/lib/musicbrainz/sinceLastCall";
import type { MusicBrainzLinks } from "@/lib/musicbrainz/types";
import { foldName } from "@/lib/text/foldName";

/**
 * An artist's links from MusicBrainz, matched by identifier where possible.
 * An entry linking a Spotify or Deezer id we already hold is certainly theirs.
 * Otherwise a single high-scoring entry with exactly their name is returned as
 * an exact-name match, for the caller to verify; a shared name abstains.
 *
 * @param artistName - The artist's name.
 * @param held - The Spotify and Deezer ids we already hold.
 * @param held.spotify - Their Spotify id.
 * @param held.deezer - Their Deezer id.
 * @returns The links, or null when MusicBrainz can't say who they are. Never throws.
 */
export async function fetchMusicBrainzLinks(
  artistName: string,
  held: { spotify?: string | null; deezer?: string | null },
): Promise<MusicBrainzLinks | null> {
  if (!artistName?.trim()) return null;

  await sinceLastCall();
  const search = await mb(
    `/artist?query=${encodeURIComponent(`artist:"${artistName}"`)}&fmt=json&limit=5`,
  );
  const candidates = ((search?.artists as Array<Record<string, unknown>>) ?? []).filter(
    a => Number(a.score ?? 0) >= MIN_SCORE,
  );
  if (candidates.length === 0) return null;

  const wantName = foldName(artistName);
  let fallback: MusicBrainzLinks | null = null;
  for (const cand of candidates.slice(0, 3)) {
    await sinceLastCall();
    const detail = await mb(`/artist/${String(cand.id)}?inc=url-rels&fmt=json`);
    const relations = (detail?.relations as Array<Record<string, unknown>>) ?? [];
    const urls = relations
      .map(r => (r.url as Record<string, unknown> | undefined)?.resource)
      .filter((u): u is string => typeof u === "string" && u.length > 0);
    if (urls.length === 0) continue;

    const homepage =
      relations
        .filter(r => r.type === "official homepage")
        .map(r => (r.url as Record<string, unknown> | undefined)?.resource)
        .find((u): u is string => typeof u === "string") ?? null;

    const identifies = urls.some(
      u =>
        (held.spotify && artistIdFromUrl(u, "spotify.com") === held.spotify) ||
        (held.deezer && artistIdFromUrl(u, "deezer.com") === held.deezer),
    );
    if (identifies) return { matchedBy: "identifier", urls, homepage };
    // Keep looking for an identifier, which outranks an exact-name match.
    if (!fallback && foldName(String(cand.name ?? "")) === wantName) {
      fallback = { matchedBy: "exact-name", urls, homepage };
    }
  }

  // Several high-scoring entries with this name: it is shared, so don't guess.
  if (
    fallback &&
    candidates.filter(c => foldName(String(c.name ?? "")) === wantName).length === 1
  ) {
    return fallback;
  }
  return null;
}
