import { createHash } from "node:crypto";
import sharp from "sharp";
import { instagramMediaUrl } from "@/lib/instagram/instagramMediaUrl";
import { readImage } from "@/lib/instagram/readImage";
import type { ThumbnailUploadScope } from "@/lib/instagram/types";
import { THUMBNAIL_TIMEOUT_MS, UUID, VAULT_BUCKET } from "@/lib/instagram/const";

/**
 * Copies a post's thumbnail into Supabase Storage, because Instagram's media
 * URLs expire. `displayUrl` is replaced so existing Latest readers pick it up;
 * the original URL stays in `_musicnerdThumbnail`. Redirects are refused so an
 * allowed host cannot redirect into our network. Names are content-addressed,
 * so retries are immutable, and job-scoped, so revoking one job's claim never
 * deletes another job's identical thumbnail.
 *
 * @param raw - The post's raw Apify payload.
 * @param artistId - The artist, which is also the storage folder.
 * @param postId - Instagram's numeric post id.
 * @param scope - The job doing the work, which records every path it tries.
 * @returns The payload with the retained thumbnail, or the original payload if retention failed.
 */
export async function retainInstagramThumbnail(
  raw: unknown,
  artistId: string,
  postId: string,
  scope?: ThumbnailUploadScope,
): Promise<unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const post = { ...raw } as Record<string, unknown>;
  delete post._musicnerdThumbnail;
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!UUID.test(artistId) || (scope && !UUID.test(scope.jobId)) || !/^\d+$/.test(postId)) {
    return post;
  }
  if (!supabaseUrl || !serviceKey) return post;
  const images = Array.isArray(post.images) ? post.images : [];
  const candidates = [
    ...new Set(
      [post.displayUrl, post.thumbnailSrc, ...images]
        .map(instagramMediaUrl)
        .filter((url): url is string => url !== null),
    ),
  ].slice(0, 3);
  const signal = AbortSignal.timeout(THUMBNAIL_TIMEOUT_MS);
  for (const sourceUrl of candidates) {
    try {
      const input = await readImage(await fetch(sourceUrl, { redirect: "error", signal }));
      const image = sharp(input, { limitInputPixels: 40_000_000, animated: false });
      const metadata = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) {
        throw new Error("Unsupported image");
      }
      const { data, info } = await image
        .rotate()
        .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });
      signal.throwIfAborted();
      const hash = createHash("sha256").update(data).digest("hex");
      const path = `${artistId}/instagram-${scope ? `${scope.jobId}-` : ""}${postId}-${hash}.webp`;
      // Tracked before the POST: a failed response can still mean it was stored.
      scope?.attemptedPaths.add(path);
      const upload = await fetch(`${supabaseUrl}/storage/v1/object/${VAULT_BUCKET}/${path}`, {
        method: "POST",
        redirect: "error",
        signal,
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "Content-Type": "image/webp",
          "Cache-Control": "max-age=31536000",
          "x-upsert": "false",
        },
        body: new Uint8Array(data),
      });
      if (!upload.ok) {
        const error = await upload.json().catch(() => null);
        if (error?.error !== "Duplicate" && error?.code !== "Duplicate") {
          throw new Error("Thumbnail upload failed");
        }
      }
      const url = `${supabaseUrl}/storage/v1/object/public/${VAULT_BUCKET}/${path}`;
      return {
        ...post,
        displayUrl: url,
        _musicnerdThumbnail: {
          version: 1,
          url,
          sourceUrl,
          capturedAt: new Date().toISOString(),
          sha256: hash,
          width: info.width,
          height: info.height,
        },
      };
    } catch {
      if (signal.aborted) break;
    }
  }
  if (candidates.length)
    console.warn("[instagramThumbnail] Retention failed", { artistId, postId });
  return post;
}
