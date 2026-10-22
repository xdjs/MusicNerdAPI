/**
 * The vault `type` for an uploaded file, the same for the direct and the
 * signed upload paths.
 *
 * @param mimeType - The resolved MIME type.
 * @returns `image`, `audio`, `data` (CSV and JSON) or `document`.
 */
export function getUploadSourceType(mimeType: string): "image" | "audio" | "data" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "text/csv" || mimeType === "application/json") return "data";
  return "document";
}
