import { UUID, VAULT_BUCKET } from "@/lib/instagram/const";

/**
 * A thumbnail this environment already retained for this post, so a refresh
 * reuses it instead of uploading again. Only for metadata read from our
 * database, never scraper payloads.
 *
 * @param raw - The stored post's raw payload.
 * @param artistId - The artist the post belongs to.
 * @param postId - Instagram's numeric post id.
 * @returns The retention metadata, or null when it is missing or points anywhere else.
 */
export function storedInstagramThumbnail(
  raw: unknown,
  artistId: string,
  postId: string,
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || !UUID.test(artistId) || !/^\d+$/.test(postId)) return null;
  const metadata = (raw as Record<string, unknown>)._musicnerdThumbnail;
  if (!metadata || typeof metadata !== "object") return null;
  const retained = metadata as Record<string, unknown>;
  if (
    retained.version !== 1 ||
    typeof retained.url !== "string" ||
    typeof retained.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(retained.sha256)
  ) {
    return null;
  }
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const prefix = `${supabaseUrl}/storage/v1/object/public/${VAULT_BUCKET}/${artistId}/instagram-`;
  if (!retained.url.startsWith(prefix)) return null;
  const name = retained.url.slice(prefix.length);
  const suffix = `${postId}-${retained.sha256}.webp`;
  const jobScoped = name.endsWith(`-${suffix}`) && UUID.test(name.slice(0, -(suffix.length + 1)));
  return name === suffix || jobScoped ? retained : null;
}
