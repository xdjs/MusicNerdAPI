/**
 * Where else can you hear this song?
 *
 * Resolves track links via Apple Music and Deezer APIs on click rather than at
 * answer time. Migrated from MusicNerdWeb with the same matching logic.
 */
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

const PROVIDER_TIMEOUT_MS = 4_000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 500;

export type TrackLink = { service: string; url: string };

const cache = new Map<string, { at: number; links: TrackLink[] }>();

const fold = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * Split a credit string into individual artist names.
 *
 * @param credit - The raw credit string (e.g. "Dame Atlas & Pete Rango").
 * @returns Array of normalised individual names.
 */
function creditedNames(credit: string): string[] {
  return credit
    .split(/\s*(?:&|\/|,|\bx\b|\bvs\.?\b|\bfeat\.?\b|\bft\.?\b|\bwith\b|\band\b)\s*/i)
    .map(norm)
    .filter(Boolean);
}

const VERSION_WORDS =
  /\b(mix|remix|rmx|edit|version|rework|flip|bootleg|dub|instrumental|remaster(ed)?|live|acoustic)\b/i;

/**
 * Extract bracketed version credits from a title (e.g. "(Pete Rango Mix)").
 *
 * @param title - The track title.
 * @returns Normalised version credit segments.
 */
function versionCredits(title: string): string[] {
  return [...title.matchAll(/[([]([^)\]]{1,80})[)\]]/g)]
    .map(m => m[1])
    .filter(seg => VERSION_WORDS.test(seg))
    .map(norm);
}

/**
 * Strict track identity check: title must match exactly, artist must be credited.
 *
 * @param hitTitle - The provider result's title.
 * @param hitArtist - The provider result's artist credit.
 * @param wantTitle - The title we searched for.
 * @param wantArtist - The artist we searched for.
 * @returns `true` if the hit is the same track.
 */
function isTheSameTrack(
  hitTitle: string,
  hitArtist: string,
  wantTitle: string,
  wantArtist: string,
): boolean {
  if (!fold(wantTitle) || fold(hitTitle) !== fold(wantTitle)) return false;
  const artist = norm(wantArtist);
  if (!artist) return false;
  if (norm(hitArtist) === artist) return true;
  if (creditedNames(hitArtist).includes(artist)) return true;
  return versionCredits(wantTitle).some(seg => {
    const escaped = artist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(seg);
  });
}

/**
 * Race a promise against the provider timeout, returning null on timeout or error.
 *
 * @param p - The promise to race.
 * @returns The result or null.
 */
async function withTimeout<T>(p: Promise<T>): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>(resolve => setTimeout(() => resolve(null), PROVIDER_TIMEOUT_MS)),
  ]).catch(() => null);
}

type Lookup = TrackLink | null | undefined;

/**
 * Search Apple Music (iTunes Search API) for a track or album.
 *
 * @param title - The track/album title.
 * @param artist - The artist name.
 * @param isAlbum - Whether to search for an album rather than a song.
 * @returns A link, null (no match), or undefined (search failed).
 */
async function appleMusic(title: string, artist: string, isAlbum: boolean): Promise<Lookup> {
  const term = encodeURIComponent(`${artist} ${title}`);
  const entity = isAlbum ? "album" : "song";
  const res = await withTimeout(
    fetch(`https://itunes.apple.com/search?term=${term}&entity=${entity}&limit=5`),
  );
  if (!res?.ok) return undefined;
  const body = (await res.json().catch(() => undefined)) as
    | {
        results?: Array<{
          trackName?: string;
          collectionName?: string;
          artistName?: string;
          trackViewUrl?: string;
          collectionViewUrl?: string;
        }>;
      }
    | undefined;
  if (!body) return undefined;
  for (const r of body?.results ?? []) {
    const name = isAlbum ? r.collectionName : r.trackName;
    const link = isAlbum ? r.collectionViewUrl : r.trackViewUrl;
    if (!name || !link) continue;
    if (isTheSameTrack(name, r.artistName ?? "", title, artist)) {
      return { service: "Apple Music", url: link.split("?")[0] };
    }
  }
  return null;
}

/**
 * Search the Deezer public API for a track or album.
 *
 * @param title - The track/album title.
 * @param artist - The artist name.
 * @param isAlbum - Whether to search for an album rather than a song.
 * @returns A link, null (no match), or undefined (search failed).
 */
async function deezer(title: string, artist: string, isAlbum: boolean): Promise<Lookup> {
  const q = encodeURIComponent(`${artist} ${title}`);
  const path = isAlbum ? "search/album" : "search";
  const res = await withTimeout(fetch(`https://api.deezer.com/${path}?q=${q}&limit=5`));
  if (!res?.ok) return undefined;
  const body = (await res.json().catch(() => undefined)) as
    { data?: Array<{ title?: string; link?: string; artist?: { name?: string } }> } | undefined;
  if (!body) return undefined;
  for (const r of body?.data ?? []) {
    if (!r.title || !r.link) continue;
    if (isTheSameTrack(r.title, r.artist?.name ?? "", title, artist)) {
      return { service: "Deezer", url: r.link };
    }
  }
  return null;
}

/**
 * CORS preflight for the track links endpoint.
 *
 * @returns Empty 200 with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Resolve cross-platform track links via Apple Music and Deezer.
 *
 * @param req - GET with `?title=&artist=` and optional `?kind=album`.
 * @returns `{ links: TrackLink[] }` with matching platform links.
 */
export async function GET(req: Request): Promise<Response> {
  const headers = getCorsHeaders();
  const started = Date.now();
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") ?? "").trim();
  const artist = (searchParams.get("artist") ?? "").trim();
  const isAlbum = (searchParams.get("kind") ?? "") === "album";

  if (!title || !artist) {
    return NextResponse.json({ error: "title and artist are required" }, { status: 400, headers });
  }
  if (title.length > 200 || artist.length > 200) {
    return NextResponse.json({ error: "title or artist too long" }, { status: 400, headers });
  }

  const key = `${fold(artist)}::${fold(title)}::${isAlbum ? "album" : "song"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ links: hit.links, cached: true }, { headers });
  }

  const [apple, dz] = await Promise.all([
    appleMusic(title, artist, isAlbum).catch(() => undefined),
    deezer(title, artist, isAlbum).catch(() => undefined),
  ]);
  const links = [apple, dz].filter((l): l is TrackLink => !!l);

  const complete = apple !== undefined && dz !== undefined;
  if (complete) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: Date.now(), links });
  }

  console.debug(`[trackLinks] "${title}" — ${links.length} link(s) in ${Date.now() - started}ms`);
  return NextResponse.json({ links }, { headers });
}
