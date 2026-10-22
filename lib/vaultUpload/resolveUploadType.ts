// Extension to canonical MIME type, for files whose browser-reported type is
// empty or nonstandard (commonly "" for .md, sometimes application/octet-stream
// for known types). Kept in step with VAULT_UPLOAD_TYPES.
const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

/**
 * A file's effective MIME type against an allowlist: the browser's type when
 * it is itself allowed, else the type its extension implies. A spoofed binary
 * is still caught by `validateMagicBytes`.
 *
 * @param fileName - The upload's name, for the extension fallback.
 * @param declaredType - The browser-reported type; may be empty or nonstandard.
 * @param allowed - The acceptable MIME types.
 * @returns The resolved type, or null when neither maps to an allowed type.
 */
export function resolveUploadType(
  fileName: string,
  declaredType: string,
  allowed: readonly string[],
): string | null {
  const declared = (declaredType || "").trim().toLowerCase();
  if (declared && allowed.includes(declared)) return declared;

  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  const fromExt = ext ? EXT_TO_MIME[ext] : undefined;
  if (fromExt && allowed.includes(fromExt)) return fromExt;

  return null;
}
